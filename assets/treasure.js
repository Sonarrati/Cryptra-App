import { supabase, requireAuth, formatMicrodollars, toMicrodollars, getRandomReward } from './supabaseClient.js'

document.addEventListener('DOMContentLoaded', async function() {
    const user = requireAuth()
    if (!user) return

    await loadTreasureData()
    setupEventListeners()
})

async function loadTreasureData() {
    try {
        const user = JSON.parse(localStorage.getItem('cryptra_user'))
        const today = new Date().toISOString().split('T')[0]

        // Check if treasure already opened today
        const { data: treasureData, error } = await supabase
            .from('treasure_attempts')
            .select('used, reward_microusd')
            .eq('user_id', user.id)
            .eq('treasure_date', today)
            .single()

        const treasureBtn = document.getElementById('treasureBtn')
        
        if (treasureData && treasureData.used) {
            treasureBtn.textContent = 'Already Opened Today'
            treasureBtn.disabled = true
            treasureBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
            
            // Show the reward if already opened
            document.getElementById('treasureReward').innerHTML = `
                <div class="prize-reveal">
                    <i class="fas fa-gem"></i>
                    <h3>Today's Treasure</h3>
                    <div class="prize-amount">$${formatMicrodollars(treasureData.reward_microusd)}</div>
                </div>
            `
        }

    } catch (error) {
        console.error('Error loading treasure data:', error)
    }
}

function setupEventListeners() {
    document.getElementById('treasureBtn').addEventListener('click', openTreasure)
}

async function openTreasure() {
    const treasureBtn = document.getElementById('treasureBtn')
    const originalText = treasureBtn.textContent
    
    treasureBtn.innerHTML = '<div class="loading"></div>'
    treasureBtn.disabled = true

    try {
        const user = JSON.parse(localStorage.getItem('cryptra_user'))
        const today = new Date().toISOString().split('T')[0]

        // Check if already opened today
        const { data: existingTreasure, error: checkError } = await supabase
            .from('treasure_attempts')
            .select('id')
            .eq('user_id', user.id)
            .eq('treasure_date', today)
            .single()

        if (existingTreasure) {
            alert('You have already opened the treasure today!')
            treasureBtn.textContent = 'Already Opened Today'
            treasureBtn.disabled = true
            treasureBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
            return
        }

        // Generate random reward between $0.004 - $0.007
        const reward = getRandomReward(0.004, 0.007)

        // Create treasure record
        const { error: treasureError } = await supabase
            .from('treasure_attempts')
            .insert([{
                user_id: user.id,
                treasure_date: today,
                used: true,
                reward_microusd: reward,
                created_at: new Date().toISOString()
            }])

        if (treasureError) throw treasureError

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
                source: 'treasure',
                amount_microusd: reward,
                created_at: new Date().toISOString()
            }])

        // Show reward
        document.getElementById('treasureReward').innerHTML = `
            <div class="prize-reveal">
                <i class="fas fa-gem"></i>
                <h3>Congratulations!</h3>
                <div class="prize-amount">$${formatMicrodollars(reward)}</div>
                <p>Added to your balance</p>
            </div>
        `

        treasureBtn.textContent = 'Already Opened Today'
        treasureBtn.disabled = true
        treasureBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'

        alert(`Treasure opened! You found $${formatMicrodollars(reward)}`)

    } catch (error) {
        console.error('Error opening treasure:', error)
        alert('Failed to open treasure: ' + error.message)
        treasureBtn.textContent = originalText
        treasureBtn.disabled = false
    }
}
