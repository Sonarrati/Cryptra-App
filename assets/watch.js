import { supabase, requireAuth, formatMicrodollars, toMicrodollars, getRandomReward } from './supabaseClient.js'

document.addEventListener('DOMContentLoaded', async function() {
    const user = requireAuth()
    if (!user) return

    await loadWatchData()
    setupEventListeners()
})

async function loadWatchData() {
    await loadTodayStats()
    await loadWatchEarnings()
}

async function loadTodayStats() {
    try {
        const user = JSON.parse(localStorage.getItem('cryptra_user'))
        const today = new Date().toISOString().split('T')[0]

        const { data: watchData, error } = await supabase
            .from('watch_ad_attempts')
            .select('count, total_earned_microusd')
            .eq('user_id', user.id)
            .eq('ad_date', today)
            .single()

        if (error && error.code !== 'PGRST116') {
            throw error
        }

        const count = watchData ? watchData.count : 0
        const earnings = watchData ? watchData.total_earned_microusd : 0

        document.getElementById('todayWatches').textContent = `${count}/20`
        document.getElementById('todayEarnings').textContent = '$' + formatMicrodollars(earnings)

        // Disable button if reached daily limit
        if (count >= 20) {
            document.getElementById('watchAdBtn').textContent = 'Daily Limit Reached'
            document.getElementById('watchAdBtn').disabled = true
        }

    } catch (error) {
        console.error('Error loading watch stats:', error)
    }
}

async function loadWatchEarnings() {
    try {
        const user = JSON.parse(localStorage.getItem('cryptra_user'))

        const { data: earnings, error } = await supabase
            .from('earnings')
            .select('amount_microusd, created_at')
            .eq('user_id', user.id)
            .eq('source', 'watch_ad')
            .order('created_at', { ascending: false })
            .limit(10)

        if (error) throw error

        const earningsList = document.getElementById('watchEarnings')
        earningsList.innerHTML = ''

        if (earnings.length === 0) {
            earningsList.innerHTML = '<div class="no-earnings">No earnings from ads yet</div>'
            return
        }

        earnings.forEach(earning => {
            const earningItem = document.createElement('div')
            earningItem.className = 'activity-item'
            earningItem.innerHTML = `
                <div class="activity-info">
                    <div class="activity-icon">
                        <i class="fas fa-play-circle"></i>
                    </div>
                    <div class="activity-details">
                        <h4>Watch Ad</h4>
                        <p>${new Date(earning.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="activity-amount positive">+$${formatMicrodollars(earning.amount_microusd)}</div>
            `
            earningsList.appendChild(earningItem)
        })

    } catch (error) {
        console.error('Error loading watch earnings:', error)
    }
}

function setupEventListeners() {
    document.getElementById('watchAdBtn').addEventListener('click', startWatchingAd)
}

async function startWatchingAd() {
    const watchBtn = document.getElementById('watchAdBtn')
    const adTimer = document.getElementById('adTimer')
    const timerCount = document.getElementById('timerCount')

    watchBtn.disabled = true
    watchBtn.textContent = 'Preparing Ad...'

    // Simulate ad loading
    setTimeout(() => {
        watchBtn.style.display = 'none'
        adTimer.style.display = 'block'

        let count = 30
        timerCount.textContent = count

        const timer = setInterval(() => {
            count--
            timerCount.textContent = count

            if (count <= 0) {
                clearInterval(timer)
                completeAdWatch()
            }
        }, 1000)
    }, 2000)
}

async function completeAdWatch() {
    try {
        const user = JSON.parse(localStorage.getItem('cryptra_user'))
        const today = new Date().toISOString().split('T')[0]

        // Check daily limit
        const { data: watchData, error: checkError } = await supabase
            .from('watch_ad_attempts')
            .select('count, total_earned_microusd')
            .eq('user_id', user.id)
            .eq('ad_date', today)
            .single()

        if (checkError && checkError.code !== 'PGRST116') {
            throw checkError
        }

        const currentCount = watchData ? watchData.count : 0
        const currentEarnings = watchData ? watchData.total_earned_microusd : 0

        if (currentCount >= 20) {
            alert('Daily limit reached! Come back tomorrow.')
            resetAdUI()
            return
        }

        // Generate random reward between $0.001 - $0.004
        const reward = getRandomReward(0.001, 0.004)

        // Update or create watch attempt record
        if (watchData) {
            await supabase
                .from('watch_ad_attempts')
                .update({
                    count: currentCount + 1,
                    total_earned_microusd: currentEarnings + reward
                })
                .eq('user_id', user.id)
                .eq('ad_date', today)
        } else {
            await supabase
                .from('watch_ad_attempts')
                .insert([{
                    user_id: user.id,
                    ad_date: today,
                    count: 1,
                    total_earned_microusd: reward,
                    created_at: new Date().toISOString()
                }])
        }

        // Update user balance
        await supabase
            .from('users')
            .update({
                balance_microusd: supabase.raw('balance_microusd + ?', [reward]),
                total_earnings_microusd: supabase.raw('total_earnings_microusd + ?', [reward])
            })
            .eq('id', user.id)

        // Create earning record
        await supabase
            .from('earnings')
            .insert([{
                user_id: user.id,
                source: 'watch_ad',
                amount_microusd: reward,
                created_at: new Date().toISOString()
            }])

        // Update UI
        await loadTodayStats()
        await loadWatchEarnings()

        alert(`Ad completed! You earned $${formatMicrodollars(reward)}`)

        resetAdUI()

    } catch (error) {
        console.error('Error completing ad watch:', error)
        alert('Failed to complete ad: ' + error.message)
        resetAdUI()
    }
}

function resetAdUI() {
    const watchBtn = document.getElementById('watchAdBtn')
    const adTimer = document.getElementById('adTimer')

    adTimer.style.display = 'none'
    watchBtn.style.display = 'block'
    watchBtn.disabled = false
    watchBtn.textContent = 'Start Watching Ad'
}
