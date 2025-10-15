// Authentication functions
const supabaseUrl = 'https://xzwaisyiszdhwmyrnbkh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6d2Fpc3lpc3pkaHdteXJuYmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MjQ2NjMsImV4cCI6MjA3NTUwMDY2M30.gf9vwF44EysfVHJBN_ifmosjIe3kpUn77TcWiaX51sY';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Check authentication status
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

// Get current user
async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

// Sign out function
async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (!error) {
            window.location.href = 'login.html';
        }
        return { error };
    } catch (error) {
        console.error('Sign out error:', error);
        return { error };
    }
}

// Export for use in other files
window.authUtils = {
    supabase,
    checkAuth,
    getCurrentUser,
    signOut
};
