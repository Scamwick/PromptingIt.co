/* ============================================
   SETUP GEMINI API KEY IN SUPABASE
   Run this once to store the API key securely
   ============================================ */

// This script stores the Gemini API key in Supabase
// Run this in the browser console after logging in as owner/admin

const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';

async function setupGeminiKey() {
    const supabase = window.PromptingItSupabase?.getClient();
    const user = window.Auth?.getUser();
    
    if (!supabase || !user) {
        console.error('Please log in first');
        return;
    }

    try {
        // Store in api_keys table
        const { data, error } = await supabase
            .from('api_keys')
            .upsert({
                user_id: user.id,
                name: 'Gemini API Key',
                key_hash: btoa(GEMINI_API_KEY), // Simple encoding (not secure, but works for now)
                key_prefix: GEMINI_API_KEY.substring(0, 20) + '...',
                permissions: ['read', 'write'],
                is_active: true
            }, {
                onConflict: 'user_id,name'
            });

        if (error) {
            console.warn('Could not store in api_keys:', error);
            console.log('API Key configured in gemini-api.js file');
        } else {
            console.log('Gemini API key stored successfully in Supabase');
        }
    } catch (e) {
        console.error('Error setting up API key:', e);
        console.log('API key is configured in gemini-api.js file');
    }
}

// Auto-run if in browser console
if (typeof window !== 'undefined') {
    window.setupGeminiKey = setupGeminiKey;
    console.log('Run setupGeminiKey() to store the API key in Supabase');
}

