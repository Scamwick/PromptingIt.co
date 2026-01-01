/* ============================================
   PROMPTING IT - SECURITY MODULE
   Server-side validation, Rate Limiting & Audit Logging
   ============================================ */

(function() {
  'use strict';

  // ============================================
  // AUDIT LOGGING SERVICE
  // Tracks critical events for security and compliance
  // ============================================
  const AuditLog = {
    // Log action types for financial and security events
    ACTIONS: {
      // Authentication events
      LOGIN_SUCCESS: 'auth.login.success',
      LOGIN_FAILED: 'auth.login.failed',
      LOGOUT: 'auth.logout',
      SIGNUP: 'auth.signup',
      PASSWORD_RESET: 'auth.password_reset',
      PASSWORD_CHANGED: 'auth.password_changed',

      // Subscription/Financial events
      SUBSCRIPTION_CREATED: 'subscription.created',
      SUBSCRIPTION_UPGRADED: 'subscription.upgraded',
      SUBSCRIPTION_DOWNGRADED: 'subscription.downgraded',
      SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
      PAYMENT_ATTEMPTED: 'payment.attempted',
      PAYMENT_SUCCESS: 'payment.success',
      PAYMENT_FAILED: 'payment.failed',

      // Feature access events
      FEATURE_ACCESS_GRANTED: 'feature.access.granted',
      FEATURE_ACCESS_DENIED: 'feature.access.denied',
      PAYWALL_SHOWN: 'paywall.shown',

      // Admin events
      ADMIN_ACCESS: 'admin.access',
      ADMIN_ACCESS_DENIED: 'admin.access.denied',
      USER_ROLE_CHANGED: 'admin.user.role_changed',

      // Account events
      ACCOUNT_DELETED: 'account.deleted',
      PROFILE_UPDATED: 'profile.updated'
    },

    // Log an activity event
    async log(action, metadata = {}) {
      const supabase = window.PromptingItSupabase?.getClient();
      if (!supabase) {
        console.warn('Supabase not initialized, audit log skipped');
        return;
      }

      try {
        const user = window.Auth?.getUser();

        const logEntry = {
          user_id: user?.id || null,
          action: action,
          resource_type: metadata.resourceType || null,
          resource_id: metadata.resourceId || null,
          metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
            page: window.location.pathname,
            userAgent: navigator.userAgent
          },
          ip_address: null, // Will be set by server/edge function
          user_agent: navigator.userAgent
        };

        const { error } = await supabase
          .from('activity_log')
          .insert(logEntry);

        if (error) {
          console.error('Audit log error:', error);
        }
      } catch (error) {
        console.error('Audit log error:', error);
      }
    },

    // Convenience methods for common events
    async logLogin(success, email, errorMessage = null) {
      await this.log(
        success ? this.ACTIONS.LOGIN_SUCCESS : this.ACTIONS.LOGIN_FAILED,
        { email, error: errorMessage }
      );
    },

    async logSubscriptionChange(oldTier, newTier, stripeDetails = {}) {
      let action = this.ACTIONS.SUBSCRIPTION_CREATED;
      if (oldTier && newTier) {
        const tierOrder = ['free', 'pro', 'enterprise'];
        const oldIndex = tierOrder.indexOf(oldTier);
        const newIndex = tierOrder.indexOf(newTier);
        action = newIndex > oldIndex
          ? this.ACTIONS.SUBSCRIPTION_UPGRADED
          : this.ACTIONS.SUBSCRIPTION_DOWNGRADED;
      }

      await this.log(action, {
        resourceType: 'subscription',
        oldTier,
        newTier,
        ...stripeDetails
      });
    },

    async logPaymentAttempt(success, amount, currency = 'USD', errorMessage = null) {
      await this.log(
        success ? this.ACTIONS.PAYMENT_SUCCESS : this.ACTIONS.PAYMENT_FAILED,
        {
          resourceType: 'payment',
          amount,
          currency,
          error: errorMessage
        }
      );
    },

    async logFeatureAccess(feature, granted, requiredTier = null) {
      await this.log(
        granted ? this.ACTIONS.FEATURE_ACCESS_GRANTED : this.ACTIONS.FEATURE_ACCESS_DENIED,
        {
          resourceType: 'feature',
          feature,
          requiredTier
        }
      );
    },

    async logAdminAccess(page, granted) {
      await this.log(
        granted ? this.ACTIONS.ADMIN_ACCESS : this.ACTIONS.ADMIN_ACCESS_DENIED,
        {
          resourceType: 'admin',
          page
        }
      );
    }
  };

  // ============================================
  // RATE LIMITER
  // Client-side rate limiting (server-side enforcement required)
  // ============================================
  const RateLimiter = {
    limits: new Map(),

    // Default limits
    DEFAULTS: {
      auth: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
      api: { maxAttempts: 100, windowMs: 60 * 1000 }, // 100 requests per minute
      subscription: { maxAttempts: 10, windowMs: 60 * 60 * 1000 } // 10 changes per hour
    },

    // Check if action is rate limited
    isLimited(action, identifier = 'default') {
      const key = `${action}:${identifier}`;
      const limit = this.limits.get(key);

      if (!limit) return false;

      const config = this.DEFAULTS[action] || this.DEFAULTS.api;
      const now = Date.now();

      // Clean expired attempts
      limit.attempts = limit.attempts.filter(t => now - t < config.windowMs);

      return limit.attempts.length >= config.maxAttempts;
    },

    // Record an attempt
    recordAttempt(action, identifier = 'default') {
      const key = `${action}:${identifier}`;
      const config = this.DEFAULTS[action] || this.DEFAULTS.api;
      const now = Date.now();

      if (!this.limits.has(key)) {
        this.limits.set(key, { attempts: [] });
      }

      const limit = this.limits.get(key);
      limit.attempts = limit.attempts.filter(t => now - t < config.windowMs);
      limit.attempts.push(now);
    },

    // Get remaining attempts
    getRemainingAttempts(action, identifier = 'default') {
      const key = `${action}:${identifier}`;
      const config = this.DEFAULTS[action] || this.DEFAULTS.api;
      const limit = this.limits.get(key);

      if (!limit) return config.maxAttempts;

      const now = Date.now();
      const validAttempts = limit.attempts.filter(t => now - t < config.windowMs);

      return Math.max(0, config.maxAttempts - validAttempts.length);
    },

    // Get time until limit resets
    getResetTime(action, identifier = 'default') {
      const key = `${action}:${identifier}`;
      const config = this.DEFAULTS[action] || this.DEFAULTS.api;
      const limit = this.limits.get(key);

      if (!limit || limit.attempts.length === 0) return 0;

      const oldestAttempt = Math.min(...limit.attempts);
      return Math.max(0, config.windowMs - (Date.now() - oldestAttempt));
    },

    // Clear limits for an action
    clear(action, identifier = 'default') {
      const key = `${action}:${identifier}`;
      this.limits.delete(key);
    }
  };

  // ============================================
  // SERVER-SIDE SUBSCRIPTION VALIDATOR
  // Validates subscription status from database
  // ============================================
  const SubscriptionValidator = {
    cachedSubscription: null,
    cacheExpiry: null,
    CACHE_TTL: 5 * 60 * 1000, // 5 minutes

    // Force refresh subscription from server
    async refresh() {
      this.cachedSubscription = null;
      this.cacheExpiry = null;
      return this.validate();
    },

    // Validate subscription from database (not client state)
    async validate() {
      // Check cache
      if (this.cachedSubscription && this.cacheExpiry && Date.now() < this.cacheExpiry) {
        return this.cachedSubscription;
      }

      const supabase = window.PromptingItSupabase?.getClient();
      const user = window.Auth?.getUser();

      if (!supabase || !user) {
        return { valid: false, tier: 'free', error: 'Not authenticated' };
      }

      try {
        // Query subscription directly from database
        const { data: subscription, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Subscription validation error:', error);
          return { valid: false, tier: 'free', error: error.message };
        }

        // Validate subscription status
        const result = {
          valid: true,
          tier: subscription?.tier || 'free',
          status: subscription?.status || 'active',
          promptsUsed: subscription?.prompts_used || 0,
          promptsLimit: subscription?.prompts_limit || 25,
          trialEndsAt: subscription?.trial_ends_at,
          currentPeriodEnd: subscription?.current_period_end,
          isTrialing: subscription?.status === 'trialing',
          isPastDue: subscription?.status === 'past_due'
        };

        // Check if trial has expired
        if (result.isTrialing && result.trialEndsAt) {
          const trialEnd = new Date(result.trialEndsAt);
          if (trialEnd < new Date()) {
            result.tier = 'free';
            result.isTrialing = false;
          }
        }

        // Check if subscription has lapsed
        if (result.currentPeriodEnd) {
          const periodEnd = new Date(result.currentPeriodEnd);
          if (periodEnd < new Date() && result.tier !== 'free') {
            result.tier = 'free';
            result.isLapsed = true;
          }
        }

        // Cache result
        this.cachedSubscription = result;
        this.cacheExpiry = Date.now() + this.CACHE_TTL;

        return result;
      } catch (error) {
        console.error('Subscription validation error:', error);
        return { valid: false, tier: 'free', error: error.message };
      }
    },

    // Check if user has access to a feature (server-validated)
    async hasAccess(feature) {
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

      const requiredTier = FEATURE_REQUIREMENTS[feature];
      if (!requiredTier) return { hasAccess: true, tier: 'free' };

      const subscription = await this.validate();
      const tierOrder = ['free', 'pro', 'enterprise'];
      const currentIndex = tierOrder.indexOf(subscription.tier);
      const requiredIndex = tierOrder.indexOf(requiredTier);

      const hasAccess = currentIndex >= requiredIndex;

      // Log access attempt
      await AuditLog.logFeatureAccess(feature, hasAccess, requiredTier);

      return {
        hasAccess,
        tier: subscription.tier,
        requiredTier
      };
    },

    // Check prompt usage limits (server-validated)
    async checkPromptLimit() {
      const subscription = await this.validate();

      if (subscription.tier === 'pro' || subscription.tier === 'enterprise') {
        return { canCreate: true, remaining: -1 }; // Unlimited
      }

      const remaining = subscription.promptsLimit - subscription.promptsUsed;
      return {
        canCreate: remaining > 0,
        remaining,
        used: subscription.promptsUsed,
        limit: subscription.promptsLimit
      };
    }
  };

  // ============================================
  // ROLE VALIDATOR
  // Validates user role from database
  // ============================================
  const RoleValidator = {
    cachedRole: null,
    cacheExpiry: null,
    CACHE_TTL: 5 * 60 * 1000, // 5 minutes

    // Validate role from database (not client state)
    async validate() {
      // Check cache
      if (this.cachedRole && this.cacheExpiry && Date.now() < this.cacheExpiry) {
        return this.cachedRole;
      }

      const supabase = window.PromptingItSupabase?.getClient();
      const user = window.Auth?.getUser();

      if (!supabase || !user) {
        return { valid: false, role: 'user', isOwner: false, isAdmin: false };
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Role validation error:', error);
          return { valid: false, role: 'user', isOwner: false, isAdmin: false };
        }

        const result = {
          valid: true,
          role: profile?.role || 'user',
          isOwner: profile?.role === 'owner',
          isAdmin: profile?.role === 'admin' || profile?.role === 'owner'
        };

        // Cache result
        this.cachedRole = result;
        this.cacheExpiry = Date.now() + this.CACHE_TTL;

        return result;
      } catch (error) {
        console.error('Role validation error:', error);
        return { valid: false, role: 'user', isOwner: false, isAdmin: false };
      }
    },

    // Check if user is admin/owner (server-validated)
    async isAdmin() {
      const role = await this.validate();
      return role.isAdmin;
    },

    // Check if user is owner (server-validated)
    async isOwner() {
      const role = await this.validate();
      return role.isOwner;
    },

    // Clear cache (use after role changes)
    clearCache() {
      this.cachedRole = null;
      this.cacheExpiry = null;
    }
  };

  // ============================================
  // ACCOUNT DELETION SERVICE
  // Handles GDPR-compliant account deletion
  // ============================================
  const AccountDeletion = {
    // Request account deletion
    async requestDeletion(confirmEmail) {
      const supabase = window.PromptingItSupabase?.getClient();
      const user = window.Auth?.getUser();

      if (!supabase || !user) {
        throw new Error('Not authenticated');
      }

      // Verify email matches
      if (confirmEmail !== user.email) {
        throw new Error('Email confirmation does not match');
      }

      try {
        // Log deletion request
        await AuditLog.log(AuditLog.ACTIONS.ACCOUNT_DELETED, {
          email: user.email,
          requestedAt: new Date().toISOString()
        });

        // Delete user data in order (respecting foreign keys)
        // 1. Delete activity logs
        await supabase.from('activity_log').delete().eq('user_id', user.id);

        // 2. Delete API keys
        await supabase.from('api_keys').delete().eq('user_id', user.id);

        // 3. Delete prompt versions
        const { data: prompts } = await supabase
          .from('prompts')
          .select('id')
          .eq('user_id', user.id);

        if (prompts?.length) {
          const promptIds = prompts.map(p => p.id);
          await supabase.from('prompt_versions').delete().in('prompt_id', promptIds);
        }

        // 4. Delete prompts
        await supabase.from('prompts').delete().eq('user_id', user.id);

        // 5. Delete subscription
        await supabase.from('subscriptions').delete().eq('user_id', user.id);

        // 6. Delete profile
        await supabase.from('profiles').delete().eq('id', user.id);

        // 7. Sign out and delete auth user
        // Note: Deleting auth.users requires service role or admin API
        // For now, sign out the user - full deletion should be triggered via webhook/edge function
        await window.Auth?.signOut();

        return { success: true, message: 'Account deletion initiated' };
      } catch (error) {
        console.error('Account deletion error:', error);
        throw new Error('Failed to delete account: ' + error.message);
      }
    },

    // Export user data (GDPR requirement)
    async exportData() {
      const supabase = window.PromptingItSupabase?.getClient();
      const user = window.Auth?.getUser();

      if (!supabase || !user) {
        throw new Error('Not authenticated');
      }

      try {
        // Fetch all user data
        const [profile, subscription, prompts, purchases, apiKeys, activityLog] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('subscriptions').select('*').eq('user_id', user.id).single(),
          supabase.from('prompts').select('*').eq('user_id', user.id),
          supabase.from('purchases').select('*').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`),
          supabase.from('api_keys').select('id, name, key_prefix, permissions, rate_limit, created_at').eq('user_id', user.id),
          supabase.from('activity_log').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1000)
        ]);

        return {
          exportedAt: new Date().toISOString(),
          user: {
            email: user.email,
            createdAt: user.created_at
          },
          profile: profile.data,
          subscription: subscription.data,
          prompts: prompts.data,
          purchases: purchases.data,
          apiKeys: apiKeys.data,
          activityLog: activityLog.data
        };
      } catch (error) {
        console.error('Data export error:', error);
        throw new Error('Failed to export data: ' + error.message);
      }
    }
  };

  // ============================================
  // SECURE PAGE GUARD
  // Enforces authentication with server validation
  // ============================================
  const SecurePageGuard = {
    // Protected pages requiring authentication
    protectedPages: [
      'creator-dashboard.html',
      'analytics.html',
      'api-console.html',
      'library.html',
      'workspace.html',
      'templates.html',
      'workflows.html',
      'settings.html',
      'anti-fraud-shield.html',
      'playground.html',
      'app.html'
    ],

    // Admin/Owner only pages
    adminPages: [
      'owner-dashboard.html',
      'admin.html'
    ],

    // Paid feature pages
    paidPages: {
      'anti-fraud-shield.html': 'pro',
      'workflows.html': 'pro',
      'api-console.html': 'pro'
    },

    // Enforce page access with server-side validation
    async enforce() {
      const currentPage = window.location.pathname.split('/').pop() || 'index.html';

      // Wait for auth initialization
      await window.Auth?.init();

      // Check if authentication is required
      const requiresAuth = this.protectedPages.includes(currentPage) ||
                          this.adminPages.includes(currentPage);

      if (requiresAuth && !window.Auth?.isAuthenticated()) {
        console.warn('Access denied: Not authenticated');
        await AuditLog.log(AuditLog.ACTIONS.FEATURE_ACCESS_DENIED, {
          page: currentPage,
          reason: 'not_authenticated'
        });
        window.location.href = `login.html?redirect=${encodeURIComponent(currentPage)}`;
        return false;
      }

      // Check admin access with server validation
      if (this.adminPages.includes(currentPage)) {
        const isAdmin = await RoleValidator.isAdmin();

        if (!isAdmin) {
          console.warn('Access denied: Not an admin');
          await AuditLog.logAdminAccess(currentPage, false);
          window.location.href = 'creator-dashboard.html?error=unauthorized';
          return false;
        }

        await AuditLog.logAdminAccess(currentPage, true);
      }

      // Check paid feature access with server validation
      const requiredTier = this.paidPages[currentPage];
      if (requiredTier) {
        const subscription = await SubscriptionValidator.validate();
        const tierOrder = ['free', 'pro', 'enterprise'];
        const currentIndex = tierOrder.indexOf(subscription.tier);
        const requiredIndex = tierOrder.indexOf(requiredTier);

        if (currentIndex < requiredIndex) {
          console.warn('Access denied: Subscription tier insufficient');
          await AuditLog.logFeatureAccess(currentPage, false, requiredTier);

          if (typeof window.Paywall !== 'undefined') {
            window.Paywall.show(currentPage.replace('.html', ''));
          } else {
            window.location.href = `upgrade.html?feature=${encodeURIComponent(currentPage)}`;
          }
          return false;
        }

        await AuditLog.logFeatureAccess(currentPage, true, requiredTier);
      }

      return true;
    }
  };

  // ============================================
  // EXPORT GLOBAL
  // ============================================
  window.Security = {
    AuditLog,
    RateLimiter,
    SubscriptionValidator,
    RoleValidator,
    AccountDeletion,
    SecurePageGuard
  };

  // Auto-enforce on page load (if auth.js is loaded)
  document.addEventListener('DOMContentLoaded', async () => {
    // Give auth.js time to initialize first
    await new Promise(resolve => setTimeout(resolve, 100));

    // Only enforce if we're on a page that needs protection
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const needsProtection = SecurePageGuard.protectedPages.includes(currentPage) ||
                           SecurePageGuard.adminPages.includes(currentPage);

    if (needsProtection && window.Auth) {
      await SecurePageGuard.enforce();
    }
  });

})();
