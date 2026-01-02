/* ============================================
   PROMPTING IT - FORM VALIDATION MODULE
   Production-ready form validation with accessibility
   ============================================ */

(function() {
  'use strict';

  // Validation rules and patterns
  const ValidationRules = {
    email: {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: 'Please enter a valid email address'
    },
    password: {
      minLength: 8,
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
      message: 'Password must be at least 8 characters with uppercase, lowercase, and number'
    },
    passwordSimple: {
      minLength: 8,
      message: 'Password must be at least 8 characters'
    },
    name: {
      minLength: 1,
      maxLength: 100,
      pattern: /^[a-zA-Z\s\-']+$/,
      message: 'Please enter a valid name'
    },
    phone: {
      pattern: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
      message: 'Please enter a valid phone number'
    },
    url: {
      pattern: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
      message: 'Please enter a valid URL'
    },
    number: {
      pattern: /^-?\d*\.?\d+$/,
      message: 'Please enter a valid number'
    },
    alphanumeric: {
      pattern: /^[a-zA-Z0-9]+$/,
      message: 'Only letters and numbers are allowed'
    }
  };

  // Form Validator class
  class FormValidator {
    constructor(form, options = {}) {
      this.form = typeof form === 'string' ? document.querySelector(form) : form;
      if (!this.form) {
        console.warn('FormValidator: Form not found');
        return;
      }

      this.options = {
        validateOnBlur: true,
        validateOnInput: true,
        showSuccessState: true,
        scrollToError: true,
        focusOnError: true,
        debounceMs: 300,
        ...options
      };

      this.errors = new Map();
      this.touched = new Set();
      this.debounceTimers = new Map();

      this.init();
    }

    init() {
      // Prevent native validation
      this.form.setAttribute('novalidate', 'true');

      // Get all form inputs
      this.inputs = this.form.querySelectorAll('input, textarea, select');

      // Set up event listeners
      this.inputs.forEach(input => {
        if (this.options.validateOnBlur) {
          input.addEventListener('blur', () => this.handleBlur(input));
        }
        if (this.options.validateOnInput) {
          input.addEventListener('input', () => this.handleInput(input));
        }
        // Add ARIA attributes
        this.setupAria(input);
      });

      // Handle form submission
      this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    setupAria(input) {
      if (!input.id) {
        input.id = `input-${Math.random().toString(36).substr(2, 9)}`;
      }

      // Create error message container if it doesn't exist
      let errorEl = this.getErrorElement(input);
      if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'form-error';
        errorEl.id = `${input.id}-error`;
        errorEl.setAttribute('aria-live', 'polite');
        errorEl.setAttribute('role', 'alert');

        const parent = input.closest('.form-group') || input.parentElement;
        parent.appendChild(errorEl);
      }

      input.setAttribute('aria-describedby', errorEl.id);
    }

    getErrorElement(input) {
      const parent = input.closest('.form-group') || input.parentElement;
      return parent.querySelector('.form-error');
    }

    handleBlur(input) {
      this.touched.add(input.name || input.id);
      this.validateField(input);
    }

    handleInput(input) {
      // Debounce input validation
      const key = input.name || input.id;
      clearTimeout(this.debounceTimers.get(key));

      this.debounceTimers.set(key, setTimeout(() => {
        if (this.touched.has(key) || this.errors.has(key)) {
          this.validateField(input);
        }
      }, this.options.debounceMs));
    }

    handleSubmit(e) {
      // Mark all fields as touched
      this.inputs.forEach(input => {
        this.touched.add(input.name || input.id);
      });

      const isValid = this.validateAll();

      if (!isValid) {
        e.preventDefault();

        // Find first error and scroll/focus
        const firstError = this.form.querySelector('.form-group.has-error input, .form-group.has-error textarea, .form-group.has-error select');
        if (firstError) {
          if (this.options.scrollToError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          if (this.options.focusOnError) {
            setTimeout(() => firstError.focus(), 300);
          }
        }
      }

      return isValid;
    }

    validateField(input) {
      const key = input.name || input.id;
      const value = input.value.trim();
      const errors = [];

      // Required validation
      if (input.required && !value) {
        errors.push(input.dataset.requiredMessage || 'This field is required');
      }

      // Only validate further if there's a value
      if (value) {
        // Type-specific validation
        const type = input.type || 'text';
        const rule = input.dataset.validate || type;

        if (ValidationRules[rule]) {
          const ruleConfig = ValidationRules[rule];

          if (ruleConfig.pattern && !ruleConfig.pattern.test(value)) {
            errors.push(input.dataset.patternMessage || ruleConfig.message);
          }

          if (ruleConfig.minLength && value.length < ruleConfig.minLength) {
            errors.push(input.dataset.minMessage || `Must be at least ${ruleConfig.minLength} characters`);
          }

          if (ruleConfig.maxLength && value.length > ruleConfig.maxLength) {
            errors.push(input.dataset.maxMessage || `Must be no more than ${ruleConfig.maxLength} characters`);
          }
        }

        // HTML5 validation attributes
        if (input.minLength && value.length < input.minLength) {
          errors.push(input.dataset.minMessage || `Must be at least ${input.minLength} characters`);
        }

        if (input.maxLength && value.length > input.maxLength) {
          errors.push(input.dataset.maxMessage || `Must be no more than ${input.maxLength} characters`);
        }

        if (input.min && parseFloat(value) < parseFloat(input.min)) {
          errors.push(input.dataset.minMessage || `Must be at least ${input.min}`);
        }

        if (input.max && parseFloat(value) > parseFloat(input.max)) {
          errors.push(input.dataset.maxMessage || `Must be no more than ${input.max}`);
        }

        if (input.pattern) {
          const regex = new RegExp(input.pattern);
          if (!regex.test(value)) {
            errors.push(input.dataset.patternMessage || 'Please match the required format');
          }
        }

        // Email validation
        if (type === 'email' && !ValidationRules.email.pattern.test(value)) {
          errors.push(input.dataset.patternMessage || ValidationRules.email.message);
        }

        // Custom validation function
        if (input.dataset.customValidate && window[input.dataset.customValidate]) {
          const customResult = window[input.dataset.customValidate](value, input);
          if (customResult !== true) {
            errors.push(customResult || 'Invalid value');
          }
        }

        // Match validation (for confirm password, etc.)
        if (input.dataset.match) {
          const matchInput = this.form.querySelector(`[name="${input.dataset.match}"], #${input.dataset.match}`);
          if (matchInput && value !== matchInput.value) {
            errors.push(input.dataset.matchMessage || 'Values do not match');
          }
        }
      }

      // Update error state
      if (errors.length > 0) {
        this.errors.set(key, errors[0]);
        this.showError(input, errors[0]);
        return false;
      } else {
        this.errors.delete(key);
        this.showSuccess(input);
        return true;
      }
    }

    validateAll() {
      let isValid = true;

      this.inputs.forEach(input => {
        if (!this.validateField(input)) {
          isValid = false;
        }
      });

      return isValid;
    }

    showError(input, message) {
      const parent = input.closest('.form-group') || input.parentElement;
      parent.classList.remove('has-success');
      parent.classList.add('has-error');

      input.setAttribute('aria-invalid', 'true');

      const errorEl = this.getErrorElement(input);
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
      }
    }

    showSuccess(input) {
      const parent = input.closest('.form-group') || input.parentElement;
      parent.classList.remove('has-error');

      if (this.options.showSuccessState && input.value.trim()) {
        parent.classList.add('has-success');
      } else {
        parent.classList.remove('has-success');
      }

      input.setAttribute('aria-invalid', 'false');

      const errorEl = this.getErrorElement(input);
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
      }
    }

    // Public API
    isValid() {
      return this.validateAll();
    }

    getErrors() {
      return Object.fromEntries(this.errors);
    }

    reset() {
      this.errors.clear();
      this.touched.clear();
      this.inputs.forEach(input => {
        const parent = input.closest('.form-group') || input.parentElement;
        parent.classList.remove('has-error', 'has-success');
        input.setAttribute('aria-invalid', 'false');
        const errorEl = this.getErrorElement(input);
        if (errorEl) {
          errorEl.textContent = '';
          errorEl.style.display = 'none';
        }
      });
    }

    addCustomRule(name, validator, message) {
      ValidationRules[name] = {
        validate: validator,
        message: message
      };
    }
  }

  // Global validation utility functions
  const ValidationUtils = {
    isEmail: (value) => ValidationRules.email.pattern.test(value),
    isPhone: (value) => ValidationRules.phone.pattern.test(value),
    isUrl: (value) => ValidationRules.url.pattern.test(value),
    isNumber: (value) => ValidationRules.number.pattern.test(value),

    isEmpty: (value) => !value || value.trim() === '',

    minLength: (value, min) => value.length >= min,
    maxLength: (value, max) => value.length <= max,

    passwordStrength: (password) => {
      if (!password) return 0;
      let strength = 0;
      if (password.length >= 8) strength++;
      if (password.length >= 12) strength++;
      if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
      if (/\d/.test(password)) strength++;
      if (/[^a-zA-Z\d]/.test(password)) strength++;
      return strength;
    },

    sanitize: (value) => {
      if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(value);
      }
      // Basic fallback sanitization
      return value.replace(/[<>]/g, '');
    }
  };

  // Auto-initialize forms with data-validate-form attribute
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-validate-form]').forEach(form => {
      new FormValidator(form);
    });
  });

  // Export to window
  window.FormValidator = FormValidator;
  window.ValidationUtils = ValidationUtils;
  window.ValidationRules = ValidationRules;

})();
