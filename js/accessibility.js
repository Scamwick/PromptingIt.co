/* ============================================
   PROMPTING IT - ACCESSIBILITY MODULE
   WCAG 2.1 AA compliant accessibility features
   ============================================ */

(function() {
  'use strict';

  const A11y = {
    // Initialize accessibility features
    init() {
      this.addSkipLink();
      this.enhanceButtons();
      this.enhanceLinks();
      this.enhanceImages();
      this.enhanceForms();
      this.enhanceModals();
      this.enhanceTables();
      this.setupKeyboardNav();
      this.setupFocusTrap();
      this.announcePageChanges();
      this.setupReducedMotion();
    },

    // Add skip to main content link
    addSkipLink() {
      const main = document.querySelector('main, .main-content, .dashboard-content, [role="main"]');
      if (!main) return;

      // Ensure main has an ID
      if (!main.id) main.id = 'main-content';
      main.setAttribute('role', 'main');
      main.setAttribute('tabindex', '-1');

      // Check if skip link already exists
      if (document.querySelector('.skip-link')) return;

      const skipLink = document.createElement('a');
      skipLink.href = '#' + main.id;
      skipLink.className = 'skip-link';
      skipLink.textContent = 'Skip to main content';
      skipLink.setAttribute('aria-label', 'Skip navigation and go to main content');

      // Add styles dynamically
      skipLink.style.cssText = `
        position: fixed;
        top: -100px;
        left: 16px;
        z-index: 10000;
        padding: 12px 24px;
        background: var(--glacier, #22d3ee);
        color: var(--surface-0, #000);
        text-decoration: none;
        font-weight: 600;
        border-radius: 8px;
        transition: top 0.2s ease;
      `;

      skipLink.addEventListener('focus', () => {
        skipLink.style.top = '16px';
      });

      skipLink.addEventListener('blur', () => {
        skipLink.style.top = '-100px';
      });

      document.body.insertBefore(skipLink, document.body.firstChild);
    },

    // Enhance buttons with proper ARIA
    enhanceButtons() {
      document.querySelectorAll('button, [role="button"]').forEach(btn => {
        // Ensure buttons have accessible names
        if (!btn.textContent.trim() && !btn.getAttribute('aria-label') && !btn.getAttribute('aria-labelledby')) {
          // Try to get label from icon or title
          const icon = btn.querySelector('i, svg');
          const title = btn.getAttribute('title');
          if (title) {
            btn.setAttribute('aria-label', title);
          } else if (icon && icon.className) {
            // Extract icon name from class (e.g., fa-search -> search)
            const iconName = icon.className.match(/fa-(\w+)/);
            if (iconName) {
              btn.setAttribute('aria-label', iconName[1].replace(/-/g, ' '));
            }
          }
        }

        // Add button role if missing
        if (btn.tagName !== 'BUTTON' && !btn.getAttribute('role')) {
          btn.setAttribute('role', 'button');
          if (!btn.getAttribute('tabindex')) {
            btn.setAttribute('tabindex', '0');
          }
        }

        // Handle icon-only buttons
        if (btn.querySelector('i, svg') && !btn.textContent.trim()) {
          const srText = document.createElement('span');
          srText.className = 'sr-only';
          srText.textContent = btn.getAttribute('aria-label') || 'Button';
          srText.style.cssText = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;';
          btn.appendChild(srText);
        }
      });
    },

    // Enhance links with proper ARIA
    enhanceLinks() {
      document.querySelectorAll('a').forEach(link => {
        // Add external link indicators
        if (link.hostname && link.hostname !== window.location.hostname) {
          if (!link.getAttribute('rel')) {
            link.setAttribute('rel', 'noopener noreferrer');
          }
          if (!link.getAttribute('aria-label') && link.textContent.trim()) {
            link.setAttribute('aria-label', link.textContent.trim() + ' (opens in new tab)');
          }
          if (link.getAttribute('target') === '_blank') {
            // Add screen reader text for new tab indicator
            if (!link.querySelector('.sr-only')) {
              const srText = document.createElement('span');
              srText.className = 'sr-only';
              srText.textContent = ' (opens in new tab)';
              srText.style.cssText = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;';
              link.appendChild(srText);
            }
          }
        }

        // Ensure links have accessible names
        if (!link.textContent.trim() && !link.getAttribute('aria-label') && !link.getAttribute('aria-labelledby')) {
          const title = link.getAttribute('title');
          const img = link.querySelector('img');
          if (title) {
            link.setAttribute('aria-label', title);
          } else if (img && img.alt) {
            link.setAttribute('aria-label', img.alt);
          }
        }
      });
    },

    // Enhance images with alt text
    enhanceImages() {
      document.querySelectorAll('img').forEach(img => {
        if (!img.getAttribute('alt')) {
          // If decorative, set empty alt
          if (img.getAttribute('role') === 'presentation' || img.closest('[aria-hidden="true"]')) {
            img.setAttribute('alt', '');
          } else {
            // Try to generate alt from filename or set as decorative
            const src = img.src;
            const filename = src.split('/').pop().split('.')[0];
            if (filename && filename.length > 2) {
              img.setAttribute('alt', filename.replace(/[-_]/g, ' '));
            } else {
              img.setAttribute('alt', '');
              img.setAttribute('role', 'presentation');
            }
          }
        }
      });
    },

    // Enhance forms with ARIA
    enhanceForms() {
      document.querySelectorAll('form').forEach(form => {
        // Ensure form has a name
        if (!form.getAttribute('aria-label') && !form.getAttribute('aria-labelledby')) {
          const heading = form.querySelector('h1, h2, h3, h4, h5, h6');
          if (heading) {
            if (!heading.id) heading.id = 'form-heading-' + Math.random().toString(36).substr(2, 9);
            form.setAttribute('aria-labelledby', heading.id);
          }
        }
      });

      // Enhance form inputs
      document.querySelectorAll('input, textarea, select').forEach(input => {
        // Link labels to inputs
        const label = input.closest('.form-group')?.querySelector('label');
        if (label && !label.getAttribute('for') && input.id) {
          label.setAttribute('for', input.id);
        }

        // Add aria-required for required fields
        if (input.required) {
          input.setAttribute('aria-required', 'true');
          // Mark label as required
          if (label && !label.classList.contains('required')) {
            label.classList.add('required');
          }
        }

        // Add autocomplete suggestions for common fields
        this.addAutocomplete(input);
      });
    },

    // Add autocomplete attributes
    addAutocomplete(input) {
      const name = (input.name || input.id || '').toLowerCase();
      const type = input.type;

      const autocompleteMap = {
        email: 'email',
        password: input.closest('form')?.id?.includes('signup') ? 'new-password' : 'current-password',
        firstName: 'given-name',
        first_name: 'given-name',
        lastname: 'family-name',
        last_name: 'family-name',
        phone: 'tel',
        telephone: 'tel',
        address: 'street-address',
        city: 'address-level2',
        state: 'address-level1',
        zip: 'postal-code',
        postal: 'postal-code',
        country: 'country-name',
        cc: 'cc-number',
        cvv: 'cc-csc',
        exp: 'cc-exp'
      };

      for (const [key, value] of Object.entries(autocompleteMap)) {
        if (name.includes(key) && !input.getAttribute('autocomplete')) {
          input.setAttribute('autocomplete', value);
          break;
        }
      }
    },

    // Enhance modals with ARIA
    enhanceModals() {
      document.querySelectorAll('.modal, [role="dialog"], .modal-overlay').forEach(modal => {
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');

        // Find modal title
        const title = modal.querySelector('h1, h2, h3, .modal-title');
        if (title) {
          if (!title.id) title.id = 'modal-title-' + Math.random().toString(36).substr(2, 9);
          modal.setAttribute('aria-labelledby', title.id);
        }

        // Ensure close button is accessible
        const closeBtn = modal.querySelector('.modal-close, [data-dismiss="modal"], .close-btn');
        if (closeBtn) {
          if (!closeBtn.getAttribute('aria-label')) {
            closeBtn.setAttribute('aria-label', 'Close dialog');
          }
        }
      });
    },

    // Enhance tables with ARIA
    enhanceTables() {
      document.querySelectorAll('table').forEach(table => {
        if (!table.getAttribute('role')) {
          table.setAttribute('role', 'table');
        }

        // Add scope to header cells
        table.querySelectorAll('th').forEach(th => {
          if (!th.getAttribute('scope')) {
            th.setAttribute('scope', th.closest('thead') ? 'col' : 'row');
          }
        });

        // Wrap in scrollable container if needed
        if (!table.closest('.table-responsive') && table.scrollWidth > table.clientWidth) {
          const wrapper = document.createElement('div');
          wrapper.className = 'table-responsive';
          wrapper.setAttribute('role', 'region');
          wrapper.setAttribute('aria-label', 'Scrollable table');
          wrapper.setAttribute('tabindex', '0');
          table.parentNode.insertBefore(wrapper, table);
          wrapper.appendChild(table);
        }
      });
    },

    // Setup keyboard navigation
    setupKeyboardNav() {
      // Make sure interactive elements are keyboard accessible
      document.querySelectorAll('[onclick]').forEach(el => {
        if (!el.getAttribute('tabindex') && el.tagName !== 'BUTTON' && el.tagName !== 'A' && el.tagName !== 'INPUT') {
          el.setAttribute('tabindex', '0');
          el.setAttribute('role', 'button');

          // Handle Enter and Space for activation
          el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              el.click();
            }
          });
        }
      });

      // Escape key to close modals
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const modal = document.querySelector('.modal.show, .modal-overlay.show, [role="dialog"]:not([hidden])');
          if (modal) {
            const closeBtn = modal.querySelector('.modal-close, [data-dismiss="modal"], .close-btn');
            if (closeBtn) closeBtn.click();
          }
        }
      });
    },

    // Focus trap for modals
    setupFocusTrap() {
      const trapFocus = (modal) => {
        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        modal.addEventListener('keydown', (e) => {
          if (e.key !== 'Tab') return;

          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        });
      };

      // Watch for modal opens
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const target = mutation.target;
            if (target.classList.contains('show') && (target.classList.contains('modal') || target.classList.contains('modal-overlay'))) {
              trapFocus(target);
              // Focus first focusable element
              const firstFocusable = target.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
              if (firstFocusable) setTimeout(() => firstFocusable.focus(), 100);
            }
          }
        });
      });

      document.querySelectorAll('.modal, .modal-overlay, [role="dialog"]').forEach(modal => {
        observer.observe(modal, { attributes: true });
      });
    },

    // Announce page changes to screen readers
    announcePageChanges() {
      // Create live region for announcements
      let announcer = document.getElementById('a11y-announcer');
      if (!announcer) {
        announcer = document.createElement('div');
        announcer.id = 'a11y-announcer';
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('aria-atomic', 'true');
        announcer.className = 'sr-only';
        announcer.style.cssText = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;';
        document.body.appendChild(announcer);
      }

      // Public method to announce messages
      window.announce = (message, priority = 'polite') => {
        announcer.setAttribute('aria-live', priority);
        announcer.textContent = '';
        setTimeout(() => {
          announcer.textContent = message;
        }, 100);
      };
    },

    // Setup reduced motion preference
    setupReducedMotion() {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

      const updateMotion = () => {
        if (prefersReducedMotion.matches) {
          document.body.classList.add('reduce-motion');
        } else {
          document.body.classList.remove('reduce-motion');
        }
      };

      updateMotion();
      prefersReducedMotion.addEventListener('change', updateMotion);
    }
  };

  // Initialize on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    A11y.init();
  });

  // Export to window
  window.A11y = A11y;

})();
