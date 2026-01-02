/**
 * PromptingIt.co - Prompt Library Module
 * Full CRUD operations with Supabase integration
 * Version: 2.0.0
 */

// ============================================
// PROMPT LIBRARY CLASS
// ============================================
class PromptLibrary {
    constructor() {
        this.state = {
            prompts: [],
            folders: [],
            favorites: new Set(),
            currentFilter: 'all',
            currentFolder: 'all',
            currentView: 'grid',
            searchQuery: '',
            selectedPromptId: null,
            editingPromptId: null,
            user: null,
            isLoading: false,
            sortBy: 'updated_at',
            sortOrder: 'desc'
        };

        this.STORAGE_KEYS = {
            PROMPTS: 'promptingit_prompts',
            FOLDERS: 'promptingit_folders',
            FAVORITES: 'promptingit_favorites',
            VIEW: 'promptingit_view',
            SORT: 'promptingit_sort'
        };

        this.supabase = null;
        this.initialized = false;
    }

    // ============================================
    // INITIALIZATION
    // ============================================
    async init() {
        if (this.initialized) return;

        try {
            // Load cached data first for instant display
            this.loadFromLocalStorage();
            this.renderPrompts();
            this.renderFolders();
            this.updateStats();

            // Get Supabase client
            if (window.PromptingItSupabase) {
                this.supabase = await window.PromptingItSupabase.getClientAsync();
            }

            // Get user
            if (window.AuthService) {
                await window.AuthService.init();
                this.state.user = window.AuthService.user;
            }

            // Update user display
            this.updateUserDisplay();

            // Load fresh data from Supabase
            await this.loadFromSupabase();

            // Check for playground prompt to import
            this.checkPlaygroundImport();

            // Set up event listeners
            this.setupEventListeners();

            this.initialized = true;
            console.log('Prompt Library initialized');
        } catch (error) {
            console.error('Failed to initialize Prompt Library:', error);
            this.showToast('Failed to initialize library', 'error');
        }
    }

    // ============================================
    // DATA LOADING
    // ============================================
    loadFromLocalStorage() {
        try {
            const prompts = localStorage.getItem(this.STORAGE_KEYS.PROMPTS);
            const folders = localStorage.getItem(this.STORAGE_KEYS.FOLDERS);
            const favorites = localStorage.getItem(this.STORAGE_KEYS.FAVORITES);
            const view = localStorage.getItem(this.STORAGE_KEYS.VIEW);
            const sort = localStorage.getItem(this.STORAGE_KEYS.SORT);

            if (prompts) this.state.prompts = JSON.parse(prompts);
            if (folders) this.state.folders = JSON.parse(folders);
            if (favorites) this.state.favorites = new Set(JSON.parse(favorites));
            if (view) this.state.currentView = view;
            if (sort) {
                const sortData = JSON.parse(sort);
                this.state.sortBy = sortData.sortBy || 'updated_at';
                this.state.sortOrder = sortData.sortOrder || 'desc';
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem(this.STORAGE_KEYS.PROMPTS, JSON.stringify(this.state.prompts));
            localStorage.setItem(this.STORAGE_KEYS.FOLDERS, JSON.stringify(this.state.folders));
            localStorage.setItem(this.STORAGE_KEYS.FAVORITES, JSON.stringify([...this.state.favorites]));
            localStorage.setItem(this.STORAGE_KEYS.VIEW, this.state.currentView);
            localStorage.setItem(this.STORAGE_KEYS.SORT, JSON.stringify({
                sortBy: this.state.sortBy,
                sortOrder: this.state.sortOrder
            }));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    async loadFromSupabase() {
        if (!this.supabase || !this.state.user) {
            console.log('No Supabase or user, using local data');
            return;
        }

        this.state.isLoading = true;
        this.showLoadingState();

        try {
            // Load prompts
            const { data: prompts, error: promptsError } = await this.supabase
                .from('prompts')
                .select('*')
                .eq('user_id', this.state.user.id)
                .order('updated_at', { ascending: false });

            if (promptsError) throw promptsError;

            // Load folders
            const { data: folders, error: foldersError } = await this.supabase
                .from('folders')
                .select('*')
                .eq('user_id', this.state.user.id)
                .order('name', { ascending: true });

            if (foldersError && foldersError.code !== 'PGRST116') {
                console.warn('Folders error:', foldersError);
            }

            // Transform and merge data
            if (prompts) {
                this.state.prompts = prompts.map(p => this.transformPromptFromDB(p));
                this.saveToLocalStorage();
            }

            if (folders) {
                this.state.folders = folders.map(f => ({
                    id: f.id,
                    name: f.name,
                    parent_id: f.parent_id,
                    color: f.color || '#67e8f9',
                    icon: f.icon || 'folder'
                }));
                this.saveToLocalStorage();
            }

            this.renderPrompts();
            this.renderFolders();
            this.updateStats();

        } catch (error) {
            console.error('Error loading from Supabase:', error);
            this.showToast('Using cached data', 'warning');
        } finally {
            this.state.isLoading = false;
            this.hideLoadingState();
        }
    }

    transformPromptFromDB(prompt) {
        return {
            id: prompt.id,
            title: prompt.title,
            content: prompt.content,
            description: prompt.description || '',
            category: prompt.category || 'General',
            tags: prompt.tags || [],
            model: prompt.model || 'GPT-4',
            status: prompt.status || 'draft',
            folder_id: prompt.folder_id,
            version: prompt.version || '1.0.0',
            is_favorite: prompt.is_favorite || false,
            is_public: prompt.is_public || false,
            run_count: prompt.run_count || 0,
            view_count: prompt.view_count || 0,
            rating: prompt.rating || 0,
            created_at: prompt.created_at,
            updated_at: prompt.updated_at
        };
    }

    transformPromptToDB(prompt) {
        return {
            title: prompt.title,
            content: prompt.content,
            description: prompt.description || '',
            category: prompt.category || 'General',
            tags: prompt.tags || [],
            model: prompt.model || 'GPT-4',
            status: prompt.status || 'draft',
            folder_id: prompt.folder_id || null,
            version: prompt.version || '1.0.0',
            is_favorite: prompt.is_favorite || false,
            is_public: prompt.is_public || false,
            user_id: this.state.user?.id
        };
    }

    // ============================================
    // PROMPT CRUD OPERATIONS
    // ============================================
    async createPrompt(promptData) {
        const newPrompt = {
            id: this.generateId(),
            title: promptData.title,
            content: promptData.content,
            description: promptData.description || '',
            category: promptData.category || 'General',
            tags: promptData.tags || [],
            model: promptData.model || 'GPT-4',
            status: promptData.status || 'draft',
            folder_id: promptData.folder_id || null,
            version: '1.0.0',
            is_favorite: false,
            run_count: 0,
            view_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Add to local state immediately
        this.state.prompts.unshift(newPrompt);
        this.saveToLocalStorage();
        this.renderPrompts();
        this.updateStats();

        // Sync to Supabase
        if (this.supabase && this.state.user) {
            try {
                const { data, error } = await this.supabase
                    .from('prompts')
                    .insert(this.transformPromptToDB(newPrompt))
                    .select()
                    .single();

                if (error) throw error;

                // Update local with server ID
                const index = this.state.prompts.findIndex(p => p.id === newPrompt.id);
                if (index !== -1 && data) {
                    this.state.prompts[index] = this.transformPromptFromDB(data);
                    this.saveToLocalStorage();
                    this.renderPrompts();
                }

                // Create initial version
                await this.createPromptVersion(data.id, newPrompt.content, 'Initial version');

            } catch (error) {
                console.error('Error creating prompt in Supabase:', error);
                this.showToast('Saved locally, sync pending', 'warning');
            }
        }

        this.showToast('Prompt created successfully', 'success');
        return newPrompt;
    }

    async updatePrompt(promptId, updates) {
        const index = this.state.prompts.findIndex(p => p.id === promptId);
        if (index === -1) {
            this.showToast('Prompt not found', 'error');
            return null;
        }

        const existingPrompt = this.state.prompts[index];
        const contentChanged = updates.content && updates.content !== existingPrompt.content;

        // Increment version if content changed
        let newVersion = existingPrompt.version;
        if (contentChanged) {
            newVersion = this.incrementVersion(existingPrompt.version);
        }

        const updatedPrompt = {
            ...existingPrompt,
            ...updates,
            version: newVersion,
            updated_at: new Date().toISOString()
        };

        // Update local state
        this.state.prompts[index] = updatedPrompt;
        this.saveToLocalStorage();
        this.renderPrompts();
        this.updateStats();

        // Sync to Supabase
        if (this.supabase && this.state.user) {
            try {
                const { error } = await this.supabase
                    .from('prompts')
                    .update({
                        ...this.transformPromptToDB(updatedPrompt),
                        version: newVersion,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', promptId)
                    .eq('user_id', this.state.user.id);

                if (error) throw error;

                // Create version entry if content changed
                if (contentChanged) {
                    await this.createPromptVersion(promptId, updates.content, updates.change_notes || 'Content updated');
                }

            } catch (error) {
                console.error('Error updating prompt:', error);
                this.showToast('Saved locally, sync pending', 'warning');
            }
        }

        this.showToast('Prompt updated successfully', 'success');
        return updatedPrompt;
    }

    async deletePrompt(promptId) {
        const prompt = this.state.prompts.find(p => p.id === promptId);
        if (!prompt) return false;

        // Remove from local state
        this.state.prompts = this.state.prompts.filter(p => p.id !== promptId);
        this.state.favorites.delete(promptId);
        this.saveToLocalStorage();
        this.renderPrompts();
        this.updateStats();

        // Sync to Supabase
        if (this.supabase && this.state.user) {
            try {
                const { error } = await this.supabase
                    .from('prompts')
                    .delete()
                    .eq('id', promptId)
                    .eq('user_id', this.state.user.id);

                if (error) throw error;
            } catch (error) {
                console.error('Error deleting prompt:', error);
            }
        }

        this.showToast('Prompt deleted', 'success');
        return true;
    }

    async duplicatePrompt(promptId) {
        const original = this.state.prompts.find(p => p.id === promptId);
        if (!original) {
            this.showToast('Prompt not found', 'error');
            return null;
        }

        const duplicate = await this.createPrompt({
            title: `${original.title} (Copy)`,
            content: original.content,
            description: original.description,
            category: original.category,
            tags: [...original.tags],
            model: original.model,
            status: 'draft',
            folder_id: original.folder_id
        });

        return duplicate;
    }

    async archivePrompt(promptId) {
        const prompt = this.state.prompts.find(p => p.id === promptId);
        if (!prompt) return;

        const newStatus = prompt.status === 'archived' ? 'draft' : 'archived';
        await this.updatePrompt(promptId, { status: newStatus });
        this.showToast(newStatus === 'archived' ? 'Prompt archived' : 'Prompt restored', 'success');
    }

    async toggleFavorite(promptId) {
        const prompt = this.state.prompts.find(p => p.id === promptId);
        if (!prompt) return;

        const isFavorite = this.state.favorites.has(promptId);

        if (isFavorite) {
            this.state.favorites.delete(promptId);
        } else {
            this.state.favorites.add(promptId);
        }

        // Update prompt
        await this.updatePrompt(promptId, { is_favorite: !isFavorite });
        this.saveToLocalStorage();
        this.renderPrompts();

        this.showToast(isFavorite ? 'Removed from favorites' : 'Added to favorites', 'success');
    }

    async activatePrompt(promptId) {
        await this.updatePrompt(promptId, { status: 'active' });
        this.showToast('Prompt activated', 'success');
    }

    // ============================================
    // VERSION MANAGEMENT
    // ============================================
    async createPromptVersion(promptId, content, changeNotes = '') {
        if (!this.supabase || !this.state.user) return;

        const prompt = this.state.prompts.find(p => p.id === promptId);
        if (!prompt) return;

        try {
            await this.supabase
                .from('prompt_versions')
                .insert({
                    prompt_id: promptId,
                    version: prompt.version,
                    content: content,
                    change_notes: changeNotes,
                    created_by: this.state.user.id
                });
        } catch (error) {
            console.error('Error creating version:', error);
        }
    }

    async getPromptVersions(promptId) {
        if (!this.supabase) return [];

        try {
            const { data, error } = await this.supabase
                .from('prompt_versions')
                .select('*')
                .eq('prompt_id', promptId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting versions:', error);
            return [];
        }
    }

    incrementVersion(version) {
        const parts = version.replace('v', '').split('.').map(Number);
        parts[2] = (parts[2] || 0) + 1;
        if (parts[2] >= 10) {
            parts[2] = 0;
            parts[1] = (parts[1] || 0) + 1;
        }
        if (parts[1] >= 10) {
            parts[1] = 0;
            parts[0] = (parts[0] || 1) + 1;
        }
        return `v${parts.join('.')}`;
    }

    // ============================================
    // FOLDER OPERATIONS
    // ============================================
    async createFolder(name, parentId = null) {
        const folder = {
            id: this.generateId(),
            name: name,
            parent_id: parentId,
            color: '#67e8f9',
            icon: 'folder'
        };

        // Add to local state
        this.state.folders.push(folder);
        this.saveToLocalStorage();
        this.renderFolders();

        // Sync to Supabase
        if (this.supabase && this.state.user) {
            try {
                const { data, error } = await this.supabase
                    .from('folders')
                    .insert({
                        name: folder.name,
                        parent_id: folder.parent_id,
                        color: folder.color,
                        icon: folder.icon,
                        user_id: this.state.user.id
                    })
                    .select()
                    .single();

                if (error) throw error;

                // Update local with server ID
                const index = this.state.folders.findIndex(f => f.id === folder.id);
                if (index !== -1 && data) {
                    this.state.folders[index].id = data.id;
                    this.saveToLocalStorage();
                    this.renderFolders();
                }
            } catch (error) {
                console.error('Error creating folder:', error);
            }
        }

        this.showToast('Folder created', 'success');
        return folder;
    }

    async renameFolder(folderId, newName) {
        const index = this.state.folders.findIndex(f => f.id === folderId);
        if (index === -1) return;

        this.state.folders[index].name = newName;
        this.saveToLocalStorage();
        this.renderFolders();

        if (this.supabase && this.state.user) {
            try {
                await this.supabase
                    .from('folders')
                    .update({ name: newName, updated_at: new Date().toISOString() })
                    .eq('id', folderId)
                    .eq('user_id', this.state.user.id);
            } catch (error) {
                console.error('Error renaming folder:', error);
            }
        }

        this.showToast('Folder renamed', 'success');
    }

    async deleteFolder(folderId) {
        // Move prompts in this folder to root
        this.state.prompts.forEach(p => {
            if (p.folder_id === folderId) {
                p.folder_id = null;
            }
        });

        // Remove folder
        this.state.folders = this.state.folders.filter(f => f.id !== folderId);
        this.saveToLocalStorage();
        this.renderFolders();
        this.renderPrompts();

        if (this.supabase && this.state.user) {
            try {
                await this.supabase
                    .from('folders')
                    .delete()
                    .eq('id', folderId)
                    .eq('user_id', this.state.user.id);
            } catch (error) {
                console.error('Error deleting folder:', error);
            }
        }

        this.showToast('Folder deleted', 'success');
    }

    async moveToFolder(promptId, folderId) {
        await this.updatePrompt(promptId, { folder_id: folderId });
        this.showToast('Prompt moved', 'success');
    }

    getFolderPromptCount(folderId) {
        return this.state.prompts.filter(p => p.folder_id === folderId && p.status !== 'archived').length;
    }

    getNestedFolders(parentId = null) {
        return this.state.folders.filter(f => f.parent_id === parentId);
    }

    // ============================================
    // SEARCH & FILTER
    // ============================================
    getFilteredPrompts() {
        let filtered = [...this.state.prompts];

        // Filter by status
        if (this.state.currentFilter === 'active') {
            filtered = filtered.filter(p => p.status === 'active');
        } else if (this.state.currentFilter === 'draft') {
            filtered = filtered.filter(p => p.status === 'draft');
        } else if (this.state.currentFilter === 'archived') {
            filtered = filtered.filter(p => p.status === 'archived');
        } else {
            // 'all' - exclude archived
            filtered = filtered.filter(p => p.status !== 'archived');
        }

        // Filter by folder
        if (this.state.currentFolder === 'favorites') {
            filtered = filtered.filter(p => this.state.favorites.has(p.id));
        } else if (this.state.currentFolder !== 'all' && this.state.currentFolder !== 'archived') {
            filtered = filtered.filter(p => p.folder_id === this.state.currentFolder);
        }

        // Search filter
        if (this.state.searchQuery) {
            const query = this.state.searchQuery.toLowerCase();
            filtered = filtered.filter(p =>
                (p.title || '').toLowerCase().includes(query) ||
                (p.description || '').toLowerCase().includes(query) ||
                (p.content || '').toLowerCase().includes(query) ||
                (p.tags || []).some(t => t.toLowerCase().includes(query)) ||
                (p.category || '').toLowerCase().includes(query)
            );
        }

        // Sort
        filtered.sort((a, b) => {
            let aVal = a[this.state.sortBy];
            let bVal = b[this.state.sortBy];

            if (this.state.sortBy === 'updated_at' || this.state.sortBy === 'created_at') {
                aVal = new Date(aVal || 0).getTime();
                bVal = new Date(bVal || 0).getTime();
            } else if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (this.state.sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        return filtered;
    }

    setFilter(filter) {
        this.state.currentFilter = filter;
        this.renderPrompts();
        this.updateFilterButtons();
    }

    setFolder(folderId) {
        this.state.currentFolder = folderId;
        if (folderId === 'archived') {
            this.state.currentFilter = 'archived';
        } else if (this.state.currentFilter === 'archived') {
            this.state.currentFilter = 'all';
        }
        this.renderPrompts();
        this.updateFolderButtons();
    }

    setSearch(query) {
        this.state.searchQuery = query;
        this.renderPrompts();
    }

    setSort(sortBy, sortOrder = 'desc') {
        this.state.sortBy = sortBy;
        this.state.sortOrder = sortOrder;
        this.saveToLocalStorage();
        this.renderPrompts();
    }

    setView(view) {
        this.state.currentView = view;
        this.saveToLocalStorage();
        this.renderPrompts();
        this.updateViewButtons();
    }

    // ============================================
    // IMPORT / EXPORT
    // ============================================
    async importFromJSON(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            let importedCount = 0;

            // Import prompts
            if (data.prompts && Array.isArray(data.prompts)) {
                for (const prompt of data.prompts) {
                    await this.createPrompt({
                        title: prompt.title || 'Imported Prompt',
                        content: prompt.content || '',
                        description: prompt.description || '',
                        category: prompt.category || 'General',
                        tags: prompt.tags || [],
                        model: prompt.model || 'GPT-4',
                        status: 'draft'
                    });
                    importedCount++;
                }
            }

            // Import folders
            if (data.folders && Array.isArray(data.folders)) {
                for (const folder of data.folders) {
                    if (!this.state.folders.find(f => f.name === folder.name)) {
                        await this.createFolder(folder.name);
                    }
                }
            }

            this.showToast(`Imported ${importedCount} prompts`, 'success');
            return importedCount;
        } catch (error) {
            console.error('Import error:', error);
            this.showToast('Invalid JSON file', 'error');
            return 0;
        }
    }

    async importFromCSV(csvData) {
        try {
            const lines = csvData.split('\n');
            if (lines.length < 2) {
                this.showToast('Invalid CSV file', 'error');
                return 0;
            }

            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
            let importedCount = 0;

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                // Parse CSV line (handle quoted values)
                const values = this.parseCSVLine(line);
                const prompt = {};

                headers.forEach((header, index) => {
                    if (values[index]) {
                        prompt[header] = values[index];
                    }
                });

                if (prompt.title || prompt.content) {
                    await this.createPrompt({
                        title: prompt.title || 'Imported Prompt',
                        content: prompt.content || prompt.prompt || '',
                        description: prompt.description || '',
                        category: prompt.category || 'General',
                        tags: prompt.tags ? prompt.tags.split(';') : [],
                        model: prompt.model || 'GPT-4',
                        status: 'draft'
                    });
                    importedCount++;
                }
            }

            this.showToast(`Imported ${importedCount} prompts from CSV`, 'success');
            return importedCount;
        } catch (error) {
            console.error('CSV import error:', error);
            this.showToast('Invalid CSV file', 'error');
            return 0;
        }
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    exportToJSON(promptIds = null) {
        const promptsToExport = promptIds
            ? this.state.prompts.filter(p => promptIds.includes(p.id))
            : this.state.prompts.filter(p => p.status !== 'archived');

        const exportData = {
            version: '2.0',
            exported_at: new Date().toISOString(),
            source: 'PromptingIt.co',
            prompts: promptsToExport.map(p => ({
                title: p.title,
                content: p.content,
                description: p.description,
                category: p.category,
                tags: p.tags,
                model: p.model,
                version: p.version,
                status: p.status,
                created_at: p.created_at,
                updated_at: p.updated_at
            })),
            folders: this.state.folders.map(f => ({
                name: f.name,
                parent_id: f.parent_id
            }))
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `promptingit-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showToast(`Exported ${promptsToExport.length} prompts`, 'success');
    }

    exportToCSV(promptIds = null) {
        const promptsToExport = promptIds
            ? this.state.prompts.filter(p => promptIds.includes(p.id))
            : this.state.prompts.filter(p => p.status !== 'archived');

        const headers = ['title', 'content', 'description', 'category', 'tags', 'model', 'version', 'status', 'created_at', 'updated_at'];
        const csvRows = [headers.join(',')];

        promptsToExport.forEach(p => {
            const row = headers.map(h => {
                let value = p[h] || '';
                if (h === 'tags' && Array.isArray(value)) {
                    value = value.join(';');
                }
                // Escape quotes and wrap in quotes if contains comma
                value = String(value).replace(/"/g, '""');
                if (value.includes(',') || value.includes('\n') || value.includes('"')) {
                    value = `"${value}"`;
                }
                return value;
            });
            csvRows.push(row.join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `promptingit-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        this.showToast(`Exported ${promptsToExport.length} prompts to CSV`, 'success');
    }

    exportSinglePrompt(promptId) {
        const prompt = this.state.prompts.find(p => p.id === promptId);
        if (!prompt) return;

        const blob = new Blob([JSON.stringify(prompt, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${prompt.title.toLowerCase().replace(/\s+/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showToast('Prompt exported', 'success');
    }

    // ============================================
    // RENDERING
    // ============================================
    renderPrompts() {
        const grid = document.getElementById('promptsGrid');
        if (!grid) return;

        const filtered = this.getFilteredPrompts();

        if (filtered.length === 0) {
            grid.innerHTML = this.getEmptyStateHTML();
            return;
        }

        const isListView = this.state.currentView === 'list';
        grid.className = `prompts-grid ${isListView ? 'list-view' : ''}`;

        grid.innerHTML = filtered.map(p => this.getPromptCardHTML(p)).join('');

        // Add event listeners
        grid.querySelectorAll('.prompt-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.prompt-actions')) {
                    this.openPrompt(card.dataset.id);
                }
            });
        });
    }

    getPromptCardHTML(prompt) {
        const isFavorite = this.state.favorites.has(prompt.id);
        const timeAgo = this.formatTimeAgo(prompt.updated_at);
        const statusClass = prompt.status || 'draft';

        return `
            <div class="prompt-card" data-id="${prompt.id}">
                <div class="prompt-card-header">
                    <div>
                        <div class="prompt-title">
                            <span class="status-dot ${statusClass}"></span>
                            ${this.escapeHtml(prompt.title)}
                            ${isFavorite ? '<i class="fas fa-star" style="color:var(--solar);font-size:12px;margin-left:6px;"></i>' : ''}
                        </div>
                        <span class="prompt-version">${prompt.version || 'v1.0.0'}</span>
                    </div>
                </div>
                <p class="prompt-description">${this.escapeHtml(prompt.description || 'No description')}</p>
                <div class="prompt-meta">
                    <span><i class="fas fa-clock"></i> ${timeAgo}</span>
                    <span><i class="fas fa-tag"></i> ${prompt.category || 'General'}</span>
                </div>
                <div class="prompt-tags">
                    ${(prompt.tags || []).slice(0, 3).map(t =>
                        `<span class="prompt-tag model">${this.escapeHtml(t)}</span>`
                    ).join('')}
                    ${prompt.status === 'active' ? '<span class="prompt-tag status">Production</span>' : ''}
                </div>
                <div class="prompt-footer">
                    <div class="prompt-stats">
                        <span class="prompt-stat"><i class="fas fa-play"></i> ${this.formatNumber(prompt.run_count || 0)} runs</span>
                        <span class="prompt-stat"><i class="fas fa-eye"></i> ${this.formatNumber(prompt.view_count || 0)} views</span>
                    </div>
                    <div class="prompt-actions" onclick="event.stopPropagation()">
                        <button class="prompt-action" title="Edit" onclick="promptLibrary.openEditModal('${prompt.id}')">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                        <button class="prompt-action" title="Duplicate" onclick="promptLibrary.duplicatePrompt('${prompt.id}')">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="prompt-action" title="More" onclick="promptLibrary.showContextMenu('${prompt.id}', event)">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    getEmptyStateHTML() {
        const message = this.state.searchQuery
            ? 'No prompts match your search'
            : this.state.currentFilter === 'archived'
                ? 'No archived prompts'
                : 'Create your first prompt';

        return `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-icon"><i class="fas fa-folder-open"></i></div>
                <div class="empty-title">No prompts found</div>
                <div class="empty-desc">${message}</div>
                ${!this.state.searchQuery ? `
                    <button class="btn btn-primary" onclick="promptLibrary.openNewPromptModal()">
                        <i class="fas fa-plus"></i> Create Prompt
                    </button>
                ` : ''}
            </div>
        `;
    }

    renderFolders() {
        const folderTree = document.querySelector('.folder-tree');
        if (!folderTree) return;

        const allCount = this.state.prompts.filter(p => p.status !== 'archived').length;
        const favCount = this.state.prompts.filter(p => this.state.favorites.has(p.id)).length;
        const archiveCount = this.state.prompts.filter(p => p.status === 'archived').length;

        let html = `
            <li class="folder-item ${this.state.currentFolder === 'all' ? 'active' : ''}"
                onclick="promptLibrary.setFolder('all')">
                <i class="fas fa-folder"></i>
                All Prompts
                <span class="folder-count">${allCount}</span>
            </li>
            <li class="folder-item ${this.state.currentFolder === 'favorites' ? 'active' : ''}"
                onclick="promptLibrary.setFolder('favorites')">
                <i class="fas fa-star"></i>
                Favorites
                <span class="folder-count">${favCount}</span>
            </li>
        `;

        // Render root folders
        const rootFolders = this.getNestedFolders(null);
        rootFolders.forEach(folder => {
            html += this.getFolderHTML(folder);
        });

        // Archived folder at the end
        html += `
            <li class="folder-item ${this.state.currentFolder === 'archived' ? 'active' : ''}"
                onclick="promptLibrary.setFolder('archived')">
                <i class="fas fa-archive"></i>
                Archived
                <span class="folder-count">${archiveCount}</span>
            </li>
        `;

        folderTree.innerHTML = html;
    }

    getFolderHTML(folder, depth = 0) {
        const count = this.getFolderPromptCount(folder.id);
        const nestedFolders = this.getNestedFolders(folder.id);
        const isActive = this.state.currentFolder === folder.id;

        let html = `
            <li class="folder-item ${isActive ? 'active' : ''}"
                data-folder-id="${folder.id}"
                onclick="promptLibrary.setFolder('${folder.id}')"
                oncontextmenu="promptLibrary.showFolderMenu('${folder.id}', event)"
                style="${depth > 0 ? 'margin-left: ' + (depth * 16) + 'px;' : ''}">
                <i class="fas fa-folder"></i>
                ${this.escapeHtml(folder.name)}
                <span class="folder-count">${count}</span>
            </li>
        `;

        // Render nested folders
        if (nestedFolders.length > 0) {
            nestedFolders.forEach(nested => {
                html += this.getFolderHTML(nested, depth + 1);
            });
        }

        return html;
    }

    updateStats() {
        const all = this.state.prompts.filter(p => p.status !== 'archived');
        const active = this.state.prompts.filter(p => p.status === 'active');
        const drafts = this.state.prompts.filter(p => p.status === 'draft');
        const totalRuns = this.state.prompts.reduce((sum, p) => sum + (p.run_count || 0), 0);

        const stats = document.querySelectorAll('.quick-stat-value');
        if (stats[0]) stats[0].textContent = all.length;
        if (stats[1]) stats[1].textContent = active.length;
        if (stats[2]) stats[2].textContent = drafts.length;
        if (stats[3]) stats[3].textContent = this.formatNumber(totalRuns);

        // Update nav badge
        const badge = document.querySelector('.nav-badge');
        if (badge) badge.textContent = all.length;
    }

    updateFilterButtons() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            const text = btn.textContent.trim().toLowerCase();
            if (
                (text.includes('all') && this.state.currentFilter === 'all') ||
                (text.includes('active') && this.state.currentFilter === 'active') ||
                (text.includes('draft') && this.state.currentFilter === 'draft') ||
                (text.includes('archived') && this.state.currentFilter === 'archived')
            ) {
                btn.classList.add('active');
            }
        });
    }

    updateFolderButtons() {
        document.querySelectorAll('.folder-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeFolder = document.querySelector(`.folder-item[data-folder-id="${this.state.currentFolder}"]`);
        if (activeFolder) activeFolder.classList.add('active');
    }

    updateViewButtons() {
        document.querySelectorAll('.view-btn').forEach((btn, index) => {
            btn.classList.remove('active');
            if ((index === 0 && this.state.currentView === 'grid') ||
                (index === 1 && this.state.currentView === 'list')) {
                btn.classList.add('active');
            }
        });
    }

    updateUserDisplay() {
        const userCard = document.querySelector('.user-card');
        if (!userCard) return;

        const user = this.state.user;
        const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Demo User';
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const tier = window.AuthService?.subscriptionTier || 'free';

        userCard.innerHTML = `
            <div class="user-avatar">${initials}</div>
            <div class="user-info">
                <div class="user-name">${this.escapeHtml(name)}</div>
                <div class="user-tier">
                    <i class="fas fa-crown"></i>
                    ${tier === 'pro' ? 'Pro Plan' : tier === 'enterprise' ? 'Enterprise' : 'Free Plan'}
                </div>
            </div>
        `;
    }

    showLoadingState() {
        const grid = document.getElementById('promptsGrid');
        if (grid && this.state.prompts.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-3);">
                    <i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>Loading prompts...
                </div>
            `;
        }
    }

    hideLoadingState() {
        // Loading state is replaced by renderPrompts
    }

    // ============================================
    // MODALS
    // ============================================
    openNewPromptModal() {
        this.state.editingPromptId = null;
        const form = document.getElementById('newPromptForm');
        if (form) form.reset();

        // Update modal title
        const modalTitle = document.querySelector('#newPromptModal .modal-header h2');
        if (modalTitle) modalTitle.textContent = 'Create New Prompt';

        const submitBtn = document.querySelector('#newPromptModal .btn-primary');
        if (submitBtn) submitBtn.textContent = 'Create Prompt';

        this.openModal('newPromptModal');
        document.getElementById('promptTitle')?.focus();
    }

    openEditModal(promptId) {
        const prompt = this.state.prompts.find(p => p.id === promptId);
        if (!prompt) return;

        this.state.editingPromptId = promptId;

        // Populate form
        document.getElementById('promptTitle').value = prompt.title || '';
        document.getElementById('promptDescription').value = prompt.description || '';
        document.getElementById('promptModel').value = prompt.model || 'GPT-4';
        document.getElementById('promptCategory').value = prompt.category || 'General';
        document.getElementById('promptContent').value = prompt.content || '';

        // Add folder selector if exists
        const folderSelect = document.getElementById('promptFolder');
        if (folderSelect) {
            folderSelect.value = prompt.folder_id || '';
        }

        // Add status selector if exists
        const statusSelect = document.getElementById('promptStatus');
        if (statusSelect) {
            statusSelect.value = prompt.status || 'draft';
        }

        // Add tags input if exists
        const tagsInput = document.getElementById('promptTags');
        if (tagsInput) {
            tagsInput.value = (prompt.tags || []).join(', ');
        }

        // Update modal title
        const modalTitle = document.querySelector('#newPromptModal .modal-header h2');
        if (modalTitle) modalTitle.textContent = 'Edit Prompt';

        const submitBtn = document.querySelector('#newPromptModal .btn-primary');
        if (submitBtn) submitBtn.textContent = 'Save Changes';

        this.openModal('newPromptModal');
    }

    async handlePromptSubmit(event) {
        event.preventDefault();

        const title = document.getElementById('promptTitle')?.value.trim();
        const description = document.getElementById('promptDescription')?.value.trim();
        const model = document.getElementById('promptModel')?.value;
        const category = document.getElementById('promptCategory')?.value;
        const content = document.getElementById('promptContent')?.value.trim();
        const tagsInput = document.getElementById('promptTags')?.value || '';
        const status = document.getElementById('promptStatus')?.value || 'draft';
        const folderId = document.getElementById('promptFolder')?.value || null;

        if (!title || !content) {
            this.showToast('Title and content are required', 'error');
            return;
        }

        const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);

        const promptData = {
            title,
            description,
            model,
            category,
            content,
            tags,
            status,
            folder_id: folderId
        };

        if (this.state.editingPromptId) {
            await this.updatePrompt(this.state.editingPromptId, promptData);
        } else {
            await this.createPrompt(promptData);
        }

        this.closeModal('newPromptModal');
        this.state.editingPromptId = null;
    }

    openImportModal() {
        this.openModal('importModal');
    }

    openAddFolderModal() {
        document.getElementById('addFolderForm')?.reset();
        this.openModal('addFolderModal');
    }

    async handleFolderSubmit(event) {
        event.preventDefault();
        const name = document.getElementById('folderName')?.value.trim();
        const parentId = document.getElementById('folderParent')?.value || null;

        if (!name) {
            this.showToast('Folder name is required', 'error');
            return;
        }

        await this.createFolder(name, parentId);
        this.closeModal('addFolderModal');
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal.open').forEach(modal => {
            modal.classList.remove('open');
        });
        document.body.style.overflow = '';
    }

    // ============================================
    // CONTEXT MENU
    // ============================================
    showContextMenu(promptId, event) {
        event.preventDefault();
        event.stopPropagation();
        this.state.selectedPromptId = promptId;

        const menu = document.getElementById('promptContextMenu');
        if (!menu) return;

        const rect = event.target.closest('.prompt-action')?.getBoundingClientRect() ||
                     { bottom: event.clientY, left: event.clientX };

        menu.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 300)}px`;
        menu.style.left = `${Math.min(rect.left, window.innerWidth - 220)}px`;
        menu.classList.add('open');

        // Update favorite button text
        const prompt = this.state.prompts.find(p => p.id === promptId);
        const favBtn = menu.querySelector('[data-action="favorite"]');
        if (favBtn && prompt) {
            const isFav = this.state.favorites.has(promptId);
            favBtn.innerHTML = `<i class="fas fa-star"></i> ${isFav ? 'Remove from Favorites' : 'Add to Favorites'}`;
        }

        // Update archive button text
        const archiveBtn = menu.querySelector('[data-action="archive"]');
        if (archiveBtn && prompt) {
            archiveBtn.innerHTML = `<i class="fas fa-archive"></i> ${prompt.status === 'archived' ? 'Restore' : 'Archive'}`;
        }

        setTimeout(() => {
            document.addEventListener('click', () => this.hideContextMenu(), { once: true });
        }, 10);
    }

    hideContextMenu() {
        const menu = document.getElementById('promptContextMenu');
        if (menu) menu.classList.remove('open');
    }

    handleContextMenuAction(action) {
        const id = this.state.selectedPromptId;
        if (!id) return;

        this.hideContextMenu();

        switch (action) {
            case 'open':
                this.openPrompt(id);
                break;
            case 'edit':
                this.openEditModal(id);
                break;
            case 'duplicate':
                this.duplicatePrompt(id);
                break;
            case 'favorite':
                this.toggleFavorite(id);
                break;
            case 'activate':
                this.activatePrompt(id);
                break;
            case 'export':
                this.exportSinglePrompt(id);
                break;
            case 'archive':
                this.archivePrompt(id);
                break;
            case 'delete':
                this.confirmDelete(id);
                break;
        }
    }

    showFolderMenu(folderId, event) {
        event.preventDefault();
        event.stopPropagation();

        const menu = document.createElement('div');
        menu.className = 'context-menu open';
        menu.style.cssText = `
            position: fixed;
            top: ${event.clientY}px;
            left: ${event.clientX}px;
            z-index: 1100;
        `;
        menu.innerHTML = `
            <button onclick="promptLibrary.promptRenameFolder('${folderId}')">
                <i class="fas fa-pencil-alt"></i> Rename
            </button>
            <button onclick="promptLibrary.promptAddSubfolder('${folderId}')">
                <i class="fas fa-folder-plus"></i> Add Subfolder
            </button>
            <div class="context-divider"></div>
            <button class="text-danger" onclick="promptLibrary.confirmDeleteFolder('${folderId}')">
                <i class="fas fa-trash"></i> Delete
            </button>
        `;

        document.body.appendChild(menu);

        setTimeout(() => {
            document.addEventListener('click', () => menu.remove(), { once: true });
        }, 10);
    }

    // ============================================
    // CONFIRMATION DIALOGS
    // ============================================
    confirmDelete(promptId) {
        const prompt = this.state.prompts.find(p => p.id === promptId);
        if (!prompt) return;

        if (confirm(`Are you sure you want to delete "${prompt.title}"?\n\nThis action cannot be undone.`)) {
            this.deletePrompt(promptId);
        }
    }

    confirmDeleteFolder(folderId) {
        const folder = this.state.folders.find(f => f.id === folderId);
        if (!folder) return;

        const promptCount = this.getFolderPromptCount(folderId);
        const message = promptCount > 0
            ? `Delete folder "${folder.name}"?\n\n${promptCount} prompt(s) will be moved to "All Prompts".`
            : `Delete folder "${folder.name}"?`;

        if (confirm(message)) {
            this.deleteFolder(folderId);
        }
    }

    promptRenameFolder(folderId) {
        const folder = this.state.folders.find(f => f.id === folderId);
        if (!folder) return;

        const newName = prompt('Enter new folder name:', folder.name);
        if (newName && newName.trim() && newName !== folder.name) {
            this.renameFolder(folderId, newName.trim());
        }
    }

    promptAddSubfolder(parentId) {
        const name = prompt('Enter subfolder name:');
        if (name && name.trim()) {
            this.createFolder(name.trim(), parentId);
        }
    }

    // ============================================
    // NAVIGATION
    // ============================================
    openPrompt(promptId) {
        const prompt = this.state.prompts.find(p => p.id === promptId);
        if (!prompt) return;

        // Increment view count
        this.updatePrompt(promptId, { view_count: (prompt.view_count || 0) + 1 });

        // Store prompt data for playground
        sessionStorage.setItem('selectedPrompt', JSON.stringify(prompt));
        window.location.href = `playground.html?prompt=${promptId}`;
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    setupEventListeners() {
        // Search input
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.setSearch(e.target.value);
                }, 200);
            });
        }

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.textContent.trim().toLowerCase();
                if (text.includes('all')) this.setFilter('all');
                else if (text.includes('active')) this.setFilter('active');
                else if (text.includes('draft')) this.setFilter('draft');
                else if (text.includes('archived')) this.setFilter('archived');
            });
        });

        // View toggle
        document.querySelectorAll('.view-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                this.setView(index === 0 ? 'grid' : 'list');
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape to close modals
            if (e.key === 'Escape') {
                this.closeAllModals();
                this.hideContextMenu();
            }
            // Ctrl/Cmd + N for new prompt
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.openNewPromptModal();
            }
            // Ctrl/Cmd + F for search focus
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                document.querySelector('.search-input')?.focus();
            }
            // Ctrl/Cmd + E for export
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                this.exportToJSON();
            }
        });

        // Drag and drop for import
        this.setupDragAndDrop();

        // Form submissions
        const newPromptForm = document.getElementById('newPromptForm');
        if (newPromptForm) {
            newPromptForm.addEventListener('submit', (e) => this.handlePromptSubmit(e));
        }

        const addFolderForm = document.getElementById('addFolderForm');
        if (addFolderForm) {
            addFolderForm.addEventListener('submit', (e) => this.handleFolderSubmit(e));
        }

        // Context menu actions
        document.querySelectorAll('#promptContextMenu button').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action || btn.getAttribute('onclick')?.match(/'(\w+)'/)?.[1];
                if (action) this.handleContextMenuAction(action);
            });
        });
    }

    setupDragAndDrop() {
        const dropZone = document.getElementById('dropZone');
        if (!dropZone) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('dragover');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const file = e.dataTransfer.files[0];
            this.handleFileImport(file);
        });

        // File input
        const fileInput = document.getElementById('importFile');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                this.handleFileImport(file);
            });
        }
    }

    async handleFileImport(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target.result;

            if (file.name.endsWith('.json')) {
                await this.importFromJSON(content);
            } else if (file.name.endsWith('.csv')) {
                await this.importFromCSV(content);
            } else {
                this.showToast('Unsupported file format. Use JSON or CSV.', 'error');
            }

            this.closeModal('importModal');
        };

        reader.readAsText(file);
    }

    checkPlaygroundImport() {
        const playgroundPrompt = sessionStorage.getItem('playgroundPrompt');
        if (playgroundPrompt) {
            try {
                const data = JSON.parse(playgroundPrompt);
                // Open modal with content pre-filled
                setTimeout(() => {
                    this.openNewPromptModal();
                    const contentField = document.getElementById('promptContent');
                    if (contentField && data.content) {
                        contentField.value = data.content;
                    }
                    this.showToast('Prompt imported from Playground', 'info');
                }, 500);
                sessionStorage.removeItem('playgroundPrompt');
            } catch (error) {
                console.error('Error importing from playground:', error);
            }
        }
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

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
        const container = document.getElementById('toastContainer');
        if (!container) {
            console.log(`Toast (${type}): ${message}`);
            return;
        }

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${icons[type] || icons.info}"></i>
            <span>${this.escapeHtml(message)}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

// ============================================
// GLOBAL INSTANCE
// ============================================
const promptLibrary = new PromptLibrary();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    promptLibrary.init();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PromptLibrary, promptLibrary };
}
