// Referral system with 7-level tracking
async function processReferral(inviteeId, referralCode) {
    try {
        if (!referralCode) return;

        // Find inviter by referral code
        const { data: inviter, error: inviterError } = await supabase
            .from('users')
            .select('*')
            .eq('referral_code', referralCode)
            .single();

        if (inviterError || !inviter) return;

        // Check if referral already processed
        const { data: existingReferral, error: checkError } = await supabase
            .from('referrals')
            .select('*')
            .eq('invitee_id', inviteeId)
            .single();

        if (existingReferral) return;

        // Add referral record for level 1
        const { error: referralError } = await supabase
            .from('referrals')
            .insert({
                inviter_id: inviter.id,
                invitee_id: inviteeId,
                level: 1,
                bonus_given: false
            });

        if (referralError) throw referralError;

        // Give direct referral bonus (250 coins each)
        const inviterUpdated = await updateCoins(inviter.id, 250, 'earn', 'referral');
        const inviteeUpdated = await updateCoins(inviteeId, 250, 'earn', 'referral');

        if (inviterUpdated && inviteeUpdated) {
            // Add earning records
            await addEarningRecord(inviter.id, 'referral', 250, 1);
            await addEarningRecord(inviteeId, 'referral', 250, 1);

            // Mark bonus as given
            await supabase
                .from('referrals')
                .update({ bonus_given: true })
                .eq('invitee_id', inviteeId);

            // Build multi-level referral chain
            await buildReferralChain(inviter.id, inviteeId);
        }
    } catch (error) {
        console.error('Referral processing error:', error);
    }
}

// Build multi-level referral chain
async function buildReferralChain(topInviterId, newUserId) {
    try {
        let currentInviterId = topInviterId;
        
        for (let level = 2; level <= 7; level++) {
            // Find who referred the current inviter
            const { data: referral, error } = await supabase
                .from('referrals')
                .select('inviter_id')
                .eq('invitee_id', currentInviterId)
                .eq('level', 1)
                .single();

            if (error || !referral) break;

            const nextLevelInviterId = referral.inviter_id;
            
            // Create referral record for this level
            await supabase
                .from('referrals')
                .insert({
                    inviter_id: nextLevelInviterId,
                    invitee_id: newUserId,
                    level: level,
                    bonus_given: false
                });

            currentInviterId = nextLevelInviterId;
        }
    } catch (error) {
        console.error('Error building referral chain:', error);
    }
}

async function getReferralStats(userId) {
    try {
        // Get all referrals across 7 levels
        const { data: referrals, error: refError } = await supabase
            .from('referrals')
            .select('*')
            .eq('inviter_id', userId);

        if (refError) throw refError;

        // Get referral earnings including commissions
        const { data: earnings, error: earnError } = await supabase
            .from('earnings')
            .select('coins, level')
            .eq('user_id', userId)
            .in('type', ['referral', 'commission']);

        if (earnError) throw earnError;

        const totalEarnings = earnings.reduce((sum, earning) => sum + earning.coins, 0);

        // Calculate earnings by level
        const earningsByLevel = {};
        earnings.forEach(earning => {
            const level = earning.level || 1;
            if (!earningsByLevel[level]) {
                earningsByLevel[level] = 0;
            }
            earningsByLevel[level] += earning.coins;
        });

        return {
            totalReferrals: referrals?.length || 0,
            totalEarnings: totalEarnings,
            earningsByLevel: earningsByLevel,
            referrals: referrals || []
        };
    } catch (error) {
        console.error('Error getting referral stats:', error);
        return { 
            totalReferrals: 0, 
            totalEarnings: 0, 
            earningsByLevel: {},
            referrals: [] 
        };
    }
}

// Get detailed referral network
async function getReferralNetwork(userId) {
    try {
        const { data: referrals, error } = await supabase
            .from('referrals')
            .select(`
                *,
                invitee:users!referrals_invitee_id_fkey (
                    id,
                    email,
                    name,
                    total_coins,
                    last_checkin
                )
            `)
            .eq('inviter_id', userId)
            .order('level', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Group by level
        const networkByLevel = {};
        referrals?.forEach(ref => {
            const level = ref.level;
            if (!networkByLevel[level]) {
                networkByLevel[level] = [];
            }
            
            // Check if invitee is active today
            const today = new Date().toISOString().split('T')[0];
            const isActive = ref.invitee.last_checkin === today;
            
            networkByLevel[level].push({
                ...ref,
                isActive: isActive
            });
        });

        return networkByLevel;
    } catch (error) {
        console.error('Error getting referral network:', error);
        return {};
    }
}
