const Toast = {
    init() {
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
    },

    show(message, type = 'info', duration = 3000) {
        this.init();
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        // Icon selection based on type
        let icon = '';
        switch (type) {
            case 'success': icon = '✓'; break;
            case 'error': icon = '✕'; break;
            case 'warning': icon = '⚠'; break;
            default: icon = 'ℹ';
        }

        toast.innerHTML = `
            <span class="toast-message">${icon} ${message}</span>
            <span class="toast-close" onclick="this.parentElement.remove()">×</span>
        `;

        container.appendChild(toast);

        // Auto dismiss
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-in forwards';
            toast.addEventListener('animationend', () => {
                if (toast.parentElement) toast.remove();
            });
        }, duration);
    },

    success(msg) {
        this.show(msg, 'success');
    },

    error(msg) {
        this.show(msg, 'error');
    },

    warning(msg) {
        this.show(msg, 'warning');
    },

    info(msg) {
        this.show(msg, 'info');
    }
};

// Expose globally
window.Toast = Toast;
