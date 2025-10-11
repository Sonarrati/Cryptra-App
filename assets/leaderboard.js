import { supabase, requireAuth, formatMicrodollars } from './supabaseClient.js'

document.addEventListener('DOMContentLoaded', async function() {
    const user = requireAuth()
    if (!user) return

    await loadLeaderboard('daily')
    setupEventListeners()
})

function setupEventListeners() {
    // Tab switching
    const tabBtns = document.querySelectorAll('.tab-btn')
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const period = this.getAttribute('data-period')
            
            tabBtns.forEach(b => b.classList.remove('active'))
            this.classList.add('active')
            
            loadLeaderboard(period)
        })
    })
}

async function loadLeaderboard(period) {
    try {
        let query = supabase
            .from('users')
            .select('id, display_name, total_earnings_microusd')
            .order('total_earnings_microusd', { ascending: false })
            .limit(100)

        // For daily/weekly leaderboards, we'd need to filter by date
        // This is a simplified version using total earnings
        const { data: users, error } = await query

        if (error) throw error

        const leaderboardList = document.getElementById('leaderboardList')
        leaderboardList.innerHTML = ''

        users.forEach((user, index) => {
            const rank = index + 1
            const rankClass = rank <= 3 ? `rank-${rank}` : ''

            const leaderItem = document.createElement('div')
            leaderItem.className = `leader-item ${rankClass}`
            leaderItem.innerHTML = `
                <div class="leader-rank">
                    ${rank <= 3 ? '<i class="fas fa-trophy"></i>' : rank}
                </div>
                <div class="leader-info">
                    <div class="leader-name">${user.display_name || 'Anonymous'}</div>
                    <div class="leader-earnings">$${formatMicrodollars(user.total_earnings_microusd)}</div>
                </div>
            `
            leaderboardList.appendChild(leaderItem)
        })

    } catch (error) {
        console.error('Error loading leaderboard:', error)
    }
}
