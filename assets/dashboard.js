import { supabase, requireAuth, formatMicrodollars, toMicrodollars, getRandomReward } from './supabaseClient.js'

document.addEventListener('DOMContentLoaded', async function() {
    const user = requireAuth()
    if (!user) return

    await loadDashboardData()
    setupEventListeners()
})

async function loadDashboardData() {
    try {
        // Load user balance
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('balance_microusd, total_earnings_microusd, last_checkin_date, streak_days')
            .eq('id', JSON.parse(localStorage.getItem('cryptra_user')).id)
            .single()

        if (userError) throw userError

        document.getElementById('userBalance').textContent = '$' + formatMicrodollars(userData.balance_microusd)
        document.getElementById('streakDays').textContent = userData.streak_days || 0

        // Check if already checked in today
        const today = new Date().toISOString().split('T')[0]
        const checkinBtn = document.getElementById('checkinBtn')
        if (userData.last_checkin_date === today) {
            checkinBtn.textContent = 'Already Checked In'
            checkinBtn.disabled = true
            checkinBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
        }

        // Load referral stats
        const { data: referralData, error: referralError } = await supabase
            .from('referrals')
            .select('referred_user_id')
            .eq('user_id', JSON.parse(localStorage.getItem('cryptra_user')).id)

        if (!referralError) {
            document.getElementById('totalReferrals').textContent = referralData.length
        }

        // Load commission data
        const { data: commissionData, error: commissionError } = await supabase
            .from('earnings')
            .select('amount_microusd')
            .eq('user_id', JSON.parse(localStorage.getItem('cryptra_user')).id)
            .eq('source', 'referral_commission')

        if (!commissionError) {
            const totalCommission = commissionData.reduce((sum, earning) => sum + earning.amount_microusd, 0)
            document.getElementById('totalCommission').textContent = '$' + formatMicrodollars(totalCommission)
        }

        // Load recent winners
        await loadWinners()

        // Load recent activity
        await loadRecentActivity()

    } catch (error) {
        console.error('Error loading dashboard:', error)
    }
}

async function loadWinners() {
    try {
        const { data: winners, error } = await supabase
            .from('lucky_draw_results')
            .select('winners')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (error) throw error

        const winnersList = document.getElementById('winnersList')
        if (winners && winners.winners) {
            winners.winners.slice(0, 3).forEach(winner => {
                const winnerItem = document.createElement('div')
                winnerItem.className = 'winner-item'
                winnerItem.innerHTML = `
                    <div class="winner-info">
                        <div class="winner-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="winner-name">User ${winner.user_id.substring(0, 8)}</div>
                    </div>
                    <div class="winner-prize">$${formatMicrodollars(winner.prize_microusd)}</div>
                `
                winnersList.appendChild(winnerItem)
            })
        } else {
            winnersList.innerHTML = '<div class="winner-item">No winners yet today</div>'
        }
    } catch (error) {
        console.error('Error loading winners:', error)
    }
}

async function loadRecentActivity() {
    try {
        const { data: activities, error } = await supabase
            .from('earnings')
            .select('source, amount_microusd, created_at')
            .eq('user_id', JSON.parse(localStorage.getItem('cryptra_user')).id)
            .order('created_at', { ascending: false })
            .limit(5)

        if (error) throw error

        const activityList = document.getElementById('recentActivity')
        activityList.innerHTML = ''

        activities.forEach(activity => {
            const activityItem = document.createElement('div')
            activityItem.className = 'activity-item'
            
            const iconMap = {
                'signup_bonus': 'user-plus',
                'referral_bonus': 'users',
                'watch_ad': 'play-circle',
                'scratch': 'scroll',
                'treasure': 'gem',
                'daily_checkin': 'check-circle',
                'referral_commission': 'money-bill-wave'
            }

            activityItem.innerHTML = `
                <div class="activity-info">
                    <div class="activity-icon">
                        <i class="fas fa-${iconMap[activity.source] || 'dollar-sign'}"></i>
                    </div>
                    <div class="activity-details">
                        <h4>${formatSourceName(activity.source)}</h4>
                        <p>${new Date(activity.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="activity-amount positive">+$${formatMicrodollars(activity.amount_microusd)}</div>
            `
            activityList.appendChild(activityItem)
        })
    } catch (error) {
        console.error('Error loading activities:', error)
    }
}

function formatSourceName(source) {
    const names = {
        'signup_bonus': 'Signup Bonus',
        'referral_bonus': 'Referral Bonus',
        'watch_ad': 'Watch Ad',
        'scratch': 'Scratch Card',
        'treasure': 'Treasure Box',
        'daily_checkin': 'Daily Check-in',
        'referral_commission': 'Referral Commission'
    }
    return names[source] || source
}

function setupEventListeners() {
    // Daily check-in
    document.getElementById('checkinBtn').addEventListener('click', handleDailyCheckin)

    // Notification dropdown
    const notificationIcon = document.querySelector('.notification-icon')
    const notificationDropdown = document.querySelector('.notification-dropdown')
    
    notificationIcon.addEventListener('click', function(e) {
        e.stopPropagation()
        notificationDropdown.classList.toggle('active')
    })

    document.addEventListener('click', function() {
        notificationDropdown.classList.remove('active')
    })
}

async function handleDailyCheckin() {
    const checkinBtn = document.getElementById('checkinBtn')
    const originalText = checkinBtn.textContent
    
    checkinBtn.innerHTML = '<div class="loading"></div>'
    checkinBtn.disabled = true

    try {
        const user = JSON.parse(localStorage.getItem('cryptra_user'))
        const today = new Date().toISOString().split('T')[0]

        // Check if already checked in today
        const { data: existingCheckin, error: checkError } = await supabase
            .from('daily_checkins')
            .select('id')
            .eq('user_id', user.id)
            .eq('checkin_date', today)
            .single()

        if (existingCheckin) {
            alert('You have already checked in today!')
            checkinBtn.textContent = 'Already Checked In'
            checkinBtn.disabled = true
            checkinBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
            return
        }

        // Generate random reward between $0.001 - $0.005 (with 10% chance of $0)
        let reward = 0
        if (Math.random() > 0.1) { // 90% chance of getting reward
            reward = getRandomReward(0.001, 0.005)
        }

        // Create checkin record
        const { error: checkinError } = await supabase
            .from('daily_checkins')
            .insert([{
                user_id: user.id,
                checkin_date: today,
                reward_microusd: reward,
                created_at: new Date().toISOString()
            }])

        if (checkinError) throw checkinError

        // Update user streak and balance
        const { data: userData } = await supabase
            .from('users')
            .select('streak_days, last_checkin_date')
            .eq('id', user.id)
            .single()

        let newStreak = 1
        if (userData.last_checkin_date) {
            const lastCheckin = new Date(userData.last_checkin_date)
            const yesterday = new Date()
            yesterday.setDate(yesterday.getDate() - 1)
            
            if (lastCheckin.toDateString() === yesterday.toDateString()) {
                newStreak = (userData.streak_days || 0) + 1
            }
        }

        // Update user
        await supabase
            .from('users')
            .update({
                last_checkin_date: today,
                streak_days: newStreak,
                balance_microusd: supabase.raw('balance_microusd + ?', [reward]),
                total_earnings_microusd: supabase.raw('total_earnings_microusd + ?', [reward])
            })
            .eq('id', user.id)

        // Create earning record
        await supabase
            .from('earnings')
            .insert([{
                user_id: user.id,
                source: 'daily_checkin',
                amount_microusd: reward,
                created_at: new Date().toISOString()
            }])

        // Update UI
        document.getElementById('streakDays').textContent = newStreak
        document.getElementById('userBalance').textContent = '$' + formatMicrodollars(userData.balance_microusd + reward)
        
        checkinBtn.textContent = 'Already Checked In'
        checkinBtn.disabled = true
        checkinBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'

        if (reward > 0) {
            alert(`Daily check-in successful! You earned $${formatMicrodollars(reward)}`)
        } else {
            alert('Daily check-in completed! Better luck tomorrow.')
        }

        // Reload activities
        await loadRecentActivity()

    } catch (error) {
        console.error('Error during check-in:', error)
        alert('Check-in failed: ' + error.message)
        checkinBtn.textContent = originalText
        checkinBtn.disabled = false
    }
}
