/**
 * Card Verification API
 * POST /api/deposits/verify-card - Verify card and detect currency by BIN
 */

import Stripe from 'stripe';

// BIN to currency mapping for automatic detection
const BIN_CURRENCY_MAP = {
  // Thai cards (THB)
  '434076': 'thb', // Thai card BIN
  '434077': 'thb',
  '434078': 'thb',
  
  // US cards (USD)
  '424242': 'usd', // Stripe test card
  '401288': 'usd',
  '378282': 'usd', // Amex
  
  // European cards (EUR)
  '400000': 'eur',
  '520000': 'eur',
  
  // UK cards (GBP)
  '400001': 'gbp',
  '520001': 'gbp'
};

function detectCurrencyFromBIN(cardNumber) {
  // Remove spaces and get first 6 digits (BIN)
  const bin = cardNumber.replace(/\s/g, '').substring(0, 6);
  
  console.log(`🔍 Detecting currency for BIN: ${bin}`);
  
  // Check exact BIN match
  if (BIN_CURRENCY_MAP[bin]) {
    const currency = BIN_CURRENCY_MAP[bin];
    console.log(`✅ BIN ${bin} detected as ${currency.toUpperCase()}`);
    return currency;
  }
  
  // Check partial BIN matches (first 4 digits)
  const partialBin = bin.substring(0, 4);
  for (const [fullBin, currency] of Object.entries(BIN_CURRENCY_MAP)) {
    if (fullBin.startsWith(partialBin)) {
      console.log(`✅ Partial BIN ${partialBin} detected as ${currency.toUpperCase()}`);
      return currency;
    }
  }
  
  console.log(`⚠️ BIN ${bin} not recognized, defaulting to USD`);
  return 'usd'; // Default fallback
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cardNumber, expiryMonth, expiryYear, cvc } = req.body;

    if (!cardNumber) {
      return res.status(400).json({ 
        error: 'Missing required field: cardNumber' 
      });
    }

    // Detect currency from BIN
    const detectedCurrency = detectCurrencyFromBIN(cardNumber);

    // Determine mode and get appropriate Stripe key
    const mode = req.headers['x-stripe-mode'] || 'test';
    const testKey = process.env.STRIPE_SECRET_KEY;
    const liveKey = process.env.STRIPE_SECRET_KEY_LIVE;
    const stripeKey = mode === 'live' ? liveKey : testKey;

    if (!stripeKey) {
      // Return currency detection even without Stripe key
      return res.status(200).json({
        success: true,
        currency: detectedCurrency,
        note: 'Currency detected by BIN, but Stripe verification unavailable'
      });
    }

    const stripe = new Stripe(stripeKey);

    // Create payment method for verification
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: cardNumber.replace(/\s/g, ''),
        exp_month: parseInt(expiryMonth),
        exp_year: parseInt(expiryYear),
        cvc: cvc
      },
      billing_details: {
        address: {
          postal_code: '12345' // Default postal code
        }
      }
    });

    console.log('✅ Card verified successfully:', {
      id: paymentMethod.id,
      brand: paymentMethod.card.brand,
      last4: paymentMethod.card.last4,
      currency: detectedCurrency
    });

    return res.status(200).json({
      success: true,
      paymentMethod: {
        id: paymentMethod.id,
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        exp_month: paymentMethod.card.exp_month,
        exp_year: paymentMethod.card.exp_year
      },
      currency: detectedCurrency,
      mode
    });

  } catch (error) {
    console.error('❌ Card verification failed:', error);
    
    // Still return currency detection if available
    const { cardNumber } = req.body;
    const detectedCurrency = cardNumber ? detectCurrencyFromBIN(cardNumber) : 'usd';
    
    return res.status(400).json({ 
      error: 'Card verification failed',
      message: error.message,
      currency: detectedCurrency // Still provide currency detection
    });
  }
}
