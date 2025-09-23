#!/usr/bin/env node

/**
 * Test enhanced authentication middleware
 * Tests the new AuthMiddleware class and its features
 */

const { AuthMiddleware, checkAuthorization } = require('../src/auth/authMiddleware');
const { buildLogger } = require('../src/utils/logger');

// Mock request objects for testing
function createMockRequest(headers = {}, options = {}) {
  return {
    headers: {
      'user-agent': 'test-client/1.0',
      ...headers
    },
    method: options.method || 'GET',
    url: options.url || '/api/test',
    connection: { remoteAddress: '127.0.0.1' },
    ...options
  };
}

// Mock response object
function createMockResponse() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function testAuthMiddlewareClass() {
  console.log('\n🧪 Testing AuthMiddleware Class');
  
  const testToken = 'test-secure-token-12345';
  const logger = buildLogger('test-auth');
  
  const authMiddleware = new AuthMiddleware({
    apiToken: testToken,
    logger,
    enableLogging: true
  });
  
  console.log('\n1. Testing valid authorization:');
  const validReq = createMockRequest({
    authorization: `Bearer ${testToken}`
  });
  
  const validResult = authMiddleware.isAuthorized(validReq);
  console.log(`   Result: ${validResult.authorized ? '✅ Authorized' : '❌ Not authorized'}`);
  if (!validResult.authorized) {
    console.log(`   Error: ${validResult.error}`);
  }
  
  console.log('\n2. Testing invalid token:');
  const invalidReq = createMockRequest({
    authorization: 'Bearer invalid-token'
  });
  
  const invalidResult = authMiddleware.isAuthorized(invalidReq);
  console.log(`   Result: ${invalidResult.authorized ? '✅ Authorized' : '❌ Not authorized'}`);
  if (!invalidResult.authorized) {
    console.log(`   Error: ${invalidResult.error}`);
  }
  
  console.log('\n3. Testing missing header:');
  const missingReq = createMockRequest();
  
  const missingResult = authMiddleware.isAuthorized(missingReq);
  console.log(`   Result: ${missingResult.authorized ? '✅ Authorized' : '❌ Not authorized'}`);
  if (!missingResult.authorized) {
    console.log(`   Error: ${missingResult.error}`);
  }
  
  console.log('\n4. Testing malformed header:');
  const malformedReq = createMockRequest({
    authorization: 'InvalidFormat token'
  });
  
  const malformedResult = authMiddleware.isAuthorized(malformedReq);
  console.log(`   Result: ${malformedResult.authorized ? '✅ Authorized' : '❌ Not authorized'}`);
  if (!malformedResult.authorized) {
    console.log(`   Error: ${malformedResult.error}`);
  }
  
  console.log('\n5. Testing requireAuth method:');
  const req = createMockRequest({
    authorization: `Bearer ${testToken}`
  });
  const res = createMockResponse();
  
  const authSuccess = authMiddleware.requireAuth(req, res);
  console.log(`   Auth success: ${authSuccess ? '✅' : '❌'}`);
  console.log(`   Response status: ${res.statusCode || 'none'}`);
  if (req.auth) {
    console.log(`   Auth timestamp: ${req.auth.timestamp}`);
  }
}

async function testTokenExtraction() {
  console.log('\n🔍 Testing Token Extraction');
  
  const authMiddleware = new AuthMiddleware({ apiToken: 'test' });
  
  const testCases = [
    {
      name: 'Valid Bearer token',
      headers: { authorization: 'Bearer valid-token-123' },
      expectedValid: true,
      expectedToken: 'valid-token-123'
    },
    {
      name: 'Missing Authorization header',
      headers: {},
      expectedValid: false
    },
    {
      name: 'Wrong format (no Bearer)',
      headers: { authorization: 'token-without-bearer' },
      expectedValid: false
    },
    {
      name: 'Empty token',
      headers: { authorization: 'Bearer ' },
      expectedValid: false
    },
    {
      name: 'Token with extra spaces',
      headers: { authorization: 'Bearer   token-with-spaces   ' },
      expectedValid: true,
      expectedToken: 'token-with-spaces'
    },
    {
      name: 'Case sensitive Bearer',
      headers: { authorization: 'bearer lowercase-bearer' },
      expectedValid: false
    }
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`\n${index + 1}. ${testCase.name}:`);
    
    const req = createMockRequest(testCase.headers);
    const result = authMiddleware.extractToken(req);
    
    console.log(`   Valid: ${result.valid ? '✅' : '❌'} (expected: ${testCase.expectedValid ? '✅' : '❌'})`);
    
    if (result.valid && testCase.expectedToken) {
      console.log(`   Token: "${result.token}" (expected: "${testCase.expectedToken}")`);
      console.log(`   Match: ${result.token === testCase.expectedToken ? '✅' : '❌'}`);
    }
    
    if (!result.valid) {
      console.log(`   Error: ${result.error}`);
    }
    
    const passed = result.valid === testCase.expectedValid && 
                   (!testCase.expectedToken || result.token === testCase.expectedToken);
    console.log(`   Test: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  });
}

async function testClientIPExtraction() {
  console.log('\n🌐 Testing Client IP Extraction');
  
  const authMiddleware = new AuthMiddleware({ apiToken: 'test' });
  
  const testCases = [
    {
      name: 'X-Forwarded-For header',
      headers: { 'x-forwarded-for': '192.168.1.100' },
      expected: '192.168.1.100'
    },
    {
      name: 'X-Real-IP header',
      headers: { 'x-real-ip': '10.0.0.50' },
      expected: '10.0.0.50'
    },
    {
      name: 'Connection remote address',
      connection: { remoteAddress: '127.0.0.1' },
      expected: '127.0.0.1'
    },
    {
      name: 'No IP information',
      headers: {},
      expected: 'unknown'
    }
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`\n${index + 1}. ${testCase.name}:`);
    
    const req = createMockRequest(testCase.headers, {
      connection: testCase.connection
    });
    
    const ip = authMiddleware.getClientIP(req);
    console.log(`   IP: "${ip}" (expected: "${testCase.expected}")`);
    console.log(`   Test: ${ip === testCase.expected ? '✅ PASS' : '❌ FAIL'}`);
  });
}

async function testCheckAuthorizationFunction() {
  console.log('\n⚡ Testing checkAuthorization Function');
  
  const testToken = 'function-test-token';
  
  console.log('\n1. Valid authorization:');
  const validReq = createMockRequest({
    authorization: `Bearer ${testToken}`
  });
  
  const validResult = checkAuthorization(validReq, testToken);
  console.log(`   Authorized: ${validResult.authorized ? '✅' : '❌'}`);
  
  console.log('\n2. Invalid authorization:');
  const invalidReq = createMockRequest({
    authorization: 'Bearer wrong-token'
  });
  
  const invalidResult = checkAuthorization(invalidReq, testToken);
  console.log(`   Authorized: ${invalidResult.authorized ? '✅' : '❌'}`);
  console.log(`   Error: ${invalidResult.error}`);
}

async function testErrorMessages() {
  console.log('\n📝 Testing Error Messages');
  
  const authMiddleware = new AuthMiddleware({
    apiToken: 'test-token',
    enableLogging: false // Disable logging for cleaner test output
  });
  
  const errorCases = [
    {
      name: 'Missing Authorization header',
      req: createMockRequest(),
      expectedError: 'Missing Authorization header'
    },
    {
      name: 'Invalid header format',
      req: createMockRequest({ authorization: 'InvalidFormat' }),
      expectedError: 'Invalid Authorization header format. Expected: Bearer <token>'
    },
    {
      name: 'Empty token',
      req: createMockRequest({ authorization: 'Bearer ' }),
      expectedError: 'Empty token in Authorization header'
    },
    {
      name: 'Invalid token',
      req: createMockRequest({ authorization: 'Bearer wrong-token' }),
      expectedError: 'Invalid token'
    }
  ];
  
  errorCases.forEach((testCase, index) => {
    console.log(`\n${index + 1}. ${testCase.name}:`);
    
    const result = authMiddleware.isAuthorized(testCase.req);
    console.log(`   Authorized: ${result.authorized ? '✅' : '❌'}`);
    console.log(`   Error: "${result.error}"`);
    console.log(`   Expected: "${testCase.expectedError}"`);
    console.log(`   Match: ${result.error === testCase.expectedError ? '✅ PASS' : '❌ FAIL'}`);
  });
}

async function main() {
  console.log('🔐 Enhanced Authentication Middleware Tests');
  
  try {
    await testAuthMiddlewareClass();
    await testTokenExtraction();
    await testClientIPExtraction();
    await testCheckAuthorizationFunction();
    await testErrorMessages();
    
    console.log('\n✅ All authentication tests completed!');
    console.log('\n💡 The enhanced auth middleware provides:');
    console.log('   • Detailed error messages');
    console.log('   • Client IP logging');
    console.log('   • Comprehensive token validation');
    console.log('   • Backward compatibility');
    console.log('   • Enhanced security logging');
    
  } catch (error) {
    console.error('\n❌ Authentication tests failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testAuthMiddlewareClass,
  testTokenExtraction,
  testClientIPExtraction,
  createMockRequest,
  createMockResponse
};
