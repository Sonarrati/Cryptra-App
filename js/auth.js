// Supabase configuration - UPDATED
const SUPABASE_URL = 'https://xzwaisyiszdhwmyrnbkh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6d2Fpc3lpc3pkaHdteXJuYmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MjQ2NjMsImV4cCI6MjA3NTUwMDY2M30.gf9vwF44EysfVHJBN_ifmosjIe3kpUn77TcWiaX51sY';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Auth state management
let currentUser = null;

// Check authentication state
async function checkAuth() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session) {
            currentUser = session.user;
            return true;
        }
        return false;
    } catch (error) {
        console.error('Auth check error:', error);
        return false;
    }
}

// Redirect if not authenticated
async function requireAuth(redirectTo = 'login.html') {
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
        window.location.href = redirectTo;
        return false;
    }
    return true;
}

// Redirect if already authenticated
async function redirectIfAuthenticated(redirectTo = 'dashboard.html') {
    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        window.location.href = redirectTo;
        return true;
    }
    return false;
}

// Sign out function
async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (!error) {
            window.location.href = 'login.html';
        } else {
            console.error('Sign out error:', error);
        }
    } catch (error) {
        console.error('Sign out error:', error);
    }
}

// Generate referral code
function generateReferralCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Show notification
function showNotification(message, type = 'success') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.custom-notification');
    existingNotifications.forEach(notif => notif.remove());

    const notification = document.createElement('div');
    notification.className = `custom-notification fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-transform duration-300 ${
        type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// 7-Level Referral Commission System
const REFERRAL_LEVELS = {
    1: 0.045, // 4.5%
    2: 0.02,  // 2.0%
    3: 0.01,  // 1.0%
    4: 0.005, // 0.5%
    5: 0.001, // 0.1%
    6: 0.0001, // 0.01%
    7: 0.00002 // 0.002%
};

// Check if user is active (has checked in today)
async function isUserActive(userId) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('last_checkin')
            .eq('id', userId)
            .single();

        if (error || !user) return false;

        const today = new Date().toISOString().split('T')[0];
        return user.last_checkin === today;
    } catch (error) {
        console.error('Error checking user activity:', error);
        return false;
    }
}

// Distribute referral commissions
async function distributeReferralCommissions(earnerId, earnedCoins, earningType) {
    try {
        if (earningType === 'commission') return; // Prevent commission on commission

        let currentUserId = earnerId;
        
        for (let level = 1; level <= 7; level++) {
            // Get referrer for current level
            const { data: referral, error } = await supabase
                .from('referrals')
                .select('inviter_id')
                .eq('invitee_id', currentUserId)
                .single();

            if (error || !referral) break;

            const referrerId = referral.inviter_id;
            
            // Check if referrer is active
            const isActive = await isUserActive(referrerId);
            
            if (isActive) {
                const commissionRate = REFERRAL_LEVELS[level];
                const commission = Math.floor(earnedCoins * commissionRate);
                
                if (commission > 0) {
                    // Update referrer's coins
                    await updateCoins(referrerId, commission, 'earn');
                    
                    // Add commission record
                    await addEarningRecord(referrerId, 'commission', commission, level);
                    
                    console.log(`Level ${level} commission: ${commission} coins to user ${referrerId}`);
                }
            }

            // Move to next level
            currentUserId = referrerId;
        }
    } catch (error) {
        console.error('Error distributing referral commissions:', error);
    }
}
