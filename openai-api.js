/* ============================================
   OPENAI API SERVICE
   Prompting It - OpenAI ChatGPT Integration
   ============================================ */

// OpenAI API Configuration
// SECURITY: API keys are stored in Supabase api_keys table only
// No hardcoded keys in source code for security
// Support both Responses API (newer) and Chat Completions API
const OPENAI_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_CHAT_API_URL = 'https://api.openai.com/v1/chat/completions';

// OpenAI API Service
window.OpenAIAPI = {
    /**
     * Call OpenAI API with a prompt
     * @param {string} prompt - The prompt text
     * @param {Object} options - Additional options
     * @param {string} options.model - Model to use (default: 'gpt-4o')
     * @param {number} options.maxTokens - Max tokens in response (default: 2048)
     * @param {number} options.temperature - Temperature (0-2, default: 1)
     * @param {string} options.systemPrompt - System prompt (optional)
     * @returns {Promise<Object>} API response
     */
    async call(prompt, options = {}) {
        const {
            model = 'gpt-4',
            maxTokens = 2048,
            temperature = 1,
            systemPrompt = null
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
                throw new Error('Authentication required to use OpenAI API');
            }
            
            // Get API key from api_keys table
            const { data: apiKeyData, error } = await supabase
                .from('api_keys')
                .select('key_hash')
                .eq('user_id', user.id)
                .eq('name', 'OpenAI API Key')
                .eq('is_active', true)
                .single();
            
            if (error || !apiKeyData?.key_hash) {
                throw new Error('OpenAI API key not configured. Please add your API key in Settings.');
            }
            
            // Decode the stored key
            apiKey = atob(apiKeyData.key_hash);
        } catch (e) {
            console.error('OpenAI API key error:', e);
            throw new Error('OpenAI API key not configured. Please add your API key in Settings.');
        }

        if (!apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        // Determine which API to use based on model
        // Responses API supports: GPT-5.x, GPT-5.1.x, GPT-4o, and newer models
        // Chat Completions API supports: GPT-4.1, o3, o4-mini, and older models
        const useResponsesAPI = model.includes('gpt-5') || 
                                 model.includes('gpt-4o') || 
                                 model.startsWith('gpt-5') ||
                                 model === 'gpt-4o';
        
        let requestBody;
        let apiUrl;
        
        if (useResponsesAPI) {
            // Use Responses API (newer endpoint)
            apiUrl = OPENAI_RESPONSES_API_URL;
            requestBody = {
                model: model,
                input: prompt,
                store: true  // Store the response
            };
            
            // Add system prompt if provided (Responses API may support this differently)
            if (systemPrompt) {
                requestBody.system = systemPrompt;
            }
        } else {
            // Use Chat Completions API (standard endpoint)
            apiUrl = OPENAI_CHAT_API_URL;
            const messages = [];
            
            // Add system message if provided
            if (systemPrompt) {
                messages.push({
                    role: 'system',
                    content: systemPrompt
                });
            }
            
            // Add user message
            messages.push({
                role: 'user',
                content: prompt
            });

            requestBody = {
                model: model,
                messages: messages,
                max_tokens: maxTokens,
                temperature: temperature
            };
        }

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.error?.message || 
                    `OpenAI API error: ${response.status} ${response.statusText}`
                );
            }

            const data = await response.json();
            
            let content;
            let usage;
            let responseModel;
            let finishReason;
            
            if (useResponsesAPI) {
                // Responses API format
                content = data.output?.text || data.text || data.content || '';
                usage = data.usage || {};
                responseModel = data.model || model;
                finishReason = data.finish_reason || 'stop';
                
                // Responses API may have different usage structure
                usage = {
                    inputTokens: usage.input_tokens || usage.prompt_tokens || 0,
                    outputTokens: usage.output_tokens || usage.completion_tokens || 0,
                    totalTokens: usage.total_tokens || (usage.input_tokens || 0) + (usage.output_tokens || 0)
                };
            } else {
                // Chat Completions API format
                content = data.choices?.[0]?.message?.content || '';
                usage = data.usage || {};
                responseModel = data.model || model;
                finishReason = data.choices?.[0]?.finish_reason || 'stop';
                
                usage = {
                    inputTokens: usage.prompt_tokens || 0,
                    outputTokens: usage.completion_tokens || 0,
                    totalTokens: usage.total_tokens || 0
                };
            }
            
            return {
                success: true,
                content: content,
                usage: usage,
                model: responseModel,
                finishReason: finishReason,
                raw: data
            };
        } catch (error) {
            console.error('OpenAI API error:', error);
            throw error;
        }
    },

    /**
     * Get available OpenAI models
     */
    getModels() {
        return [
            // GPT-5.1 Series (Latest)
            { id: 'gpt-5-1-instant', name: 'GPT-5.1 Instant', description: 'Latest instant model', isResponsesAPI: true, cost: 'Low' },
            { id: 'gpt-5-1-thinking', name: 'GPT-5.1 Thinking', description: 'Latest thinking model', isResponsesAPI: true, cost: 'Medium' },
            
            // GPT-5 Series
            { id: 'gpt-5-instant', name: 'GPT-5 Instant', description: 'Fast GPT-5 model', isResponsesAPI: true, cost: 'Low' },
            { id: 'gpt-5-thinking-mini', name: 'GPT-5 Thinking mini', description: 'Smaller thinking model', isResponsesAPI: true, cost: 'Medium' },
            { id: 'gpt-5-thinking', name: 'GPT-5 Thinking', description: 'Advanced thinking model', isResponsesAPI: true, cost: 'High' },
            
            // GPT-4 Series
            { id: 'gpt-4o', name: 'GPT-4o', description: 'Optimized GPT-4', isResponsesAPI: true, cost: 'Medium' },
            { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Enhanced GPT-4', cost: 'High' },
            
            // Reasoning Models (O Series)
            { id: 'o3', name: 'o3', description: 'Advanced reasoning model', cost: 'High' },
            { id: 'o4-mini', name: 'o4-mini', description: 'Smaller reasoning model', cost: 'Medium' }
        ];
    },

    /**
     * Estimate cost for a request
     * @param {number} inputTokens - Input tokens
     * @param {number} outputTokens - Output tokens
     * @param {string} model - Model ID
     * @returns {Object} Cost breakdown
     */
    estimateCost(inputTokens, outputTokens, model = 'gpt-4o') {
        // Pricing per 1M tokens (as of 2024/2025)
        // Updated with latest pricing for current models
        const pricing = {
            // GPT-5.1 Series (Latest)
            'gpt-5-1-instant': { input: 0.10, output: 0.40 },
            'gpt-5-1-thinking': { input: 0.50, output: 2.00 },
            
            // GPT-5 Series
            'gpt-5-instant': { input: 0.10, output: 0.40 },
            'gpt-5-thinking-mini': { input: 0.30, output: 1.20 },
            'gpt-5-thinking': { input: 0.50, output: 2.00 },
            
            // GPT-4 Series
            'gpt-4o': { input: 2.50, output: 10.00 },
            'gpt-4.1': { input: 5.00, output: 15.00 },
            
            // Reasoning Models (O Series)
            'o3': { input: 15.00, output: 60.00 },
            'o4-mini': { input: 3.00, output: 12.00 }
        };

        const modelPricing = pricing[model] || pricing['gpt-4'];
        
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
                .eq('name', 'OpenAI API Key')
                .eq('is_active', true)
                .single();
            
            return !!data;
        } catch (e) {
            return false;
        }
    }
};
