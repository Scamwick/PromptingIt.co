/* ============================================
   GEMINI API SERVICE
   Prompting It - Google Gemini Integration
   ============================================ */

// Gemini API Configuration
// SECURITY: API keys are stored in Supabase api_keys table only
// No hardcoded keys in source code for security
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Gemini API Service
window.GeminiAPI = {
    /**
     * Call Gemini API with a prompt
     * @param {string} prompt - The prompt text
     * @param {Object} options - Additional options
     * @param {string} options.model - Model to use (default: 'gemini-3-fast')
     * @param {number} options.maxTokens - Max tokens in response (default: 2048)
     * @param {number} options.temperature - Temperature (0-2, default: 1)
     * @returns {Promise<Object>} API response
     */
    async call(prompt, options = {}) {
        const {
            model = 'gemini-3-fast',
            maxTokens = 2048,
            temperature = 1
        } = options;

        if (!prompt || !prompt.trim()) {
            throw new Error('Prompt is required');
        }

        // SECURITY: Get API key from Supabase api_keys table only
        // No fallback to hardcoded keys for security
        let apiKey = null;
        try {
            const supabase = window.PromptingItSupabase?.getClient();
            const user = window.Auth?.getUser();
            
            if (!supabase || !user) {
                throw new Error('Authentication required to use Gemini API');
            }
            
            // Get API key from api_keys table
            const { data: apiKeyData, error } = await supabase
                .from('api_keys')
                .select('key_hash')
                .eq('user_id', user.id)
                .eq('name', 'Gemini API Key')
                .eq('is_active', true)
                .single();
            
            if (error || !apiKeyData?.key_hash) {
                throw new Error('Gemini API key not configured. Please add your API key in Settings.');
            }
            
            // Decrypt the stored key using SecurityCrypto module
            if (window.SecurityCrypto) {
                apiKey = await window.SecurityCrypto.decrypt(apiKeyData.key_hash, user.id);
            } else {
                // Fallback for backwards compatibility
                apiKey = atob(apiKeyData.key_hash);
            }
        } catch (e) {
            console.error('Gemini API key error:', e);
            throw new Error('Gemini API key not configured. Please add your API key in Settings.');
        }

        if (!apiKey) {
            throw new Error('Gemini API key not configured');
        }

        // Handle Gemini 3 model names - map to API format
        // Gemini API uses format: gemini-{version}-{variant}
        let apiModel = model;
        if (model === 'gemini-3-fast') {
            apiModel = 'gemini-3-fast';
        } else if (model === 'gemini-3-thinking') {
            apiModel = 'gemini-3-thinking';
        } else if (model === 'gemini-3-pro') {
            apiModel = 'gemini-3-pro';
        }
        
        // Construct the API URL for the specific model
        const apiUrl = `${GEMINI_API_URL}/${apiModel}:generateContent?key=${apiKey}`;

        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: temperature,
                maxOutputTokens: maxTokens,
                topP: 0.95,
                topK: 40
            }
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.error?.message || 
                    `Gemini API error: ${response.status} ${response.statusText}`
                );
            }

            const data = await response.json();
            
            // Extract response content
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
            // Extract usage information
            const usageMetadata = data.usageMetadata || {};
            
            return {
                success: true,
                content: content,
                usage: {
                    inputTokens: usageMetadata.promptTokenCount || 0,
                    outputTokens: usageMetadata.candidatesTokenCount || 0,
                    totalTokens: usageMetadata.totalTokenCount || 0
                },
                model: model,
                finishReason: data.candidates?.[0]?.finishReason,
                raw: data
            };
        } catch (error) {
            console.error('Gemini API error:', error);
            throw error;
        }
    },

    /**
     * Get available Gemini models
     */
    getModels() {
        return [
            // Gemini 3 Series (Latest - 2024/2025)
            { id: 'gemini-3-fast', name: 'Gemini 3 Fast', description: 'Answers quickly', cost: 'Low' },
            { id: 'gemini-3-thinking', name: 'Gemini 3 Thinking', description: 'Solves complex problems', cost: 'Medium' },
            { id: 'gemini-3-pro', name: 'Gemini 3 Pro', description: 'Thinks longer for advanced math & code', cost: 'High' }
        ];
    },

    /**
     * Estimate cost for a request
     * @param {number} inputTokens - Input tokens
     * @param {number} outputTokens - Output tokens
     * @param {string} model - Model ID
     * @returns {Object} Cost breakdown
     */
    estimateCost(inputTokens, outputTokens, model = 'gemini-3-fast') {
        // Pricing per 1M tokens (as of 2024/2025)
        const pricing = {
            // Gemini 3 Series (Latest)
            'gemini-3-fast': { input: 0.075, output: 0.30 },
            'gemini-3-thinking': { input: 0.15, output: 0.60 },
            'gemini-3-pro': { input: 1.25, output: 5.00 }
        };

        const modelPricing = pricing[model] || pricing['gemini-3-fast'];
        
        const inputCost = (inputTokens / 1000000) * modelPricing.input;
        const outputCost = (outputTokens / 1000000) * modelPricing.output;
        const totalCost = inputCost + outputCost;

        return {
            inputCost: inputCost,
            outputCost: outputCost,
            totalCost: totalCost,
            inputTokens: inputTokens,
            outputTokens: outputTokens,
            totalTokens: inputTokens + outputTokens
        };
    },

    /**
     * Check if API key is configured
     * SECURITY: Checks Supabase only, no hardcoded keys
     */
    async isConfigured() {
        try {
            const supabase = window.PromptingItSupabase?.getClient();
            const user = window.Auth?.getUser();
            
            if (!supabase || !user) {
                return false;
            }
            
            const { data } = await supabase
                .from('api_keys')
                .select('id')
                .eq('user_id', user.id)
                .eq('name', 'Gemini API Key')
                .eq('is_active', true)
                .single();
            
            return !!data;
        } catch (e) {
            return false;
        }
    }
};

