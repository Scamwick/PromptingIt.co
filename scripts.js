/* ============================================
   PROMPTING IT - PREMIUM INTERACTIONS v2.0
   Advanced JavaScript for Modern UX
   ============================================ */

(function() {
  'use strict';

  // ============================================
  // 1. PARTICLE SYSTEM
  // ============================================
  class ParticleSystem {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext('2d');
      this.particles = [];
      this.mouse = { x: null, y: null, radius: 150 };
      this.animationId = null;

      this.init();
    }

    init() {
      this.resize();
      this.createParticles();
      this.animate();
      this.setupEventListeners();
    }

    resize() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    createParticles() {
      this.particles = [];
      const count = Math.min(100, Math.floor(window.innerWidth / 15));

      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.5 + 0.1,
          hue: Math.random() > 0.7 ? 160 : 180 // Cyan or teal
        });
      }
    }

    animate() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.particles.forEach((p, i) => {
        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off edges
        if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;

        // Mouse interaction
        if (this.mouse.x !== null) {
          const dx = this.mouse.x - p.x;
          const dy = this.mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < this.mouse.radius) {
            const force = (this.mouse.radius - dist) / this.mouse.radius;
            p.x -= dx * force * 0.02;
            p.y -= dy * force * 0.02;
          }
        }

        // Draw particle
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fillStyle = `hsla(${p.hue}, 90%, 75%, ${p.opacity})`;
        this.ctx.fill();

        // Draw connections
        this.particles.slice(i + 1).forEach(p2 => {
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            this.ctx.beginPath();
            this.ctx.moveTo(p.x, p.y);
            this.ctx.lineTo(p2.x, p2.y);
            this.ctx.strokeStyle = `hsla(180, 90%, 75%, ${0.12 * (1 - dist / 120)})`;
            this.ctx.stroke();
          }
        });
      });

      this.animationId = requestAnimationFrame(() => this.animate());
    }

    setupEventListeners() {
      window.addEventListener('resize', () => {
        this.resize();
        this.createParticles();
      });

      window.addEventListener('mousemove', (e) => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
      });

      window.addEventListener('mouseout', () => {
        this.mouse.x = null;
        this.mouse.y = null;
      });
    }

    destroy() {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
    }
  }

  // ============================================
  // 2. SCROLL ANIMATIONS
  // ============================================
  class ScrollAnimations {
    constructor() {
      this.reveals = document.querySelectorAll('.reveal, .reveal-scale, .reveal-left, .reveal-right');
      this.init();
    }

    init() {
      if ('IntersectionObserver' in window) {
        this.observer = new IntersectionObserver(
          (entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Optionally unobserve after animation
                // this.observer.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
        );

        this.reveals.forEach(el => this.observer.observe(el));
      } else {
        // Fallback for browsers without IntersectionObserver
        this.reveals.forEach(el => el.classList.add('visible'));
      }
    }
  }

  // ============================================
  // 3. HEADER SCROLL EFFECT
  // ============================================
  class HeaderEffect {
    constructor() {
      this.header = document.getElementById('header');
      if (!this.header) return;

      this.lastScroll = 0;
      this.init();
    }

    init() {
      window.addEventListener('scroll', () => this.handleScroll(), { passive: true });
      this.handleScroll(); // Check initial state
    }

    handleScroll() {
      const currentScroll = window.scrollY;

      // Add/remove scrolled class
      this.header.classList.toggle('scrolled', currentScroll > 50);

      // Optional: Hide on scroll down, show on scroll up
      // if (currentScroll > this.lastScroll && currentScroll > 200) {
      //   this.header.style.transform = 'translateY(-100%)';
      // } else {
      //   this.header.style.transform = 'translateY(0)';
      // }

      this.lastScroll = currentScroll;
    }
  }

  // ============================================
  // 4. MOBILE MENU
  // ============================================
  class MobileMenu {
    constructor() {
      this.btn = document.querySelector('.mobile-menu-btn');
      this.nav = document.getElementById('mobileNav');
      if (!this.btn || !this.nav) return;

      this.isOpen = false;
      this.init();
    }

    init() {
      this.btn.addEventListener('click', () => this.toggle());

      // Close on link click
      this.nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => this.close());
      });

      // Close on escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) this.close();
      });

      // Close on outside click
      document.addEventListener('click', (e) => {
        if (this.isOpen && !this.nav.contains(e.target) && !this.btn.contains(e.target)) {
          this.close();
        }
      });
    }

    toggle() {
      this.isOpen ? this.close() : this.open();
    }

    open() {
      this.isOpen = true;
      this.nav.classList.add('open');
      this.btn.setAttribute('aria-expanded', 'true');
      this.btn.innerHTML = '&times;';
      document.body.style.overflow = 'hidden';
    }

    close() {
      this.isOpen = false;
      this.nav.classList.remove('open');
      this.btn.setAttribute('aria-expanded', 'false');
      this.btn.innerHTML = '&#9776;';
      document.body.style.overflow = '';
    }
  }

  // ============================================
  // 5. SMOOTH SCROLL
  // ============================================
  class SmoothScroll {
    constructor() {
      this.init();
    }

    init() {
      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => this.handleClick(e, anchor));
      });
    }

    handleClick(e, anchor) {
      const href = anchor.getAttribute('href');
      if (href === '#' || href === '#top') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const headerHeight = document.getElementById('header')?.offsetHeight || 80;
        const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    }
  }

  // ============================================
  // 6. ANIMATED COUNTER
  // ============================================
  class AnimatedCounter {
    constructor() {
      this.metricsBar = document.querySelector('.metrics-bar');
      if (!this.metricsBar) return;

      this.hasAnimated = false;
      this.init();
    }

    init() {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting && !this.hasAnimated) {
              this.hasAnimated = true;
              this.animateAll();
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 }
      );

      observer.observe(this.metricsBar);
    }

    animateAll() {
      this.metricsBar.querySelectorAll('.metric-value').forEach(el => {
        const end = parseFloat(el.dataset.count);
        const prefix = el.dataset.prefix || '';
        const suffix = el.dataset.suffix || '';
        const duration = 2000;

        this.animate(el, end, duration, prefix, suffix);
      });
    }

    animate(el, end, duration, prefix, suffix) {
      const startTime = performance.now();
      const isDecimal = suffix === 'M' || String(end).includes('.');

      const update = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out quart
        const eased = 1 - Math.pow(1 - progress, 4);
        const current = eased * end;

        if (isDecimal) {
          el.textContent = prefix + current.toFixed(1) + suffix;
        } else {
          el.textContent = prefix + Math.floor(current).toLocaleString() + suffix;
        }

        if (progress < 1) {
          requestAnimationFrame(update);
        }
      };

      requestAnimationFrame(update);
    }
  }

  // ============================================
  // 7. PRICING TOGGLE
  // ============================================
  class PricingToggle {
    constructor() {
      this.toggle = document.getElementById('pricingToggle');
      if (!this.toggle) return;

      this.labels = document.querySelectorAll('.pricing-toggle-label');
      this.amounts = document.querySelectorAll('.pricing-amount[data-monthly]');
      this.isAnnual = false;

      this.init();
    }

    init() {
      this.toggle.addEventListener('click', () => this.handleToggle());
    }

    handleToggle() {
      this.isAnnual = !this.isAnnual;

      // Toggle switch state
      this.toggle.classList.toggle('active', this.isAnnual);

      // Update labels
      this.labels.forEach(label => {
        const isActive = (this.isAnnual && label.dataset.billing === 'annual') ||
                        (!this.isAnnual && label.dataset.billing === 'monthly');
        label.classList.toggle('active', isActive);
      });

      // Update prices with animation
      this.amounts.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-10px)';

        setTimeout(() => {
          el.textContent = '$' + (this.isAnnual ? el.dataset.annual : el.dataset.monthly);
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }, 150);
      });
    }
  }

  // ============================================
  // 8. FAQ ACCORDION
  // ============================================
  class FAQAccordion {
    constructor() {
      this.items = document.querySelectorAll('.faq-item');
      if (!this.items.length) return;

      this.init();
    }

    init() {
      this.items.forEach(item => {
        const question = item.querySelector('.faq-question');
        if (question) {
          question.addEventListener('click', () => this.toggle(item));
        }
      });
    }

    toggle(item) {
      const wasOpen = item.classList.contains('open');

      // Close all
      this.items.forEach(i => i.classList.remove('open'));

      // Open clicked if it wasn't open
      if (!wasOpen) {
        item.classList.add('open');
      }
    }
  }

  // ============================================
  // 9. DEMO TABS
  // ============================================
  class DemoTabs {
    constructor() {
      this.tabs = document.querySelectorAll('.demo-tab');
      this.contents = document.querySelectorAll('.demo-code-content');
      if (!this.tabs.length) return;

      this.init();
    }

    init() {
      this.tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => this.activate(index));
      });
    }

    activate(index) {
      this.tabs.forEach((tab, i) => {
        tab.classList.toggle('active', i === index);
      });

      this.contents.forEach((content, i) => {
        if (content) {
          content.style.display = i === index ? 'block' : 'none';
        }
      });
    }
  }

  // ============================================
  // 10. NEWSLETTER FORM
  // ============================================
  class NewsletterForm {
    constructor() {
      this.form = document.getElementById('newsletterForm');
      if (!this.form) return;

      this.init();
    }

    init() {
      this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    handleSubmit(e) {
      e.preventDefault();

      const btn = this.form.querySelector('button');
      const input = this.form.querySelector('input');
      const originalText = btn.textContent;

      // Disable and show loading
      btn.disabled = true;
      btn.textContent = 'Subscribing...';
      btn.style.opacity = '0.7';

      // Simulate API call
      setTimeout(() => {
        btn.textContent = 'Subscribed!';
        btn.style.background = 'var(--emerald-400)';
        btn.style.opacity = '1';
        input.value = '';

        // Reset after delay
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
          btn.disabled = false;
        }, 3000);
      }, 1000);
    }
  }

  // ============================================
  // 11. COOKIE BANNER
  // ============================================
  class CookieBanner {
    constructor() {
      this.banner = document.getElementById('cookieBanner');
      if (!this.banner) return;

      this.init();
    }

    init() {
      // Check if already consented
      if (!localStorage.getItem('cookieConsent')) {
        setTimeout(() => this.show(), 2000);
      }

      // Setup buttons
      this.banner.querySelector('.cookie-btn.accept')?.addEventListener('click', () => {
        this.accept();
      });

      this.banner.querySelector('.cookie-btn.decline')?.addEventListener('click', () => {
        this.decline();
      });
    }

    show() {
      this.banner.classList.add('visible');
    }

    hide() {
      this.banner.classList.remove('visible');
    }

    accept() {
      localStorage.setItem('cookieConsent', 'accepted');
      this.hide();
    }

    decline() {
      localStorage.setItem('cookieConsent', 'declined');
      this.hide();
    }
  }

  // ============================================
  // 12. FORM VALIDATION
  // ============================================
  class FormValidation {
    constructor(formId) {
      this.form = document.getElementById(formId);
      if (!this.form) return;

      this.init();
    }

    init() {
      this.form.addEventListener('submit', (e) => this.handleSubmit(e));

      // Real-time validation
      this.form.querySelectorAll('input').forEach(input => {
        input.addEventListener('blur', () => this.validateField(input));
        input.addEventListener('input', () => this.clearError(input));
      });
    }

    handleSubmit(e) {
      e.preventDefault();

      let isValid = true;
      this.form.querySelectorAll('input[required]').forEach(input => {
        if (!this.validateField(input)) {
          isValid = false;
        }
      });

      if (isValid) {
        // Handle form submission
        this.submitForm();
      }
    }

    validateField(input) {
      const value = input.value.trim();
      const type = input.type;
      let isValid = true;
      let message = '';

      // Required check
      if (input.required && !value) {
        isValid = false;
        message = 'This field is required';
      }
      // Email validation
      else if (type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          isValid = false;
          message = 'Please enter a valid email';
        }
      }
      // Password validation
      else if (type === 'password' && value && value.length < 8) {
        isValid = false;
        message = 'Password must be at least 8 characters';
      }

      if (!isValid) {
        this.showError(input, message);
      } else {
        this.clearError(input);
      }

      return isValid;
    }

    showError(input, message) {
      input.classList.add('input-error');

      let errorEl = input.parentNode.querySelector('.error-message');
      if (!errorEl) {
        errorEl = document.createElement('span');
        errorEl.className = 'error-message';
        input.parentNode.appendChild(errorEl);
      }
      errorEl.textContent = message;
    }

    clearError(input) {
      input.classList.remove('input-error');
      const errorEl = input.parentNode.querySelector('.error-message');
      if (errorEl) {
        errorEl.remove();
      }
    }

    submitForm() {
      const btn = this.form.querySelector('button[type="submit"]');
      const originalText = btn.textContent;

      btn.disabled = true;
      btn.innerHTML = '<span class="loading-spinner"></span> Processing...';

      // Simulate API call
      setTimeout(() => {
        btn.textContent = 'Success!';
        btn.style.background = 'var(--emerald-400)';

        setTimeout(() => {
          // Redirect or show success message
          window.location.href = '/dashboard';
        }, 1000);
      }, 1500);
    }
  }

  // ============================================
  // 13. MAGNETIC BUTTONS (PREMIUM EFFECT)
  // ============================================
  class MagneticButtons {
    constructor() {
      this.buttons = document.querySelectorAll('.btn-magnetic');
      if (!this.buttons.length) return;

      this.init();
    }

    init() {
      this.buttons.forEach(btn => {
        btn.addEventListener('mousemove', (e) => this.handleMove(e, btn));
        btn.addEventListener('mouseleave', (e) => this.handleLeave(e, btn));
      });
    }

    handleMove(e, btn) {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
    }

    handleLeave(e, btn) {
      btn.style.transform = 'translate(0, 0)';
    }
  }

  // ============================================
  // 14. TILT EFFECT (PREMIUM CARDS)
  // ============================================
  class TiltEffect {
    constructor() {
      this.cards = document.querySelectorAll('.card-tilt');
      if (!this.cards.length) return;

      this.init();
    }

    init() {
      this.cards.forEach(card => {
        card.addEventListener('mousemove', (e) => this.handleMove(e, card));
        card.addEventListener('mouseleave', (e) => this.handleLeave(e, card));
      });
    }

    handleMove(e, card) {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    }

    handleLeave(e, card) {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
    }
  }

  // ============================================
  // 15. CURSOR GLOW EFFECT
  // ============================================
  class CursorGlow {
    constructor() {
      this.glow = document.querySelector('.cursor-glow');
      if (!this.glow || window.innerWidth < 1024) return;

      this.init();
    }

    init() {
      document.addEventListener('mousemove', (e) => {
        requestAnimationFrame(() => {
          this.glow.style.left = e.clientX + 'px';
          this.glow.style.top = e.clientY + 'px';
        });
      });
    }
  }

  // ============================================
  // 16. TYPING EFFECT
  // ============================================
  class TypingEffect {
    constructor(elementId, strings, options = {}) {
      this.element = document.getElementById(elementId);
      if (!this.element) return;

      this.strings = strings;
      this.typeSpeed = options.typeSpeed || 50;
      this.deleteSpeed = options.deleteSpeed || 30;
      this.pauseTime = options.pauseTime || 2000;
      this.currentString = 0;
      this.currentChar = 0;
      this.isDeleting = false;

      this.init();
    }

    init() {
      this.type();
    }

    type() {
      const current = this.strings[this.currentString];

      if (this.isDeleting) {
        this.element.textContent = current.substring(0, this.currentChar - 1);
        this.currentChar--;
      } else {
        this.element.textContent = current.substring(0, this.currentChar + 1);
        this.currentChar++;
      }

      let timeout = this.isDeleting ? this.deleteSpeed : this.typeSpeed;

      if (!this.isDeleting && this.currentChar === current.length) {
        timeout = this.pauseTime;
        this.isDeleting = true;
      } else if (this.isDeleting && this.currentChar === 0) {
        this.isDeleting = false;
        this.currentString = (this.currentString + 1) % this.strings.length;
      }

      setTimeout(() => this.type(), timeout);
    }
  }

  // ============================================
  // 17. LAZY LOADING IMAGES
  // ============================================
  class LazyLoader {
    constructor() {
      this.images = document.querySelectorAll('img[data-src]');
      if (!this.images.length) return;

      this.init();
    }

    init() {
      if ('IntersectionObserver' in window) {
        this.observer = new IntersectionObserver(
          (entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                this.loadImage(entry.target);
                this.observer.unobserve(entry.target);
              }
            });
          },
          { rootMargin: '50px' }
        );

        this.images.forEach(img => this.observer.observe(img));
      } else {
        this.images.forEach(img => this.loadImage(img));
      }
    }

    loadImage(img) {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
      img.classList.add('loaded');
    }
  }

  // ============================================
  // INITIALIZE ALL MODULES
  // ============================================
  document.addEventListener('DOMContentLoaded', () => {
    // Core functionality
    new ParticleSystem('particles');
    new ScrollAnimations();
    new HeaderEffect();
    new MobileMenu();
    new SmoothScroll();

    // Interactive components
    new AnimatedCounter();
    new PricingToggle();
    new FAQAccordion();
    new DemoTabs();
    new NewsletterForm();
    new CookieBanner();

    // Premium effects
    new MagneticButtons();
    new TiltEffect();
    new CursorGlow();
    new LazyLoader();

    // Form validation for auth pages
    new FormValidation('loginForm');
    new FormValidation('signupForm');
  });

  // ============================================
  // GLOBAL UTILITY FUNCTIONS
  // ============================================
  window.PromptingIt = {
    // Show toast notification
    toast: function(message, type = 'info', duration = 3000) {
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;

      document.body.appendChild(toast);

      requestAnimationFrame(() => {
        toast.classList.add('visible');
      });

      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    },

    // Debounce utility
    debounce: function(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    // Throttle utility
    throttle: function(func, limit) {
      let inThrottle;
      return function(...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    }
  };

})();
