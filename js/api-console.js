/**
 * PromptingIt.co - API Console Module
 * API key management and testing with Supabase integration
 * Version: 1.0.0
 */

class APIConsole {
    constructor() {
        this.user = null;
        this.supabase = null;
        this.apiKeys = [];
        this.usageData = [];
        this.initialized = false;

        this.STORAGE_KEY = 'promptingit_api_keys';
    }

    // ============================================
    // INITIALIZATION
    // ============================================
    async init() {
        if (this.initialized) return;

        try {
            // Get Supabase client
            if (window.PromptingItSupabase) {
                this.supabase = await window.PromptingItSupabase.getClientAsync();
            }

            // Get user
            if (window.AuthService) {
                await window.AuthService.init();
                this.user = window.AuthService.user;
            }

            // Load API keys
            await this.loadApiKeys();

            // Load usage data
            await this.loadUsageData();

            // Render UI
            this.renderApiKeys();
            this.renderUsageStats();
            this.updateQuotaDisplay();

            // Setup event listeners
            this.setupEventListeners();

            this.initialized = true;
            console.log('API Console initialized');
        } catch (error) {
            console.error('Failed to initialize API Console:', error);
            this.showToast('Failed to load API Console', 'error');
        }
    }

    // ============================================
    // API KEYS MANAGEMENT
    // ============================================
    async loadApiKeys() {
        if (!this.supabase || !this.user) {
            // Load from localStorage for demo
            const stored = localStorage.getItem(this.STORAGE_KEY);
            this.apiKeys = stored ? JSON.parse(stored) : this.getMockApiKeys();
            return;
        }

        try {
            const { data, error } = await this.supabase
                .from('api_keys')
                .select('*')
                .eq('user_id', this.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.apiKeys = data || [];
        } catch (error) {
            console.error('Failed to load API keys:', error);
            this.apiKeys = [];
        }
    }

    getMockApiKeys() {
        // Return empty array - no fake data
        return [];
    }

    async createApiKey(name, permissions = ['read', 'write']) {
        const key = 'pk_' + (permissions.includes('write') ? 'live_' : 'test_') + this.generateKey(24);
        const keyPrefix = key.slice(0, 16);

        const newKey = {
            id: Date.now().toString(),
            name: name,
            key_prefix: keyPrefix,
            permissions: permissions,
            last_used: null,
            requests_count: 0,
            created_at: new Date().toISOString()
        };

        if (this.supabase && this.user) {
            try {
                const keyHash = await this.hashKey(key);
                const { data, error } = await this.supabase
                    .from('api_keys')
                    .insert({
                        user_id: this.user.id,
                        name: name,
                        key_prefix: keyPrefix,
                        key_hash: keyHash,
                        permissions: permissions
                    })
                    .select()
                    .single();

                if (error) throw error;
                newKey.id = data.id;
            } catch (error) {
                console.error('Failed to create API key:', error);
                this.showToast('Failed to create API key', 'error');
                return null;
            }
        }

        this.apiKeys.unshift(newKey);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.apiKeys));
        this.renderApiKeys();

        this.showToast('API key created successfully', 'success');

        // Return full key only once
        return { ...newKey, full_key: key };
    }

    async revokeApiKey(keyId) {
        const key = this.apiKeys.find(k => k.id === keyId);
        if (!key) return false;

        if (!confirm(`Are you sure you want to revoke "${key.name}"?\n\nThis action cannot be undone.`)) {
            return false;
        }

        if (this.supabase && this.user) {
            try {
                const { error } = await this.supabase
                    .from('api_keys')
                    .delete()
                    .eq('id', keyId)
                    .eq('user_id', this.user.id);

                if (error) throw error;
            } catch (error) {
                console.error('Failed to revoke API key:', error);
                this.showToast('Failed to revoke API key', 'error');
                return false;
            }
        }

        this.apiKeys = this.apiKeys.filter(k => k.id !== keyId);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.apiKeys));
        this.renderApiKeys();

        this.showToast('API key revoked', 'success');
        return true;
    }

    async regenerateApiKey(keyId) {
        const key = this.apiKeys.find(k => k.id === keyId);
        if (!key) return null;

        if (!confirm(`Regenerate "${key.name}"?\n\nThe current key will stop working immediately.`)) {
            return null;
        }

        // Delete old and create new
        await this.revokeApiKey(keyId);
        return await this.createApiKey(key.name, key.permissions);
    }

    generateKey(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        const randomValues = new Uint32Array(length);
        crypto.getRandomValues(randomValues);
        for (let i = 0; i < length; i++) {
            result += chars[randomValues[i] % chars.length];
        }
        return result;
    }

    async hashKey(key) {
        const encoder = new TextEncoder();
        const data = encoder.encode(key);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ============================================
    // USAGE DATA
    // ============================================
    async loadUsageData() {
        if (!this.supabase || !this.user) {
            this.usageData = this.getMockUsageData();
            return;
        }

        try {
            const { data, error } = await this.supabase
                .from('api_usage')
                .select('*')
                .eq('user_id', this.user.id)
                .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
                .order('timestamp', { ascending: true });

            if (error) throw error;
            this.usageData = data || [];
        } catch (error) {
            console.error('Failed to load usage data:', error);
            this.usageData = [];
        }
    }

    getMockUsageData() {
        // Return empty array - no fake data
        return [];
    }

    getTotalRequests() {
        return this.usageData.reduce((sum, d) => sum + (d.requests || 0), 0);
    }

    getTotalTokens() {
        return this.usageData.reduce((sum, d) => sum + (d.tokens || 0), 0);
    }

    getAverageLatency() {
        const total = this.usageData.reduce((sum, d) => sum + (d.latency || 0), 0);
        return this.usageData.length > 0 ? Math.round(total / this.usageData.length) : 0;
    }

    getErrorRate() {
        const totalRequests = this.getTotalRequests();
        const totalErrors = this.usageData.reduce((sum, d) => sum + (d.errors || 0), 0);
        return totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) : 0;
    }

    // ============================================
    // API TESTING
    // ============================================
    async testApiCall(endpoint, method, body) {
        const startTime = Date.now();

        try {
            const response = await fetch(`/api/v1/${endpoint}`, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getSelectedApiKey()}`
                },
                body: body ? JSON.stringify(body) : undefined
            });

            const data = await response.json();
            const latency = Date.now() - startTime;

            return {
                success: response.ok,
                status: response.status,
                statusText: response.statusText,
                data: data,
                latency: latency
            };
        } catch (error) {
            return {
                success: false,
                status: 0,
                statusText: 'Network Error',
                data: { error: error.message },
                latency: Date.now() - startTime
            };
        }
    }

    getSelectedApiKey() {
        const select = document.getElementById('testApiKey');
        return select?.value || 'demo_key';
    }

    // ============================================
    // RENDERING
    // ============================================
    renderApiKeys() {
        const container = document.getElementById('apiKeysContainer');
        if (!container) return;

        if (this.apiKeys.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon"><i class="fas fa-key"></i></div>
                    <h3>No API Keys</h3>
                    <p>Create your first API key to start using the PromptingIt API.</p>
                    <button class="btn btn-primary" onclick="apiConsole.openCreateKeyModal()">
                        <i class="fas fa-plus"></i> Create API Key
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.apiKeys.map(key => `
            <div class="api-key-card" data-key-id="${key.id}">
                <div class="api-key-header">
                    <div class="api-key-info">
                        <h3>${this.escapeHtml(key.name)}</h3>
                        <code class="api-key-value">${key.key_prefix}${'•'.repeat(20)}</code>
                    </div>
                    <div class="api-key-actions">
                        <button class="btn-icon" title="Copy" onclick="apiConsole.copyKeyPrefix('${key.key_prefix}')">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn-icon" title="Regenerate" onclick="apiConsole.regenerateApiKey('${key.id}')">
                            <i class="fas fa-sync"></i>
                        </button>
                        <button class="btn-icon danger" title="Revoke" onclick="apiConsole.revokeApiKey('${key.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="api-key-meta">
                    <span class="api-key-permission ${key.permissions.includes('write') ? 'write' : 'read'}">
                        ${key.permissions.includes('write') ? 'Read & Write' : 'Read Only'}
                    </span>
                    <span><i class="fas fa-clock"></i> Last used: ${key.last_used ? this.formatTimeAgo(key.last_used) : 'Never'}</span>
                    <span><i class="fas fa-chart-line"></i> ${this.formatNumber(key.requests_count || 0)} requests</span>
                    <span><i class="fas fa-calendar"></i> Created ${this.formatTimeAgo(key.created_at)}</span>
                </div>
            </div>
        `).join('');
    }

    renderUsageStats() {
        const totalRequests = this.getTotalRequests();
        const totalTokens = this.getTotalTokens();
        const avgLatency = this.getAverageLatency();
        const errorRate = this.getErrorRate();

        // Update stat cards
        this.updateStatValue('totalRequests', this.formatNumber(totalRequests));
        this.updateStatValue('totalTokens', this.formatNumber(totalTokens));
        this.updateStatValue('avgLatency', avgLatency + 'ms');
        this.updateStatValue('errorRate', errorRate + '%');

        // Render usage chart
        this.renderUsageChart();
    }

    updateStatValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    renderUsageChart() {
        const container = document.getElementById('usageChart');
        if (!container || this.usageData.length === 0) return;

        const maxRequests = Math.max(...this.usageData.map(d => d.requests));
        const barWidth = 100 / this.usageData.length;

        container.innerHTML = `
            <div class="chart-bars">
                ${this.usageData.map((d, i) => `
                    <div class="chart-bar" style="height: ${(d.requests / maxRequests) * 100}%; width: ${barWidth}%;"
                         title="${d.date}: ${d.requests} requests">
                    </div>
                `).join('')}
            </div>
            <div class="chart-labels">
                <span>${this.usageData[0]?.date || ''}</span>
                <span>Today</span>
            </div>
        `;
    }

    updateQuotaDisplay() {
        const tier = window.AuthService?.subscriptionTier || 'free';
        const limits = {
            free: { requests: 1000, keys: 2 },
            pro: { requests: 100000, keys: 10 },
            enterprise: { requests: -1, keys: -1 } // Unlimited
        };

        const limit = limits[tier] || limits.free;
        const usedRequests = this.getTotalRequests();
        const usedKeys = this.apiKeys.length;

        const quotaContainer = document.getElementById('quotaDisplay');
        if (quotaContainer) {
            const requestsPercent = limit.requests > 0 ? Math.min((usedRequests / limit.requests) * 100, 100) : 0;
            const keysPercent = limit.keys > 0 ? Math.min((usedKeys / limit.keys) * 100, 100) : 0;

            quotaContainer.innerHTML = `
                <div class="quota-item">
                    <div class="quota-header">
                        <span>API Requests (This Month)</span>
                        <span>${this.formatNumber(usedRequests)} / ${limit.requests > 0 ? this.formatNumber(limit.requests) : 'Unlimited'}</span>
                    </div>
                    <div class="quota-bar">
                        <div class="quota-bar-fill" style="width: ${requestsPercent}%;"></div>
                    </div>
                </div>
                <div class="quota-item">
                    <div class="quota-header">
                        <span>API Keys</span>
                        <span>${usedKeys} / ${limit.keys > 0 ? limit.keys : 'Unlimited'}</span>
                    </div>
                    <div class="quota-bar">
                        <div class="quota-bar-fill" style="width: ${keysPercent}%;"></div>
                    </div>
                </div>
            `;
        }
    }

    // ============================================
    // MODALS
    // ============================================
    openCreateKeyModal() {
        const modal = document.getElementById('createKeyModal');
        if (modal) {
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
            document.getElementById('keyName')?.focus();
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    async handleCreateKeySubmit(e) {
        e.preventDefault();

        const name = document.getElementById('keyName')?.value.trim();
        const permissions = document.getElementById('keyPermissions')?.value || 'read';

        if (!name) {
            this.showToast('Please enter a key name', 'error');
            return;
        }

        const permissionsArray = permissions === 'write' ? ['read', 'write'] : ['read'];
        const result = await this.createApiKey(name, permissionsArray);

        if (result) {
            // Show the full key in a modal
            this.showNewKeyModal(result);
            this.closeModal('createKeyModal');
            document.getElementById('createKeyForm')?.reset();
        }
    }

    showNewKeyModal(keyData) {
        const modal = document.createElement('div');
        modal.className = 'modal open';
        modal.id = 'newKeyModal';
        modal.innerHTML = `
            <div class="modal-backdrop" onclick="this.parentElement.remove(); document.body.style.overflow='';"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>API Key Created</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove(); document.body.style.overflow='';">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-warning" style="margin-bottom: 20px;">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>Copy your API key now. You won't be able to see it again!</span>
                    </div>
                    <div class="form-group">
                        <label>API Key</label>
                        <div class="api-key-display">
                            <code id="newApiKey">${keyData.full_key}</code>
                            <button class="btn btn-secondary" onclick="apiConsole.copyFullKey()">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="this.closest('.modal').remove(); document.body.style.overflow='';">Done</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    copyFullKey() {
        const keyEl = document.getElementById('newApiKey');
        if (keyEl) {
            navigator.clipboard.writeText(keyEl.textContent);
            this.showToast('API key copied to clipboard', 'success');
        }
    }

    copyKeyPrefix(prefix) {
        navigator.clipboard.writeText(prefix + '...');
        this.showToast('Key prefix copied', 'success');
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    setupEventListeners() {
        // Create key form
        const createKeyForm = document.getElementById('createKeyForm');
        if (createKeyForm) {
            createKeyForm.addEventListener('submit', (e) => this.handleCreateKeySubmit(e));
        }

        // API test form
        const testForm = document.getElementById('apiTestForm');
        if (testForm) {
            testForm.addEventListener('submit', (e) => this.handleApiTest(e));
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.open').forEach(m => {
                    m.classList.remove('open');
                });
                document.body.style.overflow = '';
            }
        });
    }

    async handleApiTest(e) {
        e.preventDefault();

        const endpoint = document.getElementById('testEndpoint')?.value || 'prompts';
        const method = document.getElementById('testMethod')?.value || 'GET';
        const bodyInput = document.getElementById('testBody');
        const body = bodyInput?.value ? JSON.parse(bodyInput.value) : null;

        const resultContainer = document.getElementById('testResult');
        if (resultContainer) {
            resultContainer.innerHTML = '<div class="loading">Testing...</div>';
        }

        const result = await this.testApiCall(endpoint, method, body);

        if (resultContainer) {
            resultContainer.innerHTML = `
                <div class="test-result ${result.success ? 'success' : 'error'}">
                    <div class="result-header">
                        <span class="status-code">${result.status} ${result.statusText}</span>
                        <span class="latency">${result.latency}ms</span>
                    </div>
                    <pre>${JSON.stringify(result.data, null, 2)}</pre>
                </div>
            `;
        }
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTimeAgo(dateString) {
        if (!dateString) return '';
        const seconds = Math.floor((Date.now() - new Date(dateString)) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return `${Math.floor(seconds / 604800)}w ago`;
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num.toString();
    }

    showToast(message, type = 'info') {
        if (window.Toast?.show) {
            window.Toast.show(message, type);
            return;
        }

        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            padding: 14px 20px;
            border-radius: 10px;
            background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#27272a'};
            color: white;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 3000);
    }
}

// ============================================
// GLOBAL INSTANCE
// ============================================
const apiConsole = new APIConsole();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('api-console.html')) {
        apiConsole.init();
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { APIConsole, apiConsole };
}
