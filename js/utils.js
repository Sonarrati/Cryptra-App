// utils.js - Common utilities for all pages
class AppUtils {
    constructor() {
        this.supabaseUrl = 'https://xzwaisyiszdhwmyrnbkh.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6d2Fpc3lpc3pkaHdteXJuYmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MjQ2NjMsImV4cCI6MjA3NTUwMDY2M30.gf9vwF44EysfVHJBN_ifmosjIe3kpUn77TcWiaX51sY';
        this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);
    }

    // Show notification
    showNotification(message, type = 'info') {
        let notification = document.getElementById('notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.className = 'fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-transform duration-300 hidden';
            document.body.appendChild(notification);
        }

        const typeClasses = {
            success: 'bg-green-500 text-white',
            error: 'bg-red-500 text-white',
            warning: 'bg-yellow-500 text-white',
            info: 'bg-blue-500 text-white'
        };

        notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-triangle' : type === 'warning' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-transform duration-300 ${typeClasses[type]}`;
        notification.classList.remove('hidden');

        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
    }

    // Format currency
    formatCurrency(amount) {
        return `₹${parseFloat(amount).toFixed(2)}`;
    }

    // Get today's date string
    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }

    // Check if user is authenticated
    async checkAuth() {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return null;
        }
        return session.user;
    }

    // Update user balance
    async updateUserBalance(userId, amount, type = 'add') {
        try {
            const { data: user, error } = await this.supabase
                .from('users')
                .select('total_balance, earned_balance')
                .eq('id', userId)
                .single();

            if (error) throw error;

            let updateData = {};
            if (type === 'add') {
                updateData = {
                    total_balance: (user.total_balance || 0) + amount,
                    earned_balance: (user.earned_balance || 0) + amount
                };
            } else if (type === 'subtract') {
                updateData = {
                    total_balance: (user.total_balance || 0) - amount
                };
            }

            const { error: updateError } = await this.supabase
                .from('users')
                .update(updateData)
                .eq('id', userId);

            if (updateError) throw updateError;

            return { success: true, error: null };
        } catch (error) {
            console.error('Error updating balance:', error);
            return { success: false, error };
        }
    }

    // Add earning record
    async addEarning(userId, type, amount, description) {
        try {
            const { error } = await this.supabase
                .from('earnings')
                .insert({
                    user_id: userId,
                    type: type,
                    amount: amount,
                    description: description
                });

            if (error) throw error;
            return { success: true, error: null };
        } catch (error) {
            console.error('Error adding earning:', error);
            return { success: false, error };
        }
    }

    // Get today's earnings count
    async getTodayEarningsCount(userId, type = null) {
        try {
            const today = this.getTodayDate();
            let query = this.supabase
                .from('earnings')
                .select('id')
                .eq('user_id', userId)
                .gte('created_at', today + 'T00:00:00')
                .lte('created_at', today + 'T23:59:59');

            if (type) {
                query = query.eq('type', type);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data ? data.length : 0;
        } catch (error) {
            console.error('Error getting today earnings count:', error);
            return 0;
        }
    }

    // Get user data
    async getUserData(userId) {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error getting user data:', error);
            return { data: null, error };
        }
    }
}

// Initialize global utils
window.appUtils = new AppUtils();
