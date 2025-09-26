export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-stripe-mode');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const {
      amount,
      customerId,
      paymentMethodId,
      currency = 'usd',
      metadata = {},
      verifyCard = false
    } = req.body;

    // Validate required fields
    if (!amount || !customerId || !paymentMethodId) {
      return res.status(400).json({
        error: 'Missing required fields: amount, customerId, paymentMethodId'
      });
    }

    // Import currency utilities
    const { getCurrencyConfig, validateAmount, toStripeAmount } = require('../../utils/currency');

    // Validate currency
    let currencyConfig;
    try {
      currencyConfig = getCurrencyConfig(currency);
    } catch (error) {
      return res.status(400).json({
        error: `Unsupported currency: ${currency}`
      });
    }

    // Validate amount for the selected currency
    const amountValue = parseFloat(amount);
    const validation = validateAmount(amountValue, currency);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error
      });
    }

    // Convert to Stripe format (smallest currency unit)
    const amountInCents = toStripeAmount(amountValue, currency);

    // Get mode from headers or default to test
    const mode = req.headers['x-stripe-mode'] || 'test';
    
    // Import Stripe with appropriate key
    const stripe = require('stripe')(
      mode === 'live' 
        ? process.env.STRIPE_SECRET_KEY_LIVE 
        : process.env.STRIPE_SECRET_KEY
    );

    console.log(`🔄 Creating payment intent in ${mode} mode for ${currencyConfig.symbol}${amount}`, {
      mode,
      amount,
      currency,
      customerId,
      paymentMethodId
    });

    // Create or retrieve customer
    let customer;
    try {
      // Try to retrieve existing customer by our custom ID in metadata
      const customers = await stripe.customers.list({
        limit: 1,
        metadata: {
          custom_id: customerId
        }
      });

      if (customers.data.length > 0) {
        customer = customers.data[0];
        console.log(`✅ Found existing customer: ${customer.id} with custom_id: ${customerId}`);
      } else {
        throw new Error('Customer not found');
      }
    } catch (error) {
      // Customer doesn't exist, create new one
      console.log(`🔄 Creating new customer with custom_id: ${customerId}`);
      customer = await stripe.customers.create({
        metadata: {
          custom_id: customerId,
          created_via: 'deposit_api_3ds',
          mode: mode,
          created_at: new Date().toISOString()
        }
      });
      console.log(`✅ Customer created: ${customer.id} with custom_id: ${customerId}`);
    }

    // Attach payment method to customer
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      });
      console.log(`✅ Payment method attached to customer`);
    } catch (error) {
      // Payment method might already be attached, which is fine
      if (error.code !== 'resource_already_exists') {
        throw error;
      }
      console.log(`ℹ️ Payment method already attached to customer`);
    }

    let verificationResult = null;

    // ALWAYS verify card with $3 charge (required for all deposits)
    console.log(`🔄 Performing mandatory card verification with $3 charge`);
    try {
      // Calculate $3 equivalent in the selected currency
      const verificationAmount = currency === 'jpy' ? 300 : 300; // $3 or ¥300 (adjust for other currencies if needed)

      const verificationIntent = await stripe.paymentIntents.create({
        amount: verificationAmount,
        currency: currency.toLowerCase(),
        customer: customer.id,
        payment_method: paymentMethodId,
        confirmation_method: 'automatic',
        confirm: true,
        return_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://stripe-deposit.vercel.app'}/deposit-status`,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never' // Prevent redirect-based payment methods
        },
        description: 'Card verification charge - will be refunded automatically',
        metadata: {
          type: 'verification',
          mode: mode,
          created_at: new Date().toISOString(),
          deposit_currency: currency,
          deposit_amount: amount
        }
      });

      // Immediately refund the verification charge
      const refund = await stripe.refunds.create({
        payment_intent: verificationIntent.id,
        reason: 'requested_by_customer',
        metadata: {
          type: 'verification_refund',
          original_payment_intent: verificationIntent.id,
          deposit_currency: currency,
          deposit_amount: amount
        }
      });

      verificationResult = {
        payment_intent_id: verificationIntent.id,
        refund_id: refund.id,
        amount: verificationAmount,
        currency: currency,
        status: verificationIntent.status
      };

      console.log(`✅ Card verification completed: ${verificationIntent.id}, refunded: ${refund.id}`);
    } catch (verificationError) {
      console.error('❌ Card verification failed:', verificationError.message);
      return res.status(400).json({
        error: `Card verification failed: ${verificationError.message}`,
        type: 'verification_failed',
        code: verificationError.code,
        decline_code: verificationError.decline_code
      });
    }

    // Create payment intent WITHOUT immediate confirmation for 3D Secure support
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      customer: customer.id,
      payment_method: paymentMethodId,
      capture_method: 'manual', // This creates a hold/authorization
      confirmation_method: 'automatic', // Allow frontend to confirm with 3D Secure
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://stripe-deposit.vercel.app'}/deposit-status`,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never' // Prevent redirect-based payment methods
      },
      // DO NOT set confirm: true - this allows 3D Secure authentication
      metadata: {
        created_via: 'deposit_api_3ds',
        mode: mode,
        original_amount: amount,
        currency: currency,
        verified_card: 'true', // Always true now since verification is mandatory
        verification_intent: verificationResult?.payment_intent_id || 'none',
        verification_refund: verificationResult?.refund_id || 'none',
        ...metadata
      }
    });

    console.log(`✅ Payment intent created: ${paymentIntent.id} with status: ${paymentIntent.status}`);

    // Return the client_secret for frontend confirmation
    return res.status(200).json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        amount: amountInCents,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        customerId: customer.id,
        created: new Date().toISOString(),
        metadata: paymentIntent.metadata
      },
      verification: verificationResult,
      message: 'Card verified with $3 charge (refunded) and deposit amount authorized - ready for confirmation',
      mode
    });

  } catch (error) {
    console.error('❌ Error creating payment intent:', {
      error: error.message,
      type: error.type,
      code: error.code,
      param: error.param,
      decline_code: error.decline_code,
      mode: req.headers['x-stripe-mode'] || 'test',
      stack: error.stack
    });

    // Handle specific Stripe errors with more detailed information
    if (error.type === 'StripeCardError') {
      return res.status(400).json({
        error: 'Card was declined',
        details: error.message,
        code: error.code,
        decline_code: error.decline_code,
        param: error.param
      });
    }

    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.message,
        code: error.code,
        param: error.param,
        stripe_error_type: error.type
      });
    }

    if (error.type === 'StripeAuthenticationError') {
      return res.status(401).json({
        error: 'Authentication failed',
        details: 'Invalid Stripe API key for ' + (req.headers['x-stripe-mode'] || 'test') + ' mode',
        mode: req.headers['x-stripe-mode'] || 'test'
      });
    }

    if (error.type === 'StripeRateLimitError') {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        details: error.message
      });
    }

    if (error.type === 'StripeConnectionError') {
      return res.status(502).json({
        error: 'Connection error',
        details: 'Unable to connect to Stripe'
      });
    }

    return res.status(500).json({
      error: 'Failed to create payment intent',
      details: error.message,
      type: error.type,
      mode: req.headers['x-stripe-mode'] || 'test'
    });
  }
}
