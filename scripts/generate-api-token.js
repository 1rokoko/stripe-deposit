#!/usr/bin/env node

/**
 * Generate secure API tokens for authentication
 * Provides various token formats and security levels
 */

const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

/**
 * Generate cryptographically secure random token
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate base64 token
 */
function generateBase64Token(length = 32) {
  return crypto.randomBytes(length).toString('base64').replace(/[+/=]/g, '');
}

/**
 * Generate URL-safe token
 */
function generateUrlSafeToken(length = 32) {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Generate UUID-based token
 */
function generateUuidToken() {
  return crypto.randomUUID().replace(/-/g, '');
}

/**
 * Generate prefixed token (like API keys)
 */
function generatePrefixedToken(prefix = 'sdt', length = 32) {
  const token = crypto.randomBytes(length).toString('hex');
  return `${prefix}_${token}`;
}

/**
 * Validate token strength
 */
function validateTokenStrength(token) {
  const checks = {
    length: token.length >= 32,
    entropy: calculateEntropy(token) >= 4.0,
    noCommonPatterns: !hasCommonPatterns(token),
    noSequential: !hasSequentialChars(token)
  };

  const score = Object.values(checks).filter(Boolean).length;
  const strength = score >= 4 ? 'Strong' : score >= 3 ? 'Medium' : 'Weak';

  return { checks, score, strength };
}

function calculateEntropy(str) {
  const freq = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  
  let entropy = 0;
  const len = str.length;
  
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  
  return entropy;
}

function hasCommonPatterns(token) {
  const patterns = [
    /(.)\1{3,}/, // Repeated characters
    /123|abc|qwe|password|admin|test/i, // Common sequences
    /^[0-9]+$/, // Only numbers
    /^[a-z]+$/i // Only letters
  ];
  
  return patterns.some(pattern => pattern.test(token));
}

function hasSequentialChars(token) {
  for (let i = 0; i < token.length - 2; i++) {
    const char1 = token.charCodeAt(i);
    const char2 = token.charCodeAt(i + 1);
    const char3 = token.charCodeAt(i + 2);
    
    if (char2 === char1 + 1 && char3 === char2 + 1) {
      return true;
    }
  }
  return false;
}

/**
 * Display token with security analysis
 */
function displayToken(name, token) {
  console.log(`\n📋 ${name}:`);
  console.log(`🔑 Token: ${token}`);
  console.log(`📏 Length: ${token.length} characters`);
  
  const analysis = validateTokenStrength(token);
  console.log(`💪 Strength: ${analysis.strength}`);
  console.log(`📊 Entropy: ${calculateEntropy(token).toFixed(2)} bits`);
  
  console.log('✅ Security Checks:');
  console.log(`   Length ≥32: ${analysis.checks.length ? '✅' : '❌'}`);
  console.log(`   High Entropy: ${analysis.checks.entropy ? '✅' : '❌'}`);
  console.log(`   No Common Patterns: ${analysis.checks.noCommonPatterns ? '✅' : '❌'}`);
  console.log(`   No Sequential Chars: ${analysis.checks.noSequential ? '✅' : '❌'}`);
}

/**
 * Show environment setup instructions
 */
function showSetupInstructions(token) {
  console.log('\n🔧 Environment Setup:');
  console.log('');
  console.log('1. 📁 Local Development (.env file):');
  console.log(`   API_AUTH_TOKEN=${token}`);
  console.log('');
  console.log('2. ☁️  Vercel Deployment:');
  console.log('   vercel env add API_AUTH_TOKEN');
  console.log(`   # Enter: ${token}`);
  console.log('');
  console.log('3. 🧪 Testing:');
  console.log(`   export API_AUTH_TOKEN="${token}"`);
  console.log('   node scripts/test-authorization.js');
  console.log('');
  console.log('4. 📱 API Usage:');
  console.log(`   curl -H "Authorization: Bearer ${token}" \\`);
  console.log('        https://your-app.vercel.app/api/deposits');
}

/**
 * Interactive token generation
 */
async function interactiveGeneration() {
  console.log('\n🎯 Interactive Token Generation');
  console.log('Choose the type of token you want to generate:\n');
  
  console.log('1. 🔒 Secure Hex Token (recommended)');
  console.log('2. 📝 Base64 Token');
  console.log('3. 🌐 URL-Safe Token');
  console.log('4. 🆔 UUID-based Token');
  console.log('5. 🏷️  Prefixed Token (like API keys)');
  console.log('6. 🎲 Custom Length Token');
  
  const choice = await question('\nEnter your choice (1-6): ');
  
  let token;
  let name;
  
  switch (choice) {
    case '1':
      token = generateSecureToken();
      name = 'Secure Hex Token';
      break;
    case '2':
      token = generateBase64Token();
      name = 'Base64 Token';
      break;
    case '3':
      token = generateUrlSafeToken();
      name = 'URL-Safe Token';
      break;
    case '4':
      token = generateUuidToken();
      name = 'UUID-based Token';
      break;
    case '5':
      const prefix = await question('Enter prefix (default: sdt): ') || 'sdt';
      token = generatePrefixedToken(prefix);
      name = `Prefixed Token (${prefix})`;
      break;
    case '6':
      const length = parseInt(await question('Enter token length in bytes (default: 32): ') || '32');
      token = generateSecureToken(length);
      name = `Custom Length Token (${length} bytes)`;
      break;
    default:
      console.log('Invalid choice, generating secure hex token...');
      token = generateSecureToken();
      name = 'Secure Hex Token';
  }
  
  displayToken(name, token);
  showSetupInstructions(token);
  
  const useToken = await question('\nDo you want to use this token? (y/n): ');
  if (useToken.toLowerCase() === 'y') {
    return token;
  }
  
  return null;
}

/**
 * Generate multiple tokens for comparison
 */
function generateMultipleTokens() {
  console.log('\n🔄 Multiple Token Options:');
  
  const tokens = [
    { name: 'Secure Hex (32 bytes)', token: generateSecureToken(32) },
    { name: 'Secure Hex (48 bytes)', token: generateSecureToken(48) },
    { name: 'Base64 (32 bytes)', token: generateBase64Token(32) },
    { name: 'URL-Safe (32 bytes)', token: generateUrlSafeToken(32) },
    { name: 'UUID-based', token: generateUuidToken() },
    { name: 'Prefixed (sdt_)', token: generatePrefixedToken('sdt', 32) }
  ];
  
  tokens.forEach((item, index) => {
    console.log(`\n${index + 1}. ${item.name}:`);
    console.log(`   ${item.token}`);
    const analysis = validateTokenStrength(item.token);
    console.log(`   Strength: ${analysis.strength} (${analysis.score}/4)`);
  });
  
  return tokens;
}

/**
 * Show security recommendations
 */
function showSecurityRecommendations() {
  console.log('\n🔒 Security Recommendations:');
  console.log('');
  console.log('✅ Token Requirements:');
  console.log('   • Minimum 32 bytes (64 hex characters)');
  console.log('   • Cryptographically secure random generation');
  console.log('   • High entropy (>4.0 bits per character)');
  console.log('   • No predictable patterns');
  console.log('');
  console.log('✅ Storage Best Practices:');
  console.log('   • Store in environment variables only');
  console.log('   • Never commit to version control');
  console.log('   • Use different tokens per environment');
  console.log('   • Rotate tokens regularly');
  console.log('');
  console.log('✅ Usage Best Practices:');
  console.log('   • Always use HTTPS');
  console.log('   • Implement rate limiting');
  console.log('   • Log authentication attempts');
  console.log('   • Monitor for suspicious activity');
}

async function main() {
  console.log('🔐 API Token Generator');
  console.log('Generate secure tokens for API authentication\n');
  
  try {
    const args = process.argv.slice(2);
    
    if (args.includes('--interactive')) {
      const token = await interactiveGeneration();
      if (token) {
        console.log('\n✅ Token ready for use!');
      }
    } else if (args.includes('--multiple')) {
      generateMultipleTokens();
    } else if (args.includes('--quick')) {
      const token = generateSecureToken();
      displayToken('Quick Secure Token', token);
      showSetupInstructions(token);
    } else {
      // Default: show options
      console.log('Usage options:');
      console.log('  --quick       Generate a secure token immediately');
      console.log('  --interactive Choose token type interactively');
      console.log('  --multiple    Show multiple token options');
      console.log('');
      
      const token = generateSecureToken();
      displayToken('Default Secure Token', token);
      showSetupInstructions(token);
    }
    
    showSecurityRecommendations();
    
  } catch (error) {
    console.error('❌ Token generation failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  generateSecureToken,
  generateBase64Token,
  generateUrlSafeToken,
  generateUuidToken,
  generatePrefixedToken,
  validateTokenStrength
};
