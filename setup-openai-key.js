/* ============================================
   SETUP OPENAI API KEY IN SUPABASE
   Run this once to store the API key securely
   ============================================ */

// This script stores the OpenAI API key in Supabase
// Run this in the browser console after logging in as owner/admin

// IMPORTANT: Replace with your actual OpenAI API key before running
// Never commit real API keys to version control!
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY_HERE';

async function setupOpenAIKey() {
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
                name: 'OpenAI API Key',
                key_hash: btoa(OPENAI_API_KEY), // Simple encoding (not secure, but works for now)
                key_prefix: OPENAI_API_KEY.substring(0, 20) + '...',
                permissions: ['read', 'write'],
                is_active: true
            }, {
                onConflict: 'user_id,name'
            });

        if (error) {
            console.warn('Could not store in api_keys:', error);
            console.log('API Key configured in openai-api.js file');
        } else {
            console.log('OpenAI API key stored successfully in Supabase');
        }
    } catch (e) {
        console.error('Error setting up API key:', e);
        console.log('API key is configured in openai-api.js file');
    }
}

// Auto-run if in browser console
if (typeof window !== 'undefined') {
    window.setupOpenAIKey = setupOpenAIKey;
    console.log('Run setupOpenAIKey() to store the API key in Supabase');
}
