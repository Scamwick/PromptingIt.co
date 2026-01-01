/* ============================================
   PROMPTING IT - PAYWALL SYSTEM
   Subscription Management & Access Control
   ============================================ */

(function() {
  'use strict';

  // ============================================
  // SUBSCRIPTION TIERS CONFIGURATION
  // ============================================
  const SUBSCRIPTION_TIERS = {
    free: {
      name: 'Free',
      price: 0,
      priceAnnual: 0,
      features: [
        '25 prompts per month',
        'Basic prompt editor',
        'Community support',
        '1 AI model',
        'Standard templates'
      ],
      limits: {
        prompts: 25,
        models: 1,
        apiCalls: 100,
        storage: '100MB',
        teamMembers: 1
      }
    },
    pro: {
      name: 'Pro',
      price: 29,
      priceAnnual: 24,
      features: [
        'Unlimited prompts',
        'Advanced prompt editor',
        'Priority support',
        'All AI models',
        'Premium templates',
        'Version control',
        'Analytics dashboard',
        'API access (1K calls/mo)'
      ],
      limits: {
        prompts: -1, // unlimited
        models: -1,
        apiCalls: 1000,
        storage: '10GB',
        teamMembers: 5
      }
    },
    enterprise: {
      name: 'Enterprise',
      price: 99,
      priceAnnual: 84,
      features: [
        'Everything in Pro',
        'Custom AI model training',
        'Dedicated support',
        'SSO & SAML',
        'Advanced security',
        'Custom integrations',
        'Unlimited API calls',
        'SLA guarantee',
        'Team collaboration',
        'Audit logs'
      ],
      limits: {
        prompts: -1,
        models: -1,
        apiCalls: -1,
        storage: 'Unlimited',
        teamMembers: -1
      }
    }
  };

  // ============================================
  // FEATURE REQUIREMENTS
  // ============================================
  const FEATURE_REQUIREMENTS = {
    'anti-fraud-shield': 'pro',
    'workflows': 'pro',
    'api-console': 'pro',
    'advanced-analytics': 'pro',
    'version-control': 'pro',
    'team-collaboration': 'enterprise',
    'sso': 'enterprise',
    'custom-integrations': 'enterprise',
    'unlimited-prompts': 'pro',
    'all-models': 'pro'
  };

  // ============================================
  // PAYWALL CLASS
  // ============================================
  class PaywallManager {
    constructor() {
      this.modal = null;
      this.currentTier = 'free';
      this.isAnnual = true;
      this.init();
    }

    async init() {
      // Load user subscription from auth
      await this.loadSubscription();
      // Create modal element
      this.createModal();
      // Setup event listeners
      this.setupListeners();
    }

    async loadSubscription() {
      if (window.Auth?.isAuthenticated()) {
        // Use server-side validation instead of client state
        if (window.Security?.SubscriptionValidator) {
          const subscription = await window.Security.SubscriptionValidator.validate();
          this.currentTier = subscription.tier || 'free';
        } else {
          // Fallback to client state if security module not loaded
          this.currentTier = window.Auth.getSubscriptionTier() || 'free';
        }
      }
    }

    createModal() {
      // Remove existing modal if any
      const existing = document.getElementById('paywallModal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'paywallModal';
      modal.className = 'paywall-modal';
      modal.innerHTML = `
        <div class="paywall-overlay"></div>
        <div class="paywall-container">
          <button class="paywall-close" aria-label="Close">&times;</button>

          <div class="paywall-header">
            <div class="paywall-badge">
              <span class="paywall-badge-icon">✨</span>
              <span>Upgrade Required</span>
            </div>
            <h2 class="paywall-title">Unlock Premium Features</h2>
            <p class="paywall-subtitle" id="paywallSubtitle">Upgrade to access advanced features and take your prompt engineering to the next level.</p>
          </div>

          <div class="paywall-toggle">
            <span class="toggle-label" data-period="monthly">Monthly</span>
            <button class="toggle-switch active" id="billingToggle" aria-label="Toggle billing period">
              <span class="toggle-slider"></span>
            </button>
            <span class="toggle-label active" data-period="annual">Annual <span class="toggle-discount">Save 17%</span></span>
          </div>

          <div class="paywall-plans">
            <!-- Pro Plan -->
            <div class="plan-card" data-tier="pro">
              <div class="plan-badge">Most Popular</div>
              <h3 class="plan-name">Pro</h3>
              <div class="plan-price">
                <span class="plan-currency">$</span>
                <span class="plan-amount" data-monthly="29" data-annual="24">24</span>
                <span class="plan-period">/month</span>
              </div>
              <p class="plan-billed">Billed annually</p>
              <ul class="plan-features">
                <li><i class="fa fa-check"></i> Unlimited prompts</li>
                <li><i class="fa fa-check"></i> All AI models</li>
                <li><i class="fa fa-check"></i> Version control</li>
                <li><i class="fa fa-check"></i> Analytics dashboard</li>
                <li><i class="fa fa-check"></i> API access (1K/mo)</li>
                <li><i class="fa fa-check"></i> Priority support</li>
              </ul>
              <button class="plan-btn plan-btn-primary" data-action="subscribe" data-tier="pro">
                Get Pro
              </button>
            </div>

            <!-- Enterprise Plan -->
            <div class="plan-card featured" data-tier="enterprise">
              <div class="plan-badge">Best Value</div>
              <h3 class="plan-name">Enterprise</h3>
              <div class="plan-price">
                <span class="plan-currency">$</span>
                <span class="plan-amount" data-monthly="99" data-annual="84">84</span>
                <span class="plan-period">/month</span>
              </div>
              <p class="plan-billed">Billed annually</p>
              <ul class="plan-features">
                <li><i class="fa fa-check"></i> Everything in Pro</li>
                <li><i class="fa fa-check"></i> Custom AI training</li>
                <li><i class="fa fa-check"></i> SSO & SAML</li>
                <li><i class="fa fa-check"></i> Unlimited API</li>
                <li><i class="fa fa-check"></i> Team collaboration</li>
                <li><i class="fa fa-check"></i> SLA guarantee</li>
              </ul>
              <button class="plan-btn plan-btn-primary" data-action="subscribe" data-tier="enterprise">
                Get Enterprise
              </button>
            </div>
          </div>

          <div class="paywall-footer">
            <p>14-day free trial included. Cancel anytime.</p>
            <div class="paywall-trust">
              <span><i class="fa fa-lock"></i> Secure payment</span>
              <span><i class="fa fa-shield-alt"></i> Money-back guarantee</span>
            </div>
          </div>
        </div>
      `;

      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        .paywall-modal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 10000;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .paywall-modal.active { display: flex; }
        .paywall-overlay {
          position: absolute;
          inset: 0;
          background: rgba(3, 3, 6, 0.9);
          backdrop-filter: blur(8px);
        }
        .paywall-container {
          position: relative;
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 24px;
          padding: 40px;
          max-width: 800px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          animation: paywallSlideIn 0.3s ease-out;
        }
        @keyframes paywallSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .paywall-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #18181b;
          border: 1px solid #27272a;
          color: rgba(255,255,255,0.6);
          font-size: 24px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .paywall-close:hover { background: #27272a; color: #fff; }
        .paywall-header { text-align: center; margin-bottom: 32px; }
        .paywall-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, rgba(167,139,250,0.15), rgba(139,92,246,0.1));
          color: #a78bfa;
          font-size: 13px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 20px;
          margin-bottom: 16px;
        }
        .paywall-title {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
          background: linear-gradient(135deg, #fff, rgba(255,255,255,0.7));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .paywall-subtitle { color: rgba(255,255,255,0.5); font-size: 15px; }
        .paywall-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-bottom: 32px;
        }
        .toggle-label {
          font-size: 14px;
          color: rgba(255,255,255,0.4);
          transition: color 0.2s;
        }
        .toggle-label.active { color: #fff; }
        .toggle-discount {
          background: rgba(52,211,153,0.1);
          color: #34d399;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 10px;
          margin-left: 6px;
        }
        .toggle-switch {
          width: 52px;
          height: 28px;
          background: #27272a;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          position: relative;
          transition: background 0.2s;
        }
        .toggle-switch.active { background: #67e8f9; }
        .toggle-slider {
          position: absolute;
          width: 22px;
          height: 22px;
          background: #fff;
          border-radius: 50%;
          top: 3px;
          left: 3px;
          transition: transform 0.2s;
        }
        .toggle-switch.active .toggle-slider { transform: translateX(24px); }
        .paywall-plans {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 32px;
        }
        @media (max-width: 640px) { .paywall-plans { grid-template-columns: 1fr; } }
        .plan-card {
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 16px;
          padding: 32px;
          position: relative;
          transition: all 0.2s;
        }
        .plan-card:hover { border-color: #3f3f46; transform: translateY(-2px); }
        .plan-card.featured {
          background: linear-gradient(180deg, rgba(103,232,249,0.05) 0%, transparent 100%);
          border-color: rgba(103,232,249,0.3);
        }
        .plan-badge {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #67e8f9, #22d3ee);
          color: #030306;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 10px;
        }
        .plan-name {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 16px;
          margin-top: 8px;
        }
        .plan-price {
          display: flex;
          align-items: baseline;
          gap: 2px;
          margin-bottom: 4px;
        }
        .plan-currency { font-size: 24px; color: rgba(255,255,255,0.6); }
        .plan-amount {
          font-size: 48px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
        }
        .plan-period { font-size: 16px; color: rgba(255,255,255,0.5); }
        .plan-billed { font-size: 13px; color: rgba(255,255,255,0.4); margin-bottom: 24px; }
        .plan-features {
          list-style: none;
          margin-bottom: 24px;
        }
        .plan-features li {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          color: rgba(255,255,255,0.7);
          padding: 8px 0;
        }
        .plan-features li i { color: #34d399; font-size: 12px; }
        .plan-btn {
          width: 100%;
          padding: 14px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
          font-family: 'Inter', sans-serif;
        }
        .plan-btn-primary {
          background: linear-gradient(135deg, #67e8f9, #22d3ee);
          color: #030306;
        }
        .plan-btn-primary:hover {
          box-shadow: 0 8px 24px rgba(103,232,249,0.3);
          transform: translateY(-1px);
        }
        .paywall-footer {
          text-align: center;
          color: rgba(255,255,255,0.4);
          font-size: 13px;
        }
        .paywall-trust {
          display: flex;
          justify-content: center;
          gap: 24px;
          margin-top: 12px;
        }
        .paywall-trust span {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .paywall-trust i { color: #34d399; }

        /* Inline Paywall Banner */
        .paywall-banner {
          background: linear-gradient(135deg, rgba(167,139,250,0.1), rgba(103,232,249,0.05));
          border: 1px solid rgba(167,139,250,0.2);
          border-radius: 16px;
          padding: 24px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin: 24px 0;
        }
        .paywall-banner-content { flex: 1; }
        .paywall-banner-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .paywall-banner-title i { color: #a78bfa; }
        .paywall-banner-text {
          font-size: 14px;
          color: rgba(255,255,255,0.6);
        }
        .paywall-banner-btn {
          padding: 12px 24px;
          background: linear-gradient(135deg, #a78bfa, #8b5cf6);
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .paywall-banner-btn:hover {
          box-shadow: 0 8px 24px rgba(167,139,250,0.3);
          transform: translateY(-1px);
        }

        /* Locked Feature Overlay */
        .feature-locked {
          position: relative;
        }
        .feature-locked::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(3,3,6,0.8);
          backdrop-filter: blur(4px);
          border-radius: inherit;
          z-index: 10;
        }
        .feature-locked-badge {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 11;
          background: linear-gradient(135deg, #a78bfa, #8b5cf6);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          padding: 10px 20px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .feature-locked-badge:hover {
          transform: translate(-50%, -50%) scale(1.05);
          box-shadow: 0 8px 24px rgba(167,139,250,0.3);
        }
      `;

      document.head.appendChild(style);
      document.body.appendChild(modal);
      this.modal = modal;
    }

    setupListeners() {
      if (!this.modal) return;

      // Close button
      this.modal.querySelector('.paywall-close')?.addEventListener('click', () => this.hide());

      // Overlay click
      this.modal.querySelector('.paywall-overlay')?.addEventListener('click', () => this.hide());

      // Billing toggle
      const toggle = this.modal.querySelector('#billingToggle');
      toggle?.addEventListener('click', () => {
        this.isAnnual = !this.isAnnual;
        toggle.classList.toggle('active', this.isAnnual);

        // Update labels
        this.modal.querySelectorAll('.toggle-label').forEach(label => {
          const period = label.dataset.period;
          label.classList.toggle('active',
            (period === 'annual' && this.isAnnual) || (period === 'monthly' && !this.isAnnual)
          );
        });

        // Update prices
        this.modal.querySelectorAll('.plan-amount').forEach(el => {
          el.textContent = this.isAnnual ? el.dataset.annual : el.dataset.monthly;
        });

        // Update billed text
        this.modal.querySelectorAll('.plan-billed').forEach(el => {
          el.textContent = this.isAnnual ? 'Billed annually' : 'Billed monthly';
        });
      });

      // Subscribe buttons
      this.modal.querySelectorAll('[data-action="subscribe"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const tier = btn.dataset.tier;
          this.subscribe(tier);
        });
      });

      // Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.modal.classList.contains('active')) {
          this.hide();
        }
      });
    }

    async show(feature = null) {
      // Check if user is owner or has enterprise tier - bypass paywall
      if (window.Security?.RoleValidator) {
        const isOwner = await window.Security.RoleValidator.isOwner();
        if (isOwner) {
          // Owner access - paywall bypassed
          return; // Don't show paywall for owners
        }
      }

      if (window.Security?.SubscriptionValidator) {
        const subscription = await window.Security.SubscriptionValidator.validate();
        if (subscription.tier === 'enterprise') {
          // Enterprise tier - paywall bypassed
          return; // Don't show paywall for enterprise users
        }
      }

      if (!this.modal) this.createModal();

      // Update subtitle based on feature
      const subtitle = this.modal.querySelector('#paywallSubtitle');
      if (feature && subtitle) {
        const featureNames = {
          'anti-fraud-shield': 'Anti-Fraud Shield',
          'workflows': 'Workflow Automation',
          'api-console': 'API Console',
          'advanced-analytics': 'Advanced Analytics',
          'version-control': 'Version Control',
          'team-collaboration': 'Team Collaboration'
        };
        const name = featureNames[feature] || feature;
        subtitle.textContent = `Upgrade to unlock ${name} and other premium features.`;
      }

      this.modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    hide() {
      if (this.modal) {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    }

    async subscribe(tier) {
      // Log paywall shown event for audit
      if (window.Security?.AuditLog) {
        await window.Security.AuditLog.log(
          window.Security.AuditLog.ACTIONS.PAYWALL_SHOWN,
          { tier, currentTier: this.currentTier, billingPeriod: this.isAnnual ? 'annual' : 'monthly' }
        );
      }

      // Subscribing to plan

      // Show loading state
      const btn = this.modal.querySelector(`[data-tier="${tier}"] .plan-btn`);
      if (btn) {
        btn.textContent = 'Processing...';
        btn.disabled = true;
      }

      // Log subscription attempt for audit
      if (window.Security?.AuditLog) {
        await window.Security.AuditLog.logSubscriptionChange(
          this.currentTier,
          tier,
          { billingPeriod: this.isAnnual ? 'annual' : 'monthly', status: 'initiated' }
        );
      }

      // Simulate API call (in production, this would be a Stripe checkout session)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Redirect to checkout page with subscription details
      // Note: The actual subscription should be created server-side via Stripe webhook
      window.location.href = `upgrade.html?plan=${tier}&billing=${this.isAnnual ? 'annual' : 'monthly'}`;
    }

    // Check if user has access to a feature (synchronous check using cached tier)
    hasAccess(feature) {
      const requiredTier = FEATURE_REQUIREMENTS[feature];
      if (!requiredTier) return true;

      const tierOrder = ['free', 'pro', 'enterprise'];
      const currentIndex = tierOrder.indexOf(this.currentTier);
      const requiredIndex = tierOrder.indexOf(requiredTier);

      return currentIndex >= requiredIndex;
    }

    // Check if user has access to a feature (async server-validated)
    async hasAccessAsync(feature) {
      // Use server-side validation if available
      if (window.Security?.SubscriptionValidator) {
        const result = await window.Security.SubscriptionValidator.hasAccess(feature);
        return result.hasAccess;
      }
      // Fallback to synchronous check
      return this.hasAccess(feature);
    }

    // Check subscription limits
    checkLimit(limitType, currentValue) {
      const tier = SUBSCRIPTION_TIERS[this.currentTier];
      if (!tier) return true;

      const limit = tier.limits[limitType];
      if (limit === -1) return true; // unlimited
      return currentValue < limit;
    }

    // Create a paywall banner
    createBanner(containerId, options = {}) {
      const container = document.getElementById(containerId);
      if (!container) return;

      const {
        title = 'Upgrade to Pro',
        text = 'Unlock this feature and more with a Pro subscription.',
        buttonText = 'Upgrade Now',
        feature = null
      } = options;

      const banner = document.createElement('div');
      banner.className = 'paywall-banner';
      banner.innerHTML = `
        <div class="paywall-banner-content">
          <div class="paywall-banner-title">
            <i class="fas fa-lock"></i>
            ${title}
          </div>
          <div class="paywall-banner-text">${text}</div>
        </div>
        <button class="paywall-banner-btn">${buttonText}</button>
      `;

      banner.querySelector('.paywall-banner-btn').addEventListener('click', () => {
        this.show(feature);
      });

      container.appendChild(banner);
      return banner;
    }

    // Lock a feature element
    lockFeature(element, options = {}) {
      if (!element) return;

      const {
        message = 'Pro Feature',
        feature = null
      } = options;

      element.classList.add('feature-locked');

      const badge = document.createElement('div');
      badge.className = 'feature-locked-badge';
      badge.innerHTML = `<i class="fas fa-lock"></i> ${message}`;
      badge.addEventListener('click', () => this.show(feature));

      element.appendChild(badge);
    }
  }

  // ============================================
  // INITIALIZE
  // ============================================
  const Paywall = new PaywallManager();

  // Export globally
  window.Paywall = Paywall;
  window.SUBSCRIPTION_TIERS = SUBSCRIPTION_TIERS;

  // Listen for auth state changes
  window.addEventListener('authStateChange', () => {
    Paywall.loadSubscription();
  });

})();
