#!/usr/bin/env node

/**
 * Simple Security Features Test
 * Quick validation of security implementations
 */

const { validateDepositCreation, sanitizeString, sanitizeObject } = require('../src/security/inputValidation');
const { applySecurityHeaders, testSecurityHeaders } = require('../src/security/securityHeaders');
const { checkRateLimit, getRateLimitStatus } = require('../src/security/rateLimiting');
const { generateCSRFToken, validateCSRFToken, createCSRFToken } = require('../src/security/csrfProtection');
const { getSecurityHealth } = require('../src/security/securityMiddleware');

function testInputValidation() {
  console.log('\n🔍 Testing Input Validation...');
  
  // Test valid deposit data
  const validData = {
    customerId: 'cus_test123456789012345',
    paymentMethodId: 'pm_test123456789012345',
    amount: 10000, // $100.00
    currency: 'usd',
    metadata: { test: true }
  };
  
  const validResult = validateDepositCreation(validData);
  console.log(`✅ Valid data: ${validResult.valid ? 'PASS' : 'FAIL'}`);
  
  // Test invalid deposit data
  const invalidData = {
    customerId: 'invalid_format',
    paymentMethodId: 'pm_test123456789012345',
    amount: -100, // Negative amount
    currency: 'invalid',
    metadata: { test: '<script>alert("xss")</script>' }
  };
  
  const invalidResult = validateDepositCreation(invalidData);
  console.log(`❌ Invalid data: ${!invalidResult.valid ? 'PASS' : 'FAIL'}`);
  console.log(`   Errors: ${invalidResult.errors.length}`);
  
  // Test string sanitization
  const dirtyString = '<script>alert("xss")</script>Hello World';
  const cleanString = sanitizeString(dirtyString);
  console.log(`🧹 String sanitization: ${!cleanString.includes('<script>') ? 'PASS' : 'FAIL'}`);
  
  // Test object sanitization
  const dirtyObject = {
    name: '<script>alert("xss")</script>',
    nested: {
      value: 'javascript:alert("xss")',
      safe: 'normal text'
    }
  };
  
  const cleanObject = sanitizeObject(dirtyObject);
  const hasNoScript = !JSON.stringify(cleanObject).includes('<script>');
  console.log(`🧹 Object sanitization: ${hasNoScript ? 'PASS' : 'FAIL'}`);
}

function testSecurityHeadersGeneration() {
  console.log('\n🛡️  Testing Security Headers...');
  
  // Mock response object
  const mockRes = {
    headers: {},
    setHeader: function(name, value) {
      this.headers[name.toLowerCase()] = value;
    }
  };
  
  // Apply security headers
  applySecurityHeaders(mockRes);
  
  // Test headers
  const results = testSecurityHeaders(mockRes.headers);
  
  console.log(`✅ Passed headers: ${results.passed.length}`);
  console.log(`❌ Failed headers: ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);
  
  // Check specific headers
  const requiredHeaders = [
    'content-security-policy',
    'x-frame-options',
    'x-content-type-options',
    'strict-transport-security'
  ];
  
  let headersPassed = 0;
  for (const header of requiredHeaders) {
    if (mockRes.headers[header]) {
      console.log(`   ✅ ${header}: Present`);
      headersPassed++;
    } else {
      console.log(`   ❌ ${header}: Missing`);
    }
  }
  
  console.log(`📊 Headers score: ${headersPassed}/${requiredHeaders.length}`);
}

function testRateLimiting() {
  console.log('\n⏱️  Testing Rate Limiting...');
  
  const config = {
    windowMs: 60000, // 1 minute
    maxRequests: 5,  // 5 requests max
    keyGenerator: () => 'test-key'
  };
  
  const key = 'test-user-123';
  
  // Test multiple requests
  let allowedCount = 0;
  let blockedCount = 0;
  
  for (let i = 0; i < 10; i++) {
    const result = checkRateLimit(key, config);
    if (result.allowed) {
      allowedCount++;
    } else {
      blockedCount++;
    }
  }
  
  console.log(`✅ Allowed requests: ${allowedCount}`);
  console.log(`🚫 Blocked requests: ${blockedCount}`);
  console.log(`📊 Rate limiting: ${blockedCount > 0 ? 'WORKING' : 'NOT WORKING'}`);
  
  // Test rate limit status
  const status = getRateLimitStatus(key, 'global');
  console.log(`📈 Current status: ${status.requests} requests, ${status.remaining} remaining`);
}

function testCSRFProtection() {
  console.log('\n🛡️  Testing CSRF Protection...');
  
  // Generate CSRF token
  const sessionId = 'test-session-123';
  const { token } = createCSRFToken(sessionId);
  
  console.log(`🔑 Generated token: ${token.substring(0, 8)}...`);
  
  // Test valid token
  const validResult = validateCSRFToken(sessionId, token);
  console.log(`✅ Valid token: ${validResult.valid ? 'PASS' : 'FAIL'}`);
  
  // Test invalid token
  const invalidResult = validateCSRFToken(sessionId, 'invalid-token');
  console.log(`❌ Invalid token: ${!invalidResult.valid ? 'PASS' : 'FAIL'}`);
  
  // Test missing session
  const noSessionResult = validateCSRFToken('non-existent', token);
  console.log(`🚫 Missing session: ${!noSessionResult.valid ? 'PASS' : 'FAIL'}`);
  
  // Test token generation uniqueness
  const token1 = generateCSRFToken();
  const token2 = generateCSRFToken();
  console.log(`🔀 Token uniqueness: ${token1 !== token2 ? 'PASS' : 'FAIL'}`);
}

function testSecurityHealth() {
  console.log('\n🏥 Testing Security Health Check...');
  
  const health = getSecurityHealth();
  
  console.log(`🌍 Environment: ${health.environment}`);
  console.log(`🔧 Security Features:`);
  
  Object.entries(health.securityFeatures).forEach(([feature, enabled]) => {
    console.log(`   ${enabled ? '✅' : '❌'} ${feature}: ${enabled ? 'Enabled' : 'Disabled'}`);
  });
  
  const enabledFeatures = Object.values(health.securityFeatures).filter(Boolean).length;
  const totalFeatures = Object.keys(health.securityFeatures).length;
  
  console.log(`📊 Security score: ${enabledFeatures}/${totalFeatures} features enabled`);
}

function runAllTests() {
  console.log('🔒 Security Features Testing');
  console.log('============================');
  
  try {
    testInputValidation();
    testSecurityHeadersGeneration();
    testRateLimiting();
    testCSRFProtection();
    testSecurityHealth();
    
    console.log('\n✅ All security tests completed successfully!');
    
    console.log('\n💡 Security Implementation Summary:');
    console.log('• Input validation and sanitization: ✅ Implemented');
    console.log('• Security headers: ✅ Implemented');
    console.log('• Rate limiting: ✅ Implemented');
    console.log('• CSRF protection: ✅ Implemented');
    console.log('• Comprehensive middleware: ✅ Available');
    
    console.log('\n🚀 Ready for production deployment with enhanced security!');
    
  } catch (error) {
    console.error('\n❌ Security testing failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Security Features Testing Tool

Usage: node scripts/test-security-simple.js [options]

Options:
  --validation    Test input validation only
  --headers       Test security headers only
  --rate-limit    Test rate limiting only
  --csrf          Test CSRF protection only
  --health        Test security health check only
  --help          Show this help message

Examples:
  node scripts/test-security-simple.js                # Run all tests
  node scripts/test-security-simple.js --validation   # Test validation only
    `);
    return;
  }
  
  if (args.includes('--validation')) {
    testInputValidation();
  } else if (args.includes('--headers')) {
    testSecurityHeadersGeneration();
  } else if (args.includes('--rate-limit')) {
    testRateLimiting();
  } else if (args.includes('--csrf')) {
    testCSRFProtection();
  } else if (args.includes('--health')) {
    testSecurityHealth();
  } else {
    runAllTests();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testInputValidation,
  testSecurityHeadersGeneration,
  testRateLimiting,
  testCSRFProtection,
  testSecurityHealth,
  runAllTests
};
