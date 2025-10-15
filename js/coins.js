// coins.js - Simple coin collection functions
class CoinManager {
    constructor() {
        this.supabase = window.authUtils?.supabase;
    }

    // Update user balance directly
    async updateUserBalance(userId, amount, type, description) {
        try {
            // First get current balance
            const { data: user, error: userError } = await this.supabase
                .from('users')
                .select('total_balance, earned_balance')
                .eq('id', userId)
                .single();

            if (userError) throw userError;

            // Update balance
            const { error: updateError } = await this.supabase
                .from('users')
                .update({
                    total_balance: (user.total_balance || 0) + amount,
                    earned_balance: (user.earned_balance || 0) + amount,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (updateError) throw updateError;

            // Add earning record
            const { error: earningError } = await this.supabase
                .from('earnings')
                .insert({
                    user_id: userId,
                    type: type,
                    amount: amount,
                    description: description,
                    created_at: new Date().toISOString()
                });

            if (earningError) throw earningError;

            return { 
                success: true, 
                newBalance: (user.total_balance || 0) + amount,
                earned: amount
            };

        } catch (error) {
            console.error('Update balance error:', error);
            return { success: false, error: error.message };
        }
    }

    // Watch video and earn
    async watchVideo(userId) {
        try {
            // Check daily limit
            const today = new Date().toISOString().split('T')[0];
            const { data: todayEarnings, error: countError } = await this.supabase
                .from('earnings')
                .select('id')
                .eq('user_id', userId)
                .eq('type', 'watch')
                .gte('created_at', today + 'T00:00:00')
                .lte('created_at', today + 'T23:59:59');

            if (countError) throw countError;

            if (todayEarnings.length >= 20) {
                return { success: false, error: 'Daily video limit reached (20 videos)' };
            }

            // Generate random amount between ₹0.10-₹0.20
            const amount = 0.10 + (Math.random() * 0.10);
            const result = await this.updateUserBalance(
                userId, 
                amount, 
                'watch', 
                'Watched video advertisement'
            );

            return result;

        } catch (error) {
            console.error('Watch video error:', error);
            return { success: false, error: error.message };
        }
    }

    // Scratch card
    async scratchCard(userId) {
        try {
            // Check daily limit
            const today = new Date().toISOString().split('T')[0];
            const { data: todayScratches, error: countError } = await this.supabase
                .from('earnings')
                .select('id')
                .eq('user_id', userId)
                .eq('type', 'scratch')
                .gte('created_at', today + 'T00:00:00')
                .lte('created_at', today + 'T23:59:59');

            if (countError) throw countError;

            if (todayScratches.length >= 3) {
                return { success: false, error: 'Daily scratch card limit reached (3 cards)' };
            }

            // Generate random amount between ₹0.05-₹0.50
            const amount = 0.05 + (Math.random() * 0.45);
            const result = await this.updateUserBalance(
                userId, 
                amount, 
                'scratch', 
                'Scratch card reward'
            );

            return result;

        } catch (error) {
            console.error('Scratch card error:', error);
            return { success: false, error: error.message };
        }
    }

    // Daily check-in
    async dailyCheckin(userId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // Get user data
            const { data: user, error: userError } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (userError) throw userError;

            // Check if already checked in today
            if (user.last_checkin === today) {
                return { success: false, error: 'Already checked in today' };
            }

            // Calculate streak and reward
            let streak = user.daily_streak || 0;
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (user.last_checkin === yesterdayStr) {
                streak += 1;
            } else {
                streak = 1;
            }

            // Calculate reward (Day1:0.10 → Day7:1.00)
            const reward = Math.min(0.10 + (streak - 1) * 0.15, 1.00);

            // Update user
            const { error: updateError } = await this.supabase
                .from('users')
                .update({
                    daily_streak: streak,
                    last_checkin: today,
                    is_active: true,
                    last_activity_date: today,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (updateError) throw updateError;

            // Add earning
            const result = await this.updateUserBalance(
                userId,
                reward,
                'checkin',
                `Daily check-in reward - Day ${streak}`
            );

            if (result.success) {
                result.streak = streak;
                result.reward = reward;
            }

            return result;

        } catch (error) {
            console.error('Daily check-in error:', error);
            return { success: false, error: error.message };
        }
    }

    // Treasure box
    async openTreasure(userId) {
        try {
            // Check daily limit
            const today = new Date().toISOString().split('T')[0];
            const { data: todayTreasures, error: countError } = await this.supabase
                .from('earnings')
                .select('id')
                .eq('user_id', userId)
                .eq('type', 'treasure')
                .gte('created_at', today + 'T00:00:00')
                .lte('created_at', today + 'T23:59:59');

            if (countError) throw countError;

            if (todayTreasures.length >= 1) {
                return { success: false, error: 'Daily treasure box limit reached (1 box)' };
            }

            // Generate random amount between ₹0.20-₹2.00
            const amount = 0.20 + (Math.random() * 1.80);
            const result = await this.updateUserBalance(
                userId, 
                amount, 
                'treasure', 
                'Treasure box reward'
            );

            return result;

        } catch (error) {
            console.error('Treasure box error:', error);
            return { success: false, error: error.message };
        }
    }

    // Complete task
    async completeTask(userId, taskType, reward) {
        try {
            // Check daily limit
            const today = new Date().toISOString().split('T')[0];
            const { data: todayTasks, error: countError } = await this.supabase
                .from('earnings')
                .select('id')
                .eq('user_id', userId)
                .eq('type', 'task')
                .gte('created_at', today + 'T00:00:00')
                .lte('created_at', today + 'T23:59:59');

            if (countError) throw countError;

            if (todayTasks.length >= 10) {
                return { success: false, error: 'Daily task limit reached (10 tasks)' };
            }

            const result = await this.updateUserBalance(
                userId, 
                reward, 
                'task', 
                `Completed task: ${taskType}`
            );

            return result;

        } catch (error) {
            console.error('Complete task error:', error);
            return { success: false, error: error.message };
        }
    }
}

// Initialize coin manager
window.coinManager = new CoinManager();
