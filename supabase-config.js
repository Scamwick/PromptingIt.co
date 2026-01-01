/* ============================================
   SUPABASE CONFIGURATION
   Prompting It - Authentication & Database
   ============================================ */

// Supabase Configuration
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://znqehstoulqhvfjdadxr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucWVoc3RvdWxxaHZmamRhZHhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU2MjUwODIsImV4cCI6MjA1MTIwMTA4Mn0.UBw9EUIs6pu_x7xeEAiJIA_y8C0pBdw';

// Initialize Supabase client
let supabaseClient = null;
let initPromise = null;
let readyCallbacks = [];

// Check if Supabase JS is loaded and initialize
function initSupabase() {
  if (supabaseClient) {
    return supabaseClient;
  }
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // Call any waiting callbacks
    readyCallbacks.forEach(function(cb) { cb(supabaseClient); });
    readyCallbacks = [];
    return supabaseClient;
  }
  return null;
}

// Wait for Supabase CDN to load with polling
function waitForSupabase(maxAttempts, interval) {
  maxAttempts = maxAttempts || 50;
  interval = interval || 100;

  if (initPromise) {
    return initPromise;
  }

  initPromise = new Promise(function(resolve, reject) {
    var attempts = 0;

    function check() {
      var client = initSupabase();
      if (client) {
        resolve(client);
        return;
      }

      attempts++;
      if (attempts >= maxAttempts) {
        console.error('Supabase JS failed to load after ' + maxAttempts + ' attempts. Make sure to include the Supabase CDN script.');
        reject(new Error('Supabase JS not loaded'));
        return;
      }

      setTimeout(check, interval);
    }

    check();
  });

  return initPromise;
}

// Export for use in other scripts - set immediately when script loads
window.PromptingItSupabase = {
  // Synchronous getter - returns client or null
  getClient: function() {
    if (!supabaseClient) {
      initSupabase();
    }
    return supabaseClient;
  },

  // Async getter - waits for Supabase CDN to load, returns Promise
  getClientAsync: function() {
    return waitForSupabase();
  },

  // Callback-based ready handler
  onReady: function(callback) {
    if (supabaseClient) {
      callback(supabaseClient);
    } else {
      readyCallbacks.push(callback);
      // Start waiting if not already
      waitForSupabase();
    }
  },

  // Check if client is ready
  isReady: function() {
    return supabaseClient !== null;
  },

  SUPABASE_URL: SUPABASE_URL,
  SUPABASE_ANON_KEY: SUPABASE_ANON_KEY
};

// Try to initialize immediately if CDN is already loaded
initSupabase();

// Also try on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSupabase);
} else {
  // DOM already loaded, try again
  initSupabase();
}
