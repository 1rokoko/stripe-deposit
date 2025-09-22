const crypto = require('crypto');

function parseStripeSignature(header) {
  if (!header) {
    throw new Error('Missing Stripe-Signature header');
  }

  const parts = header.split(',');
  const result = {};

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (!key || value === undefined) {
      continue;
    }
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(value);
  }

  const timestamp = result.t?.[0];
  const signatures = result.v1 || [];

  if (!timestamp || signatures.length === 0) {
    throw new Error('Invalid Stripe-Signature header');
  }

  return { timestamp: Number(timestamp), signatures };
}

function timingSafeEquals(a, b) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufferA, bufferB);
}

function verifyStripeSignature({ payload, header, secret, toleranceSeconds = 300 }) {
  if (!secret) {
    throw new Error('Stripe webhook secret is not configured');
  }

  const rawPayload = typeof payload === 'string' ? payload : payload.toString('utf8');
  const { timestamp, signatures } = parseStripeSignature(header);

  if (!Number.isFinite(timestamp)) {
    throw new Error('Invalid timestamp in Stripe-Signature header');
  }

  const signedPayload = `${timestamp}.${rawPayload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  const isValid = signatures.some((signature) => timingSafeEquals(signature, expectedSignature));
  if (!isValid) {
    throw new Error('Stripe webhook signature verification failed');
  }

  const currentTimestamp = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTimestamp - timestamp) > toleranceSeconds) {
    throw new Error('Stripe webhook signature timestamp outside of tolerance');
  }

  let event;
  try {
    event = JSON.parse(rawPayload);
  } catch (error) {
    const parseError = new Error('Failed to parse Stripe webhook payload');
    parseError.cause = error;
    throw parseError;
  }

  return event;
}

module.exports = { verifyStripeSignature };
