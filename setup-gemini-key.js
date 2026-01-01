/* ============================================
   SETUP GEMINI API KEY IN SUPABASE
   Run this once to store the API key securely
   ============================================ */

// This script stores the Gemini API key in Supabase
// Run this in the browser console after logging in as owner/admin

// SECURITY NOTICE:
// - Never commit real API keys to version control
// - Keys are encrypted before storage using AES-256-GCM
// - Only you can decrypt your keys using your user session

/**
 * Encrypt API key using Web Crypto API
 * Uses AES-256-GCM with a key derived from user ID + session
 */
async function encryptApiKey(apiKey, userId) {
    const encoder = new TextEncoder();
    
    // Generate a random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Derive encryption key from user ID
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(userId + '_promptingit_secure_2024'),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );
    
    const encryptionKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('promptingit_salt_v1'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );
    
    // Encrypt the API key
    const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        encryptionKey,
        encoder.encode(apiKey)
    );
    
    // Combine IV + encrypted data and encode as base64
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);
    
    return btoa(String.fromCharCode(...combined));
}

/**
 * Validate Google Gemini API key format
 */
function validateGeminiKey(key) {
    if (!key || typeof key !== 'string') {
        return { valid: false, error: 'API key is required' };
    }
    
    key = key.trim();
    
    // Gemini keys start with AIzaSy
    if (!key.startsWith('AIzaSy')) {
        return { valid: false, error: 'Invalid Gemini API key format. Keys should start with "AIzaSy"' };
    }
    
    if (key.length < 30) {
        return { valid: false, error: 'API key appears to be too short' };
    }
    
    return { valid: true };
}

/**
 * Setup Gemini API Key
 * @param {string} apiKey - Your Gemini API key (will be prompted if not provided)
 */
async function setupGeminiKey(apiKey) {
    // Prompt for key if not provided
    if (!apiKey) {
        apiKey = prompt('Enter your Google Gemini API key:');
        if (!apiKey) {
            console.error('Setup cancelled - no API key provided');
            return;
        }
    }
    
    // Validate key format
    const validation = validateGeminiKey(apiKey);
    if (!validation.valid) {
        console.error('Validation failed:', validation.error);
        return;
    }
    
    const supabase = window.PromptingItSupabase?.getClient();
    const user = window.Auth?.getUser();
    
    if (!supabase || !user) {
        console.error('Please log in first');
        return;
    }

    try {
        // Encrypt the API key
        const encryptedKey = await encryptApiKey(apiKey.trim(), user.id);
        
        // Create a safe prefix (first 8 chars + ... + last 4 chars)
        const safePrefix = apiKey.substring(0, 8) + '...' + apiKey.slice(-4);
        
        // Store in api_keys table
        const { data, error } = await supabase
            .from('api_keys')
            .upsert({
                user_id: user.id,
                name: 'Gemini API Key',
                key_hash: encryptedKey,
                key_prefix: safePrefix,
                permissions: ['read', 'write'],
                is_active: true,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,name'
            });

        if (error) {
            console.error('Failed to store API key:', error.message);
        } else {
            console.log('✅ Gemini API key stored securely in Supabase');
            console.log('   Prefix:', safePrefix);
        }
    } catch (e) {
        console.error('Error setting up API key:', e.message);
    }
}

// Auto-run if in browser console
if (typeof window !== 'undefined') {
    window.setupGeminiKey = setupGeminiKey;
    console.log('🔐 Gemini Key Setup');
    console.log('   Run: setupGeminiKey() or setupGeminiKey("your-api-key")');
}

