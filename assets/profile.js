import { supabase, requireAuth, formatMicrodollars } from './supabaseClient.js'

document.addEventListener('DOMContentLoaded', async function() {
    const user = requireAuth()
    if (!user) return

    await loadProfileData()
    setupEventListeners()
})

async function loadProfileData() {
    try {
        const user = JSON.parse(localStorage.getItem('cryptra_user'))

        // Load user profile
        const { data: userData, error } = await supabase
            .from('users')
            .select('display_name, email, total_earnings_microusd, balance_microusd')
            .eq('id', user.id)
            .single()

        if (error) throw error

        document.getElementById('userName').textContent = userData.display_name || 'User'
        document.getElementById('userEmail').textContent = userData.email
        document.getElementById('totalEarnings').textContent = '$' + formatMicrodollars(userData.total_earnings_microusd)
        document.getElementById('currentBalance').textContent = '$' + formatMicrodollars(userData.balance_microusd)

        // Load referral count
        const { data: referrals, error: refError } = await supabase
            .from('referrals')
            .select('id')
            .eq('user_id', user.id)

        if (!refError) {
            document.getElementById('totalReferrals').textContent = referrals.length
        }

    } catch (error) {
        console.error('Error loading profile data:', error)
    }
}

function setupEventListeners() {
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout)

    // FAQ and Privacy links
    document.querySelectorAll('.setting-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault()
            const text = this.querySelector('span').textContent
            
            if (text === 'FAQ') {
                showFAQ()
            } else if (text === 'Privacy Policy') {
                showPrivacyPolicy()
            } else if (text === 'Support') {
                showSupport()
            } else if (text === 'Edit Profile') {
                // Implement edit profile
                alert('Edit profile feature coming soon!')
            }
        })
    })
}

function logout() {
    localStorage.removeItem('cryptra_user')
    window.location.href = 'index.html'
}

function showFAQ() {
    const faqContent = `
        <div class="faq-content">
            <h3>Frequently Asked Questions</h3>
            
            <div class="faq-item">
                <h4>How do I earn money?</h4>
                <p>You can earn through daily check-ins, watching ads, scratch cards, treasure boxes, completing tasks, and referral commissions.</p>
            </div>
            
            <div class="faq-item">
                <h4>What is the referral system?</h4>
                <p>You earn 7-level commissions from your referrals. Level 1: 4.5%, Level 2: 2.5%, Level 3: 1.5%, Level 4: 0.8%, Level 5: 0.4%, Level 6: 0.2%, Level 7: 0.05%.</p>
            </div>
            
            <div class="faq-item">
                <h4>When can I withdraw?</h4>
                <p>You can withdraw once per day with minimum $3 and maximum $5.</p>
            </div>
            
            <div class="faq-item">
                <h4>How are daily commissions calculated?</h4>
                <p>Commissions are calculated daily based on your referrals' earnings from the previous day (excluding their referral commissions).</p>
            </div>
        </div>
    `
    
    showModal('FAQ', faqContent)
}

function showPrivacyPolicy() {
    const privacyContent = `
        <div class="privacy-content">
            <h3>Privacy Policy</h3>
            <p>We are committed to protecting your privacy. This policy explains how we collect, use, and protect your personal information.</p>
            
            <h4>Information We Collect</h4>
            <p>We collect information you provide during registration, including your name, email address, and payment details.</p>
            
            <h4>How We Use Your Information</h4>
            <p>We use your information to provide services, process transactions, and improve our platform.</p>
            
            <h4>Data Security</h4>
            <p>We implement security measures to protect your personal information from unauthorized access.</p>
            
            <h4>Contact Us</h4>
            <p>If you have any questions about this privacy policy, please contact us at support@cryptra.com</p>
        </div>
    `
    
    showModal('Privacy Policy', privacyContent)
}

function showSupport() {
    const supportContent = `
        <div class="support-content">
            <h3>Contact Support</h3>
            <p>If you need help, please contact our support team:</p>
            
            <div class="contact-methods">
                <p><i class="fas fa-envelope"></i> Email: support@cryptra.com</p>
                <p><i class="fas fa-clock"></i> Response Time: 24-48 hours</p>
            </div>
            
            <div class="common-issues">
                <h4>Common Issues</h4>
                <ul>
                    <li>Withdrawal processing takes 24 hours</li>
                    <li>Referral commissions are calculated daily at 7:00 AM IST</li>
                    <li>Daily limits reset at midnight IST</li>
                </ul>
            </div>
        </div>
    `
    
    showModal('Support', supportContent)
}

function showModal(title, content) {
    // Create modal overlay
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-content">
                ${content}
            </div>
        </div>
    `
    
    document.body.appendChild(overlay)
    
    // Close modal
    overlay.querySelector('.modal-close').addEventListener('click', () => {
        document.body.removeChild(overlay)
    })
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay)
        }
    })
}
