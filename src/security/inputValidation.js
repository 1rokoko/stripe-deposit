/**
 * Comprehensive Input Validation and Sanitization
 * Protects against common security vulnerabilities
 */

// Validation schemas for different data types
const VALIDATION_SCHEMAS = {
  // Stripe Customer ID validation
  stripeCustomerId: {
    pattern: /^cus_[a-zA-Z0-9]{14,}$/,
    maxLength: 255,
    required: true
  },
  
  // Payment Method ID validation
  stripePaymentMethodId: {
    pattern: /^pm_[a-zA-Z0-9]{14,}$/,
    maxLength: 255,
    required: true
  },
  
  // Payment Intent ID validation
  stripePaymentIntentId: {
    pattern: /^pi_[a-zA-Z0-9]{14,}$/,
    maxLength: 255,
    required: false
  },
  
  // Amount validation (in cents)
  amount: {
    type: 'integer',
    min: 100,        // $1.00 minimum
    max: 100000000,  // $1,000,000 maximum
    required: true
  },
  
  // Currency validation
  currency: {
    pattern: /^[a-z]{3}$/,
    enum: ['usd', 'eur', 'gbp', 'cad', 'aud'],
    required: true
  },
  
  // Email validation
  email: {
    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    maxLength: 254,
    required: false
  },
  
  // General string validation
  string: {
    type: 'string',
    maxLength: 1000,
    required: false
  },
  
  // Metadata validation
  metadata: {
    type: 'object',
    maxKeys: 50,
    maxValueLength: 500,
    required: false
  }
};

/**
 * Sanitize string input to prevent XSS and injection attacks
 */
function sanitizeString(input) {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[<>]/g, '')           // Remove potential HTML tags
    .replace(/['"]/g, '')           // Remove quotes to prevent injection
    .replace(/javascript:/gi, '')   // Remove javascript: protocol
    .replace(/on\w+=/gi, '')        // Remove event handlers
    .substring(0, 1000);            // Limit length
}

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj, maxDepth = 3) {
  if (maxDepth <= 0 || obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.slice(0, 100).map(item => sanitizeObject(item, maxDepth - 1));
  }
  
  const sanitized = {};
  const keys = Object.keys(obj).slice(0, 50); // Limit number of keys
  
  for (const key of keys) {
    const sanitizedKey = sanitizeString(key);
    if (sanitizedKey) {
      const value = obj[key];
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[sanitizedKey] = sanitizeObject(value, maxDepth - 1);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }
  }
  
  return sanitized;
}

/**
 * Validate individual field against schema
 */
function validateField(value, schema, fieldName) {
  const errors = [];
  
  // Check if required
  if (schema.required && (value === undefined || value === null || value === '')) {
    errors.push(`${fieldName} is required`);
    return errors;
  }
  
  // Skip validation if not required and empty
  if (!schema.required && (value === undefined || value === null || value === '')) {
    return errors;
  }
  
  // Type validation
  if (schema.type) {
    if (schema.type === 'integer' && !Number.isInteger(value)) {
      errors.push(`${fieldName} must be an integer`);
    } else if (schema.type === 'string' && typeof value !== 'string') {
      errors.push(`${fieldName} must be a string`);
    } else if (schema.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
      errors.push(`${fieldName} must be an object`);
    }
  }
  
  // Pattern validation
  if (schema.pattern && typeof value === 'string' && !schema.pattern.test(value)) {
    errors.push(`${fieldName} has invalid format`);
  }
  
  // Enum validation
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${fieldName} must be one of: ${schema.enum.join(', ')}`);
  }
  
  // Length validation
  if (schema.maxLength && typeof value === 'string' && value.length > schema.maxLength) {
    errors.push(`${fieldName} must be no longer than ${schema.maxLength} characters`);
  }
  
  // Numeric range validation
  if (schema.min !== undefined && typeof value === 'number' && value < schema.min) {
    errors.push(`${fieldName} must be at least ${schema.min}`);
  }
  
  if (schema.max !== undefined && typeof value === 'number' && value > schema.max) {
    errors.push(`${fieldName} must be no more than ${schema.max}`);
  }
  
  // Object validation
  if (schema.type === 'object' && typeof value === 'object') {
    const keys = Object.keys(value);
    
    if (schema.maxKeys && keys.length > schema.maxKeys) {
      errors.push(`${fieldName} must have no more than ${schema.maxKeys} properties`);
    }
    
    if (schema.maxValueLength) {
      for (const [key, val] of Object.entries(value)) {
        if (typeof val === 'string' && val.length > schema.maxValueLength) {
          errors.push(`${fieldName}.${key} must be no longer than ${schema.maxValueLength} characters`);
        }
      }
    }
  }
  
  return errors;
}

/**
 * Validate deposit creation data
 */
function validateDepositCreation(data) {
  const errors = [];
  
  // Validate required fields
  const requiredFields = {
    customerId: VALIDATION_SCHEMAS.stripeCustomerId,
    paymentMethodId: VALIDATION_SCHEMAS.stripePaymentMethodId,
    amount: VALIDATION_SCHEMAS.amount,
    currency: VALIDATION_SCHEMAS.currency
  };
  
  for (const [field, schema] of Object.entries(requiredFields)) {
    const fieldErrors = validateField(data[field], schema, field);
    errors.push(...fieldErrors);
  }
  
  // Validate optional fields
  const optionalFields = {
    metadata: VALIDATION_SCHEMAS.metadata,
    description: VALIDATION_SCHEMAS.string
  };
  
  for (const [field, schema] of Object.entries(optionalFields)) {
    if (data[field] !== undefined) {
      const fieldErrors = validateField(data[field], schema, field);
      errors.push(...fieldErrors);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? sanitizeDepositData(data) : null
  };
}

/**
 * Validate deposit capture data
 */
function validateDepositCapture(data) {
  const errors = [];
  
  // Amount is optional for capture (can capture full amount)
  if (data.amount !== undefined) {
    const amountErrors = validateField(data.amount, VALIDATION_SCHEMAS.amount, 'amount');
    errors.push(...amountErrors);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? { amount: data.amount } : null
  };
}

/**
 * Sanitize deposit data
 */
function sanitizeDepositData(data) {
  return {
    customerId: sanitizeString(data.customerId),
    paymentMethodId: sanitizeString(data.paymentMethodId),
    amount: parseInt(data.amount, 10),
    currency: sanitizeString(data.currency).toLowerCase(),
    metadata: data.metadata ? sanitizeObject(data.metadata) : {},
    description: data.description ? sanitizeString(data.description) : undefined
  };
}

/**
 * Validate webhook data
 */
function validateWebhookData(data) {
  const errors = [];
  
  // Basic webhook validation
  if (!data || typeof data !== 'object') {
    errors.push('Webhook data must be an object');
    return { valid: false, errors };
  }
  
  if (!data.type || typeof data.type !== 'string') {
    errors.push('Webhook type is required');
  }
  
  if (!data.id || typeof data.id !== 'string') {
    errors.push('Webhook id is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? sanitizeObject(data) : null
  };
}

/**
 * Express middleware for request validation
 */
function createValidationMiddleware(validationType) {
  return (req, res, next) => {
    let result;
    
    switch (validationType) {
      case 'depositCreation':
        result = validateDepositCreation(req.body);
        break;
      case 'depositCapture':
        result = validateDepositCapture(req.body);
        break;
      case 'webhook':
        result = validateWebhookData(req.body);
        break;
      default:
        return res.status(500).json({ error: 'Invalid validation type' });
    }
    
    if (!result.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.errors
      });
    }
    
    // Add sanitized data to request
    req.validatedData = result.sanitizedData;
    next();
  };
}

/**
 * Validate and sanitize query parameters
 */
function validateQueryParams(query, allowedParams = []) {
  const sanitized = {};
  const errors = [];
  
  for (const [key, value] of Object.entries(query)) {
    const sanitizedKey = sanitizeString(key);
    
    if (!allowedParams.includes(sanitizedKey)) {
      errors.push(`Unknown query parameter: ${sanitizedKey}`);
      continue;
    }
    
    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[sanitizedKey] = value.slice(0, 10).map(v => sanitizeString(String(v)));
    } else {
      sanitized[sanitizedKey] = String(value);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitizedQuery: sanitized
  };
}

module.exports = {
  VALIDATION_SCHEMAS,
  sanitizeString,
  sanitizeObject,
  validateField,
  validateDepositCreation,
  validateDepositCapture,
  validateWebhookData,
  validateQueryParams,
  createValidationMiddleware,
  sanitizeDepositData
};
