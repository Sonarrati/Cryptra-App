// Improved 7-Level Referral System with Daily Commissions
class ImprovedReferralManager {
    constructor() {
        this.supabase = window.authUtils?.supabase;
        
        // New commission structure (percentages of daily earnings)
        this.commissionRates = {
            1: 0.045, // 4.5%
            2: 0.025, // 2.5%
            3: 0.015, // 1.5%
            4: 0.008, // 0.8%
            5: 0.003, // 0.3%
            6: 0.001, // 0.1%
            7: 0.0005 // 0.05%
        };
    }

    // Generate referral code (same as before)
    generateReferralCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Process referral signup - Only create referral relationship now
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
                return { error: null };
            }

            // Add level 1 referral record (no immediate bonus)
            const { error: referralError } = await this.supabase
                .from('referrals')
                .insert({
                    inviter_id: inviter.id,
                    invitee_id: inviteeId,
                    level: 1,
                    bonus_given: false // No longer used for immediate bonuses
                });

            if (referralError) throw referralError;

            console.log(`Referral relationship created: ${inviter.id} -> ${inviteeId}`);

            return { error: null };
        } catch (error) {
            console.error('Error processing referral signup:', error);
            return { error };
        }
    }

    // Update user activity status (called when user completes daily check-in)
    async updateUserActivity(userId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            const { error } = await this.supabase
                .from('users')
                .update({
                    is_active: true,
                    last_activity_date: today
                })
                .eq('id', userId);

            if (error) throw error;

            console.log(`User ${userId} marked as active for ${today}`);
            return { error: null };
        } catch (error) {
            console.error('Error updating user activity:', error);
            return { error };
        }
    }

    // Calculate daily commissions for all active users
    async calculateDailyCommissions() {
        try {
            const today = new Date().toISOString().split('T')[0];
            console.log(`Calculating daily commissions for ${today}`);

            // Get all active users (completed check-in today)
            const { data: activeUsers, error: activeError } = await this.supabase
                .from('users')
                .select('id, email, total_balance, earned_balance')
                .eq('is_active', true)
                .eq('last_activity_date', today);

            if (activeError) throw activeError;

            let totalCommissions = 0;
            let processedUsers = 0;

            // Calculate daily earnings for each active user and distribute commissions
            for (const user of activeUsers) {
                const userDailyEarnings = await this.calculateUserDailyEarnings(user.id, today);
                
                if (userDailyEarnings > 0) {
                    await this.distributeCommissionsToUplines(user.id, userDailyEarnings, today);
                    processedUsers++;
                }
            }

            // Reset activity status for next day (will be set again when users check-in)
            await this.resetActivityStatusForNewDay();

            console.log(`Daily commissions calculated: ${processedUsers} active users processed, ₹${totalCommissions} distributed`);
            return { processedUsers, totalCommissions, error: null };
        } catch (error) {
            console.error('Error calculating daily commissions:', error);
            return { error };
        }
    }

    // Calculate user's daily earnings (excluding referral commissions)
    async calculateUserDailyEarnings(userId, date) {
        try {
            const { data: earnings, error } = await this.supabase
                .from('earnings')
                .select('amount, type')
                .eq('user_id', userId)
                .gte('created_at', date + 'T00:00:00')
                .lte('created_at', date + 'T23:59:59')
                .neq('type', 'referral'); // Exclude referral commissions to avoid loops

            if (error) throw error;

            const totalEarned = earnings?.reduce((sum, earning) => sum + earning.amount, 0) || 0;

            // Store daily earnings record
            await this.supabase
                .from('daily_earnings')
                .upsert({
                    user_id: userId,
                    date: date,
                    total_earned: totalEarned,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,date'
                });

            return totalEarned;
        } catch (error) {
            console.error('Error calculating user daily earnings:', error);
            return 0;
        }
    }

    // Distribute commissions to upline (7 levels)
    async distributeCommissionsToUplines(inviteeId, inviteeDailyEarnings, date) {
        try {
            let currentInviteeId = inviteeId;
            
            for (let level = 1; level <= 7; level++) {
                const inviter = await this.getInviter(currentInviteeId);
                if (!inviter) break;

                // Check if inviter is active
                const isInviterActive = await this.isUserActive(inviter.id, date);
                if (!isInviterActive) {
                    console.log(`Skipping level ${level} - Inviter ${inviter.id} is not active`);
                    currentInviteeId = inviter.id;
                    continue;
                }

                const commissionRate = this.commissionRates[level];
                const commissionAmount = inviteeDailyEarnings * commissionRate;

                if (commissionAmount > 0) {
                    await this.giveCommission(
                        inviter.id, 
                        inviteeId, 
                        level, 
                        commissionRate, 
                        inviteeDailyEarnings, 
                        commissionAmount, 
                        date
                    );
                }

                currentInviteeId = inviter.id;
            }
        } catch (error) {
            console.error('Error distributing commissions to uplines:', error);
        }
    }

    // Get immediate inviter for a user
    async getInviter(inviteeId) {
        try {
            const { data: referral, error } = await this.supabase
                .from('referrals')
                .select('inviter_id')
                .eq('invitee_id', inviteeId)
                .eq('level', 1)
                .single();

            if (error || !referral) return null;

            const { data: inviter, error: inviterError } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', referral.inviter_id)
                .single();

            if (inviterError) return null;

            return inviter;
        } catch (error) {
            console.error('Error getting inviter:', error);
            return null;
        }
    }

    // Check if user is active for a specific date
    async isUserActive(userId, date) {
        try {
            const { data: user, error } = await this.supabase
                .from('users')
                .select('is_active, last_activity_date')
                .eq('id', userId)
                .single();

            if (error) return false;

            return user.is_active && user.last_activity_date === date;
        } catch (error) {
            console.error('Error checking user activity:', error);
            return false;
        }
    }

    // Give commission to inviter
    async giveCommission(inviterId, inviteeId, level, commissionRate, inviteeDailyEarnings, commissionAmount, date) {
        try {
            // Update inviter's balance
            const wallet = window.walletManager;
            await wallet.updateBalance(inviterId, commissionAmount, 'add');
            
            // Add earning record
            await wallet.addEarning(
                inviterId,
                'referral',
                commissionAmount,
                `Level ${level} commission (${(commissionRate * 100).toFixed(2)}% of ₹${inviteeDailyEarnings.toFixed(2)})`
            );

            // Update total referral earnings
            await this.supabase
                .from('users')
                .update({
                    total_referral_earnings: this.supabase.raw('total_referral_earnings + ' + commissionAmount)
                })
                .eq('id', inviterId);

            // Record commission details
            const { error } = await this.supabase
                .from('referral_commissions')
                .insert({
                    inviter_id: inviterId,
                    invitee_id: inviteeId,
                    level: level,
                    commission_rate: commissionRate,
                    invitee_daily_earnings: inviteeDailyEarnings,
                    commission_amount: commissionAmount,
                    date: date
                });

            if (error) throw error;

            console.log(`Level ${level} commission: ₹${commissionAmount.toFixed(2)} to ${inviterId} from ${inviteeId}`);
        } catch (error) {
            console.error('Error giving commission:', error);
        }
    }

    // Reset activity status for new day (called by cron job)
    async resetActivityStatusForNewDay() {
        try {
            const { error } = await this.supabase
                .from('users')
                .update({
                    is_active: false
                })
                .neq('is_active', false);

            if (error) throw error;

            console.log('User activity status reset for new day');
            return { error: null };
        } catch (error) {
            console.error('Error resetting activity status:', error);
            return { error };
        }
    }

    // Get improved referral stats
    async getReferralStats(userId) {
        try {
            // Get referral counts by level
            const { data: referrals, error } = await this.supabase
                .from('referrals')
                .select('level, invitee_id')
                .eq('inviter_id', userId);

            if (error) throw error;

            // Count by level and check active status
            const levelCounts = {1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0};
            const activeCounts = {1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0};
            const today = new Date().toISOString().split('T')[0];

            for (const ref of referrals || []) {
                if (levelCounts[ref.level] !== undefined) {
                    levelCounts[ref.level]++;
                    
                    // Check if this invitee is active today
                    const isActive = await this.isUserActive(ref.invitee_id, today);
                    if (isActive) {
                        activeCounts[ref.level]++;
                    }
                }
            }

            // Get total referral earnings
            const { data: user, error: userError } = await this.supabase
                .from('users')
                .select('total_referral_earnings')
                .eq('id', userId)
                .single();

            // Get today's commission earnings
            const { data: todaysCommissions, error: commissionError } = await this.supabase
                .from('referral_commissions')
                .select('commission_amount')
                .eq('inviter_id', userId)
                .eq('date', today);

            const todaysEarnings = todaysCommissions?.reduce((sum, c) => sum + c.commission_amount, 0) || 0;

            return {
                totalReferrals: referrals?.length || 0,
                levelCounts,
                activeCounts,
                totalEarnings: user?.total_referral_earnings || 0,
                todaysEarnings,
                error: null
            };
        } catch (error) {
            console.error('Error getting referral stats:', error);
            return { error };
        }
    }

    // Get commission history
    async getCommissionHistory(userId, limit = 20) {
        try {
            const { data, error } = await this.supabase
                .from('referral_commissions')
                .select(`
                    *,
                    invitee:users!referral_commissions_invitee_id_fkey(email)
                `)
                .eq('inviter_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error getting commission history:', error);
            return { data: null, error };
        }
    }

    // Get user's downline tree
    async getDownlineTree(userId, maxLevel = 7) {
        try {
            const tree = {};
            
            // Recursive function to build tree
            const buildLevel = async (inviterId, currentLevel) => {
                if (currentLevel > maxLevel) return [];

                const { data: referrals, error } = await this.supabase
                    .from('referrals')
                    .select(`
                        invitee_id,
                        level,
                        invitee:users!referrals_invitee_id_fkey(
                            email,
                            is_active,
                            last_activity_date,
                            total_balance,
                            earned_balance
                        )
                    `)
                    .eq('inviter_id', inviterId)
                    .eq('level', 1);

                if (error || !referrals) return [];

                const levelData = await Promise.all(
                    referrals.map(async (ref) => {
                        const downline = await buildLevel(ref.invitee_id, currentLevel + 1);
                        return {
                            userId: ref.invitee_id,
                            email: ref.invitee.email,
                            isActive: ref.invitee.is_active,
                            lastActive: ref.invitee.last_activity_date,
                            totalBalance: ref.invitee.total_balance,
                            earnedBalance: ref.invitee.earned_balance,
                            level: currentLevel,
                            downline: downline
                        };
                    })
                );

                return levelData;
            };

            tree.downline = await buildLevel(userId, 1);
            return { data: tree, error: null };
        } catch (error) {
            console.error('Error getting downline tree:', error);
            return { data: null, error };
        }
    }
}

// Initialize improved referral manager
window.improvedReferralManager = new ImprovedReferralManager();
