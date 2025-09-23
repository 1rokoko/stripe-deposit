#!/usr/bin/env node

/**
 * Webhook Load Testing Tool
 * Tests webhook endpoint with realistic Stripe webhook payloads
 */

const https = require('https');
const crypto = require('crypto');
const { loadEnv } = require('../src/config');

const BASE_URL = process.env.API_BASE_URL || 'https://stripe-deposit.vercel.app';
const WEBHOOK_ENDPOINT = '/api/stripe/webhook';

/**
 * Generate Stripe webhook signature
 */
function generateStripeSignature(payload, secret, timestamp) {
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

/**
 * Generate realistic webhook payloads
 */
const WEBHOOK_PAYLOADS = {
  payment_intent_succeeded: (id) => ({
    id: `evt_${id}`,
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: `pi_${id}`,
        object: 'payment_intent',
        amount: Math.floor(Math.random() * 10000) + 1000,
        currency: 'usd',
        status: 'succeeded',
        metadata: {
          depositId: `dep_${id}`
        }
      }
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: `req_${id}`,
      idempotency_key: null
    }
  }),
  
  payment_intent_payment_failed: (id) => ({
    id: `evt_${id}`,
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    type: 'payment_intent.payment_failed',
    data: {
      object: {
        id: `pi_${id}`,
        object: 'payment_intent',
        amount: Math.floor(Math.random() * 10000) + 1000,
        currency: 'usd',
        status: 'requires_payment_method',
        last_payment_error: {
          code: 'card_declined',
          decline_code: 'generic_decline',
          message: 'Your card was declined.'
        },
        metadata: {
          depositId: `dep_${id}`
        }
      }
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: `req_${id}`,
      idempotency_key: null
    }
  }),
  
  charge_dispute_created: (id) => ({
    id: `evt_${id}`,
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    type: 'charge.dispute.created',
    data: {
      object: {
        id: `dp_${id}`,
        object: 'dispute',
        amount: Math.floor(Math.random() * 10000) + 1000,
        currency: 'usd',
        reason: 'fraudulent',
        status: 'warning_needs_response',
        charge: `ch_${id}`,
        created: Math.floor(Date.now() / 1000)
      }
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: `req_${id}`,
      idempotency_key: null
    }
  }),
  
  invoice_payment_succeeded: (id) => ({
    id: `evt_${id}`,
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    type: 'invoice.payment_succeeded',
    data: {
      object: {
        id: `in_${id}`,
        object: 'invoice',
        amount_paid: Math.floor(Math.random() * 10000) + 1000,
        currency: 'usd',
        status: 'paid',
        customer: `cus_${id}`,
        subscription: `sub_${id}`
      }
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: `req_${id}`,
      idempotency_key: null
    }
  })
};

/**
 * HTTP request helper
 */
function makeWebhookRequest(payload, signature) {
  return new Promise((resolve, reject) => {
    const url = new URL(WEBHOOK_ENDPOINT, BASE_URL);
    const startTime = Date.now();
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature,
        'User-Agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          data,
          duration
        });
      });
    });

    req.on('error', (error) => {
      reject({
        error: error.message,
        duration: Date.now() - startTime
      });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Webhook load test metrics
 */
class WebhookLoadTestMetrics {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.startTime = Date.now();
    this.requests = [];
    this.errors = [];
    this.eventTypes = {};
  }
  
  recordRequest(eventType, response, error = null) {
    const now = Date.now();
    
    const record = {
      timestamp: now,
      eventType,
      duration: response?.duration || 0,
      status: response?.status || 0,
      success: !error && response?.status === 200,
      error: error?.message || null
    };
    
    this.requests.push(record);
    
    if (error) {
      this.errors.push({ ...record, error });
    }
    
    // Update event type metrics
    if (!this.eventTypes[eventType]) {
      this.eventTypes[eventType] = {
        total: 0,
        success: 0,
        errors: 0,
        durations: []
      };
    }
    
    const eventMetrics = this.eventTypes[eventType];
    eventMetrics.total++;
    
    if (record.success) {
      eventMetrics.success++;
      eventMetrics.durations.push(record.duration);
    } else {
      eventMetrics.errors++;
    }
  }
  
  getMetrics() {
    const now = Date.now();
    const totalDuration = now - this.startTime;
    const totalRequests = this.requests.length;
    const totalErrors = this.errors.length;
    const successfulRequests = totalRequests - totalErrors;
    
    // Calculate overall statistics
    const durations = this.requests
      .filter(r => r.success)
      .map(r => r.duration);
    
    const avgDuration = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;
    
    const sortedDurations = durations.sort((a, b) => a - b);
    const p95 = this.calculatePercentile(sortedDurations, 95);
    
    return {
      summary: {
        totalDuration: Math.round(totalDuration / 1000),
        totalRequests,
        successfulRequests,
        totalErrors,
        successRate: totalRequests > 0 ? (successfulRequests / totalRequests * 100).toFixed(2) : 0,
        requestsPerSecond: (totalRequests / (totalDuration / 1000)).toFixed(2),
        avgDuration: Math.round(avgDuration),
        p95Duration: Math.round(p95)
      },
      eventTypes: Object.entries(this.eventTypes).map(([type, metrics]) => {
        const avgDuration = metrics.durations.length > 0 
          ? metrics.durations.reduce((sum, d) => sum + d, 0) / metrics.durations.length 
          : 0;
        
        return {
          type,
          total: metrics.total,
          success: metrics.success,
          errors: metrics.errors,
          successRate: metrics.total > 0 ? (metrics.success / metrics.total * 100).toFixed(2) : 0,
          avgDuration: Math.round(avgDuration)
        };
      }),
      recentErrors: this.errors.slice(-5)
    };
  }
  
  calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }
}

/**
 * Webhook load test runner
 */
class WebhookLoadTestRunner {
  constructor() {
    this.metrics = new WebhookLoadTestMetrics();
    this.isRunning = false;
    this.activeRequests = 0;
    this.maxConcurrency = 20;
  }
  
  generateRandomWebhook() {
    const eventTypes = Object.keys(WEBHOOK_PAYLOADS);
    const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const randomId = Math.random().toString(36).substr(2, 9);
    
    return {
      type: randomType,
      payload: WEBHOOK_PAYLOADS[randomType](randomId)
    };
  }
  
  async sendWebhook(eventType, payload) {
    this.activeRequests++;
    
    try {
      const env = loadEnv();
      const webhookSecret = env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';
      const timestamp = Math.floor(Date.now() / 1000);
      const payloadString = JSON.stringify(payload);
      const signature = generateStripeSignature(payloadString, webhookSecret, timestamp);
      
      const response = await makeWebhookRequest(payloadString, signature);
      this.metrics.recordRequest(eventType, response);
      
      return response;
      
    } catch (error) {
      this.metrics.recordRequest(eventType, null, error);
      throw error;
    } finally {
      this.activeRequests--;
    }
  }
  
  async runLoadTest(options = {}) {
    const {
      duration = 60000,        // 1 minute
      concurrency = 10,        // 10 webhooks per second
      rampUp = false,
      startConcurrency = 1,
      endConcurrency = 10
    } = options;
    
    console.log('🔥 Starting Webhook Load Test');
    console.log(`🌐 Target: ${BASE_URL}${WEBHOOK_ENDPOINT}`);
    console.log(`⏱️  Duration: ${duration / 1000}s`);
    
    if (rampUp) {
      console.log(`📈 Concurrency: ${startConcurrency} → ${endConcurrency} webhooks/second`);
    } else {
      console.log(`📊 Concurrency: ${concurrency} webhooks/second`);
    }
    
    console.log('=====================================');
    
    this.isRunning = true;
    this.metrics.reset();
    
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    try {
      while (Date.now() < endTime && this.isRunning) {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;
        
        let currentConcurrency;
        if (rampUp) {
          currentConcurrency = Math.round(
            startConcurrency + (endConcurrency - startConcurrency) * progress
          );
        } else {
          currentConcurrency = concurrency;
        }
        
        // Limit concurrency
        currentConcurrency = Math.min(currentConcurrency, this.maxConcurrency);
        
        // Send webhooks for this interval
        const promises = [];
        for (let i = 0; i < currentConcurrency && this.activeRequests < this.maxConcurrency; i++) {
          const webhook = this.generateRandomWebhook();
          promises.push(
            this.sendWebhook(webhook.type, webhook.payload).catch(error => {
              console.error(`❌ Webhook error (${webhook.type}):`, error.message);
            })
          );
        }
        
        await Promise.all(promises);
        
        // Progress indicator
        const progressPercent = Math.round(progress * 100);
        if (progressPercent % 10 === 0) {
          console.log(`📊 Progress: ${progressPercent}% (${this.metrics.requests.length} webhooks sent)`);
        }
        
        // Wait before next batch (1 second intervals)
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Wait for remaining requests to complete
      while (this.activeRequests > 0) {
        console.log(`⏳ Waiting for ${this.activeRequests} webhooks to complete...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log('\n🎉 Webhook load test completed!');
      
    } catch (error) {
      console.error('\n❌ Webhook load test failed:', error.message);
    } finally {
      this.isRunning = false;
    }
  }
  
  printResults() {
    const metrics = this.metrics.getMetrics();
    
    console.log('\n📊 WEBHOOK LOAD TEST RESULTS');
    console.log('============================');
    
    console.log('\n📈 Summary:');
    console.log(`   Total Duration: ${metrics.summary.totalDuration}s`);
    console.log(`   Total Webhooks: ${metrics.summary.totalRequests}`);
    console.log(`   Successful Webhooks: ${metrics.summary.successfulRequests}`);
    console.log(`   Failed Webhooks: ${metrics.summary.totalErrors}`);
    console.log(`   Success Rate: ${metrics.summary.successRate}%`);
    console.log(`   Webhooks/Second: ${metrics.summary.requestsPerSecond}`);
    console.log(`   Average Response Time: ${metrics.summary.avgDuration}ms`);
    console.log(`   P95 Response Time: ${metrics.summary.p95Duration}ms`);
    
    console.log('\n📋 Event Type Results:');
    metrics.eventTypes.forEach(eventType => {
      console.log(`   ${eventType.type}:`);
      console.log(`     Total: ${eventType.total}, Success: ${eventType.success}, Errors: ${eventType.errors}`);
      console.log(`     Success Rate: ${eventType.successRate}%, Avg Duration: ${eventType.avgDuration}ms`);
    });
    
    if (metrics.recentErrors.length > 0) {
      console.log('\n❌ Recent Errors:');
      metrics.recentErrors.forEach(error => {
        console.log(`   ${error.eventType}: ${error.error}`);
      });
    }
    
    // Performance assessment
    console.log('\n🎯 Webhook Performance Assessment:');
    if (metrics.summary.successRate >= 99) {
      console.log('   ✅ Excellent: Success rate > 99%');
    } else if (metrics.summary.successRate >= 95) {
      console.log('   ✅ Good: Success rate > 95%');
    } else {
      console.log('   ❌ Poor: Success rate < 95%');
    }
    
    if (metrics.summary.p95Duration <= 500) {
      console.log('   ✅ Excellent: P95 response time ≤ 500ms');
    } else if (metrics.summary.p95Duration <= 1000) {
      console.log('   ✅ Good: P95 response time ≤ 1s');
    } else {
      console.log('   ❌ Poor: P95 response time > 1s');
    }
  }
  
  stop() {
    this.isRunning = false;
    console.log('\n🛑 Webhook load test stopped by user');
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Webhook Load Testing Tool

Usage: node scripts/test-webhook-load.js [options]

Options:
  --duration=60     Test duration in seconds (default: 60)
  --concurrency=10  Webhooks per second (default: 10)
  --ramp-up         Gradually increase load from 1 to concurrency
  --stress          Run stress test with higher concurrency
  --help            Show this help message

Examples:
  node scripts/test-webhook-load.js                           # Standard test
  node scripts/test-webhook-load.js --duration=30             # 30-second test
  node scripts/test-webhook-load.js --concurrency=20          # 20 webhooks/second
  node scripts/test-webhook-load.js --ramp-up --concurrency=25 # Ramp up test
  node scripts/test-webhook-load.js --stress                  # Stress test
    `);
    return;
  }
  
  const runner = new WebhookLoadTestRunner();
  
  // Parse options
  const options = {};
  
  args.forEach(arg => {
    if (arg.startsWith('--duration=')) {
      options.duration = parseInt(arg.split('=')[1]) * 1000;
    } else if (arg.startsWith('--concurrency=')) {
      options.concurrency = parseInt(arg.split('=')[1]);
    } else if (arg === '--ramp-up') {
      options.rampUp = true;
      options.startConcurrency = 1;
      options.endConcurrency = options.concurrency || 10;
    } else if (arg === '--stress') {
      options.concurrency = 25;
      options.duration = 120000; // 2 minutes
      runner.maxConcurrency = 50;
    }
  });
  
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    runner.stop();
    setTimeout(() => {
      runner.printResults();
      process.exit(0);
    }, 1000);
  });
  
  try {
    await runner.runLoadTest(options);
    runner.printResults();
  } catch (error) {
    console.error('Webhook load test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  WebhookLoadTestRunner,
  WebhookLoadTestMetrics,
  WEBHOOK_PAYLOADS,
  generateStripeSignature
};
