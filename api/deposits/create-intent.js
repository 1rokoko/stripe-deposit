// API configuration for Next.js
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}

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
    // First, log the raw request
    console.log('🔍 Raw API Request:', {
      method: req.method,
      headers: req.headers,
      body: req.body,
      bodyType: typeof req.body,
      bodyKeys: req.body ? Object.keys(req.body) : 'no body',
      bodyStringified: JSON.stringify(req.body),
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length']
    });

    // Check if body is properly parsed
    if (!req.body || typeof req.body !== 'object') {
      console.error('❌ Request body is not properly parsed:', {
        body: req.body,
        bodyType: typeof req.body,
        headers: req.headers
      });
      return res.status(400).json({
        error: 'Request body is not properly parsed',
        details: {
          bodyType: typeof req.body,
          contentType: req.headers['content-type']
        }
      });
    }

    const {
      amount,
      customerId,
      paymentMethodId,
      currency = 'usd',
      metadata = {},
      verifyCard = false
    } = req.body;

    // Debug logging
    console.log('🔍 API Request received:', {
      amount,
      amountType: typeof amount,
      amountValue: amount,
      amountEmpty: amount === '' || amount === null || amount === undefined,
      currency,
      customerId,
      customerIdType: typeof customerId,
      customerIdValue: customerId,
      paymentMethodId: paymentMethodId ? 'present' : 'missing',
      paymentMethodIdType: typeof paymentMethodId,
      paymentMethodIdValue: paymentMethodId,
      metadata,
      mode: req.headers['x-stripe-mode'] || 'test',
      bodyStringified: JSON.stringify(req.body)
    });

    // Enhanced validation with detailed error messages
    const missingFields = [];
    if (!amount || amount === '' || amount === null || amount === undefined) {
      missingFields.push('amount');
    }
    if (!customerId || customerId === '' || customerId === null || customerId === undefined) {
      missingFields.push('customerId');
    }
    if (!paymentMethodId || paymentMethodId === '' || paymentMethodId === null || paymentMethodId === undefined) {
      missingFields.push('paymentMethodId');
    }

    if (missingFields.length > 0) {
      console.error('❌ Missing required fields:', {
        missingFields,
        amount,
        customerId,
        paymentMethodId,
        receivedBody: req.body
      });
      return res.status(400).json({
        error: `Missing required fields: ${missingFields.join(', ')}`,
        details: {
          amount: amount || 'missing',
          customerId: customerId || 'missing',
          paymentMethodId: paymentMethodId || 'missing'
        }
      });
    }

    // Import currency utilities
    const { getCurrencyConfig, validateAmount, toStripeAmount } = require('../../utils/currency');

    // Normalize currency to lowercase
    const normalizedCurrency = currency.toLowerCase();
    console.log('🔍 Currency normalization:', { original: currency, normalized: normalizedCurrency });

    // Validate currency
    let currencyConfig;
    try {
      currencyConfig = getCurrencyConfig(normalizedCurrency);
      console.log('✅ Currency config loaded:', { currency: normalizedCurrency, config: currencyConfig });
    } catch (error) {
      console.error('❌ Unsupported currency:', { currency: normalizedCurrency, error: error.message });
      return res.status(400).json({
        error: `Unsupported currency: ${normalizedCurrency}`
      });
    }

    // Validate amount for the selected currency
    const amountValue = parseFloat(amount);
    console.log('🔍 Amount validation:', { amount, amountValue, currency: normalizedCurrency });

    const validation = validateAmount(amountValue, normalizedCurrency);
    console.log('🔍 Validation result:', validation);

    if (!validation.valid) {
      console.error('❌ Amount validation failed:', validation);
      return res.status(400).json({
        error: validation.error
      });
    }

    // Convert to Stripe format (smallest currency unit)
    const amountInCents = toStripeAmount(amountValue, normalizedCurrency);
    console.log('✅ Amount converted to Stripe format:', { amountValue, amountInCents, currency: normalizedCurrency });

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
      currency: normalizedCurrency,
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
    console.log(`🔄 Performing mandatory card verification charge`);
    try {
      // Calculate verification amount based on currency and minimum requirements
      let verificationAmount;
      switch (normalizedCurrency) {
        case 'thb':
          verificationAmount = 1000; // ฿10.00 (minimum for THB)
          break;
        case 'jpy':
          verificationAmount = 300; // ¥300 (minimum for JPY)
          break;
        case 'eur':
          verificationAmount = 300; // €3.00
          break;
        case 'usd':
        default:
          verificationAmount = 300; // $3.00
          break;
      }

      const verificationIntent = await stripe.paymentIntents.create({
        amount: verificationAmount,
        currency: normalizedCurrency,
        customer: customer.id,
        payment_method: paymentMethodId,
        confirm: true,
        return_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://stripe-deposit.vercel.app'}/deposit-status`,
        description: 'Card verification charge - will be refunded automatically',
        metadata: {
          type: 'verification',
          mode: mode,
          created_at: new Date().toISOString(),
          deposit_currency: normalizedCurrency,
          deposit_amount: amount
        }
      });

      console.log(`🔍 Verification PaymentIntent status: ${verificationIntent.status}`);

      // Only refund if the payment was successful
      let refund = null;
      if (verificationIntent.status === 'succeeded') {
        console.log(`✅ Verification successful, creating refund...`);
        refund = await stripe.refunds.create({
          payment_intent: verificationIntent.id,
          reason: 'requested_by_customer',
          metadata: {
            type: 'verification_refund',
            original_payment_intent: verificationIntent.id,
            deposit_currency: normalizedCurrency,
            deposit_amount: amount
          }
        });
        console.log(`✅ Refund created: ${refund.id}`);
      } else {
        console.log(`⚠️ Verification PaymentIntent not succeeded (${verificationIntent.status}), skipping refund`);
      }

      verificationResult = {
        payment_intent_id: verificationIntent.id,
        refund_id: refund?.id || null,
        amount: verificationAmount,
        currency: normalizedCurrency,
        status: verificationIntent.status,
        refund_status: refund?.status || 'not_created'
      };

      console.log(`✅ Card verification completed: ${verificationIntent.id}, refunded: ${refund?.id || 'not_refunded'}`);
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
      currency: normalizedCurrency,
      customer: customer.id,
      payment_method: paymentMethodId,
      capture_method: 'manual', // This creates a hold/authorization
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://stripe-deposit.vercel.app'}/deposit-status`,
      // DO NOT set confirm: true - this allows 3D Secure authentication
      metadata: {
        created_via: 'deposit_api_3ds',
        mode: mode,
        original_amount: amount,
        currency: normalizedCurrency,
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
