// Earning actions with 7-level referral support
async function watchAd() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: 'Not authenticated' };

        // Check daily limit (max 50 ads/day)
        const todayEarnings = await checkDailyLimit(user.id, 'watch');
        if (todayEarnings.length >= 50) {
            return { success: false, message: 'Daily limit reached (50 ads)' };
        }

        // Generate random coins between 10-20
        const coins = Math.floor(Math.random() * 11) + 10;

        // Update coins and add earning record
        const coinUpdated = await updateCoins(user.id, coins, 'earn', 'watch');
        const recordAdded = await addEarningRecord(user.id, 'watch', coins);

        if (coinUpdated && recordAdded) {
            return { success: true, coins: coins };
        } else {
            return { success: false, message: 'Failed to process earning' };
        }
    } catch (error) {
        console.error('Watch ad error:', error);
        return { success: false, message: 'An error occurred' };
    }
}

async function scratchCard() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: 'Not authenticated' };

        // Check daily limit (max 3 scratch cards/day)
        const todayEarnings = await checkDailyLimit(user.id, 'scratch');
        if (todayEarnings.length >= 3) {
            return { success: false, message: 'Daily limit reached (3 scratch cards)' };
        }

        // Generate random coins between 5-50
        const coins = Math.floor(Math.random() * 46) + 5;

        // Update coins and add earning record
        const coinUpdated = await updateCoins(user.id, coins, 'earn', 'scratch');
        const recordAdded = await addEarningRecord(user.id, 'scratch', coins);

        if (coinUpdated && recordAdded) {
            return { success: true, coins: coins };
        } else {
            return { success: false, message: 'Failed to process earning' };
        }
    } catch (error) {
        console.error('Scratch card error:', error);
        return { success: false, message: 'An error occurred' };
    }
}

async function dailyCheckin() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: 'Not authenticated' };

        // Get user data
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (userError) throw userError;

        const today = new Date().toISOString().split('T')[0];
        const lastCheckin = userData.last_checkin;

        let streak = userData.daily_streak || 0;
        let coins = 0;

        // Check if already checked in today
        if (lastCheckin === today) {
            return { success: false, message: 'Already checked in today' };
        }

        // Calculate streak and coins
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (lastCheckin === yesterdayStr) {
            streak += 1;
        } else {
            streak = 1;
        }

        // Calculate coins based on streak (Day1:10 → Day7:100)
        coins = Math.min(10 + (streak - 1) * 15, 100);

        // Update user data
        const { error: updateError } = await supabase
            .from('users')
            .update({
                daily_streak: streak,
                last_checkin: today
            })
            .eq('id', user.id);

        if (updateError) throw updateError;

        // Add coins and earning record
        const coinUpdated = await updateCoins(user.id, coins, 'earn', 'checkin');
        const recordAdded = await addEarningRecord(user.id, 'checkin', coins);

        if (coinUpdated && recordAdded) {
            return { success: true, coins: coins, streak: streak };
        } else {
            return { success: false, message: 'Failed to process checkin' };
        }
    } catch (error) {
        console.error('Daily checkin error:', error);
        return { success: false, message: 'An error occurred' };
    }
}

async function openTreasure() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: 'Not authenticated' };

        // Check daily limit (max 1 treasure/day)
        const todayEarnings = await checkDailyLimit(user.id, 'treasure');
        if (todayEarnings.length >= 1) {
            return { success: false, message: 'Daily limit reached (1 treasure)' };
        }

        // Generate random coins between 20-200
        const coins = Math.floor(Math.random() * 181) + 20;

        // Update coins and add earning record
        const coinUpdated = await updateCoins(user.id, coins, 'earn', 'treasure');
        const recordAdded = await addEarningRecord(user.id, 'treasure', coins);

        if (coinUpdated && recordAdded) {
            return { success: true, coins: coins };
        } else {
            return { success: false, message: 'Failed to process treasure' };
        }
    } catch (error) {
        console.error('Treasure error:', error);
        return { success: false, message: 'An error occurred' };
    }
}
