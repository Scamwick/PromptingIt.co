/* ============================================
   PROMPTING IT - AUTHENTICATION SYSTEM
   Supabase Authentication & Session Management
   ============================================ */

(function() {
  'use strict';

  // ============================================
  // AUTH SERVICE
  // ============================================
  const AuthService = {
    user: null,
    session: null,
    subscriptionTier: 'free', // free, pro, enterprise
    isOwner: false,

    // Initialize auth state
    async init() {
      // Wait for Supabase to be ready
      let supabase;
      try {
        supabase = await window.PromptingItSupabase?.getClientAsync();
      } catch (e) {
        console.warn('Supabase not initialized:', e.message);
        return null;
      }
      if (!supabase) {
        console.warn('Supabase not initialized');
        return null;
      }

      try {
        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session) {
          this.session = session;
          this.user = session.user;
          await this.loadUserProfile();
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
          this.session = session;
          this.user = session?.user || null;

          if (session) {
            await this.loadUserProfile();
          } else {
            this.subscriptionTier = 'free';
            this.isOwner = false;
          }

          // Dispatch custom event for UI updates
          window.dispatchEvent(new CustomEvent('authStateChange', {
            detail: { event, session, user: this.user }
          }));
        });

        return this.user;
      } catch (error) {
        console.error('Auth init error:', error);
        return null;
      }
    },

    // Load user profile and subscription data
    async loadUserProfile() {
      const supabase = window.PromptingItSupabase?.getClient();
      if (!supabase || !this.user) return;

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*, subscriptions(*)')
          .eq('id', this.user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Profile load error:', error);
          return;
        }

        if (profile) {
          this.isOwner = profile.role === 'owner' || profile.role === 'admin';
          this.subscriptionTier = profile.subscriptions?.tier || 'free';
          this.user.profile = profile;
        }
      } catch (error) {
        console.error('Profile load error:', error);
      }
    },

    // Sign up with email and password
    async signUp(email, password, metadata = {}) {
      const supabase = window.PromptingItSupabase?.getClient();
      if (!supabase) throw new Error('Supabase not initialized');

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: metadata.firstName || '',
            last_name: metadata.lastName || '',
            full_name: `${metadata.firstName || ''} ${metadata.lastName || ''}`.trim()
          },
          emailRedirectTo: `${window.location.origin}/creator-dashboard.html`
        }
      });

      if (error) throw error;

      // Note: Profile and subscription are automatically created by database trigger
      // (see supabase-schema.sql handle_new_user() function)
      // No need to create profile here to avoid race conditions and duplicates

      return data;
    },

    // Create user profile in database
    // NOTE: This function is deprecated - profile creation is handled by database trigger
    // (see supabase-schema.sql handle_new_user() function)
    // Kept for backward compatibility but should not be called for new signups
    async createProfile(user, metadata = {}) {
      const supabase = window.PromptingItSupabase?.getClient();
      if (!supabase) return;

      try {
        // Check if profile already exists (trigger may have created it)
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();

        if (existingProfile) {
          // Profile already exists (created by trigger), skip creation
          return;
        }

        // Only create if trigger didn't run (edge case)
        const { error } = await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          first_name: metadata.firstName || '',
          last_name: metadata.lastName || '',
          role: 'user',
          created_at: new Date().toISOString()
        });

        if (error && error.code !== '23505') { // Ignore duplicate key error
          console.error('Profile creation error:', error);
          throw error;
        }

        // Check if subscription exists
        const { data: existingSubscription } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!existingSubscription) {
          // Create default free subscription if trigger didn't create it
          const { error: subscriptionError } = await supabase.from('subscriptions').insert({
            user_id: user.id,
            tier: 'free',
            status: 'active',
            prompts_limit: 25,
            prompts_used: 0,
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days
          });

          if (subscriptionError && subscriptionError.code !== '23505') {
            console.error('Subscription creation error:', subscriptionError);
            throw subscriptionError;
          }
        }
      } catch (error) {
        // Only log non-duplicate errors
        if (error.code !== '23505') {
          console.error('Profile/subscription creation error:', error);
        }
      }
    },

    // Sign in with email and password
    async signIn(email, password) {
      const supabase = window.PromptingItSupabase?.getClient();
      if (!supabase) throw new Error('Supabase not initialized');

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // Update local session state
      if (data?.session) {
        this.session = data.session;
        this.user = data.user;
        await this.loadUserProfile();
      }

      return data;
    },

    // Sign in with OAuth provider (Google, GitHub)
    async signInWithOAuth(provider) {
      const supabase = window.PromptingItSupabase?.getClient();
      if (!supabase) throw new Error('Supabase not initialized');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/creator-dashboard.html`
        }
      });

      if (error) throw error;
      return data;
    },

    // Sign out
    async signOut() {
      const supabase = window.PromptingItSupabase?.getClient();
      if (!supabase) throw new Error('Supabase not initialized');

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      this.user = null;
      this.session = null;
      this.subscriptionTier = 'free';
      this.isOwner = false;

      window.location.href = 'index.html';
    },

    // Send password reset email
    async resetPassword(email) {
      const supabase = window.PromptingItSupabase?.getClient();
      if (!supabase) throw new Error('Supabase not initialized');

      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password.html`
      });

      if (error) throw error;
      return data;
    },

    // Update password
    async updatePassword(newPassword) {
      const supabase = window.PromptingItSupabase?.getClient();
      if (!supabase) throw new Error('Supabase not initialized');

      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      return data;
    },

    // Check if user is authenticated
    isAuthenticated() {
      return !!this.session && !!this.user;
    },

    // Get current user
    getUser() {
      return this.user;
    },

    // Get current session
    getSession() {
      return this.session;
    },

    // Check subscription tier
    getSubscriptionTier() {
      return this.subscriptionTier;
    },

    // Check if user is owner/admin
    checkIsOwner() {
      return this.isOwner;
    }
  };

  // ============================================
  // AUTH GUARDS (Protected Routes)
  // ============================================
  const AuthGuard = {
    // Pages that require authentication
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

    // Pages that require owner/admin access
    ownerPages: [
      'owner-dashboard.html',
      'admin.html'
    ],

    // Pages that require paid subscription
    paidPages: [
      'anti-fraud-shield.html',
      'workflows.html',
      'api-console.html'
    ],

    // Check page access
    async checkAccess() {
      const currentPage = window.location.pathname.split('/').pop() || 'index.html';

      // Wait for auth to initialize
      await AuthService.init();

      // Check if page requires authentication
      if (this.protectedPages.includes(currentPage) || this.ownerPages.includes(currentPage)) {
        if (!AuthService.isAuthenticated()) {
          this.redirectToLogin(currentPage);
          return false;
        }
      }

      // Check if page requires owner access
      if (this.ownerPages.includes(currentPage)) {
        if (!AuthService.checkIsOwner()) {
          this.redirectToUnauthorized();
          return false;
        }
      }

      // Check if page requires paid subscription
      if (this.paidPages.includes(currentPage)) {
        const tier = AuthService.getSubscriptionTier();
        if (tier === 'free') {
          this.showPaywall(currentPage);
          return false;
        }
      }

      return true;
    },

    // Redirect to login
    redirectToLogin(returnTo) {
      const returnUrl = encodeURIComponent(returnTo);
      window.location.href = `login.html?redirect=${returnUrl}`;
    },

    // Redirect to unauthorized page
    redirectToUnauthorized() {
      window.location.href = 'creator-dashboard.html?error=unauthorized';
    },

    // Show paywall modal
    showPaywall(feature) {
      if (typeof window.Paywall !== 'undefined') {
        window.Paywall.show(feature);
      } else {
        window.location.href = `upgrade.html?feature=${encodeURIComponent(feature)}`;
      }
    }
  };

  // ============================================
  // AUTH UI HELPERS
  // ============================================
  const AuthUI = {
    // Show loading state on button
    setLoading(button, loading, originalText) {
      if (loading) {
        button.dataset.originalText = button.textContent;
        button.textContent = 'Loading...';
        button.disabled = true;
        button.style.opacity = '0.7';
      } else {
        button.textContent = originalText || button.dataset.originalText;
        button.disabled = false;
        button.style.opacity = '1';
      }
    },

    // Show error message
    showError(message, containerId = 'authError') {
      let errorEl = document.getElementById(containerId);
      if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.id = containerId;
        errorEl.className = 'auth-error';
        errorEl.style.cssText = `
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 16px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        `;
        const form = document.querySelector('form');
        if (form) {
          form.insertBefore(errorEl, form.firstChild);
        }
      }
      errorEl.innerHTML = `<span style="font-size: 16px;">⚠</span> ${message}`;
      errorEl.style.display = 'flex';
    },

    // Hide error message
    hideError(containerId = 'authError') {
      const errorEl = document.getElementById(containerId);
      if (errorEl) {
        errorEl.style.display = 'none';
      }
    },

    // Hide success message
    hideSuccess(containerId = 'authSuccess') {
      const successEl = document.getElementById(containerId);
      if (successEl) {
        successEl.style.display = 'none';
      }
    },

    // Show success message
    showSuccess(message, containerId = 'authSuccess') {
      let successEl = document.getElementById(containerId);
      if (!successEl) {
        successEl = document.createElement('div');
        successEl.id = containerId;
        successEl.className = 'auth-success';
        successEl.style.cssText = `
          background: rgba(52, 211, 153, 0.1);
          border: 1px solid rgba(52, 211, 153, 0.3);
          color: #34d399;
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 16px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        `;
        const form = document.querySelector('form');
        if (form) {
          form.insertBefore(successEl, form.firstChild);
        }
      }
      successEl.innerHTML = `<span style="font-size: 16px;">✓</span> ${message}`;
      successEl.style.display = 'flex';
    },

    // Update UI for authenticated user
    updateAuthState(user) {
      const authLinks = document.querySelectorAll('[data-auth-link]');
      const userMenus = document.querySelectorAll('[data-user-menu]');
      const userNames = document.querySelectorAll('[data-user-name]');
      const userEmails = document.querySelectorAll('[data-user-email]');
      const userAvatars = document.querySelectorAll('[data-user-avatar]');

      if (user) {
        // Show user menu, hide auth links
        authLinks.forEach(el => el.style.display = 'none');
        userMenus.forEach(el => el.style.display = 'flex');

        // Update user info
        const displayName = user.user_metadata?.full_name ||
                           user.user_metadata?.first_name ||
                           user.email?.split('@')[0] || 'User';
        userNames.forEach(el => el.textContent = displayName);
        userEmails.forEach(el => el.textContent = user.email || '');

        // Update avatar with initials
        const initials = displayName.split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
        userAvatars.forEach(el => {
          if (el.tagName === 'IMG') {
            el.src = user.user_metadata?.avatar_url || '';
            el.onerror = () => {
              el.style.display = 'none';
              const initialsEl = document.createElement('span');
              initialsEl.textContent = initials;
              el.parentNode.appendChild(initialsEl);
            };
          } else {
            el.textContent = initials;
          }
        });
      } else {
        // Show auth links, hide user menu
        authLinks.forEach(el => el.style.display = 'flex');
        userMenus.forEach(el => el.style.display = 'none');
      }
    }
  };

  // ============================================
  // INITIALIZE AUTH ON PAGE LOAD
  // ============================================
  document.addEventListener('DOMContentLoaded', async () => {
    // Initialize auth
    await AuthService.init();

    // Check page access
    await AuthGuard.checkAccess();

    // Update UI based on auth state
    AuthUI.updateAuthState(AuthService.getUser());

    // Listen for auth state changes
    window.addEventListener('authStateChange', (e) => {
      AuthUI.updateAuthState(e.detail.user);
    });

    // Setup logout buttons
    document.querySelectorAll('[data-logout]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          await AuthService.signOut();
        } catch (error) {
          console.error('Logout error:', error);
        }
      });
    });
  });

  // ============================================
  // EXPORT GLOBAL
  // ============================================
  window.Auth = AuthService;
  window.AuthGuard = AuthGuard;
  window.AuthUI = AuthUI;

})();
