import { supabase, requireAuth, formatMicrodollars, toMicrodollars } from './supabaseClient.js'

document.addEventListener('DOMContentLoaded', async function() {
    const user = requireAuth()
    if (!user) return

    await loadWithdrawData()
    setupEventListeners()
})

async function loadWithdrawData() {
    await loadUserBalance()
    await loadWithdrawHistory()
    await loadWithdrawSettings()
}

async function loadUserBalance() {
    try {
        const { data: userData, error } = await supabase
            .from('users')
            .select('balance_microusd')
            .eq('id', JSON.parse(localStorage.getItem('cryptra_user')).id)
            .single()

        if (!error) {
            document.getElementById('userBalance').textContent = '$' + formatMicrodollars(userData.balance_microusd)
        }
    } catch (error) {
        console.error('Error loading user balance:', error)
    }
}

async function loadWithdrawHistory() {
    try {
        const { data: withdrawals, error } = await supabase
            .from('withdrawals')
            .select('*')
            .eq('user_id', JSON.parse(localStorage.getItem('cryptra_user')).id)
            .order('created_at', { ascending: false })
            .limit(10)

        if (error) throw error

        const historyList = document.getElementById('withdrawHistory')
        historyList.innerHTML = ''

        if (withdrawals.length === 0) {
            historyList.innerHTML = '<div class="no-history">No withdrawal history</div>'
            return
        }

        withdrawals.forEach(withdrawal => {
            const historyItem = document.createElement('div')
            historyItem.className = 'history-item'
            historyItem.innerHTML = `
                <div class="history-info">
                    <h4>${withdrawal.method.toUpperCase()} - $${formatMicrodollars(withdrawal.amount_microusd)}</h4>
                    <p>${new Date(withdrawal.created_at).toLocaleDateString()} - ${withdrawal.status}</p>
                </div>
                <div class="history-status ${withdrawal.status}">${withdrawal.status}</div>
            `
            historyList.appendChild(historyItem)
        })

    } catch (error) {
        console.error('Error loading withdraw history:', error)
    }
}

async function loadWithdrawSettings() {
    try {
        const { data: settings, error } = await supabase
            .from('admin_settings')
            .select('settings')
            .eq('id', 1)
            .single()

        if (!error) {
            const min = settings.settings.withdraw_min_microusd
            const max = settings.settings.withdraw_max_microusd
            
            document.getElementById('minAmount').textContent = '$' + formatMicrodollars(min)
            document.getElementById('maxAmount').textContent = '$' + formatMicrodollars(max)
        }
    } catch (error) {
        console.error('Error loading withdraw settings:', error)
    }
}

function setupEventListeners() {
    document.getElementById('withdrawForm').addEventListener('submit', requestWithdrawal)
    
    // Method selection
    const methodOptions = document.querySelectorAll('.method-option')
    methodOptions.forEach(option => {
        option.addEventListener('click', function() {
            methodOptions.forEach(opt => opt.classList.remove('selected'))
            this.classList.add('selected')
            
            const method = this.getAttribute('data-method')
            document.getElementById('withdrawMethod').value = method
            
            // Show appropriate details field
            if (method === 'upi') {
                document.getElementById('upiDetails').style.display = 'block'
                document.getElementById('paypalDetails').style.display = 'none'
            } else {
                document.getElementById('upiDetails').style.display = 'none'
                document.getElementById('paypalDetails').style.display = 'block'
            }
        })
    })
}

async function requestWithdrawal(e) {
    e.preventDefault()
    
    const submitBtn = document.querySelector('#withdrawForm button[type="submit"]')
    const originalText = submitBtn.textContent
    
    submitBtn.innerHTML = '<div class="loading"></div>'
    submitBtn.disabled = true

    try {
        const user = JSON.parse(localStorage.getItem('cryptra_user'))
        const amount = parseFloat(document.getElementById('amount').value)
        const method = document.getElementById('withdrawMethod').value
        
        if (!method) {
            alert('Please select withdrawal method')
            submitBtn.textContent = originalText
            submitBtn.disabled = false
            return
        }

        let details = {}
        if (method === 'upi') {
            const upiId = document.getElementById('upiId').value
            if (!upiId) {
                alert('Please enter UPI ID')
                submitBtn.textContent = originalText
                submitBtn.disabled = false
                return
            }
            details = { upi_id: upiId }
        } else {
            const paypalEmail = document.getElementById('paypalEmail').value
            if (!paypalEmail) {
                alert('Please enter PayPal email')
                submitBtn.textContent = originalText
                submitBtn.disabled = false
                return
            }
            details = { paypal_email: paypalEmail }
        }

        const amountMicro = toMicrodollars(amount)

        // Load settings for validation
        const { data: settings, error: settingsError } = await supabase
            .from('admin_settings')
            .select('settings')
            .eq('id', 1)
            .single()

        if (settingsError) throw settingsError

        const min = settings.settings.withdraw_min_microusd
        const max = settings.settings.withdraw_max_microusd

        // Validate amount
        if (amountMicro < min) {
            alert(`Minimum withdrawal amount is $${formatMicrodollars(min)}`)
            submitBtn.textContent = originalText
            submitBtn.disabled = false
            return
        }

        if (amountMicro > max) {
            alert(`Maximum withdrawal amount is $${formatMicrodollars(max)}`)
            submitBtn.textContent = originalText
            submitBtn.disabled = false
            return
        }

        // Check user balance
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('balance_microusd')
            .eq('id', user.id)
            .single()

        if (userError) throw userError

        if (userData.balance_microusd < amountMicro) {
            alert('Insufficient balance!')
            submitBtn.textContent = originalText
            submitBtn.disabled = false
            return
        }

        // Check if already withdrawn today
        const today = new Date().toISOString().split('T')[0]
        const { data: todayWithdrawals, error: todayError } = await supabase
            .from('withdrawals')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'requested')
            .gte('created_at', today + 'T00:00:00')
            .lte('created_at', today + 'T23:59:59')

        if (!todayError && todayWithdrawals.length > 0) {
            alert('You can only make one withdrawal request per day!')
            submitBtn.textContent = originalText
            submitBtn.disabled = false
            return
        }

        // Create withdrawal request
        const { error: withdrawError } = await supabase
            .from('withdrawals')
            .insert([{
                user_id: user.id,
                amount_microusd: amountMicro,
                method: method,
                details: details,
                status: 'requested',
                created_at: new Date().toISOString()
            }])

        if (withdrawError) throw withdrawError

        alert('Withdrawal request submitted successfully! It will be processed within 24 hours.')

        // Reset form
        document.getElementById('withdrawForm').reset()
        document.querySelectorAll('.method-option').forEach(opt => opt.classList.remove('selected'))
        document.getElementById('withdrawMethod').value = ''
        document.getElementById('upiDetails').style.display = 'none'
        document.getElementById('paypalDetails').style.display = 'none'

        // Reload data
        await loadWithdrawHistory()
        await loadUserBalance()

        submitBtn.textContent = originalText
        submitBtn.disabled = false

    } catch (error) {
        console.error('Error requesting withdrawal:', error)
        alert('Failed to request withdrawal: ' + error.message)
        submitBtn.textContent = originalText
        submitBtn.disabled = false
    }
}
