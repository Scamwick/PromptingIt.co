/* ============================================
   SUPABASE CONFIGURATION
   Prompting It - Authentication & Database
   ============================================ */

// Supabase Configuration
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://znqehstoulqhvfjdadxr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucWVoc3RvdWxxaHZmamRhZHhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU2MjUwODIsImV4cCI6MjA1MTIwMTA4Mn0.UBw9EUIs6pu_x7xeEAiJIA_y8C0pBdw';

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
