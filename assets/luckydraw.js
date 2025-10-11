import { supabase, requireAuth, formatMicrodollars, toMicrodollars } from './supabaseClient.js'

document.addEventListener('DOMContentLoaded', async function() {
    const user = requireAuth()
    if (!user) return

    await loadLuckyDrawData()
    setupEventListeners()
})

async function loadLuckyDrawData() {
    await loadCurrentDraw()
    await loadWinners()
    await loadUserEntries()
}

async function loadCurrentDraw() {
    try {
        const today = new Date().toISOString().split('T')[0]
        
        const { data: draw, error } = await supabase
            .from('lucky_draw_entries')
            .select('coins_spent, entry_count')
            .eq('user_id', JSON.parse(localStorage.getItem('cryptra_user')).id)
            .eq('draw_date', today)
            .single()

        if (!error && draw) {
            document.getElementById('userEntries').textContent = draw.entry_count
            document.getElementById('userCoins').textContent = draw.coins_spent
        }

        // Load pool size
        const { data: poolData, error: poolError } = await supabase
            .from('lucky_draw_entries')
            .select('coins_spent')
            .eq('draw_date', today)

        if (!poolError) {
            const totalPool = poolData.reduce((sum, entry) => sum + entry.coins_spent, 0)
            document.getElementById('currentPool').textContent = formatMicrodollars(totalPool)
        }

    } catch (error) {
        console.error('Error loading draw data:', error)
    }
}

async function loadWinners() {
    try {
        const { data: results, error } = await supabase
            .from('lucky_draw_results')
            .select('draw_date, winners, total_pool_microusd')
            .order('draw_date', { ascending: false })
            .limit(5)

        if (error) throw error

        const winnersList = document.getElementById('winnersHistory')
        winnersList.innerHTML = ''

        results.forEach(result => {
            const resultItem = document.createElement('div')
            resultItem.className = 'winner-item'
            
            const topWinner = result.winners[0]
            resultItem.innerHTML = `
                <div class="winner-info">
                    <div class="winner-avatar">
                        <i class="fas fa-crown"></i>
                    </div>
                    <div class="winner-details">
                        <h4>${result.draw_date}</h4>
                        <p>Pool: $${formatMicrodollars(result.total_pool_microusd)}</p>
                    </div>
                </div>
                <div class="winner-prize">$${formatMicrodollars(topWinner.prize_microusd)}</div>
            `
            winnersList.appendChild(resultItem)
        })

    } catch (error) {
        console.error('Error loading winners:', error)
    }
}

async function loadUserEntries() {
    try {
        const { data: entries, error } = await supabase
            .from('lucky_draw_entries')
            .select('draw_date, coins_spent, entry_count')
            .eq('user_id', JSON.parse(localStorage.getItem('cryptra_user')).id)
            .order('draw_date', { ascending: false })
            .limit(10)

        if (error) throw error

        const entriesList = document.getElementById('userEntriesList')
        entriesList.innerHTML = ''

        entries.forEach(entry => {
            const entryItem = document.createElement('div')
            entryItem.className = 'entry-item'
            entryItem.innerHTML = `
                <div class="entry-date">${entry.draw_date}</div>
                <div class="entry-details">
                    <span>${entry.entry_count} entries</span>
                    <span class="entry-cost">${entry.coins_spent} coins</span>
                </div>
            `
            entriesList.appendChild(entryItem)
        })

    } catch (error) {
        console.error('Error loading user entries:', error)
    }
}

function setupEventListeners() {
    document.getElementById('enterDrawBtn').addEventListener('click', enterLuckyDraw)
    
    // Coin selection
    const coinOptions = document.querySelectorAll('.coin-option')
    coinOptions.forEach(option => {
        option.addEventListener('click', function() {
            coinOptions.forEach(opt => opt.classList.remove('selected'))
            this.classList.add('selected')
        })
    })
}

async function enterLuckyDraw() {
    const enterBtn = document.getElementById('enterDrawBtn')
    const originalText = enterBtn.textContent
    
    enterBtn.innerHTML = '<div class="loading"></div>'
    enterBtn.disabled = true

    try {
        const user = JSON.parse(localStorage.getItem('cryptra_user'))
        const today = new Date().toISOString().split('T')[0]
        const selectedCoin = document.querySelector('.coin-option.selected')
        
        if (!selectedCoin) {
            alert('Please select coin amount')
            enterBtn.textContent = originalText
            enterBtn.disabled = false
            return
        }

        const coins = parseInt(selectedCoin.getAttribute('data-coins'))
        const coinsValue = toMicrodollars(coins * 0.001) // Each coin = $0.001

        // Check user balance
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('balance_microusd')
            .eq('id', user.id)
            .single()

        if (userError) throw userError

        if (userData.balance_microusd < coinsValue) {
            alert('Insufficient balance!')
            enterBtn.textContent = originalText
            enterBtn.disabled = false
            return
        }

        // Check if user already entered today
        const { data: existingEntry, error: entryError } = await supabase
            .from('lucky_draw_entries')
            .select('id, entry_count, coins_spent')
            .eq('user_id', user.id)
            .eq('draw_date', today)
            .single()

        if (existingEntry) {
            // Update existing entry
            await supabase
                .from('lucky_draw_entries')
                .update({
                    entry_count: existingEntry.entry_count + 1,
                    coins_spent: existingEntry.coins_spent + coinsValue
                })
                .eq('id', existingEntry.id)
        } else {
            // Create new entry
            await supabase
                .from('lucky_draw_entries')
                .insert([{
                    user_id: user.id,
                    draw_date: today,
                    coins_spent: coinsValue,
                    entry_count: 1,
                    created_at: new Date().toISOString()
                }])
        }

        // Deduct from user balance
        await supabase
            .from('users')
            .update({
                balance_microusd: supabase.raw('balance_microusd - ?', [coinsValue])
            })
            .eq('id', user.id)

        // Create earning record for deduction
        await supabase
            .from('earnings')
            .insert([{
                user_id: user.id,
                source: 'lucky_draw_entry',
                amount_microusd: -coinsValue,
                created_at: new Date().toISOString()
            }])

        // Reload data
        await loadCurrentDraw()
        await loadUserEntries()

        alert(`Successfully entered lucky draw with ${coins} coins!`)

        enterBtn.textContent = originalText
        enterBtn.disabled = false

    } catch (error) {
        console.error('Error entering draw:', error)
        alert('Failed to enter draw: ' + error.message)
        enterBtn.textContent = originalText
        enterBtn.disabled = false
    }
}
