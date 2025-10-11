// Supabase configuration
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const supabaseUrl = 'https://your-project.supabase.co'
const supabaseKey = 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Initialize user session
export async function initializeAuth() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
}

// Check if user is authenticated
export function requireAuth() {
    const user = JSON.parse(localStorage.getItem('cryptra_user'))
    if (!user) {
        window.location.href = 'index.html'
        return false
    }
    return user
}

// Format microdollars to dollars
export function formatMicrodollars(microdollars) {
    return (microdollars / 1000000).toFixed(6)
}

// Convert dollars to microdollars
export function toMicrodollars(dollars) {
    return Math.round(dollars * 1000000)
}

// Generate random reward in range
export function getRandomReward(min, max) {
    return toMicrodollars(Math.random() * (max - min) + min)
}
