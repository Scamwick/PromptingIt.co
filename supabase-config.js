/* ============================================
   SUPABASE CONFIGURATION
   Prompting It - Authentication & Database
   ============================================ */

// Supabase Configuration
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Initialize Supabase client
let supabase = null;

// Check if Supabase JS is loaded
function initSupabase() {
  if (typeof window.supabase !== 'undefined') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabase;
  }
  console.warn('Supabase JS not loaded. Make sure to include the Supabase CDN script.');
  return null;
}

// Export for use in other scripts
window.PromptingItSupabase = {
  getClient: function() {
    if (!supabase) {
      supabase = initSupabase();
    }
    return supabase;
  },

  SUPABASE_URL: SUPABASE_URL,
  SUPABASE_ANON_KEY: SUPABASE_ANON_KEY
};

// Initialize on load
document.addEventListener('DOMContentLoaded', initSupabase);
