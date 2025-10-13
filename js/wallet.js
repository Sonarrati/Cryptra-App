// Wallet management functions
async function getUserWallet() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching wallet:', error);
        return null;
    }
}

async function updateCoins(userId, coinChange, type = 'earn', earningType = null) {
    try {
        // Get current user data
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError) throw userError;

        let updateData = {};
        
        if (type === 'earn') {
            updateData = {
                total_coins: (user.total_coins || 0) + coinChange,
                earned_coins: (user.earned_coins || 0) + coinChange
            };
        } else if (type === 'withdraw') {
            updateData = {
                total_coins: (user.total_coins || 0) - coinChange,
                withdrawn_coins: (user.withdrawn_coins || 0) + coinChange
            };
        }

        // Update user coins
        const { error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId);

        if (updateError) throw updateError;

        // Distribute referral commissions for earnings (not for withdrawals or commissions)
        if (type === 'earn' && earningType && earningType !== 'commission') {
            setTimeout(() => {
                distributeReferralCommissions(userId, coinChange, earningType);
            }, 1000);
        }

        return true;
    } catch (error) {
        console.error('Error updating coins:', error);
        return false;
    }
}

async function addEarningRecord(userId, type, coins, level = null) {
    try {
        const record = {
            user_id: userId,
            type: type,
            coins: coins
        };

        if (level !== null) {
            record.level = level;
        }

        const { error } = await supabase
            .from('earnings')
            .insert(record);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error adding earning record:', error);
        return false;
    }
}

// Check daily limits
async function checkDailyLimit(userId, activityType) {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('earnings')
            .select('*')
            .eq('user_id', userId)
            .eq('type', activityType)
            .gte('created_at', today + 'T00:00:00')
            .lte('created_at', today + 'T23:59:59');

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error checking daily limit:', error);
        return [];
    }
}
