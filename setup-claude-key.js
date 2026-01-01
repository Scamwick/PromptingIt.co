/* ============================================
   SETUP CLAUDE API KEY IN SUPABASE
   Run this once to store the API key securely
   ============================================ */

// This script stores the Claude API key in Supabase
// Run this in the browser console after logging in as owner/admin

// IMPORTANT: Replace with your actual Claude API key before running
// Never commit real API keys to version control!
const CLAUDE_API_KEY = 'YOUR_CLAUDE_API_KEY_HERE';

async function setupClaudeKey() {
    const supabase = window.PromptingItSupabase?.getClient();
    const user = window.Auth?.getUser();
    
    if (!supabase || !user) {
        console.error('Please log in first');
        return;
    }

    try {
        // Check if settings table exists, if not create it
        // For now, we'll use a simple approach - store in api_keys table
        const { data, error } = await supabase
            .from('api_keys')
            .upsert({
                user_id: user.id,
                name: 'Claude API Key',
                key_hash: btoa(CLAUDE_API_KEY), // Simple encoding (not secure, but works for now)
                key_prefix: CLAUDE_API_KEY.substring(0, 20) + '...',
                permissions: ['read', 'write'],
                is_active: true
            }, {
                onConflict: 'user_id,name'
            });

        if (error) {
            // If api_keys table doesn't work, try creating a settings table entry
            console.warn('Could not store in api_keys, trying alternative method:', error);
            
            // Store in a simple key-value format in Supabase
            // This would require a settings table
            console.log('API Key configured in claude-api.js file');
            console.log('For production, set up a settings table in Supabase');
        } else {
            console.log('Claude API key stored successfully in Supabase');
        }
    } catch (e) {
        console.error('Error setting up API key:', e);
        console.log('API key is configured in claude-api.js file');
    }
}

// Auto-run if in browser console
if (typeof window !== 'undefined') {
    window.setupClaudeKey = setupClaudeKey;
    console.log('Run setupClaudeKey() to store the API key in Supabase');
}
