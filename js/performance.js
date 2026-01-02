/* ============================================
   PROMPTING IT - PERFORMANCE OPTIMIZATION MODULE
   Lazy loading, debouncing, caching, and optimizations
   ============================================ */

(function() {
  'use strict';

  const Performance = {
    // Configuration
    config: {
      lazyLoadThreshold: 100, // pixels before viewport
      debounceDelay: 150,
      throttleDelay: 100,
      cacheMaxAge: 5 * 60 * 1000, // 5 minutes
      preloadDelay: 2000 // wait before preloading
    },

    // Cache for memoization
    cache: new Map(),

    // Initialize performance optimizations
    init() {
      this.setupLazyLoading();
      this.optimizeEventListeners();
      this.setupIntersectionObserver();
      this.deferNonCriticalJS();
      this.optimizeScrolling();
      this.setupResourceHints();
      this.measurePerformance();
    },

    // ============================================
    // DEBOUNCE & THROTTLE
    // ============================================

    // Debounce function - delays execution until pause in calls
    debounce(fn, delay = this.config.debounceDelay) {
      let timeoutId;
      return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
      };
    },

    // Throttle function - limits execution rate
    throttle(fn, delay = this.config.throttleDelay) {
      let lastCall = 0;
      let timeoutId;
      return (...args) => {
        const now = Date.now();
        const remaining = delay - (now - lastCall);

        clearTimeout(timeoutId);

        if (remaining <= 0) {
          lastCall = now;
          fn.apply(this, args);
        } else {
          timeoutId = setTimeout(() => {
            lastCall = Date.now();
            fn.apply(this, args);
          }, remaining);
        }
      };
    },

    // ============================================
    // LAZY LOADING
    // ============================================

    // Setup lazy loading for images
    setupLazyLoading() {
      // Use native lazy loading if supported
      if ('loading' in HTMLImageElement.prototype) {
        document.querySelectorAll('img[data-src]').forEach(img => {
          img.src = img.dataset.src;
          img.loading = 'lazy';
          img.removeAttribute('data-src');
        });
      } else {
        // Fallback to IntersectionObserver
        this.lazyLoadWithObserver();
      }

      // Lazy load iframes
      document.querySelectorAll('iframe[data-src]').forEach(iframe => {
        iframe.loading = 'lazy';
      });
    },

    // Lazy load with IntersectionObserver
    lazyLoadWithObserver() {
      const options = {
        root: null,
        rootMargin: `${this.config.lazyLoadThreshold}px`,
        threshold: 0
      };

      const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target;

            if (el.dataset.src) {
              el.src = el.dataset.src;
              el.removeAttribute('data-src');
            }

            if (el.dataset.srcset) {
              el.srcset = el.dataset.srcset;
              el.removeAttribute('data-srcset');
            }

            if (el.dataset.background) {
              el.style.backgroundImage = `url(${el.dataset.background})`;
              el.removeAttribute('data-background');
            }

            observer.unobserve(el);
          }
        });
      }, options);

      document.querySelectorAll('[data-src], [data-srcset], [data-background]').forEach(el => {
        observer.observe(el);
      });
    },

    // ============================================
    // INTERSECTION OBSERVER FOR ANIMATIONS
    // ============================================

    setupIntersectionObserver() {
      // Animate elements when they come into view
      const animateOnScroll = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            // Don't unobserve if animation should replay
            if (!entry.target.dataset.animateRepeat) {
              animateOnScroll.unobserve(entry.target);
            }
          } else if (entry.target.dataset.animateRepeat) {
            entry.target.classList.remove('in-view');
          }
        });
      }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      });

      document.querySelectorAll('[data-animate]').forEach(el => {
        animateOnScroll.observe(el);
      });
    },

    // ============================================
    // EVENT OPTIMIZATION
    // ============================================

    optimizeEventListeners() {
      // Replace scroll/resize listeners with optimized versions
      const events = ['scroll', 'resize', 'mousemove'];

      events.forEach(eventType => {
        const handlers = [];

        // Collect existing handlers (if trackable)
        window[`_${eventType}Handlers`] = handlers;

        // Add method to register optimized handlers
        window[`on${eventType.charAt(0).toUpperCase() + eventType.slice(1)}Optimized`] = (handler, type = 'throttle') => {
          const optimizedHandler = type === 'debounce'
            ? this.debounce(handler)
            : this.throttle(handler);

          handlers.push(optimizedHandler);
          window.addEventListener(eventType, optimizedHandler, { passive: true });

          return () => {
            window.removeEventListener(eventType, optimizedHandler);
            const idx = handlers.indexOf(optimizedHandler);
            if (idx > -1) handlers.splice(idx, 1);
          };
        };
      });
    },

    // Optimize scrolling with passive listeners
    optimizeScrolling() {
      // Make touch events passive by default
      const passiveEvents = ['touchstart', 'touchmove', 'wheel', 'scroll'];

      passiveEvents.forEach(eventType => {
        window.addEventListener(eventType, () => {}, { passive: true, capture: true });
      });

      // Add scroll-based visibility optimizations
      let ticking = false;
      window.addEventListener('scroll', () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            this.optimizeVisibility();
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });
    },

    // Pause off-screen elements
    optimizeVisibility() {
      // Pause videos that are off-screen
      document.querySelectorAll('video[autoplay]').forEach(video => {
        const rect = video.getBoundingClientRect();
        const inView = rect.top < window.innerHeight && rect.bottom > 0;

        if (inView && video.paused) {
          video.play().catch(() => {});
        } else if (!inView && !video.paused) {
          video.pause();
        }
      });
    },

    // ============================================
    // DEFER NON-CRITICAL JS
    // ============================================

    deferNonCriticalJS() {
      // Load non-critical scripts after page load
      window.addEventListener('load', () => {
        setTimeout(() => {
          // Load analytics
          this.loadScript('https://www.googletagmanager.com/gtag/js');

          // Load other non-critical scripts marked with data-defer
          document.querySelectorAll('script[data-defer-load]').forEach(script => {
            const newScript = document.createElement('script');
            newScript.src = script.dataset.deferLoad;
            if (script.dataset.async) newScript.async = true;
            document.body.appendChild(newScript);
            script.remove();
          });
        }, this.config.preloadDelay);
      });
    },

    // Load script dynamically
    loadScript(src, async = true) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = async;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    },

    // ============================================
    // RESOURCE HINTS
    // ============================================

    setupResourceHints() {
      // Preconnect to important origins
      const origins = [
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com',
        'https://cdn.jsdelivr.net'
      ];

      origins.forEach(origin => {
        if (!document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) {
          const link = document.createElement('link');
          link.rel = 'preconnect';
          link.href = origin;
          link.crossOrigin = 'anonymous';
          document.head.appendChild(link);
        }
      });

      // Prefetch likely next pages on hover
      document.querySelectorAll('a[href]').forEach(link => {
        if (link.hostname === window.location.hostname) {
          link.addEventListener('mouseenter', () => {
            this.prefetchPage(link.href);
          }, { once: true, passive: true });
        }
      });
    },

    // Prefetch a page
    prefetchPage(url) {
      if (this.prefetchedUrls?.has(url)) return;

      this.prefetchedUrls = this.prefetchedUrls || new Set();
      this.prefetchedUrls.add(url);

      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      document.head.appendChild(link);
    },

    // ============================================
    // MEMOIZATION & CACHING
    // ============================================

    // Memoize expensive function results
    memoize(fn, keyFn = (...args) => JSON.stringify(args)) {
      return (...args) => {
        const key = keyFn(...args);
        const cached = this.cache.get(key);

        if (cached && Date.now() - cached.timestamp < this.config.cacheMaxAge) {
          return cached.value;
        }

        const result = fn(...args);
        this.cache.set(key, { value: result, timestamp: Date.now() });

        return result;
      };
    },

    // Clear old cache entries
    cleanCache() {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.config.cacheMaxAge) {
          this.cache.delete(key);
        }
      }
    },

    // ============================================
    // VIRTUAL SCROLLING
    // ============================================

    // Create virtual scroll container for large lists
    createVirtualScroller(container, items, renderItem, itemHeight = 50) {
      const visibleCount = Math.ceil(container.clientHeight / itemHeight) + 2;
      let startIndex = 0;

      const viewport = document.createElement('div');
      viewport.style.cssText = `height: ${items.length * itemHeight}px; position: relative;`;

      const content = document.createElement('div');
      content.style.cssText = 'position: absolute; left: 0; right: 0;';

      viewport.appendChild(content);
      container.appendChild(viewport);

      const render = () => {
        const scrollTop = container.scrollTop;
        startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 1);
        const endIndex = Math.min(items.length, startIndex + visibleCount);

        content.style.top = `${startIndex * itemHeight}px`;
        content.innerHTML = '';

        for (let i = startIndex; i < endIndex; i++) {
          const itemEl = renderItem(items[i], i);
          itemEl.style.height = `${itemHeight}px`;
          content.appendChild(itemEl);
        }
      };

      container.addEventListener('scroll', this.throttle(render, 16), { passive: true });
      render();

      return { render, container: viewport };
    },

    // ============================================
    // PERFORMANCE MEASUREMENT
    // ============================================

    measurePerformance() {
      // Report Core Web Vitals
      if ('PerformanceObserver' in window) {
        // Largest Contentful Paint
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            console.log('[Perf] LCP:', entry.startTime.toFixed(0), 'ms');
          }
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            console.log('[Perf] FID:', entry.processingStart - entry.startTime, 'ms');
          }
        }).observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift
        let clsValue = 0;
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
              console.log('[Perf] CLS:', clsValue.toFixed(4));
            }
          }
        }).observe({ entryTypes: ['layout-shift'] });
      }

      // Log performance timing on load
      window.addEventListener('load', () => {
        setTimeout(() => {
          const timing = performance.timing || {};
          const loadTime = timing.loadEventEnd - timing.navigationStart;
          const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;

          console.log('[Perf] DOM Ready:', domReady, 'ms');
          console.log('[Perf] Page Load:', loadTime, 'ms');
        }, 0);
      });
    },

    // ============================================
    // REQUEST ANIMATION FRAME HELPERS
    // ============================================

    // Schedule work with requestAnimationFrame
    scheduleFrame(callback) {
      if ('requestAnimationFrame' in window) {
        return requestAnimationFrame(callback);
      }
      return setTimeout(callback, 16);
    },

    // Cancel scheduled frame
    cancelFrame(id) {
      if ('cancelAnimationFrame' in window) {
        cancelAnimationFrame(id);
      } else {
        clearTimeout(id);
      }
    },

    // Run callback when browser is idle
    runWhenIdle(callback, timeout = 2000) {
      if ('requestIdleCallback' in window) {
        return requestIdleCallback(callback, { timeout });
      }
      return setTimeout(callback, 1);
    }
  };

  // Initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Performance.init());
  } else {
    Performance.init();
  }

  // Clean cache periodically
  setInterval(() => Performance.cleanCache(), 60000);

  // Export to window
  window.Performance = Performance;

  // Export utility functions globally
  window.debounce = Performance.debounce.bind(Performance);
  window.throttle = Performance.throttle.bind(Performance);
  window.memoize = Performance.memoize.bind(Performance);

})();
