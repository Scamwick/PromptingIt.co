/**
 * PromptingIt.co - Workflows Module
 * Create and manage prompt workflows/chains with Supabase integration
 * Version: 1.0.0
 */

class WorkflowManager {
    constructor() {
        this.user = null;
        this.supabase = null;
        this.workflows = [];
        this.prompts = [];
        this.currentWorkflow = null;
        this.initialized = false;

        this.STORAGE_KEY = 'promptingit_workflows';
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

            // Load workflows
            await this.loadWorkflows();

            // Load prompts for workflow builder
            await this.loadPrompts();

            // Render UI
            this.renderWorkflows();
            this.updateStats();

            // Setup event listeners
            this.setupEventListeners();

            this.initialized = true;
            console.log('Workflow Manager initialized');
        } catch (error) {
            console.error('Failed to initialize Workflow Manager:', error);
            this.showToast('Failed to load workflows', 'error');
        }
    }

    // ============================================
    // DATA LOADING
    // ============================================
    async loadWorkflows() {
        if (!this.supabase || !this.user) {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            this.workflows = stored ? JSON.parse(stored) : this.getMockWorkflows();
            return;
        }

        try {
            const { data, error } = await this.supabase
                .from('workflows')
                .select('*')
                .eq('user_id', this.user.id)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            this.workflows = data || [];
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.workflows));
        } catch (error) {
            console.error('Failed to load workflows:', error);
            const stored = localStorage.getItem(this.STORAGE_KEY);
            this.workflows = stored ? JSON.parse(stored) : [];
        }
    }

    async loadPrompts() {
        const stored = localStorage.getItem('promptingit_prompts');
        this.prompts = stored ? JSON.parse(stored) : [];

        if (this.supabase && this.user) {
            try {
                const { data, error } = await this.supabase
                    .from('prompts')
                    .select('id, title, category')
                    .eq('user_id', this.user.id)
                    .eq('status', 'active');

                if (!error && data) {
                    this.prompts = data;
                }
            } catch (error) {
                console.warn('Failed to load prompts for workflows:', error);
            }
        }
    }

    getMockWorkflows() {
        return [
            {
                id: '1',
                name: 'Customer Support Pipeline',
                description: 'Analyzes tickets, classifies them, and generates responses',
                status: 'active',
                nodes: [
                    { id: 'n1', type: 'trigger', name: 'New Ticket', icon: 'ticket-alt' },
                    { id: 'n2', type: 'prompt', name: 'Classify Ticket', prompt_id: 'p1', icon: 'tags' },
                    { id: 'n3', type: 'condition', name: 'Check Priority', icon: 'code-branch' },
                    { id: 'n4', type: 'prompt', name: 'Generate Response', prompt_id: 'p2', icon: 'reply' },
                    { id: 'n5', type: 'action', name: 'Send Email', icon: 'envelope' }
                ],
                run_count: 1240,
                success_rate: 98.5,
                avg_duration: '2.3s',
                created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
            },
            {
                id: '2',
                name: 'Content Generation Flow',
                description: 'Creates SEO blog posts from topic ideas',
                status: 'active',
                nodes: [
                    { id: 'n1', type: 'trigger', name: 'Topic Input', icon: 'lightbulb' },
                    { id: 'n2', type: 'prompt', name: 'Research Topic', prompt_id: 'p3', icon: 'search' },
                    { id: 'n3', type: 'prompt', name: 'Generate Outline', prompt_id: 'p4', icon: 'list' },
                    { id: 'n4', type: 'prompt', name: 'Write Content', prompt_id: 'p5', icon: 'pencil-alt' },
                    { id: 'n5', type: 'prompt', name: 'SEO Optimize', prompt_id: 'p6', icon: 'chart-line' }
                ],
                run_count: 890,
                success_rate: 96.2,
                avg_duration: '45s',
                created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
                updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: '3',
                name: 'Code Review Assistant',
                description: 'Reviews code and provides improvement suggestions',
                status: 'draft',
                nodes: [
                    { id: 'n1', type: 'trigger', name: 'Code Input', icon: 'code' },
                    { id: 'n2', type: 'prompt', name: 'Analyze Code', prompt_id: 'p7', icon: 'search' },
                    { id: 'n3', type: 'prompt', name: 'Security Check', prompt_id: 'p8', icon: 'shield-alt' },
                    { id: 'n4', type: 'prompt', name: 'Generate Report', prompt_id: 'p9', icon: 'file-alt' }
                ],
                run_count: 156,
                success_rate: 94.8,
                avg_duration: '8.5s',
                created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

    // ============================================
    // WORKFLOW CRUD
    // ============================================
    async createWorkflow(workflowData) {
        const workflow = {
            id: Date.now().toString(),
            name: workflowData.name,
            description: workflowData.description || '',
            status: 'draft',
            nodes: workflowData.nodes || [],
            run_count: 0,
            success_rate: 0,
            avg_duration: '0s',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (this.supabase && this.user) {
            try {
                const { data, error } = await this.supabase
                    .from('workflows')
                    .insert({
                        user_id: this.user.id,
                        name: workflow.name,
                        description: workflow.description,
                        status: workflow.status,
                        nodes: workflow.nodes
                    })
                    .select()
                    .single();

                if (error) throw error;
                workflow.id = data.id;
            } catch (error) {
                console.error('Failed to create workflow:', error);
            }
        }

        this.workflows.unshift(workflow);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.workflows));
        this.renderWorkflows();
        this.updateStats();

        this.showToast('Workflow created', 'success');
        return workflow;
    }

    async updateWorkflow(workflowId, updates) {
        const index = this.workflows.findIndex(w => w.id === workflowId);
        if (index === -1) return null;

        const workflow = {
            ...this.workflows[index],
            ...updates,
            updated_at: new Date().toISOString()
        };

        this.workflows[index] = workflow;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.workflows));

        if (this.supabase && this.user) {
            try {
                await this.supabase
                    .from('workflows')
                    .update({
                        name: workflow.name,
                        description: workflow.description,
                        status: workflow.status,
                        nodes: workflow.nodes,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', workflowId)
                    .eq('user_id', this.user.id);
            } catch (error) {
                console.error('Failed to update workflow:', error);
            }
        }

        this.renderWorkflows();
        this.updateStats();

        this.showToast('Workflow updated', 'success');
        return workflow;
    }

    async deleteWorkflow(workflowId) {
        const workflow = this.workflows.find(w => w.id === workflowId);
        if (!workflow) return false;

        if (!confirm(`Delete "${workflow.name}"?\n\nThis action cannot be undone.`)) {
            return false;
        }

        if (this.supabase && this.user) {
            try {
                await this.supabase
                    .from('workflows')
                    .delete()
                    .eq('id', workflowId)
                    .eq('user_id', this.user.id);
            } catch (error) {
                console.error('Failed to delete workflow:', error);
            }
        }

        this.workflows = this.workflows.filter(w => w.id !== workflowId);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.workflows));
        this.renderWorkflows();
        this.updateStats();

        this.showToast('Workflow deleted', 'success');
        return true;
    }

    async duplicateWorkflow(workflowId) {
        const original = this.workflows.find(w => w.id === workflowId);
        if (!original) return null;

        return await this.createWorkflow({
            name: `${original.name} (Copy)`,
            description: original.description,
            nodes: JSON.parse(JSON.stringify(original.nodes))
        });
    }

    async toggleWorkflowStatus(workflowId) {
        const workflow = this.workflows.find(w => w.id === workflowId);
        if (!workflow) return;

        const newStatus = workflow.status === 'active' ? 'paused' : 'active';
        await this.updateWorkflow(workflowId, { status: newStatus });

        this.showToast(`Workflow ${newStatus === 'active' ? 'activated' : 'paused'}`, 'success');
    }

    // ============================================
    // WORKFLOW EXECUTION
    // ============================================
    async runWorkflow(workflowId, input = {}) {
        const workflow = this.workflows.find(w => w.id === workflowId);
        if (!workflow) {
            this.showToast('Workflow not found', 'error');
            return null;
        }

        this.showToast('Running workflow...', 'info');

        const startTime = Date.now();
        const results = [];
        let currentData = input;

        try {
            for (const node of workflow.nodes) {
                const result = await this.executeNode(node, currentData);
                results.push({ node: node.id, ...result });

                if (!result.success) {
                    throw new Error(`Node ${node.name} failed: ${result.error}`);
                }

                currentData = result.output;
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(1) + 's';

            // Update workflow stats
            const newRunCount = (workflow.run_count || 0) + 1;
            await this.updateWorkflow(workflowId, {
                run_count: newRunCount,
                success_rate: ((workflow.success_rate * (newRunCount - 1) + 100) / newRunCount).toFixed(1),
                avg_duration: duration
            });

            this.showToast('Workflow completed successfully', 'success');
            return { success: true, results, duration };
        } catch (error) {
            console.error('Workflow execution failed:', error);
            this.showToast('Workflow failed: ' + error.message, 'error');
            return { success: false, error: error.message, results };
        }
    }

    async executeNode(node, input) {
        // Simulate node execution
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

        switch (node.type) {
            case 'trigger':
                return { success: true, output: input };

            case 'prompt':
                // In real implementation, this would call the AI API
                return {
                    success: true,
                    output: {
                        ...input,
                        [node.name.toLowerCase().replace(/\s+/g, '_')]: `Generated content for ${node.name}`
                    }
                };

            case 'condition':
                // In real implementation, this would evaluate conditions
                return {
                    success: true,
                    output: { ...input, branch: 'true' }
                };

            case 'action':
                // In real implementation, this would perform actions
                return {
                    success: true,
                    output: { ...input, action_completed: true }
                };

            default:
                return { success: true, output: input };
        }
    }

    // ============================================
    // RENDERING
    // ============================================
    renderWorkflows() {
        const container = document.getElementById('workflowsGrid');
        if (!container) return;

        if (this.workflows.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon"><i class="fas fa-project-diagram"></i></div>
                    <div class="empty-title">No Workflows Yet</div>
                    <div class="empty-desc">Create your first workflow to automate your prompt chains.</div>
                    <button class="btn btn-primary" onclick="workflowManager.openCreateModal()">
                        <i class="fas fa-plus"></i> Create Workflow
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.workflows.map(w => `
            <div class="workflow-card" data-id="${w.id}">
                <div class="workflow-card-header">
                    <div class="workflow-info">
                        <h3>${this.escapeHtml(w.name)}</h3>
                        <p>${this.escapeHtml(w.description || 'No description')}</p>
                    </div>
                    <span class="workflow-status ${w.status}">${w.status}</span>
                </div>

                <div class="workflow-flow">
                    <div class="flow-nodes">
                        ${w.nodes.map((node, i) => `
                            <div class="flow-node">
                                <div class="flow-node-icon"><i class="fas fa-${node.icon || 'cog'}"></i></div>
                                <div class="flow-node-name">${this.escapeHtml(node.name)}</div>
                            </div>
                            ${i < w.nodes.length - 1 ? '<div class="flow-connector"></div>' : ''}
                        `).join('')}
                    </div>
                </div>

                <div class="workflow-card-footer">
                    <div class="workflow-meta">
                        <span><i class="fas fa-play"></i> ${this.formatNumber(w.run_count || 0)} runs</span>
                        <span><i class="fas fa-check-circle"></i> ${w.success_rate || 0}% success</span>
                        <span><i class="fas fa-clock"></i> ~${w.avg_duration || '0s'}</span>
                    </div>
                    <div class="workflow-actions">
                        <button class="workflow-action" title="Run" onclick="workflowManager.runWorkflow('${w.id}')">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="workflow-action" title="Edit" onclick="workflowManager.openEditModal('${w.id}')">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                        <button class="workflow-action" title="${w.status === 'active' ? 'Pause' : 'Activate'}" onclick="workflowManager.toggleWorkflowStatus('${w.id}')">
                            <i class="fas fa-${w.status === 'active' ? 'pause' : 'play'}"></i>
                        </button>
                        <button class="workflow-action" title="Duplicate" onclick="workflowManager.duplicateWorkflow('${w.id}')">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="workflow-action" title="Delete" onclick="workflowManager.deleteWorkflow('${w.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateStats() {
        const total = this.workflows.length;
        const active = this.workflows.filter(w => w.status === 'active').length;
        const totalRuns = this.workflows.reduce((sum, w) => sum + (w.run_count || 0), 0);
        const avgSuccess = this.workflows.length > 0
            ? (this.workflows.reduce((sum, w) => sum + (parseFloat(w.success_rate) || 0), 0) / this.workflows.length).toFixed(1)
            : 0;

        const stats = document.querySelectorAll('.workflow-stat-value');
        if (stats[0]) stats[0].textContent = total;
        if (stats[1]) stats[1].textContent = active;
        if (stats[2]) stats[2].textContent = this.formatNumber(totalRuns);
        if (stats[3]) stats[3].textContent = avgSuccess + '%';
    }

    // ============================================
    // MODALS
    // ============================================
    openCreateModal() {
        this.currentWorkflow = null;
        const form = document.getElementById('workflowForm');
        if (form) form.reset();

        const modalTitle = document.querySelector('#workflowModal .modal-header h2');
        if (modalTitle) modalTitle.textContent = 'Create Workflow';

        // Reset nodes builder
        this.resetNodesBuilder();

        this.openModal('workflowModal');
    }

    openEditModal(workflowId) {
        const workflow = this.workflows.find(w => w.id === workflowId);
        if (!workflow) return;

        this.currentWorkflow = workflow;

        document.getElementById('workflowName').value = workflow.name;
        document.getElementById('workflowDescription').value = workflow.description || '';

        const modalTitle = document.querySelector('#workflowModal .modal-header h2');
        if (modalTitle) modalTitle.textContent = 'Edit Workflow';

        // Populate nodes builder
        this.populateNodesBuilder(workflow.nodes);

        this.openModal('workflowModal');
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
        this.currentWorkflow = null;
    }

    resetNodesBuilder() {
        const container = document.getElementById('nodesBuilder');
        if (container) {
            container.innerHTML = `
                <div class="nodes-empty">
                    <p>Click "Add Node" to start building your workflow</p>
                </div>
            `;
        }
    }

    populateNodesBuilder(nodes) {
        const container = document.getElementById('nodesBuilder');
        if (!container) return;

        if (!nodes || nodes.length === 0) {
            this.resetNodesBuilder();
            return;
        }

        container.innerHTML = nodes.map((node, i) => `
            <div class="node-item" data-node-id="${node.id}">
                <div class="node-icon"><i class="fas fa-${node.icon || 'cog'}"></i></div>
                <div class="node-content">
                    <input type="text" value="${this.escapeHtml(node.name)}" class="node-name-input">
                    <select class="node-type-select">
                        <option value="trigger" ${node.type === 'trigger' ? 'selected' : ''}>Trigger</option>
                        <option value="prompt" ${node.type === 'prompt' ? 'selected' : ''}>Prompt</option>
                        <option value="condition" ${node.type === 'condition' ? 'selected' : ''}>Condition</option>
                        <option value="action" ${node.type === 'action' ? 'selected' : ''}>Action</option>
                    </select>
                </div>
                <button class="node-remove" onclick="workflowManager.removeNode('${node.id}')">&times;</button>
            </div>
            ${i < nodes.length - 1 ? '<div class="node-connector"><i class="fas fa-arrow-down"></i></div>' : ''}
        `).join('');
    }

    addNode() {
        const container = document.getElementById('nodesBuilder');
        if (!container) return;

        // Remove empty state if present
        const empty = container.querySelector('.nodes-empty');
        if (empty) empty.remove();

        const nodeId = 'node_' + Date.now();
        const nodeCount = container.querySelectorAll('.node-item').length;

        // Add connector if not first node
        if (nodeCount > 0) {
            const connector = document.createElement('div');
            connector.className = 'node-connector';
            connector.innerHTML = '<i class="fas fa-arrow-down"></i>';
            container.appendChild(connector);
        }

        const nodeEl = document.createElement('div');
        nodeEl.className = 'node-item';
        nodeEl.dataset.nodeId = nodeId;
        nodeEl.innerHTML = `
            <div class="node-icon"><i class="fas fa-cog"></i></div>
            <div class="node-content">
                <input type="text" value="New Node" class="node-name-input" placeholder="Node name">
                <select class="node-type-select" onchange="workflowManager.updateNodeIcon(this)">
                    <option value="trigger">Trigger</option>
                    <option value="prompt" selected>Prompt</option>
                    <option value="condition">Condition</option>
                    <option value="action">Action</option>
                </select>
            </div>
            <button class="node-remove" onclick="workflowManager.removeNode('${nodeId}')">&times;</button>
        `;

        container.appendChild(nodeEl);
    }

    removeNode(nodeId) {
        const container = document.getElementById('nodesBuilder');
        if (!container) return;

        const nodeEl = container.querySelector(`[data-node-id="${nodeId}"]`);
        if (!nodeEl) return;

        // Remove preceding connector
        const prevEl = nodeEl.previousElementSibling;
        if (prevEl && prevEl.classList.contains('node-connector')) {
            prevEl.remove();
        }

        nodeEl.remove();

        // Show empty state if no nodes
        if (container.querySelectorAll('.node-item').length === 0) {
            this.resetNodesBuilder();
        }
    }

    updateNodeIcon(select) {
        const iconMap = {
            trigger: 'bolt',
            prompt: 'comment-dots',
            condition: 'code-branch',
            action: 'cog'
        };

        const nodeEl = select.closest('.node-item');
        const iconEl = nodeEl.querySelector('.node-icon i');
        if (iconEl) {
            iconEl.className = 'fas fa-' + (iconMap[select.value] || 'cog');
        }
    }

    getNodesFromBuilder() {
        const container = document.getElementById('nodesBuilder');
        if (!container) return [];

        const nodes = [];
        const nodeEls = container.querySelectorAll('.node-item');

        nodeEls.forEach(el => {
            const iconMap = {
                trigger: 'bolt',
                prompt: 'comment-dots',
                condition: 'code-branch',
                action: 'cog'
            };

            const type = el.querySelector('.node-type-select')?.value || 'prompt';
            nodes.push({
                id: el.dataset.nodeId,
                name: el.querySelector('.node-name-input')?.value || 'Unnamed Node',
                type: type,
                icon: iconMap[type] || 'cog'
            });
        });

        return nodes;
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    setupEventListeners() {
        // Workflow form
        const form = document.getElementById('workflowForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Add node button
        const addNodeBtn = document.getElementById('addNodeBtn');
        if (addNodeBtn) {
            addNodeBtn.addEventListener('click', () => this.addNode());
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.open').forEach(m => {
                    this.closeModal(m.id);
                });
            }
        });
    }

    async handleFormSubmit(e) {
        e.preventDefault();

        const name = document.getElementById('workflowName')?.value.trim();
        const description = document.getElementById('workflowDescription')?.value.trim();
        const nodes = this.getNodesFromBuilder();

        if (!name) {
            this.showToast('Please enter a workflow name', 'error');
            return;
        }

        if (nodes.length === 0) {
            this.showToast('Please add at least one node', 'error');
            return;
        }

        if (this.currentWorkflow) {
            await this.updateWorkflow(this.currentWorkflow.id, { name, description, nodes });
        } else {
            await this.createWorkflow({ name, description, nodes });
        }

        this.closeModal('workflowModal');
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
const workflowManager = new WorkflowManager();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('workflows.html')) {
        workflowManager.init();
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WorkflowManager, workflowManager };
}
