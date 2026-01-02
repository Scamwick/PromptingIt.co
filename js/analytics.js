/**
 * PromptingIt.co - Analytics Module
 * Prompt usage analytics and performance metrics with Supabase integration
 * Version: 1.0.0
 */

class AnalyticsManager {
    constructor() {
        this.user = null;
        this.supabase = null;
        this.data = {
            overview: {},
            prompts: [],
            usage: [],
            performance: []
        };
        this.dateRange = '30d';
        this.initialized = false;
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

            // Load analytics data
            await this.loadAnalytics();

            // Render UI
            this.renderOverview();
            this.renderUsageChart();
            this.renderTopPrompts();
            this.renderPerformanceMetrics();

            // Setup event listeners
            this.setupEventListeners();

            this.initialized = true;
            console.log('Analytics Manager initialized');
        } catch (error) {
            console.error('Failed to initialize Analytics:', error);
            this.showToast('Failed to load analytics', 'error');
        }
    }

    // ============================================
    // DATA LOADING
    // ============================================
    async loadAnalytics() {
        if (!this.supabase || !this.user) {
            // Load mock data for demo
            this.data = this.getMockAnalytics();
            return;
        }

        try {
            const startDate = this.getStartDate();

            // Load prompts with usage data
            const { data: prompts, error: promptsError } = await this.supabase
                .from('prompts')
                .select('*')
                .eq('user_id', this.user.id);

            if (!promptsError && prompts) {
                this.data.prompts = prompts;
            }

            // Load usage logs
            const { data: usage, error: usageError } = await this.supabase
                .from('prompt_usage')
                .select('*')
                .eq('user_id', this.user.id)
                .gte('created_at', startDate.toISOString());

            if (!usageError && usage) {
                this.data.usage = usage;
            }

            // Calculate overview
            this.calculateOverview();
        } catch (error) {
            console.error('Failed to load analytics:', error);
            this.data = this.getMockAnalytics();
        }
    }

    getMockAnalytics() {
        const now = Date.now();

        // Generate mock usage data for last 30 days
        const usage = [];
        for (let i = 29; i >= 0; i--) {
            const date = new Date(now - i * 24 * 60 * 60 * 1000);
            usage.push({
                date: date.toISOString().split('T')[0],
                runs: Math.floor(Math.random() * 200) + 50,
                tokens: Math.floor(Math.random() * 100000) + 20000,
                latency: Math.floor(Math.random() * 300) + 100,
                errors: Math.floor(Math.random() * 5)
            });
        }

        // Mock prompts with stats
        const prompts = [
            { id: '1', title: 'Customer Ticket Analyzer', run_count: 12400, avg_rating: 4.9, tokens_used: 2400000, category: 'Support' },
            { id: '2', title: 'Blog Post Generator', run_count: 8700, avg_rating: 4.7, tokens_used: 4500000, category: 'Content' },
            { id: '3', title: 'Email Composer', run_count: 15200, avg_rating: 4.8, tokens_used: 1800000, category: 'Communication' },
            { id: '4', title: 'Code Reviewer', run_count: 3200, avg_rating: 4.9, tokens_used: 980000, category: 'Development' },
            { id: '5', title: 'Data Insights Generator', run_count: 5400, avg_rating: 4.6, tokens_used: 2100000, category: 'Analytics' }
        ];

        const totalRuns = usage.reduce((sum, d) => sum + d.runs, 0);
        const totalTokens = usage.reduce((sum, d) => sum + d.tokens, 0);
        const avgLatency = Math.round(usage.reduce((sum, d) => sum + d.latency, 0) / usage.length);
        const totalErrors = usage.reduce((sum, d) => sum + d.errors, 0);

        return {
            overview: {
                totalRuns,
                totalTokens,
                avgLatency,
                errorRate: ((totalErrors / totalRuns) * 100).toFixed(2),
                activePrompts: prompts.length,
                costEstimate: (totalTokens / 1000 * 0.002).toFixed(2)
            },
            usage,
            prompts,
            performance: {
                p50Latency: avgLatency - 50,
                p95Latency: avgLatency + 150,
                p99Latency: avgLatency + 300,
                successRate: 99.2,
                avgTokensPerRun: Math.round(totalTokens / totalRuns)
            }
        };
    }

    calculateOverview() {
        const totalRuns = this.data.prompts.reduce((sum, p) => sum + (p.run_count || 0), 0);
        const totalTokens = this.data.usage.reduce((sum, u) => sum + (u.tokens || 0), 0);

        this.data.overview = {
            totalRuns,
            totalTokens,
            avgLatency: 150,
            errorRate: 0.5,
            activePrompts: this.data.prompts.filter(p => p.status === 'active').length,
            costEstimate: (totalTokens / 1000 * 0.002).toFixed(2)
        };
    }

    getStartDate() {
        const days = parseInt(this.dateRange) || 30;
        return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }

    // ============================================
    // RENDERING
    // ============================================
    renderOverview() {
        const overview = this.data.overview;

        this.updateStatCard('totalRuns', this.formatNumber(overview.totalRuns), '+12%');
        this.updateStatCard('totalTokens', this.formatNumber(overview.totalTokens), '+8%');
        this.updateStatCard('avgLatency', overview.avgLatency + 'ms', '-5%');
        this.updateStatCard('errorRate', overview.errorRate + '%', '-15%');
        this.updateStatCard('activePrompts', overview.activePrompts, '+2');
        this.updateStatCard('costEstimate', '$' + overview.costEstimate, '+10%');
    }

    updateStatCard(id, value, change) {
        const valueEl = document.getElementById(id);
        if (valueEl) valueEl.textContent = value;

        const changeEl = document.getElementById(id + 'Change');
        if (changeEl) {
            changeEl.textContent = change;
            changeEl.className = 'stat-change ' + (change.startsWith('+') ? 'positive' : change.startsWith('-') ? 'negative' : '');
        }
    }

    renderUsageChart() {
        const container = document.getElementById('usageChart');
        if (!container || !this.data.usage.length) return;

        const maxRuns = Math.max(...this.data.usage.map(d => d.runs));
        const chartHeight = 200;

        // Create SVG chart
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', chartHeight + 40);
        svg.setAttribute('viewBox', `0 0 ${this.data.usage.length * 20} ${chartHeight + 40}`);

        // Create gradient
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        gradient.setAttribute('id', 'chartGradient');
        gradient.setAttribute('x1', '0%');
        gradient.setAttribute('y1', '0%');
        gradient.setAttribute('x2', '0%');
        gradient.setAttribute('y2', '100%');

        const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('style', 'stop-color:#67e8f9;stop-opacity:0.5');

        const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop2.setAttribute('offset', '100%');
        stop2.setAttribute('style', 'stop-color:#67e8f9;stop-opacity:0');

        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        defs.appendChild(gradient);
        svg.appendChild(defs);

        // Create area path
        let areaPath = `M 0 ${chartHeight}`;
        let linePath = '';

        this.data.usage.forEach((d, i) => {
            const x = i * 20 + 10;
            const y = chartHeight - (d.runs / maxRuns) * (chartHeight - 20);

            if (i === 0) {
                linePath = `M ${x} ${y}`;
            } else {
                linePath += ` L ${x} ${y}`;
            }
            areaPath += ` L ${x} ${y}`;
        });

        areaPath += ` L ${(this.data.usage.length - 1) * 20 + 10} ${chartHeight} Z`;

        // Area
        const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        area.setAttribute('d', areaPath);
        area.setAttribute('fill', 'url(#chartGradient)');
        svg.appendChild(area);

        // Line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.setAttribute('d', linePath);
        line.setAttribute('stroke', '#67e8f9');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('fill', 'none');
        svg.appendChild(line);

        // Data points
        this.data.usage.forEach((d, i) => {
            const x = i * 20 + 10;
            const y = chartHeight - (d.runs / maxRuns) * (chartHeight - 20);

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', '4');
            circle.setAttribute('fill', '#67e8f9');
            circle.setAttribute('data-date', d.date);
            circle.setAttribute('data-runs', d.runs);
            svg.appendChild(circle);
        });

        container.innerHTML = '';
        container.appendChild(svg);

        // Add labels
        const labelsDiv = document.createElement('div');
        labelsDiv.className = 'chart-labels';
        labelsDiv.innerHTML = `
            <span>${this.data.usage[0]?.date || ''}</span>
            <span>Today</span>
        `;
        container.appendChild(labelsDiv);
    }

    renderTopPrompts() {
        const container = document.getElementById('topPrompts');
        if (!container) return;

        const sorted = [...this.data.prompts].sort((a, b) => (b.run_count || 0) - (a.run_count || 0)).slice(0, 5);

        if (sorted.length === 0) {
            container.innerHTML = '<div class="empty-state">No prompt data available</div>';
            return;
        }

        container.innerHTML = sorted.map((p, i) => `
            <div class="top-prompt-item">
                <div class="rank">${i + 1}</div>
                <div class="prompt-info">
                    <div class="prompt-name">${this.escapeHtml(p.title)}</div>
                    <div class="prompt-stats">
                        <span><i class="fas fa-play"></i> ${this.formatNumber(p.run_count || 0)}</span>
                        <span><i class="fas fa-star"></i> ${p.avg_rating || 'N/A'}</span>
                        <span><i class="fas fa-coins"></i> ${this.formatNumber(p.tokens_used || 0)}</span>
                    </div>
                </div>
                <div class="prompt-category">${p.category || 'General'}</div>
            </div>
        `).join('');
    }

    renderPerformanceMetrics() {
        const container = document.getElementById('performanceMetrics');
        if (!container) return;

        const perf = this.data.performance;

        container.innerHTML = `
            <div class="perf-grid">
                <div class="perf-card">
                    <div class="perf-label">P50 Latency</div>
                    <div class="perf-value">${perf.p50Latency || 0}ms</div>
                    <div class="perf-bar"><div class="perf-bar-fill" style="width: ${Math.min((perf.p50Latency / 500) * 100, 100)}%; background: var(--emerald);"></div></div>
                </div>
                <div class="perf-card">
                    <div class="perf-label">P95 Latency</div>
                    <div class="perf-value">${perf.p95Latency || 0}ms</div>
                    <div class="perf-bar"><div class="perf-bar-fill" style="width: ${Math.min((perf.p95Latency / 500) * 100, 100)}%; background: var(--solar);"></div></div>
                </div>
                <div class="perf-card">
                    <div class="perf-label">P99 Latency</div>
                    <div class="perf-value">${perf.p99Latency || 0}ms</div>
                    <div class="perf-bar"><div class="perf-bar-fill" style="width: ${Math.min((perf.p99Latency / 500) * 100, 100)}%; background: var(--rose);"></div></div>
                </div>
                <div class="perf-card">
                    <div class="perf-label">Success Rate</div>
                    <div class="perf-value">${perf.successRate || 0}%</div>
                    <div class="perf-bar"><div class="perf-bar-fill" style="width: ${perf.successRate || 0}%; background: var(--glacier);"></div></div>
                </div>
            </div>
            <div class="perf-summary">
                <div class="summary-item">
                    <span class="summary-label">Avg Tokens per Run</span>
                    <span class="summary-value">${this.formatNumber(perf.avgTokensPerRun || 0)}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Total API Calls</span>
                    <span class="summary-value">${this.formatNumber(this.data.overview.totalRuns || 0)}</span>
                </div>
            </div>
        `;
    }

    // ============================================
    // EXPORT
    // ============================================
    exportAnalytics() {
        const exportData = {
            exported_at: new Date().toISOString(),
            date_range: this.dateRange,
            overview: this.data.overview,
            usage: this.data.usage,
            prompts: this.data.prompts.map(p => ({
                title: p.title,
                run_count: p.run_count,
                tokens_used: p.tokens_used,
                category: p.category
            })),
            performance: this.data.performance
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `promptingit-analytics-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showToast('Analytics exported', 'success');
    }

    exportCSV() {
        const headers = ['Date', 'Runs', 'Tokens', 'Latency (ms)', 'Errors'];
        const rows = this.data.usage.map(d => [d.date, d.runs, d.tokens, d.latency, d.errors]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `promptingit-usage-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        this.showToast('CSV exported', 'success');
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    setupEventListeners() {
        // Date range selector
        const dateRangeSelect = document.getElementById('dateRange');
        if (dateRangeSelect) {
            dateRangeSelect.addEventListener('change', async (e) => {
                this.dateRange = e.target.value;
                await this.loadAnalytics();
                this.renderOverview();
                this.renderUsageChart();
                this.renderTopPrompts();
                this.renderPerformanceMetrics();
            });
        }

        // Export buttons
        const exportJsonBtn = document.getElementById('exportJsonBtn');
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => this.exportAnalytics());
        }

        const exportCsvBtn = document.getElementById('exportCsvBtn');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => this.exportCSV());
        }

        // Refresh button
        const refreshBtn = document.getElementById('refreshAnalytics');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                refreshBtn.classList.add('spinning');
                await this.loadAnalytics();
                this.renderOverview();
                this.renderUsageChart();
                this.renderTopPrompts();
                this.renderPerformanceMetrics();
                refreshBtn.classList.remove('spinning');
                this.showToast('Analytics refreshed', 'success');
            });
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
const analyticsManager = new AnalyticsManager();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('analytics.html')) {
        analyticsManager.init();
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AnalyticsManager, analyticsManager };
}
