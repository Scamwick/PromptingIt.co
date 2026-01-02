/* ============================================
   PROMPTING IT - ERROR HANDLING MODULE
   Comprehensive error handling with user feedback
   ============================================ */

(function() {
  'use strict';

  const ErrorHandler = {
    // Error type definitions
    TYPES: {
      NETWORK: 'network',
      AUTH: 'auth',
      VALIDATION: 'validation',
      API: 'api',
      PERMISSION: 'permission',
      NOT_FOUND: 'not_found',
      RATE_LIMIT: 'rate_limit',
      SERVER: 'server',
      CLIENT: 'client',
      UNKNOWN: 'unknown'
    },

    // User-friendly error messages
    MESSAGES: {
      network: 'Unable to connect. Please check your internet connection and try again.',
      auth: 'Your session has expired. Please sign in again.',
      validation: 'Please check your input and try again.',
      api: 'Something went wrong while processing your request.',
      permission: 'You don\'t have permission to perform this action.',
      not_found: 'The requested resource was not found.',
      rate_limit: 'Too many requests. Please wait a moment and try again.',
      server: 'Our servers are experiencing issues. Please try again later.',
      client: 'An unexpected error occurred. Please refresh the page.',
      unknown: 'Something went wrong. Please try again.'
    },

    // Retry configuration
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2
    },

    // Error log queue for batching
    errorQueue: [],
    flushTimeout: null,

    // Initialize error handling
    init() {
      this.setupGlobalHandlers();
      this.setupPromiseRejectionHandler();
      this.setupFetchInterceptor();
      this.startErrorFlush();
    },

    // Setup global error handlers
    setupGlobalHandlers() {
      window.onerror = (message, source, lineno, colno, error) => {
        this.handle(error || new Error(message), {
          source,
          lineno,
          colno,
          type: this.TYPES.CLIENT
        });
        return false; // Let browser handle it too
      };
    },

    // Handle unhandled promise rejections
    setupPromiseRejectionHandler() {
      window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason));

        this.handle(error, {
          type: this.TYPES.CLIENT,
          unhandledRejection: true
        });
      });
    },

    // Intercept fetch for automatic error handling
    setupFetchInterceptor() {
      const originalFetch = window.fetch;

      window.fetch = async (...args) => {
        try {
          const response = await originalFetch(...args);

          if (!response.ok) {
            const errorType = this.getErrorTypeFromStatus(response.status);
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.status = response.status;
            error.type = errorType;
            error.response = response;
            throw error;
          }

          return response;
        } catch (error) {
          if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            error.type = this.TYPES.NETWORK;
          }
          throw error;
        }
      };
    },

    // Get error type from HTTP status code
    getErrorTypeFromStatus(status) {
      if (status === 401 || status === 403) return this.TYPES.AUTH;
      if (status === 404) return this.TYPES.NOT_FOUND;
      if (status === 422 || status === 400) return this.TYPES.VALIDATION;
      if (status === 429) return this.TYPES.RATE_LIMIT;
      if (status >= 500) return this.TYPES.SERVER;
      if (status >= 400) return this.TYPES.CLIENT;
      return this.TYPES.UNKNOWN;
    },

    // Main error handler
    handle(error, context = {}) {
      const errorInfo = this.normalizeError(error, context);

      // Log error
      this.logError(errorInfo);

      // Show user notification
      this.notifyUser(errorInfo);

      // Report to analytics if available
      this.reportError(errorInfo);

      return errorInfo;
    },

    // Normalize error to consistent format
    normalizeError(error, context = {}) {
      const type = error.type || context.type || this.TYPES.UNKNOWN;

      return {
        type,
        message: error.message || 'Unknown error',
        userMessage: this.MESSAGES[type] || this.MESSAGES.unknown,
        stack: error.stack,
        status: error.status,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        context: {
          ...context,
          userId: window.Auth?.getUser()?.id,
          page: window.location.pathname
        }
      };
    },

    // Log error to console in development
    logError(errorInfo) {
      if (process?.env?.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
        console.group(`%c[Error] ${errorInfo.type}`, 'color: #ef4444; font-weight: bold');
        console.error(errorInfo.message);
        if (errorInfo.stack) console.log(errorInfo.stack);
        console.log('Context:', errorInfo.context);
        console.groupEnd();
      }
    },

    // Show user-friendly notification
    notifyUser(errorInfo) {
      // Use toast if available, otherwise use alert
      if (typeof window.toast !== 'undefined' && window.toast.show) {
        window.toast.show(errorInfo.userMessage, 'error');
      } else if (typeof window.Toast !== 'undefined') {
        // Try Toast class
        const toast = new window.Toast();
        toast.show(errorInfo.userMessage, 'error');
      } else {
        // Create inline notification
        this.showInlineNotification(errorInfo.userMessage, 'error');
      }
    },

    // Create inline notification if toast not available
    showInlineNotification(message, type = 'error') {
      // Check if notification container exists
      let container = document.getElementById('error-notifications');
      if (!container) {
        container = document.createElement('div');
        container.id = 'error-notifications';
        container.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 10px;
        `;
        document.body.appendChild(container);
      }

      const notification = document.createElement('div');
      notification.className = `notification notification-${type}`;
      notification.style.cssText = `
        padding: 12px 16px;
        background: ${type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(34, 197, 94, 0.95)'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 320px;
        animation: slideIn 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      notification.innerHTML = `
        <span style="flex: 1">${this.escapeHtml(message)}</span>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; font-size: 18px; line-height: 1;">&times;</button>
      `;

      container.appendChild(notification);

      // Auto remove after 5 seconds
      setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => notification.remove(), 300);
      }, 5000);
    },

    // Escape HTML to prevent XSS
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    // Report error to analytics/logging service
    reportError(errorInfo) {
      // Add to queue for batching
      this.errorQueue.push(errorInfo);

      // Flush immediately if critical
      if (errorInfo.type === this.TYPES.SERVER || errorInfo.type === this.TYPES.AUTH) {
        this.flushErrors();
      }
    },

    // Batch send errors to server
    async flushErrors() {
      if (this.errorQueue.length === 0) return;

      const errors = [...this.errorQueue];
      this.errorQueue = [];

      try {
        // Log to Supabase if available
        const supabase = window.PromptingItSupabase?.getClient();
        if (supabase) {
          await supabase.from('error_logs').insert(
            errors.map(e => ({
              type: e.type,
              message: e.message,
              stack: e.stack,
              url: e.url,
              user_id: e.context?.userId,
              metadata: e.context,
              created_at: e.timestamp
            }))
          ).catch(() => {}); // Silently fail
        }
      } catch (e) {
        // Don't throw errors from error handler
        console.warn('Failed to report errors:', e);
      }
    },

    // Start periodic error flush
    startErrorFlush() {
      setInterval(() => this.flushErrors(), 30000); // Every 30 seconds
    },

    // Retry failed operation with exponential backoff
    async retry(operation, options = {}) {
      const config = { ...this.retryConfig, ...options };
      let lastError;

      for (let attempt = 0; attempt < config.maxRetries; attempt++) {
        try {
          return await operation();
        } catch (error) {
          lastError = error;

          // Don't retry certain errors
          if (this.isNonRetryableError(error)) {
            throw error;
          }

          // Calculate delay with exponential backoff
          const delay = Math.min(
            config.baseDelay * Math.pow(config.backoffFactor, attempt),
            config.maxDelay
          );

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      throw lastError;
    },

    // Check if error should not be retried
    isNonRetryableError(error) {
      const nonRetryableTypes = [
        this.TYPES.AUTH,
        this.TYPES.PERMISSION,
        this.TYPES.VALIDATION,
        this.TYPES.NOT_FOUND
      ];
      return nonRetryableTypes.includes(error.type);
    },

    // Wrap async function with error handling
    wrap(fn, context = {}) {
      return async (...args) => {
        try {
          return await fn(...args);
        } catch (error) {
          this.handle(error, context);
          throw error;
        }
      };
    },

    // Create error boundary for sync functions
    tryCatch(fn, fallback, context = {}) {
      try {
        return fn();
      } catch (error) {
        this.handle(error, context);
        return typeof fallback === 'function' ? fallback(error) : fallback;
      }
    },

    // Validate required fields
    validateRequired(data, fields) {
      const missing = fields.filter(field => !data[field]);
      if (missing.length > 0) {
        const error = new Error(`Missing required fields: ${missing.join(', ')}`);
        error.type = this.TYPES.VALIDATION;
        error.fields = missing;
        throw error;
      }
      return true;
    },

    // Create custom error
    createError(message, type = this.TYPES.UNKNOWN, data = {}) {
      const error = new Error(message);
      error.type = type;
      Object.assign(error, data);
      return error;
    }
  };

  // Initialize on load
  ErrorHandler.init();

  // Add CSS for notifications
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(100%); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes fadeOut {
      to { opacity: 0; transform: translateX(100%); }
    }
  `;
  document.head.appendChild(style);

  // Export to window
  window.ErrorHandler = ErrorHandler;

})();
