import { supabase, requireAuth, formatMicrodollars, toMicrodollars, getRandomReward } from './supabaseClient.js'

let canvas, ctx;
let isScratching = false;
let prizeRevealed = false;

document.addEventListener('DOMContentLoaded', async function() {
    const user = requireAuth()
    if (!user) return

    await loadScratchData()
    initScratchCard()
    setupEventListeners()
})

async function loadScratchData() {
    await loadTodayStats()
    await loadScratchEarnings()
}

async function loadTodayStats() {
    try {
        const user = JSON.parse(localStorage.getItem('cryptra_user'))
        const today = new Date().toISOString().split('T')[0]

        const { data: scratchData, error } = await supabase
            .from('scratch_attempts')
            .select('count')
            .eq('user_id', user.id)
            .eq('scratch_date', today)
            .single()

        if (error && error.code !== 'PGRST116') {
            throw error
        }

        const count = scratchData ? scratchData.count : 0

        document.getElementById('todayScratches').textContent = `${count}/3`

        // Disable button if reached daily limit
        if (count >= 3) {
            document.getElementById('scratchBtn').textContent = 'Daily Limit Reached'
            document.getElementById('scratchBtn').disabled = true
        }

    } catch (error) {
        console.error('Error loading scratch stats:', error)
    }
}

async function loadScratchEarnings() {
    try {
        const user = JSON.parse(localStorage.getItem('cryptra_user'))

        const { data: earnings, error } = await supabase
            .from('earnings')
            .select('amount_microusd, created_at')
            .eq('user_id', user.id)
            .eq('source', 'scratch')
            .order('created_at', { ascending: false })
            .limit(10)

        if (error) throw error

        const earningsList = document.getElementById('scratchEarnings')
        earningsList.innerHTML = ''

        if (earnings.length === 0) {
            earningsList.innerHTML = '<div class="no-earnings">No earnings from scratch cards yet</div>'
            return
        }

        earnings.forEach(earning => {
            const earningItem = document.createElement('div')
            earningItem.className = 'activity-item'
            earningItem.innerHTML = `
                <div class="activity-info">
                    <div class="activity-icon">
                        <i class="fas fa-scroll"></i>
                    </div>
                    <div class="activity-details">
                        <h4>Scratch Card</h4>
                        <p>${new Date(earning.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="activity-amount positive">+$${formatMicrodollars(earning.amount_microusd)}</div>
            `
            earningsList.appendChild(earningItem)
        })

    } catch (error) {
        console.error('Error loading scratch earnings:', error)
    }
}

function initScratchCard() {
    canvas = document.getElementById('scratchCanvas')
    ctx = canvas.getContext('2d')

    // Draw the scratch card cover
    drawScratchCover()

    // Set up event listeners for scratching
    canvas.addEventListener('mousedown', startScratching)
    canvas.addEventListener('mousemove', scratch)
    canvas.addEventListener('mouseup', stopScratching)
    canvas.addEventListener('mouseleave', stopScratching)

    // Touch events for mobile
    canvas.addEventListener('touchstart', startScratching)
    canvas.addEventListener('touchmove', scratch)
    canvas.addEventListener('touchend', stopScratching)
}

function drawScratchCover() {
    // Draw a gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#4F46E5')
    gradient.addColorStop(1, '#7C3AED')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw scratch card text
    ctx.fillStyle = 'white'
    ctx.font = 'bold 20px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('SCRATCH HERE', canvas.width / 2, canvas.height / 2)

    ctx.font = '14px Arial'
    ctx.fillText('Use your mouse or finger', canvas.width / 2, canvas.height / 2 + 30)
}

function startScratching(e) {
    if (prizeRevealed) return

    isScratching = true
    scratch(e)
}

function scratch(e) {
    if (!isScratching) return

    const rect = canvas.getBoundingClientRect()
    let x, y

    if (e.type.includes('touch')) {
        x = e.touches[0].clientX - rect.left
        y = e.touches[0].clientY - rect.top
    } else {
        x = e.clientX - rect.left
        y = e.clientY - rect.top
    }

    // Erase the scratched area
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, 20, 0, Math.PI * 2)
    ctx.fill()

    // Check if enough area is scratched to reveal prize
    checkScratchCompletion()
}

function stopScratching() {
    isScratching = false
}

function checkScratchCompletion() {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const pixels = imageData.data
    let transparentCount = 0

    for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] === 0) {
            transparentCount++
        }
    }

    const transparency = transparentCount / (pixels.length / 4)

    if (transparency > 0.4 && !prizeRevealed) {
        prizeRevealed = true
        revealPrize()
    }
}

async function revealPrize() {
    try {
        const user = JSON.parse(localStorage.getItem('cryptra_user'))
        const today = new Date().toISOString().split('T')[0]

        // Check daily limit
        const { data: scratchData, error: checkError } = await supabase
            .from('scratch_attempts')
            .select('count')
            .eq('user_id', user.id)
            .eq('scratch_date', today)
            .single()

        if (checkError && checkError.code !== 'PGRST116') {
            throw checkError
        }

        const currentCount = scratchData ? scratchData.count : 0

        if (currentCount >= 3) {
            alert('Daily limit reached! Come back tomorrow.')
            return
        }

        // Generate random reward between $0.002 - $0.005
        const reward = getRandomReward(0.002, 0.005)

        // Update or create scratch attempt record
        if (scratchData) {
            await supabase
                .from('scratch_attempts')
                .update({
                    count: currentCount + 1
                })
                .eq('user_id', user.id)
                .eq('scratch_date', today)
        } else {
            await supabase
                .from('scratch_attempts')
                .insert([{
                    user_id: user.id,
                    scratch_date: today,
                    count: 1,
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
                source: 'scratch',
                amount_microusd: reward,
                created_at: new Date().toISOString()
            }])

        // Show prize
        document.getElementById('prizeAmount').textContent = '$' + formatMicrodollars(reward)
        document.getElementById('scratchPrize').style.display = 'block'

        // Update UI
        await loadTodayStats()
        await loadScratchEarnings()

        alert(`Congratulations! You won $${formatMicrodollars(reward)}`)

    } catch (error) {
        console.error('Error revealing scratch prize:', error)
        alert('Failed to process scratch card: ' + error.message)
    }
}

function setupEventListeners() {
    document.getElementById('scratchBtn').addEventListener('click', resetScratchCard)
}

function resetScratchCard() {
    if (prizeRevealed) {
        // Reset the canvas
        prizeRevealed = false
        drawScratchCover()
        document.getElementById('scratchPrize').style.display = 'none'
    }
}
