/* ============================================
   STRIPE INTEGRATION
   Prompting It - Payment Processing
   ============================================ */

(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================
  // NOTE: Replace with your actual Stripe publishable key
  // Get this from: https://dashboard.stripe.com/apikeys
  const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY';
  
  // Pricing configuration
  const PRICING = {
    pro: {
      monthly: {
        priceId: 'price_pro_monthly', // Replace with actual Stripe price ID
        amount: 4900, // $49.00 in cents
        interval: 'month'
      },
      annual: {
        priceId: 'price_pro_annual', // Replace with actual Stripe price ID
        amount: 39900, // $399.00 in cents ($33.25/mo)
        interval: 'year'
      }
    },
    enterprise: {
      // Enterprise is custom pricing - contact sales
      monthly: null,
      annual: null
    }
  };

  // Platform fee percentage (20%)
  const PLATFORM_FEE_PERCENT = 20;

  // ============================================
  // STRIPE CLIENT
  // ============================================
  let stripeInstance = null;

  const StripeClient = {
    // Initialize Stripe.js
    async init() {
      if (stripeInstance) return stripeInstance;
      
      // Wait for Stripe.js to load
      if (typeof Stripe === 'undefined') {
        // Load Stripe.js dynamically if not present
        await this.loadStripeJS();
      }
      
      stripeInstance = Stripe(STRIPE_PUBLISHABLE_KEY);
      return stripeInstance;
    },

    // Load Stripe.js dynamically
    loadStripeJS() {
      return new Promise((resolve, reject) => {
        if (typeof Stripe !== 'undefined') {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load Stripe.js'));
        document.head.appendChild(script);
      });
    },

    // Get Stripe instance
    getStripe() {
      return stripeInstance;
    }
  };

  // ============================================
  // CHECKOUT SERVICE
  // ============================================
  const CheckoutService = {
    // Create subscription checkout session
    async createSubscriptionCheckout(tier, billingInterval = 'monthly') {
      const supabase = window.PromptingItSupabase?.getClient();
      const user = window.Auth?.getUser();
      
      if (!user) {
        throw new Error('Please sign in to subscribe');
      }

      const pricing = PRICING[tier]?.[billingInterval];
      if (!pricing) {
        throw new Error('Invalid plan selected');
      }

      // For production, this should call a Supabase Edge Function
      // that creates the checkout session server-side
      try {
        // Call edge function to create checkout session
        const { data, error } = await supabase.functions.invoke('create-checkout', {
          body: {
            priceId: pricing.priceId,
            userId: user.id,
            customerEmail: user.email,
            successUrl: `${window.location.origin}/settings.html?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${window.location.origin}/upgrade.html?cancelled=true`
          }
        });

        if (error) throw error;
        
        // Redirect to Stripe Checkout
        const stripe = await StripeClient.init();
        const { error: stripeError } = await stripe.redirectToCheckout({
          sessionId: data.sessionId
        });

        if (stripeError) throw stripeError;
      } catch (error) {
        console.error('Checkout error:', error);
        throw error;
      }
    },

    // Create marketplace purchase checkout
    async createPurchaseCheckout(promptId, amount) {
      const supabase = window.PromptingItSupabase?.getClient();
      const user = window.Auth?.getUser();
      
      if (!user) {
        throw new Error('Please sign in to purchase');
      }

      try {
        // Get prompt details
        const { data: prompt, error: promptError } = await supabase
          .from('prompts')
          .select('*, profiles!prompts_user_id_fkey(stripe_connect_id:creator_earnings(stripe_connect_id))')
          .eq('id', promptId)
          .single();

        if (promptError) throw promptError;

        // Call edge function to create payment intent
        const { data, error } = await supabase.functions.invoke('create-payment', {
          body: {
            promptId,
            buyerId: user.id,
            amount: Math.round(amount * 100), // Convert to cents
            sellerId: prompt.user_id,
            customerEmail: user.email,
            successUrl: `${window.location.origin}/library.html?purchased=${promptId}`,
            cancelUrl: `${window.location.origin}/marketplace.html?cancelled=true`
          }
        });

        if (error) throw error;

        // Redirect to Stripe Checkout
        const stripe = await StripeClient.init();
        const { error: stripeError } = await stripe.redirectToCheckout({
          sessionId: data.sessionId
        });

        if (stripeError) throw stripeError;
      } catch (error) {
        console.error('Purchase error:', error);
        throw error;
      }
    },

    // Handle successful checkout return
    async handleCheckoutSuccess(sessionId) {
      const supabase = window.PromptingItSupabase?.getClient();
      
      try {
        // Verify the session with backend
        const { data, error } = await supabase.functions.invoke('verify-checkout', {
          body: { sessionId }
        });

        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Checkout verification error:', error);
        throw error;
      }
    }
  };

  // ============================================
  // STRIPE CONNECT (Creator Payouts)
  // ============================================
  const StripeConnect = {
    // Start Stripe Connect onboarding for creators
    async startOnboarding() {
      const supabase = window.PromptingItSupabase?.getClient();
      const user = window.Auth?.getUser();
      
      if (!user) {
        throw new Error('Please sign in to set up payouts');
      }

      try {
        // Call edge function to create Connect account and onboarding link
        const { data, error } = await supabase.functions.invoke('create-connect-account', {
          body: {
            userId: user.id,
            email: user.email,
            returnUrl: `${window.location.origin}/settings.html?connect=success`,
            refreshUrl: `${window.location.origin}/settings.html?connect=refresh`
          }
        });

        if (error) throw error;

        // Redirect to Stripe Connect onboarding
        window.location.href = data.onboardingUrl;
      } catch (error) {
        console.error('Connect onboarding error:', error);
        throw error;
      }
    },

    // Check Connect account status
    async getAccountStatus() {
      const supabase = window.PromptingItSupabase?.getClient();
      const user = window.Auth?.getUser();
      
      if (!user) return null;

      try {
        const { data, error } = await supabase
          .from('creator_earnings')
          .select('stripe_connect_id, stripe_onboarding_complete')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        
        return data || { stripe_connect_id: null, stripe_onboarding_complete: false };
      } catch (error) {
        console.error('Connect status error:', error);
        return null;
      }
    },

    // Request a payout
    async requestPayout(amount) {
      const supabase = window.PromptingItSupabase?.getClient();
      const user = window.Auth?.getUser();
      
      if (!user) {
        throw new Error('Please sign in to request a payout');
      }

      // Check minimum payout amount ($50)
      if (amount < 50) {
        throw new Error('Minimum payout amount is $50');
      }

      try {
        // Check available balance
        const { data: earnings, error: earningsError } = await supabase
          .from('creator_earnings')
          .select('pending_payout, stripe_onboarding_complete')
          .eq('user_id', user.id)
          .single();

        if (earningsError) throw earningsError;
        
        if (!earnings.stripe_onboarding_complete) {
          throw new Error('Please complete Stripe onboarding first');
        }

        if (earnings.pending_payout < amount) {
          throw new Error(`Insufficient balance. Available: $${earnings.pending_payout.toFixed(2)}`);
        }

        // Create payout request
        const { data, error } = await supabase
          .from('payouts')
          .insert({
            user_id: user.id,
            amount: amount,
            status: 'pending'
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Payout request error:', error);
        throw error;
      }
    }
  };

  // ============================================
  // PAYMENT ELEMENTS (Embedded Forms)
  // ============================================
  const PaymentElements = {
    elements: null,
    paymentElement: null,

    // Mount payment form
    async mount(containerId, options = {}) {
      const stripe = await StripeClient.init();
      
      this.elements = stripe.elements({
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#67e8f9',
            colorBackground: '#09090b',
            colorText: '#ffffff',
            colorDanger: '#ef4444',
            fontFamily: 'Inter, system-ui, sans-serif',
            borderRadius: '10px',
            spacingUnit: '4px'
          },
          rules: {
            '.Input': {
              backgroundColor: '#18181b',
              border: '1px solid #27272a'
            },
            '.Input:focus': {
              borderColor: '#67e8f9',
              boxShadow: '0 0 0 4px rgba(103, 232, 249, 0.15)'
            }
          }
        },
        ...options
      });

      this.paymentElement = this.elements.create('payment');
      this.paymentElement.mount(`#${containerId}`);

      return this.paymentElement;
    },

    // Confirm payment
    async confirm(clientSecret, returnUrl) {
      const stripe = await StripeClient.init();
      
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements: this.elements,
        clientSecret,
        confirmParams: {
          return_url: returnUrl || window.location.href
        }
      });

      if (error) throw error;
      return paymentIntent;
    },

    // Unmount elements
    unmount() {
      if (this.paymentElement) {
        this.paymentElement.unmount();
        this.paymentElement = null;
      }
      this.elements = null;
    }
  };

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  // Format currency
  function formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount / 100);
  }

  // Calculate platform fee
  function calculateFee(amount) {
    return Math.round(amount * (PLATFORM_FEE_PERCENT / 100));
  }

  // Calculate seller revenue
  function calculateSellerRevenue(amount) {
    return amount - calculateFee(amount);
  }

  // ============================================
  // EXPORT GLOBAL
  // ============================================
  window.StripePayments = {
    // Core
    init: () => StripeClient.init(),
    getStripe: () => StripeClient.getStripe(),
    
    // Checkout
    createSubscriptionCheckout: (tier, interval) => CheckoutService.createSubscriptionCheckout(tier, interval),
    createPurchaseCheckout: (promptId, amount) => CheckoutService.createPurchaseCheckout(promptId, amount),
    handleCheckoutSuccess: (sessionId) => CheckoutService.handleCheckoutSuccess(sessionId),
    
    // Connect (Creator Payouts)
    startOnboarding: () => StripeConnect.startOnboarding(),
    getAccountStatus: () => StripeConnect.getAccountStatus(),
    requestPayout: (amount) => StripeConnect.requestPayout(amount),
    
    // Elements
    mountPaymentForm: (containerId, options) => PaymentElements.mount(containerId, options),
    confirmPayment: (clientSecret, returnUrl) => PaymentElements.confirm(clientSecret, returnUrl),
    unmountPaymentForm: () => PaymentElements.unmount(),
    
    // Helpers
    formatCurrency,
    calculateFee,
    calculateSellerRevenue,
    
    // Config
    PRICING,
    PLATFORM_FEE_PERCENT
  };

  // Auto-init on page load if Stripe key is configured
  if (STRIPE_PUBLISHABLE_KEY && !STRIPE_PUBLISHABLE_KEY.includes('YOUR_STRIPE')) {
    document.addEventListener('DOMContentLoaded', () => {
      StripeClient.init().catch(err => {
        console.warn('Stripe initialization deferred:', err.message);
      });
    });
  }

})();

