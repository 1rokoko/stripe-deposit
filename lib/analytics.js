// Google Analytics 4 integration
export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID || 'GA_MEASUREMENT_ID';

// Initialize Google Analytics
export const initGA = () => {
  if (typeof window !== 'undefined' && GA_TRACKING_ID && GA_TRACKING_ID !== 'GA_MEASUREMENT_ID') {
    // Load Google Analytics script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`;
    document.head.appendChild(script);

    // Initialize gtag
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    
    gtag('js', new Date());
    gtag('config', GA_TRACKING_ID, {
      page_title: document.title,
      page_location: window.location.href
    });
  }
};

// Track page views
export const pageview = (url) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', GA_TRACKING_ID, {
      page_path: url,
    });
  }
};

// Track custom events
export const event = ({ action, category, label, value }) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Track deposit events
export const trackDeposit = (action, depositId, amount, status) => {
  event({
    action: `deposit_${action}`,
    category: 'Deposits',
    label: `${depositId}_${status}`,
    value: Math.round(amount / 100) // Convert cents to dollars
  });

  // Also track as conversion for successful deposits
  if (action === 'captured' && typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'purchase', {
      transaction_id: depositId,
      value: amount / 100,
      currency: 'USD',
      items: [{
        item_id: depositId,
        item_name: 'Deposit',
        category: 'Financial',
        quantity: 1,
        price: amount / 100
      }]
    });
  }
};

// Track user events
export const trackUser = (action, userId, userEmail) => {
  event({
    action: `user_${action}`,
    category: 'Users',
    label: userId
  });

  // Set user properties
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', GA_TRACKING_ID, {
      user_id: userId,
      custom_map: {
        user_email: userEmail
      }
    });
  }
};

// Track admin actions
export const trackAdmin = (action, adminId, details) => {
  event({
    action: `admin_${action}`,
    category: 'Admin',
    label: adminId,
    value: details?.amount ? Math.round(details.amount / 100) : undefined
  });
};

// Track performance metrics
export const trackPerformance = (metric, value, category = 'Performance') => {
  event({
    action: metric,
    category,
    label: 'timing',
    value: Math.round(value)
  });
};

// Track errors
export const trackError = (error, context = 'General') => {
  event({
    action: 'error',
    category: 'Errors',
    label: `${context}: ${error.message || error}`,
    value: 1
  });
};

// Enhanced ecommerce tracking for deposits
export const trackDepositFlow = {
  // Track when user starts deposit process
  beginCheckout: (depositAmount, currency = 'USD') => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'begin_checkout', {
        currency: currency,
        value: depositAmount / 100,
        items: [{
          item_id: 'deposit',
          item_name: 'Deposit',
          category: 'Financial',
          quantity: 1,
          price: depositAmount / 100
        }]
      });
    }
  },

  // Track payment info addition
  addPaymentInfo: (depositId, paymentMethod) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'add_payment_info', {
        currency: 'USD',
        payment_type: paymentMethod,
        items: [{
          item_id: depositId,
          item_name: 'Deposit',
          category: 'Financial'
        }]
      });
    }
  },

  // Track successful deposit
  purchase: (depositId, amount, currency = 'USD') => {
    trackDeposit('captured', depositId, amount, 'captured');
  },

  // Track failed deposit
  purchaseFailed: (depositId, amount, errorReason) => {
    event({
      action: 'deposit_failed',
      category: 'Deposits',
      label: `${depositId}_${errorReason}`,
      value: Math.round(amount / 100)
    });
  }
};

// Utility function to check if GA is loaded
export const isGALoaded = () => {
  return typeof window !== 'undefined' && window.gtag && GA_TRACKING_ID !== 'GA_MEASUREMENT_ID';
};

// Debug function for development
export const debugGA = () => {
  if (typeof window !== 'undefined') {
    console.log('GA Debug Info:', {
      trackingId: GA_TRACKING_ID,
      gtagLoaded: !!window.gtag,
      dataLayer: window.dataLayer
    });
  }
};
