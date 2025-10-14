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

// ✅ URL se referral code extract karein aur store karein
function handleReferralFromURL() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        
        if (refCode && refCode.length >= 6) {
            console.log('🔗 Referral code detected in URL:', refCode);
            
            // Referral code localStorage mein save karein
            localStorage.setItem('pendingReferral', refCode);
            
            // Clean URL (browser history se referral code hata de)
            if (window.history && window.history.replaceState) {
                const cleanURL = window.location.pathname;
                window.history.replaceState({}, document.title, cleanURL);
            }
            
            return refCode;
        }
    } catch (error) {
        console.error('❌ Error handling referral from URL:', error);
    }
    return null;
}

// ✅ Signup/registration ke time referral code use karein
async function applyPendingReferral(userId) {
    try {
        const pendingRef = localStorage.getItem('pendingReferral');
        
        if (pendingRef && userId) {
            console.log('🔗 Applying referral code:', pendingRef, 'for user:', userId);
            
            // Aapka existing processReferral function call karein
            await processReferral(userId, pendingRef);
            
            // Clear pending referral
            localStorage.removeItem('pendingReferral');
            
            return true;
        }
    } catch (error) {
        console.error('❌ Error applying pending referral:', error);
    }
    return false;
}

// ✅ Generate Proper Referral Link for Sharing
function generateReferralLink() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || !user.referral_code) {
            console.log('❌ User or referral code not found');
            return 'https://sonarrati.github.io/Cryptra-App/';
        }
        
        // YEH HI LINK SHARE KAREIN - Best working
        const referralLink = `https://sonarrati.github.io/Cryptra-App/?ref=${user.referral_code}`;
        console.log('✅ Generated referral link:', referralLink);
        return referralLink;
    } catch (error) {
        console.error('❌ Error generating referral link:', error);
        return 'https://sonarrati.github.io/Cryptra-App/';
    }
}

// ✅ Copy Referral Link to Clipboard
async function copyReferralLink() {
    try {
        const referralLink = generateReferralLink();
        
        // Modern clipboard API
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(referralLink);
        } else {
            // Fallback for older browsers
            const tempInput = document.createElement('input');
            tempInput.value = referralLink;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
        }
        
        // Success message
        showNotification('✅ Referral link copied to clipboard!', 'success');
        return true;
    } catch (error) {
        console.error('❌ Error copying referral link:', error);
        showNotification('❌ Failed to copy link', 'error');
        return false;
    }
}

// ✅ Show Notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-lg ${
        type === 'success' ? 'bg-green-500 text-white' : 
        type === 'error' ? 'bg-red-500 text-white' : 
        'bg-blue-500 text-white'
    }`;
    notification.innerHTML = `
        <div class="flex items-center space-x-2">
            <i class="fas ${type === 'success' ? 'fa-check' : type === 'error' ? 'fa-times' : 'fa-info'}"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// ✅ Load Referral Page Data
async function loadReferralPage() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        // Referral stats load karein
        const stats = await getReferralStats(user.id);
        displayReferralStats(stats);
        
        // Referral network load karein
        const network = await getReferralNetwork(user.id);
        displayReferralNetwork(network);
        
        // Referral link display karein
        const referralLinkElement = document.getElementById('referralLink');
        if (referralLinkElement) {
            referralLinkElement.value = generateReferralLink();
        }
        
    } catch (error) {
        console.error('❌ Error loading referral page:', error);
    }
}

// ✅ Display Referral Stats
function displayReferralStats(stats) {
    const totalReferralsElement = document.getElementById('totalReferrals');
    const totalEarningsElement = document.getElementById('totalEarnings');
    const levelsEarningsElement = document.getElementById('levelsEarnings');
    
    if (totalReferralsElement) {
        totalReferralsElement.textContent = stats.totalReferrals || 0;
    }
    
    if (totalEarningsElement) {
        totalEarningsElement.textContent = stats.totalEarnings || 0;
    }
    
    // Level-wise earnings display karein
    if (levelsEarningsElement) {
        levelsEarningsElement.innerHTML = '';
        for (let level = 1; level <= 7; level++) {
            const earnings = stats.earningsByLevel[level] || 0;
            levelsEarningsElement.innerHTML += `
                <div class="flex justify-between items-center p-2 border-b border-gray-200">
                    <span class="text-gray-700">Level ${level}:</span>
                    <span class="font-bold text-green-600">${earnings} coins</span>
                </div>
            `;
        }
    }
}

// ✅ Display Referral Network
function displayReferralNetwork(network) {
    const networkContainer = document.getElementById('referralNetwork');
    if (!networkContainer) return;
    
    networkContainer.innerHTML = '';
    
    for (let level = 1; level <= 7; level++) {
        const levelData = network[level] || [];
        
        const levelHTML = `
            <div class="bg-white rounded-xl shadow-md p-4 mb-4">
                <h4 class="font-bold text-lg text-gray-800 mb-3">Level ${level} (${levelData.length} users)</h4>
                <div class="space-y-2">
                    ${levelData.map(user => `
                        <div class="flex justify-between items-center p-2 rounded-lg ${user.isActive ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}">
                            <div>
                                <span class="font-medium text-gray-700">${user.invitee.email || 'User'}</span>
                                <span class="text-xs ml-2 ${user.isActive ? 'text-green-600' : 'text-gray-500'}">
                                    ${user.isActive ? '🟢 Active Today' : '⚫ Inactive'}
                                </span>
                            </div>
                            <span class="text-sm text-gray-600">${user.invitee.total_coins || 0} coins</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        networkContainer.innerHTML += levelHTML;
    }
}

// ✅ Initialize Referral System on Page Load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔗 Referral system initialized');
    
    // URL se referral code handle karein
    handleReferralFromURL();
    
    // Agar referral page pe hain to data load karein
    if (window.location.pathname.includes('referral.html')) {
        loadReferralPage();
        
        // Copy button event listener
        const copyButton = document.getElementById('copyReferralBtn');
        if (copyButton) {
            copyButton.addEventListener('click', copyReferralLink);
        }
    }
});
