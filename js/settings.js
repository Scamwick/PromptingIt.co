/**
 * PromptingIt.co - Settings Module
 * User preferences and account management with Supabase integration
 * Version: 1.0.0
 */

class SettingsManager {
    constructor() {
        this.user = null;
        this.profile = null;
        this.subscription = null;
        this.supabase = null;
        this.initialized = false;

        this.STORAGE_KEY = 'promptingit_settings';
        this.defaultSettings = {
            theme: 'dark',
            language: 'en',
            timezone: 'UTC',
            notifications: {
                email: true,
                marketing: false,
                updates: true,
                weeklyDigest: true
            },
            ai: {
                defaultModel: 'GPT-4',
                temperature: 0.7,
                maxTokens: 2048,
                saveHistory: true
            },
            privacy: {
                shareAnalytics: true,
                publicProfile: false
            },
            editor: {
                fontSize: 14,
                lineNumbers: true,
                wordWrap: true,
                autocomplete: true
            }
        };
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
                this.profile = window.AuthService.profile;
                this.subscription = window.AuthService.subscription;
            }

            // Load settings
            await this.loadSettings();

            // Populate forms
            this.populateForms();

            // Setup event listeners
            this.setupEventListeners();

            // Update UI
            this.updateUserDisplay();

            this.initialized = true;
            console.log('Settings Manager initialized');
        } catch (error) {
            console.error('Failed to initialize Settings Manager:', error);
            this.showToast('Failed to load settings', 'error');
        }
    }

    // ============================================
    // SETTINGS LOADING
    // ============================================
    async loadSettings() {
        // Try to load from localStorage first
        const localSettings = this.loadFromStorage();

        // Merge with defaults
        this.settings = { ...this.defaultSettings, ...localSettings };

        // Load from database if user is logged in
        if (this.supabase && this.user) {
            try {
                const { data, error } = await this.supabase
                    .from('profiles')
                    .select('preferences')
                    .eq('id', this.user.id)
                    .single();

                if (!error && data?.preferences) {
                    this.settings = { ...this.settings, ...data.preferences };
                    this.saveToStorage(this.settings);
                }
            } catch (error) {
                console.warn('Failed to load settings from database:', error);
            }
        }

        return this.settings;
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            return {};
        }
    }

    saveToStorage(settings) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
        } catch (error) {
            console.error('Failed to save settings to storage:', error);
        }
    }

    // ============================================
    // PROFILE MANAGEMENT
    // ============================================
    async updateProfile(profileData) {
        if (!this.supabase || !this.user) {
            this.showToast('Please log in to update profile', 'error');
            return false;
        }

        try {
            // Update auth user metadata
            const { error: authError } = await this.supabase.auth.updateUser({
                data: {
                    full_name: profileData.fullName,
                    avatar_url: profileData.avatarUrl
                }
            });

            if (authError) throw authError;

            // Update profile table
            const { error: profileError } = await this.supabase
                .from('profiles')
                .update({
                    full_name: profileData.fullName,
                    bio: profileData.bio,
                    company: profileData.company,
                    website: profileData.website,
                    location: profileData.location,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.user.id);

            if (profileError) throw profileError;

            this.showToast('Profile updated successfully', 'success');
            return true;
        } catch (error) {
            console.error('Failed to update profile:', error);
            this.showToast('Failed to update profile', 'error');
            return false;
        }
    }

    async updateEmail(newEmail, password) {
        if (!this.supabase || !this.user) {
            this.showToast('Please log in', 'error');
            return false;
        }

        try {
            const { error } = await this.supabase.auth.updateUser({
                email: newEmail
            });

            if (error) throw error;

            this.showToast('Verification email sent to ' + newEmail, 'success');
            return true;
        } catch (error) {
            console.error('Failed to update email:', error);
            this.showToast(error.message || 'Failed to update email', 'error');
            return false;
        }
    }

    async updatePassword(currentPassword, newPassword) {
        if (!this.supabase || !this.user) {
            this.showToast('Please log in', 'error');
            return false;
        }

        try {
            // Verify current password by signing in
            const { error: signInError } = await this.supabase.auth.signInWithPassword({
                email: this.user.email,
                password: currentPassword
            });

            if (signInError) {
                this.showToast('Current password is incorrect', 'error');
                return false;
            }

            // Update password
            const { error } = await this.supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            this.showToast('Password updated successfully', 'success');
            return true;
        } catch (error) {
            console.error('Failed to update password:', error);
            this.showToast(error.message || 'Failed to update password', 'error');
            return false;
        }
    }

    // ============================================
    // SETTINGS MANAGEMENT
    // ============================================
    async updateSettings(category, settings) {
        this.settings[category] = { ...this.settings[category], ...settings };
        this.saveToStorage(this.settings);

        // Sync to database
        if (this.supabase && this.user) {
            try {
                await this.supabase
                    .from('profiles')
                    .update({
                        preferences: this.settings,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', this.user.id);
            } catch (error) {
                console.warn('Failed to sync settings:', error);
            }
        }

        this.showToast('Settings saved', 'success');
        return true;
    }

    getSetting(path) {
        const keys = path.split('.');
        let value = this.settings;
        for (const key of keys) {
            value = value?.[key];
        }
        return value;
    }

    // ============================================
    // API KEYS MANAGEMENT
    // ============================================
    async getApiKeys() {
        if (!this.supabase || !this.user) return [];

        try {
            const { data, error } = await this.supabase
                .from('api_keys')
                .select('*')
                .eq('user_id', this.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Failed to get API keys:', error);
            return [];
        }
    }

    async createApiKey(name, permissions = ['read', 'write']) {
        if (!this.supabase || !this.user) {
            this.showToast('Please log in', 'error');
            return null;
        }

        try {
            // Generate key
            const key = 'pk_' + this.generateSecureKey(32);
            const keyHash = await this.hashKey(key);

            const { data, error } = await this.supabase
                .from('api_keys')
                .insert({
                    user_id: this.user.id,
                    name: name,
                    key_prefix: key.slice(0, 12),
                    key_hash: keyHash,
                    permissions: permissions
                })
                .select()
                .single();

            if (error) throw error;

            this.showToast('API key created', 'success');

            // Return the full key only once (it won't be retrievable later)
            return { ...data, full_key: key };
        } catch (error) {
            console.error('Failed to create API key:', error);
            this.showToast('Failed to create API key', 'error');
            return null;
        }
    }

    async revokeApiKey(keyId) {
        if (!this.supabase || !this.user) return false;

        try {
            const { error } = await this.supabase
                .from('api_keys')
                .delete()
                .eq('id', keyId)
                .eq('user_id', this.user.id);

            if (error) throw error;

            this.showToast('API key revoked', 'success');
            return true;
        } catch (error) {
            console.error('Failed to revoke API key:', error);
            this.showToast('Failed to revoke API key', 'error');
            return false;
        }
    }

    generateSecureKey(length) {
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
    // CONNECTED APPS
    // ============================================
    async getConnectedApps() {
        if (!this.supabase || !this.user) return [];

        try {
            const { data, error } = await this.supabase
                .from('oauth_connections')
                .select('*')
                .eq('user_id', this.user.id);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Failed to get connected apps:', error);
            return [];
        }
    }

    async disconnectApp(appId) {
        if (!this.supabase || !this.user) return false;

        try {
            const { error } = await this.supabase
                .from('oauth_connections')
                .delete()
                .eq('id', appId)
                .eq('user_id', this.user.id);

            if (error) throw error;

            this.showToast('App disconnected', 'success');
            return true;
        } catch (error) {
            console.error('Failed to disconnect app:', error);
            this.showToast('Failed to disconnect app', 'error');
            return false;
        }
    }

    // ============================================
    // DATA EXPORT/DELETE
    // ============================================
    async exportUserData() {
        if (!this.supabase || !this.user) {
            this.showToast('Please log in', 'error');
            return;
        }

        try {
            // Gather all user data
            const [promptsRes, foldersRes, workflowsRes] = await Promise.all([
                this.supabase.from('prompts').select('*').eq('user_id', this.user.id),
                this.supabase.from('folders').select('*').eq('user_id', this.user.id),
                this.supabase.from('workflows').select('*').eq('user_id', this.user.id)
            ]);

            const exportData = {
                exported_at: new Date().toISOString(),
                user: {
                    email: this.user.email,
                    metadata: this.user.user_metadata
                },
                prompts: promptsRes.data || [],
                folders: foldersRes.data || [],
                workflows: workflowsRes.data || [],
                settings: this.settings
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `promptingit-data-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            this.showToast('Data exported successfully', 'success');
        } catch (error) {
            console.error('Failed to export data:', error);
            this.showToast('Failed to export data', 'error');
        }
    }

    async deleteAccount() {
        if (!this.supabase || !this.user) return false;

        const confirmed = confirm(
            'Are you sure you want to delete your account?\n\n' +
            'This action is PERMANENT and cannot be undone.\n' +
            'All your prompts, workflows, and data will be deleted.'
        );

        if (!confirmed) return false;

        const doubleConfirm = prompt('Type "DELETE" to confirm account deletion:');
        if (doubleConfirm !== 'DELETE') {
            this.showToast('Account deletion cancelled', 'info');
            return false;
        }

        try {
            // Delete user data (cascade should handle related records)
            // The actual account deletion requires admin privileges
            // For now, we'll mark the profile as deleted
            await this.supabase
                .from('profiles')
                .update({
                    is_deleted: true,
                    deleted_at: new Date().toISOString()
                })
                .eq('id', this.user.id);

            // Sign out
            await this.supabase.auth.signOut();

            this.showToast('Account scheduled for deletion', 'success');
            window.location.href = 'index.html';
            return true;
        } catch (error) {
            console.error('Failed to delete account:', error);
            this.showToast('Failed to delete account. Please contact support.', 'error');
            return false;
        }
    }

    // ============================================
    // UI HELPERS
    // ============================================
    populateForms() {
        // Profile form
        if (this.user) {
            this.setInputValue('fullName', this.user.user_metadata?.full_name || '');
            this.setInputValue('email', this.user.email || '');
        }

        if (this.profile) {
            this.setInputValue('bio', this.profile.bio || '');
            this.setInputValue('company', this.profile.company || '');
            this.setInputValue('website', this.profile.website || '');
            this.setInputValue('location', this.profile.location || '');
        }

        // Settings
        this.setSelectValue('defaultModel', this.settings.ai?.defaultModel);
        this.setSelectValue('timezone', this.settings.timezone);
        this.setSelectValue('language', this.settings.language);

        // Toggles
        this.setToggleValue('emailNotifications', this.settings.notifications?.email);
        this.setToggleValue('marketingEmails', this.settings.notifications?.marketing);
        this.setToggleValue('productUpdates', this.settings.notifications?.updates);
        this.setToggleValue('weeklyDigest', this.settings.notifications?.weeklyDigest);
        this.setToggleValue('shareAnalytics', this.settings.privacy?.shareAnalytics);
        this.setToggleValue('publicProfile', this.settings.privacy?.publicProfile);
    }

    setInputValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    }

    setSelectValue(id, value) {
        const el = document.getElementById(id);
        if (el && value) el.value = value;
    }

    setToggleValue(id, value) {
        const el = document.getElementById(id);
        if (el) {
            if (value) el.classList.add('active');
            else el.classList.remove('active');
        }
    }

    updateUserDisplay() {
        // Update avatar
        const avatar = document.querySelector('.avatar-preview');
        if (avatar && this.user) {
            const name = this.user.user_metadata?.full_name || this.user.email?.split('@')[0] || 'User';
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            avatar.textContent = initials;
        }

        // Update sidebar user card
        const userCard = document.querySelector('.user-card');
        if (userCard && this.user) {
            const name = this.user.user_metadata?.full_name || this.user.email?.split('@')[0] || 'User';
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            const tier = this.subscription?.tier || 'free';

            const userAvatar = userCard.querySelector('.user-avatar');
            const userName = userCard.querySelector('.user-name');
            const userTier = userCard.querySelector('.user-tier');

            if (userAvatar) userAvatar.textContent = initials;
            if (userName) userName.textContent = name;
            if (userTier) {
                userTier.innerHTML = `<i class="fas fa-crown"></i> ${tier === 'pro' ? 'Pro Plan' : tier === 'enterprise' ? 'Enterprise' : 'Free Plan'}`;
            }
        }

        // Update plan card
        const planInfo = document.querySelector('.plan-info');
        if (planInfo && this.subscription) {
            const tier = this.subscription.tier || 'free';
            planInfo.innerHTML = `
                <h4>${tier === 'pro' ? 'Pro Plan' : tier === 'enterprise' ? 'Enterprise Plan' : 'Free Plan'}</h4>
                <p>${tier === 'free' ? 'Limited features and usage' : 'Full access to all features'}</p>
            `;
        }
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const targetId = tab.dataset.tab;
                this.switchTab(targetId);
            });
        });

        // Toggle switches
        document.querySelectorAll('.toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('active');
                this.handleToggleChange(toggle);
            });
        });

        // Profile form
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => this.handleProfileSubmit(e));
        }

        // Password form
        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => this.handlePasswordSubmit(e));
        }

        // Export data button
        const exportBtn = document.getElementById('exportDataBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportUserData());
        }

        // Delete account button
        const deleteBtn = document.getElementById('deleteAccountBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteAccount());
        }
    }

    switchTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabId) {
                tab.classList.add('active');
            }
        });

        // Update tab content
        document.querySelectorAll('.settings-tab-content').forEach(content => {
            content.classList.remove('active');
            if (content.id === tabId) {
                content.classList.add('active');
            }
        });
    }

    async handleProfileSubmit(e) {
        e.preventDefault();

        const profileData = {
            fullName: document.getElementById('fullName')?.value.trim(),
            bio: document.getElementById('bio')?.value.trim(),
            company: document.getElementById('company')?.value.trim(),
            website: document.getElementById('website')?.value.trim(),
            location: document.getElementById('location')?.value.trim()
        };

        await this.updateProfile(profileData);
    }

    async handlePasswordSubmit(e) {
        e.preventDefault();

        const currentPassword = document.getElementById('currentPassword')?.value;
        const newPassword = document.getElementById('newPassword')?.value;
        const confirmPassword = document.getElementById('confirmPassword')?.value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showToast('Please fill all password fields', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showToast('New passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 8) {
            this.showToast('Password must be at least 8 characters', 'error');
            return;
        }

        const success = await this.updatePassword(currentPassword, newPassword);
        if (success) {
            document.getElementById('passwordForm')?.reset();
        }
    }

    handleToggleChange(toggle) {
        const toggleId = toggle.id;
        const isActive = toggle.classList.contains('active');

        // Map toggle IDs to settings
        const settingsMap = {
            'emailNotifications': ['notifications', 'email'],
            'marketingEmails': ['notifications', 'marketing'],
            'productUpdates': ['notifications', 'updates'],
            'weeklyDigest': ['notifications', 'weeklyDigest'],
            'shareAnalytics': ['privacy', 'shareAnalytics'],
            'publicProfile': ['privacy', 'publicProfile']
        };

        const path = settingsMap[toggleId];
        if (path) {
            const [category, key] = path;
            this.settings[category] = this.settings[category] || {};
            this.settings[category][key] = isActive;
            this.saveToStorage(this.settings);

            // Debounce database sync
            clearTimeout(this.syncTimeout);
            this.syncTimeout = setTimeout(() => {
                this.syncSettingsToDatabase();
            }, 1000);
        }
    }

    async syncSettingsToDatabase() {
        if (!this.supabase || !this.user) return;

        try {
            await this.supabase
                .from('profiles')
                .update({
                    preferences: this.settings,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.user.id);
        } catch (error) {
            console.warn('Failed to sync settings:', error);
        }
    }

    showToast(message, type = 'info') {
        // Try to use existing toast function or create inline
        if (window.Toast?.show) {
            window.Toast.show(message, type);
            return;
        }

        const container = document.getElementById('toastContainer') || document.body;
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
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// ============================================
// GLOBAL INSTANCE
// ============================================
const settingsManager = new SettingsManager();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('settings.html')) {
        settingsManager.init();
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SettingsManager, settingsManager };
}
