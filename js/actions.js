// Common actions and utilities
class ActionManager {
    constructor() {
        this.supabase = window.authUtils?.supabase;
    }

    // Show notification
    showNotification(message, type = 'info') {
        // Create notification element if it doesn't exist
        let notification = document.getElementById('global-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'global-notification';
            notification.className = 'fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-transform duration-300 hidden';
            document.body.appendChild(notification);
        }

        notification.textContent = message;
        
        const typeClasses = {
            success: 'bg-green-500 text-white',
            error: 'bg-red-500 text-white',
            warning: 'bg-yellow-500 text-white',
            info: 'bg-blue-500 text-white'
        };

        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-transform duration-300 ${typeClasses[type] || typeClasses.info}`;
        notification.classList.remove('hidden');

        // Auto hide after 3 seconds
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
    }

    // Show loading overlay
    showLoading(message = 'Loading...') {
        let loading = document.getElementById('global-loading');
        if (!loading) {
            loading = document.createElement('div');
            loading.id = 'global-loading';
            loading.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
            loading.innerHTML = `
                <div class="bg-white rounded-2xl p-6 text-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
                    <p class="text-gray-800 font-semibold">${message}</p>
                </div>
            `;
            document.body.appendChild(loading);
        }

        loading.classList.remove('hidden');
    }

    // Hide loading overlay
    hideLoading() {
        const loading = document.getElementById('global-loading');
        if (loading) {
            loading.classList.add('hidden');
        }
    }

    // Format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    }

    // Format date
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // Format time
    formatTime(dateString) {
        return new Date(dateString).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Validate email
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // Validate password
    validatePassword(password) {
        return password.length >= 6;
    }

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('Copied to clipboard!', 'success');
            return true;
        } catch (err) {
            console.error('Failed to copy: ', err);
            this.showNotification('Failed to copy', 'error');
            return false;
        }
    }

    // Generate random number in range
    randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    // Calculate daily check-in reward
    calculateDailyReward(streak) {
        const baseReward = 0.10;
        const increment = 0.15;
        return Math.min(baseReward + (streak - 1) * increment, 1.00);
    }

    // Check if today's check-in is done
    async checkTodaysCheckin(userId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data: user, error } = await this.supabase
                .from('users')
                .select('last_checkin')
                .eq('id', userId)
                .single();

            if (error) throw error;

            return user.last_checkin === today;
        } catch (error) {
            console.error('Error checking today\'s check-in:', error);
            return false;
        }
    }

    // Get today's earnings
    async getTodaysEarnings(userId, type = null) {
        try {
            const today = new Date().toISOString().split('T')[0];
            let query = this.supabase
                .from('earnings')
                .select('amount')
                .eq('user_id', userId)
                .gte('created_at', today + 'T00:00:00')
                .lte('created_at', today + 'T23:59:59');

            if (type) {
                query = query.eq('type', type);
            }

            const { data, error } = await query;

            if (error) throw error;

            const total = data?.reduce((sum, earning) => sum + earning.amount, 0) || 0;
            const count = data?.length || 0;

            return { total, count, error: null };
        } catch (error) {
            console.error('Error getting today\'s earnings:', error);
            return { total: 0, count: 0, error };
        }
    }
}

// Initialize action manager
window.actionManager = new ActionManager();

// Global utility functions
window.utils = {
    // Generate unique ID
    generateId: () => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Sleep function
    sleep: (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // Check mobile device
    isMobile: () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    // Get screen size
    getScreenSize: () => {
        const width = window.innerWidth;
        if (width < 768) return 'mobile';
        if (width < 1024) return 'tablet';
        return 'desktop';
    }
};
