/* ============================================
   CLAUDE API SERVICE
   Prompting It - Anthropic Claude Integration
   ============================================ */

// Claude API Configuration
// NOTE: In production, API keys should be stored server-side or in Supabase
// For now, we'll store it in Supabase settings table for secure access
const CLAUDE_API_KEY = 'YOUR_CLAUDE_API_KEY_HERE';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// Claude API Service
window.ClaudeAPI = {
    /**
     * Call Claude API with a prompt
     * @param {string} prompt - The prompt text
     * @param {Object} options - Additional options
     * @param {string} options.model - Model to use (default: 'claude-3-5-sonnet-20241022')
     * @param {number} options.maxTokens - Max tokens in response (default: 4096)
     * @param {number} options.temperature - Temperature (0-1, default: 1)
     * @returns {Promise<Object>} API response
     */
    async call(prompt, options = {}) {
        const {
            model = 'claude-4-5-sonnet-20250514',
            maxTokens = 4096,
            temperature = 1,
            systemPrompt = null
        } = options;

        // Handle model name variations - map to Anthropic API format
        // Anthropic uses: claude-{version}-{model}-{date} format
        // For 4.5: claude-4-5-{model}-{date} or claude-{model}-4-{date}
        let apiModel = model;
        
        // Map various formats to Anthropic's API format
        if (model === 'claude-opus-4-20250514' || model === 'claude-4-5-opus-20250514') {
            apiModel = 'claude-4-5-opus-20250514'; // Try Anthropic's standard format first
        } else if (model === 'claude-sonnet-4-20250514' || model === 'claude-4-5-sonnet-20250514') {
            apiModel = 'claude-4-5-sonnet-20250514';
        } else if (model === 'claude-haiku-4-20250514' || model === 'claude-4-5-haiku-20250514') {
            apiModel = 'claude-4-5-haiku-20250514';
        } else if (model.startsWith('claude-4-5-')) {
            // Already in correct format
            apiModel = model;
        } else if (model.startsWith('claude-opus-4') || model.startsWith('claude-sonnet-4') || model.startsWith('claude-haiku-4')) {
            // Alternative format, try to convert
            if (model.includes('opus')) {
                apiModel = model.replace('claude-opus-4', 'claude-4-5-opus');
            } else if (model.includes('sonnet')) {
                apiModel = model.replace('claude-sonnet-4', 'claude-4-5-sonnet');
            } else if (model.includes('haiku')) {
                apiModel = model.replace('claude-haiku-4', 'claude-4-5-haiku');
            }
        }

        if (!prompt || !prompt.trim()) {
            throw new Error('Prompt is required');
        }

        // Try to get API key from Supabase api_keys table first, fallback to config
        let apiKey = CLAUDE_API_KEY;
        try {
            const supabase = window.PromptingItSupabase?.getClient();
            const user = window.Auth?.getUser();
            
            if (supabase && user) {
                // Try to get from api_keys table
                const { data: apiKeyData } = await supabase
                    .from('api_keys')
                    .select('key_hash')
                    .eq('user_id', user.id)
                    .eq('name', 'Claude API Key')
                    .eq('is_active', true)
                    .single();
                
                if (apiKeyData?.key_hash) {
                    // Decode the stored key
                    apiKey = atob(apiKeyData.key_hash);
                }
            }
        } catch (e) {
            // Fallback to config key
            console.warn('Could not fetch API key from Supabase, using config:', e);
        }

        if (!apiKey) {
            throw new Error('Claude API key not configured');
        }

        const requestBody = {
            model: model,
            max_tokens: maxTokens,
            temperature: temperature,
            messages: [
                ...(systemPrompt ? [{
                    role: 'system',
                    content: systemPrompt
                }] : []),
                {
                    role: 'user',
                    content: prompt
                }
            ]
        };

        try {
            const response = await fetch(CLAUDE_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.error?.message || 
                    `Claude API error: ${response.status} ${response.statusText}`
                );
            }

            const data = await response.json();
            
            // Extract response content
            const content = data.content?.[0]?.text || '';
            
            return {
                success: true,
                content: content,
                usage: {
                    inputTokens: data.usage?.input_tokens || 0,
                    outputTokens: data.usage?.output_tokens || 0,
                    totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
                },
                model: data.model,
                stopReason: data.stop_reason,
                raw: data
            };
        } catch (error) {
            console.error('Claude API error:', error);
            throw error;
        }
    },

    /**
     * Get available Claude models
     */
    getModels() {
        return [
            // Claude 4.5 Series (Latest - 2024/2025)
            // Using Anthropic's API format: claude-{model}-{version}-{date}
            { id: 'claude-4-5-opus-20250514', name: 'Opus 4.5', description: 'Most capable for complex work', cost: 'High' },
            { id: 'claude-4-5-sonnet-20250514', name: 'Sonnet 4.5', description: 'Best for everyday tasks', cost: 'Medium' },
            { id: 'claude-4-5-haiku-20250514', name: 'Haiku 4.5', description: 'Fastest for quick answers', cost: 'Low' },
            
            // Alternative formats (will be mapped in call function)
            { id: 'claude-opus-4-20250514', name: 'Opus 4.5', description: 'Most capable for complex work', cost: 'High' },
            { id: 'claude-sonnet-4-20250514', name: 'Sonnet 4.5', description: 'Best for everyday tasks', cost: 'Medium' },
            { id: 'claude-haiku-4-20250514', name: 'Haiku 4.5', description: 'Fastest for quick answers', cost: 'Low' }
        ];
    },

    /**
     * Estimate cost for a request
     * @param {number} inputTokens - Input tokens
     * @param {number} outputTokens - Output tokens
     * @param {string} model - Model ID
     * @returns {Object} Cost breakdown
     */
    estimateCost(inputTokens, outputTokens, model = 'claude-4-5-sonnet-20250514') {
        // Pricing per 1M tokens (as of 2024/2025)
        const pricing = {
            // Claude 4.5 Series (Latest) - support multiple format variations
            'claude-4-5-opus-20250514': { input: 15.00, output: 75.00 },
            'claude-4-5-sonnet-20250514': { input: 3.00, output: 15.00 },
            'claude-4-5-haiku-20250514': { input: 0.80, output: 4.00 },
            'claude-opus-4-20250514': { input: 15.00, output: 75.00 },
            'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
            'claude-haiku-4-20250514': { input: 0.80, output: 4.00 }
        };

        const modelPricing = pricing[model] || pricing['claude-4-5-sonnet-20250514'];
        
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
     */
    isConfigured() {
        return !!CLAUDE_API_KEY;
    }
};

