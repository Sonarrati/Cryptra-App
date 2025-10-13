// Wallet management functions - FIXED
async function getUserWallet() {
    try {
        console.log('👛 Fetching user wallet...');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.log('❌ No user found');
            return null;
        }

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('❌ Wallet fetch error:', error);
            throw error;
        }

        console.log('✅ Wallet data:', data);
        return data;
    } catch (error) {
        console.error('❌ Error fetching wallet:', error);
        return null;
    }
}

// Update coins function - COMPLETELY FIXED
async function updateCoins(userId, coinChange, type = 'earn', earningType = null) {
    try {
        console.log(`🪙 Updating coins: User ${userId}, Change: ${coinChange}, Type: ${type}, EarningType: ${earningType}`);

        // Get current user data
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError) {
            console.error('❌ User fetch error:', userError);
            throw userError;
        }

        console.log('📊 Current user data:', user);

        let updateData = {};
        
        if (type === 'earn') {
            updateData = {
                total_coins: parseInt(user.total_coins || 0) + parseInt(coinChange),
                earned_coins: parseInt(user.earned_coins || 0) + parseInt(coinChange),
                updated_at: new Date().toISOString()
            };
        } else if (type === 'withdraw') {
            updateData = {
                total_coins: parseInt(user.total_coins || 0) - parseInt(coinChange),
                withdrawn_coins: parseInt(user.withdrawn_coins || 0) + parseInt(coinChange),
                updated_at: new Date().toISOString()
            };
        }

        console.log('🔄 Update data:', updateData);

        // Update user coins
        const { error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId);

        if (updateError) {
            console.error('❌ Coin update error:', updateError);
            throw updateError;
        }

        console.log('✅ Coins updated successfully');

        // Add earning record
        if (type === 'earn' && earningType) {
            await addEarningRecord(userId, earningType, coinChange);
        }

        // Distribute referral commissions for earnings (not for withdrawals or commissions)
        if (type === 'earn' && earningType && earningType !== 'commission') {
            console.log('🤝 Distributing referral commissions...');
            setTimeout(() => {
                distributeReferralCommissions(userId, coinChange, earningType);
            }, 1000);
        }

        return true;
    } catch (error) {
        console.error('❌ Error updating coins:', error);
        return false;
    }
}

async function addEarningRecord(userId, type, coins, level = null) {
    try {
        console.log('📝 Adding earning record:', { userId, type, coins, level });

        const record = {
            user_id: userId,
            type: type,
            coins: parseInt(coins)
        };

        if (level !== null) {
            record.level = level;
        }

        const { error } = await supabase
            .from('earnings')
            .insert(record);

        if (error) {
            console.error('❌ Earning record error:', error);
            throw error;
        }

        console.log('✅ Earning record added successfully');
        return true;
    } catch (error) {
        console.error('❌ Error adding earning record:', error);
        return false;
    }
}

// Check daily limits - FIXED
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

        if (error) {
            console.error('❌ Daily limit check error:', error);
            throw error;
        }

        console.log(`📅 Daily ${activityType} count:`, data?.length || 0);
        return data || [];
    } catch (error) {
        console.error('❌ Error checking daily limit:', error);
        return [];
    }
}
