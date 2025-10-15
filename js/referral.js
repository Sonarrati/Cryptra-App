// Referral system management
class ReferralManager {
    constructor() {
        this.supabase = window.authUtils?.supabase;
        this.bonusAmounts = {
            1: 25.00, // Level 1: ₹25
            2: 10.00, // Level 2: ₹10
            3: 5.00,  // Level 3: ₹5
            4: 2.50,  // Level 4: ₹2.50
            5: 1.25,  // Level 5: ₹1.25
            6: 0.75,  // Level 6: ₹0.75
            7: 0.50   // Level 7: ₹0.50
        };
    }

    // Generate referral code
    generateReferralCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Get user referral stats
    async getReferralStats(userId) {
        try {
            // Get total referrals count by level
            const { data: referrals, error } = await this.supabase
                .from('referrals')
                .select('level, invitee_id')
                .eq('inviter_id', userId);

            if (error) throw error;

            // Count by level
            const levelCounts = {1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0};
            referrals?.forEach(ref => {
                if (levelCounts[ref.level] !== undefined) {
                    levelCounts[ref.level]++;
                }
            });

            // Get referral earnings
            const { data: earnings, error: earningsError } = await this.supabase
                .from('earnings')
                .select('amount')
                .eq('user_id', userId)
                .eq('type', 'referral');

            const totalEarnings = earnings?.reduce((sum, earning) => sum + earning.amount, 0) || 0;

            return {
                totalReferrals: referrals?.length || 0,
                levelCounts,
                totalEarnings,
                error: null
            };
        } catch (error) {
            console.error('Error getting referral stats:', error);
            return { error };
        }
    }

    // Process referral signup
    async processReferralSignup(inviteeId, referralCode) {
        try {
            if (!referralCode) return { error: null };

            // Find inviter by referral code
            const { data: inviter, error: inviterError } = await this.supabase
                .from('users')
                .select('*')
                .eq('referral_code', referralCode)
                .single();

            if (inviterError || !inviter) {
                console.warn('Invalid referral code:', referralCode);
                return { error: null }; // Not a critical error
            }

            // Add level 1 referral record
            const { error: referralError } = await this.supabase
                .from('referrals')
                .insert({
                    inviter_id: inviter.id,
                    invitee_id: inviteeId,
                    level: 1,
                    bonus_given: false
                });

            if (referralError) throw referralError;

            // Give bonuses
            await this.giveReferralBonuses(inviter.id, inviteeId, 1);

            return { error: null };
        } catch (error) {
            console.error('Error processing referral signup:', error);
            return { error };
        }
    }

    // Give referral bonuses
    async giveReferralBonuses(inviterId, inviteeId, currentLevel) {
        try {
            if (currentLevel > 7) return;

            const bonusAmount = this.bonusAmounts[currentLevel];
            if (!bonusAmount) return;

            // Give bonus to inviter
            const wallet = window.walletManager;
            await wallet.updateBalance(inviterId, bonusAmount, 'add');
            await wallet.addEarning(
                inviterId, 
                'referral', 
                bonusAmount, 
                `Level ${currentLevel} referral bonus`
            );

            // Give bonus to invitee for level 1
            if (currentLevel === 1) {
                await wallet.updateBalance(inviteeId, bonusAmount, 'add');
                await wallet.addEarning(
                    inviteeId,
                    'referral',
                    bonusAmount,
                    'Referral signup bonus'
                );
            }

            // Propagate to higher levels
            if (currentLevel === 1) {
                await this.propagateToHigherLevels(inviterId, 2);
            }
        } catch (error) {
            console.error('Error giving referral bonuses:', error);
        }
    }

    // Propagate bonuses to higher levels
    async propagateToHigherLevels(originalInviteeId, currentLevel) {
        if (currentLevel > 7) return;

        try {
            // Find who referred the original inviter
            const { data: higherRef, error } = await this.supabase
                .from('referrals')
                .select('inviter_id')
                .eq('invitee_id', originalInviteeId)
                .eq('level', 1)
                .single();

            if (error || !higherRef) return;

            const bonusAmount = this.bonusAmounts[currentLevel];
            if (!bonusAmount) return;

            // Give bonus to higher level inviter
            const wallet = window.walletManager;
            await wallet.updateBalance(higherRef.inviter_id, bonusAmount, 'add');
            await wallet.addEarning(
                higherRef.inviter_id,
                'referral',
                bonusAmount,
                `Level ${currentLevel} referral bonus`
            );

            // Add referral record for higher level
            await this.supabase
                .from('referrals')
                .insert({
                    inviter_id: higherRef.inviter_id,
                    invitee_id: originalInviteeId,
                    level: currentLevel,
                    bonus_given: true
                });

            // Continue to next level
            await this.propagateToHigherLevels(higherRef.inviter_id, currentLevel + 1);
        } catch (error) {
            console.error('Error propagating referral bonus:', error);
        }
    }

    // Get referral history
    async getReferralHistory(userId, limit = 10) {
        try {
            const { data, error } = await this.supabase
                .from('earnings')
                .select('*')
                .eq('user_id', userId)
                .eq('type', 'referral')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error getting referral history:', error);
            return { data: null, error };
        }
    }
}

// Initialize referral manager
window.referralManager = new ReferralManager();
