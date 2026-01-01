/* ============================================
   SECURITY CRYPTO UTILITIES
   Prompting It - Encryption/Decryption for API Keys
   ============================================ */

// SECURITY: This module provides AES-256-GCM encryption for API keys
// Keys are encrypted client-side before storage and decrypted only when needed

window.SecurityCrypto = {
    /**
     * Derive encryption key from user ID using PBKDF2
     * @param {string} userId - User's unique identifier
     * @returns {Promise<CryptoKey>} Derived encryption key
     */
    async deriveKey(userId) {
        const encoder = new TextEncoder();
        
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(userId + '_promptingit_secure_2024'),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );
        
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode('promptingit_salt_v1'),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },

    /**
     * Encrypt a string using AES-256-GCM
     * @param {string} plaintext - Text to encrypt
     * @param {string} userId - User's unique identifier
     * @returns {Promise<string>} Base64-encoded encrypted data
     */
    async encrypt(plaintext, userId) {
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await this.deriveKey(userId);
        
        const encryptedData = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encoder.encode(plaintext)
        );
        
        // Combine IV + encrypted data
        const combined = new Uint8Array(iv.length + encryptedData.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encryptedData), iv.length);
        
        return btoa(String.fromCharCode(...combined));
    },

    /**
     * Decrypt a string encrypted with AES-256-GCM
     * @param {string} encryptedBase64 - Base64-encoded encrypted data
     * @param {string} userId - User's unique identifier
     * @returns {Promise<string>} Decrypted plaintext
     */
    async decrypt(encryptedBase64, userId) {
        try {
            const decoder = new TextDecoder();
            const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
            
            // Extract IV (first 12 bytes) and encrypted data
            const iv = combined.slice(0, 12);
            const encryptedData = combined.slice(12);
            
            const key = await this.deriveKey(userId);
            
            const decryptedData = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encryptedData
            );
            
            return decoder.decode(decryptedData);
        } catch (error) {
            // If decryption fails, it might be old base64-encoded data
            // Try to decode as base64 (backwards compatibility)
            try {
                return atob(encryptedBase64);
            } catch (e) {
                throw new Error('Failed to decrypt API key');
            }
        }
    },

    /**
     * Check if a string appears to be encrypted (vs simple base64)
     * Encrypted data has IV prefix making it longer
     * @param {string} data - Base64 encoded data
     * @returns {boolean} True if appears encrypted
     */
    isEncrypted(data) {
        try {
            const decoded = atob(data);
            // Encrypted data should be at least 12 bytes IV + some encrypted content
            return decoded.length > 50;
        } catch (e) {
            return false;
        }
    },

    /**
     * Validate API key format
     * @param {string} key - API key to validate
     * @param {string} provider - Provider name: 'openai', 'claude', 'gemini'
     * @returns {Object} { valid: boolean, error?: string }
     */
    validateApiKey(key, provider) {
        if (!key || typeof key !== 'string') {
            return { valid: false, error: 'API key is required' };
        }
        
        key = key.trim();
        
        switch (provider.toLowerCase()) {
            case 'openai':
                if (!key.startsWith('sk-proj-') && !key.startsWith('sk-')) {
                    return { valid: false, error: 'Invalid OpenAI key format. Should start with "sk-" or "sk-proj-"' };
                }
                break;
            case 'claude':
            case 'anthropic':
                if (!key.startsWith('sk-ant-')) {
                    return { valid: false, error: 'Invalid Claude key format. Should start with "sk-ant-"' };
                }
                break;
            case 'gemini':
            case 'google':
                if (!key.startsWith('AIzaSy')) {
                    return { valid: false, error: 'Invalid Gemini key format. Should start with "AIzaSy"' };
                }
                break;
            default:
                // Unknown provider, just check it's not empty
                break;
        }
        
        if (key.length < 30) {
            return { valid: false, error: 'API key appears to be too short' };
        }
        
        return { valid: true };
    },

    /**
     * Create a safe prefix for display (masks the middle)
     * @param {string} key - Full API key
     * @returns {string} Masked key like "sk-proj-ab...xy12"
     */
    maskKey(key) {
        if (!key || key.length < 12) return '***';
        return key.substring(0, 8) + '...' + key.slice(-4);
    }
};

