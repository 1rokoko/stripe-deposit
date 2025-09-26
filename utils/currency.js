// Currency configuration and utilities
export const SUPPORTED_CURRENCIES = {
  usd: {
    code: 'usd',
    symbol: '$',
    name: 'US Dollar',
    minAmount: 100, // $1.00
    maxAmount: 1000000, // $10,000.00
    decimals: 2,
    zeroDecimalCurrency: false
  },
  eur: {
    code: 'eur',
    symbol: '€',
    name: 'Euro',
    minAmount: 100, // €1.00
    maxAmount: 1000000, // €10,000.00
    decimals: 2,
    zeroDecimalCurrency: false
  },
  gbp: {
    code: 'gbp',
    symbol: '£',
    name: 'British Pound',
    minAmount: 100, // £1.00
    maxAmount: 1000000, // £10,000.00
    decimals: 2,
    zeroDecimalCurrency: false
  },
  rub: {
    code: 'rub',
    symbol: '₽',
    name: 'Russian Ruble',
    minAmount: 10000, // ₽100.00
    maxAmount: 100000000, // ₽1,000,000.00
    decimals: 2,
    zeroDecimalCurrency: false
  },
  jpy: {
    code: 'jpy',
    symbol: '¥',
    name: 'Japanese Yen',
    minAmount: 100, // ¥100
    maxAmount: 1000000, // ¥1,000,000
    decimals: 0,
    zeroDecimalCurrency: true
  },
  cad: {
    code: 'cad',
    symbol: 'C$',
    name: 'Canadian Dollar',
    minAmount: 100, // C$1.00
    maxAmount: 1000000, // C$10,000.00
    decimals: 2,
    zeroDecimalCurrency: false
  },
  aud: {
    code: 'aud',
    symbol: 'A$',
    name: 'Australian Dollar',
    minAmount: 100, // A$1.00
    maxAmount: 1000000, // A$10,000.00
    decimals: 2,
    zeroDecimalCurrency: false
  },
  chf: {
    code: 'chf',
    symbol: 'CHF',
    name: 'Swiss Franc',
    minAmount: 100, // CHF 1.00
    maxAmount: 1000000, // CHF 10,000.00
    decimals: 2,
    zeroDecimalCurrency: false
  },
  sek: {
    code: 'sek',
    symbol: 'kr',
    name: 'Swedish Krona',
    minAmount: 1000, // 10.00 kr
    maxAmount: 10000000, // 100,000.00 kr
    decimals: 2,
    zeroDecimalCurrency: false
  },
  nok: {
    code: 'nok',
    symbol: 'kr',
    name: 'Norwegian Krone',
    minAmount: 1000, // 10.00 kr
    maxAmount: 10000000, // 100,000.00 kr
    decimals: 2,
    zeroDecimalCurrency: false
  },
  thb: {
    code: 'thb',
    symbol: '฿',
    name: 'Thai Baht',
    minAmount: 3000, // ฿30.00
    maxAmount: 35000000, // ฿350,000.00
    decimals: 2,
    zeroDecimalCurrency: false
  },
  sgd: {
    code: 'sgd',
    symbol: 'S$',
    name: 'Singapore Dollar',
    minAmount: 100, // S$1.00
    maxAmount: 1500000, // S$15,000.00
    decimals: 2,
    zeroDecimalCurrency: false
  },
  hkd: {
    code: 'hkd',
    symbol: 'HK$',
    name: 'Hong Kong Dollar',
    minAmount: 800, // HK$8.00
    maxAmount: 8000000, // HK$80,000.00
    decimals: 2,
    zeroDecimalCurrency: false
  },
  myr: {
    code: 'myr',
    symbol: 'RM',
    name: 'Malaysian Ringgit',
    minAmount: 400, // RM4.00
    maxAmount: 4500000, // RM45,000.00
    decimals: 2,
    zeroDecimalCurrency: false
  },
  inr: {
    code: 'inr',
    symbol: '₹',
    name: 'Indian Rupee',
    minAmount: 8000, // ₹80.00
    maxAmount: 80000000, // ₹800,000.00
    decimals: 2,
    zeroDecimalCurrency: false
  }
};

// Get currency configuration
export function getCurrencyConfig(currencyCode) {
  const currency = SUPPORTED_CURRENCIES[currencyCode?.toLowerCase()];
  if (!currency) {
    throw new Error(`Unsupported currency: ${currencyCode}`);
  }
  return currency;
}

// Format amount for display
export function formatCurrency(amount, currencyCode) {
  const currency = getCurrencyConfig(currencyCode);
  
  if (currency.zeroDecimalCurrency) {
    // For zero-decimal currencies like JPY, amount is already in the main unit
    return `${currency.symbol}${amount.toLocaleString()}`;
  } else {
    // For decimal currencies, convert from cents to main unit
    const mainAmount = amount / 100;
    return `${currency.symbol}${mainAmount.toFixed(currency.decimals)}`;
  }
}

// Convert amount to Stripe format (smallest currency unit)
export function toStripeAmount(amount, currencyCode) {
  const currency = getCurrencyConfig(currencyCode);
  
  if (currency.zeroDecimalCurrency) {
    // For zero-decimal currencies, amount is already in smallest unit
    return Math.round(amount);
  } else {
    // For decimal currencies, convert to cents
    return Math.round(amount * 100);
  }
}

// Convert from Stripe format to display amount
export function fromStripeAmount(stripeAmount, currencyCode) {
  const currency = getCurrencyConfig(currencyCode);
  
  if (currency.zeroDecimalCurrency) {
    // For zero-decimal currencies, amount is already in main unit
    return stripeAmount;
  } else {
    // For decimal currencies, convert from cents
    return stripeAmount / 100;
  }
}

// Validate amount for currency
export function validateAmount(amount, currencyCode) {
  const currency = getCurrencyConfig(currencyCode);
  const stripeAmount = toStripeAmount(amount, currencyCode);
  
  if (stripeAmount < currency.minAmount) {
    return {
      valid: false,
      error: `Amount must be at least ${formatCurrency(currency.minAmount, currencyCode)}`
    };
  }
  
  if (stripeAmount > currency.maxAmount) {
    return {
      valid: false,
      error: `Amount must not exceed ${formatCurrency(currency.maxAmount, currencyCode)}`
    };
  }
  
  return { valid: true };
}

// Get default currency based on locale/country
export function getDefaultCurrency(locale = 'en-US') {
  const currencyMap = {
    'en-US': 'usd',
    'en-GB': 'gbp',
    'en-CA': 'cad',
    'en-AU': 'aud',
    'de-DE': 'eur',
    'fr-FR': 'eur',
    'es-ES': 'eur',
    'it-IT': 'eur',
    'nl-NL': 'eur',
    'ru-RU': 'rub',
    'ja-JP': 'jpy',
    'sv-SE': 'sek',
    'nb-NO': 'nok',
    'de-CH': 'chf'
  };
  
  return currencyMap[locale] || 'usd';
}

// Get currency list for dropdown
export function getCurrencyOptions() {
  return Object.values(SUPPORTED_CURRENCIES).map(currency => ({
    value: currency.code,
    label: `${currency.symbol} ${currency.name}`,
    symbol: currency.symbol
  }));
}

// BIN to country/currency mapping (first 6 digits of card)
const BIN_CURRENCY_MAP = {
  // Thailand
  '434076': 'thb', // Kasikorn Bank
  '434077': 'thb', // Kasikorn Bank
  '434078': 'thb', // Kasikorn Bank
  '520000': 'thb', // Bangkok Bank
  '520001': 'thb', // Bangkok Bank
  '542702': 'thb', // Siam Commercial Bank
  '542703': 'thb', // Siam Commercial Bank
  '491234': 'thb', // Krung Thai Bank

  // Singapore
  '540616': 'sgd', // DBS Bank
  '540617': 'sgd', // DBS Bank
  '540618': 'sgd', // OCBC Bank
  '540619': 'sgd', // UOB Bank

  // Hong Kong
  '540120': 'hkd', // HSBC Hong Kong
  '540121': 'hkd', // HSBC Hong Kong
  '540122': 'hkd', // Standard Chartered HK

  // Malaysia
  '540123': 'myr', // Maybank
  '540124': 'myr', // CIMB Bank
  '540125': 'myr', // Public Bank

  // India
  '540126': 'inr', // State Bank of India
  '540127': 'inr', // HDFC Bank
  '540128': 'inr', // ICICI Bank

  // Russia
  '540129': 'rub', // Sberbank
  '540130': 'rub', // VTB Bank

  // Europe
  '540131': 'eur', // European banks
  '540132': 'eur', // European banks

  // UK
  '540133': 'gbp', // UK banks
  '540134': 'gbp', // UK banks

  // US/International
  '424242': 'usd', // Test cards
  '400000': 'usd', // Visa US
  '510000': 'usd', // Mastercard US
};

// Detect currency from card BIN (Bank Identification Number)
export function detectCurrencyFromBIN(cardNumber) {
  if (!cardNumber || cardNumber.length < 6) {
    return null;
  }

  // Remove spaces and get first 6 digits
  const bin = cardNumber.replace(/\s/g, '').substring(0, 6);

  // Check exact BIN match
  if (BIN_CURRENCY_MAP[bin]) {
    return BIN_CURRENCY_MAP[bin];
  }

  // Check partial matches for common patterns
  const binPrefix = bin.substring(0, 4);

  // Thailand common BIN patterns
  if (binPrefix === '4340' || binPrefix === '5200' || binPrefix === '5427' || binPrefix === '4912') {
    return 'thb';
  }

  // Singapore patterns
  if (binPrefix === '5406' && bin.substring(4, 6) >= '16' && bin.substring(4, 6) <= '19') {
    return 'sgd';
  }

  // Default fallback
  return null;
}

// Detect currency from browser locale
export function detectCurrency() {
  if (typeof window !== 'undefined' && window.navigator) {
    const locale = window.navigator.language || window.navigator.languages?.[0] || 'en-US';
    return getDefaultCurrency(locale);
  }
  return 'usd';
}

// Smart currency detection combining BIN and locale
export function smartDetectCurrency(cardNumber = '') {
  // First try BIN detection if card number provided
  if (cardNumber) {
    const binCurrency = detectCurrencyFromBIN(cardNumber);
    if (binCurrency) {
      return binCurrency;
    }
  }

  // Fallback to locale detection
  return detectCurrency();
}
