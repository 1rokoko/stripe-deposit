const STRIPE_API_BASE = 'https://api.stripe.com/v1';

function encodeForm(data) {
  const params = new URLSearchParams();

  function append(key, value) {
    if (value === undefined || value === null) {
      return;
    }

    if (value instanceof Date) {
      params.append(key, value.toISOString());
      return;
    }

    const valueType = typeof value;
    if (valueType === 'object') {
      if (Array.isArray(value)) {
        value.forEach((item, index) => append(`${key}[${index}]`, item));
      } else {
        Object.entries(value).forEach(([childKey, childValue]) => {
          append(`${key}[${childKey}]`, childValue);
        });
      }
    } else {
      params.append(key, String(value));
    }
  }

  Object.entries(data || {}).forEach(([key, value]) => append(key, value));
  return params;
}

class StripeClient {
  constructor({ apiKey, apiBase = STRIPE_API_BASE, fetchImpl = global.fetch } = {}) {
    if (!apiKey) {
      throw new Error('StripeClient requires an apiKey');
    }

    this.apiKey = apiKey;
    this.apiBase = apiBase;
    this.fetch = fetchImpl;
  }

  async request(method, path, body) {
    const url = `${this.apiBase}${path}`;
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
    };

    let requestBody;
    if (method !== 'GET' && body) {
      requestBody = encodeForm(body);
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    const response = await this.fetch(url, {
      method,
      headers,
      body: requestBody,
    });

    const responseText = await response.text();
    let payload;
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      const err = new Error('Failed to parse Stripe response JSON');
      err.cause = error;
      err.status = response.status;
      err.body = responseText;
      throw err;
    }

    if (!response.ok) {
      const error = new Error(payload?.error?.message || 'Stripe API error');
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  createPaymentIntent(params) {
    return this.request('POST', '/payment_intents', params);
  }

  capturePaymentIntent(paymentIntentId, params) {
    return this.request('POST', `/payment_intents/${paymentIntentId}/capture`, params);
  }

  cancelPaymentIntent(paymentIntentId) {
    return this.request('POST', `/payment_intents/${paymentIntentId}/cancel`);
  }

  createRefund(params) {
    return this.request('POST', '/refunds', params);
  }
}

module.exports = { StripeClient, encodeForm };
