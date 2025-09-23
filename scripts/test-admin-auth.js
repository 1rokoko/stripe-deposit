#!/usr/bin/env node

/**
 * Test Admin Authentication
 */

const { verifyAdminCredentials, hashPassword, generateAdminToken } = require('../lib/admin-auth');

console.log('🔐 Testing Admin Authentication...\n');

// Test password hashing
console.log('Testing password hashing:');
const testPassword = 'admin123';
const hashedPassword = hashPassword(testPassword);
console.log(`Password: ${testPassword}`);
console.log(`Hashed: ${hashedPassword}`);

// Expected hash for 'admin123'
const expectedHash = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
console.log(`Expected: ${expectedHash}`);
console.log(`Match: ${hashedPassword === expectedHash}\n`);

// Test admin credentials
console.log('Testing admin credentials:');
const adminResult = verifyAdminCredentials('admin@stripe-deposit.com', 'admin123');
console.log('Admin result:', adminResult);

const managerResult = verifyAdminCredentials('manager@stripe-deposit.com', 'manager123');
console.log('Manager result:', managerResult);

const invalidResult = verifyAdminCredentials('invalid@example.com', 'wrongpassword');
console.log('Invalid result:', invalidResult);

// Test token generation
if (adminResult) {
  console.log('\nTesting token generation:');
  const token = generateAdminToken(adminResult);
  console.log('Generated token:', token.substring(0, 50) + '...');
}

console.log('\n✅ Admin auth testing completed!');
