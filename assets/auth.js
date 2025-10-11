import { supabase, toMicrodollars } from './supabaseClient.js'

document.addEventListener('DOMContentLoaded', function() {
    // Tab switching
    const tabBtns = document.querySelectorAll('.tab-btn')
    const authForms = document.querySelectorAll('.auth-form')
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab')
            
            // Update active tab
            tabBtns.forEach(b => b.classList.remove('active'))
            this.classList.add('active')
            
            // Show corresponding form
            authForms.forEach(form => {
                form.classList.remove('active')
                if (form.id === `${tab}Form`) {
                    form.classList.add('active')
                }
            })
        })
    })
    
    // Login form
    const loginForm = document.getElementById('loginForm')
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault()
        
        const email = document.getElementById('loginEmail').value
        const password = document.getElementById('loginPassword').value
        
        const btn = this.querySelector('button')
        const originalText = btn.innerHTML
        btn.innerHTML = '<div class="loading"></div>'
        btn.disabled = true
        
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            })
            
            if (error) throw error
            
            // Store user data
            localStorage.setItem('cryptra_user', JSON.stringify(data.user))
            window.location.href = 'dashboard.html'
            
        } catch (error) {
            alert('Login failed: ' + error.message)
            btn.innerHTML = originalText
            btn.disabled = false
        }
    })
    
    // Signup form
    const signupForm = document.getElementById('signupForm')
    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault()
        
        const name = document.getElementById('signupName').value
        const email = document.getElementById('signupEmail').value
        const password = document.getElementById('signupPassword').value
        const referralCode = document.getElementById('referralCode').value
        
        const btn = this.querySelector('button')
        const originalText = btn.innerHTML
        btn.innerHTML = '<div class="loading"></div>'
        btn.disabled = true
        
        try {
            // Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: name
                    }
                }
            })
            
            if (authError) throw authError
            
            // Create user profile with signup bonus
            const { data: userData, error: userError } = await supabase
                .from('users')
                .insert([{
                    id: authData.user.id,
                    email: email,
                    display_name: name,
                    balance_microusd: toMicrodollars(0.009), // Signup bonus
                    total_earnings_microusd: toMicrodollars(0.009),
                    created_at: new Date().toISOString()
                }])
                .select()
                .single()
            
            if (userError) throw userError
            
            // Create signup bonus earning record
            await supabase
                .from('earnings')
                .insert([{
                    user_id: authData.user.id,
                    source: 'signup_bonus',
                    amount_microusd: toMicrodollars(0.009),
                    created_at: new Date().toISOString()
                }])
            
            // Handle referral if provided
            if (referralCode) {
                // In a real app, you'd validate the referral code and get referrer_id
                // For demo, we'll assume the code is valid
                const referrerId = referralCode // This should be validated
                
                // Update user with referrer
                await supabase
                    .from('users')
                    .update({ referrer_id: referrerId })
                    .eq('id', authData.user.id)
                
                // Credit referral bonus to referrer
                await supabase
                    .from('earnings')
                    .insert([{
                        user_id: referrerId,
                        source: 'referral_bonus',
                        amount_microusd: toMicrodollars(0.010),
                        related_id: authData.user.id,
                        created_at: new Date().toISOString()
                    }])
                
                // Update referrer's balance
                await supabase
                    .from('users')
                    .update({ 
                        balance_microusd: supabase.raw('balance_microusd + ?', [toMicrodollars(0.010)]),
                        total_earnings_microusd: supabase.raw('total_earnings_microusd + ?', [toMicrodollars(0.010)])
                    })
                    .eq('id', referrerId)
                
                // Create referral record
                await supabase
                    .from('referrals')
                    .insert([{
                        user_id: referrerId,
                        referred_user_id: authData.user.id,
                        created_at: new Date().toISOString()
                    }])
            }
            
            // Store user data and redirect
            localStorage.setItem('cryptra_user', JSON.stringify(authData.user))
            alert('Account created successfully! $0.009 signup bonus credited.')
            window.location.href = 'dashboard.html'
            
        } catch (error) {
            alert('Signup failed: ' + error.message)
            btn.innerHTML = originalText
            btn.disabled = false
        }
    })
})
