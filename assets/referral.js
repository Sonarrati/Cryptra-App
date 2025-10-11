import { supabase, requireAuth, formatMicrodollars } from './supabaseClient.js'

document.addEventListener('DOMContentLoaded', async function() {
    const user = requireAuth()
    if (!user) return

    await loadReferralData()
    setupEventListeners()
})

async function loadReferralData() {
    await loadReferralLink()
    await loadReferralStats()
    await loadReferralList()
}

function setupEventListeners() {
    // Copy referral link
    document.getElementById('copyLinkBtn').addEventListener('click', copyReferralLink)
}

async function loadReferralLink() {
    const user = JSON.parse(localStorage.getItem('cryptra_user'))
    const referralLink = `${window.location.origin}?ref=${user.id}`
    document.getElementById('referralLink').value = referralLink
}

async function loadReferralStats() {
    try {
        const user = JSON.parse(localStorage.getItem('cryptra_user'))

        // Total referrals count
        const { data: referrals, error: refError } = await supabase
            .from('referrals')
            .select('referred_user_id')
            .eq('user_id', user.id)

        if (!refError) {
            document.getElementById('totalReferrals').textContent = referrals.length
        }

        // Active referrals (checked in today)
        const today = new Date().toISOString().split('T')[0]
        const { data: activeRefs, error: activeError } = await supabase
            .from('daily_checkins')
            .select('user_id')
            .eq('checkin_date', today)
            .in('user_id', referrals.map(r => r.referred_user_id))

        if (!activeError) {
            document.getElementById('activeReferrals').textContent = activeRefs.length
        }

        // Total commission
        const { data: commissions, error: comError } = await supabase
            .from('earnings')
            .select('amount_microusd')
            .eq('user_id', user.id)
            .eq('source', 'referral_commission')

        if (!comError) {
            const totalCommission = commissions.reduce((sum, earning) => sum + earning.amount_microusd, 0)
            document.getElementById('totalCommission').textContent = '$' + formatMicrodollars(totalCommission)
        }

    } catch (error) {
        console.error('Error loading referral stats:', error)
    }
}

async function loadReferralList() {
    try {
        const user = JSON.parse(localStorage.getItem('cryptra_user'))

        const { data: referrals, error } = await supabase
            .from('referrals')
            .select(`
                referred_user_id,
                users:referred_user_id (
                    display_name,
                    email,
                    created_at
                )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (error) throw error

        const referralList = document.getElementById('referralList')
        referralList.innerHTML = ''

        if (referrals.length === 0) {
            referralList.innerHTML = '<div class="no-referrals">No referrals yet</div>'
            return
        }

        for (const ref of referrals) {
            const refItem = document.createElement('div')
            refItem.className = 'referral-item'

            // Check if active today
            const today = new Date().toISOString().split('T')[0]
            const { data: checkin, error: checkinError } = await supabase
                .from('daily_checkins')
                .select('id')
                .eq('user_id', ref.referred_user_id)
                .eq('checkin_date', today)
                .single()

            const isActive = !checkinError && checkin

            refItem.innerHTML = `
                <div class="referral-info">
                    <div class="referral-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="referral-details">
                        <h4>${ref.users.display_name || 'User'}</h4>
                        <p>Joined: ${new Date(ref.users.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="referral-status ${isActive ? 'active' : 'inactive'}">
                    ${isActive ? 'Active' : 'Inactive'}
                </div>
            `
            referralList.appendChild(refItem)
        }

    } catch (error) {
        console.error('Error loading referral list:', error)
    }
}

function copyReferralLink() {
    const referralLink = document.getElementById('referralLink')
    referralLink.select()
    document.execCommand('copy')
    
    const btn = document.getElementById('copyLinkBtn')
    const originalText = btn.innerHTML
    btn.innerHTML = '<i class="fas fa-check"></i> Copied!'
    btn.disabled = true
    
    setTimeout(() => {
        btn.innerHTML = originalText
        btn.disabled = false
    }, 2000)
}
