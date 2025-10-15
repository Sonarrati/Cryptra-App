// Wallet and balance management functions
class WalletManager {
    constructor() {
        this.supabase = window.authUtils?.supabase;
    }

    // Get user wallet data
    async getUserWallet(userId) {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error getting user wallet:', error);
            return { data: null, error };
        }
    }

    // Update user balance
    async updateBalance(userId, amount, type = 'add') {
        try {
            // Get current balance
            const { data: userData, error: userError } = await this.supabase
                .from('users')
                .select('total_balance, earned_balance')
                .eq('id', userId)
                .single();

            if (userError) throw userError;

            let newTotalBalance = userData.total_balance;
            let newEarnedBalance = userData.earned_balance;

            if (type === 'add') {
                newTotalBalance += amount;
                newEarnedBalance += amount;
            } else if (type === 'subtract') {
                newTotalBalance -= amount;
            }

            // Update balance
            const { error: updateError } = await this.supabase
                .from('users')
                .update({
                    total_balance: newTotalBalance,
                    earned_balance: newEarnedBalance
                })
                .eq('id', userId);

            if (updateError) throw updateError;

            return { 
                newTotalBalance, 
                newEarnedBalance, 
                error: null 
            };
        } catch (error) {
            console.error('Error updating balance:', error);
            return { error };
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
            return { error: null };
        } catch (error) {
            console.error('Error adding earning record:', error);
            return { error };
        }
    }

    // Get user earnings history
    async getEarningsHistory(userId, limit = 10) {
        try {
            const { data, error } = await this.supabase
                .from('earnings')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error getting earnings history:', error);
            return { data: null, error };
        }
    }

    // Process withdrawal
    async processWithdrawal(userId, method, account, amount) {
        try {
            const fee = amount * 0.05;
            const netAmount = amount - fee;

            // Create withdrawal record
            const { error: withdrawalError } = await this.supabase
                .from('withdrawals')
                .insert({
                    user_id: userId,
                    method: method,
                    account: account,
                    amount_requested: amount,
                    fee: fee,
                    net_amount: netAmount,
                    status: 'pending'
                });

            if (withdrawalError) throw withdrawalError;

            // Update user balance
            const { error: balanceError } = await this.supabase
                .from('users')
                .update({
                    total_balance: this.supabase.raw('total_balance - ' + amount),
                    withdrawn_balance: this.supabase.raw('withdrawn_balance + ' + amount)
                })
                .eq('id', userId);

            if (balanceError) throw balanceError;

            return { error: null };
        } catch (error) {
            console.error('Error processing withdrawal:', error);
            return { error };
        }
    }

    // Get withdrawal history
    async getWithdrawalHistory(userId, limit = 10) {
        try {
            const { data, error } = await this.supabase
                .from('withdrawals')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error getting withdrawal history:', error);
            return { data: null, error };
        }
    }
}

// Initialize wallet manager
window.walletManager = new WalletManager();
