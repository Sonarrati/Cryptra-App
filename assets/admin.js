import { supabase, requireAuth, formatMicrodollars, toMicrodollars } from './supabaseClient.js'

document.addEventListener('DOMContentLoaded', async function() {
    // Basic admin authentication check
    const user = JSON.parse(localStorage.getItem('cryptra_user'))
    if (!user) {
        window.location.href = 'index.html'
        return
    }

    // In a real app, you'd check if user is admin
    // For demo, we'll assume user is admin

    await loadAdminData()
    setupEventListeners()
})

async function loadAdminData() {
    await loadDashboardStats()
    await loadTasks()
    await loadProducts()
    await loadPendingWithdrawals()
    await loadSettings()
}

async function loadDashboardStats() {
    try {
        // Total users
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id', { count: 'exact' })

        if (!usersError) {
            document.getElementById('totalUsers').textContent = users.length
        }

        // Platform earnings (from lucky draw cuts, etc.)
        const { data: earnings, error: earningsError } = await supabase
            .from('lucky_draw_results')
            .select('platform_cut_microusd')

        if (!earningsError) {
            const totalEarnings = earnings.reduce((sum, result) => sum + result.platform_cut_microusd, 0)
            document.getElementById('totalEarnings').textContent = '$' + formatMicrodollars(totalEarnings)
        }

        // Pending withdrawals
        const { data: withdrawals, error: withdrawError } = await supabase
            .from('withdrawals')
            .select('id')
            .eq('status', 'requested')

        if (!withdrawError) {
            document.getElementById('pendingWithdrawals').textContent = withdrawals.length
        }

    } catch (error) {
        console.error('Error loading admin stats:', error)
    }
}

async function loadTasks() {
    try {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error

        const tasksList = document.getElementById('adminTasksList')
        tasksList.innerHTML = ''

        tasks.forEach(task => {
            const taskItem = document.createElement('div')
            taskItem.className = 'admin-task-item'
            taskItem.innerHTML = `
                <div class="task-info">
                    <h4>${task.title}</h4>
                    <p>${task.description}</p>
                    <div class="task-meta">
                        <span>Reward: $${formatMicrodollars(task.reward_microusd)}</span>
                        <span class="status ${task.is_active ? 'active' : 'inactive'}">
                            ${task.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn btn-outline edit-task" data-task-id="${task.id}">
                        Edit
                    </button>
                    <button class="btn btn-danger delete-task" data-task-id="${task.id}">
                        Delete
                    </button>
                </div>
            `
            tasksList.appendChild(taskItem)
        })

        // Add event listeners
        document.querySelectorAll('.edit-task').forEach(btn => {
            btn.addEventListener('click', editTask)
        })

        document.querySelectorAll('.delete-task').forEach(btn => {
            btn.addEventListener('click', deleteTask)
        })

    } catch (error) {
        console.error('Error loading tasks:', error)
    }
}

async function loadProducts() {
    try {
        const { data: products, error } = await supabase
            .from('marketplace_items')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error

        const productsList = document.getElementById('adminProductsList')
        productsList.innerHTML = ''

        products.forEach(product => {
            const productItem = document.createElement('div')
            productItem.className = 'admin-product-item'
            productItem.innerHTML = `
                <div class="product-image">
                    <i class="fas fa-${product.type === 'physical' ? 'box' : 'download'}"></i>
                </div>
                <div class="product-info">
                    <h4>${product.title}</h4>
                    <p>${product.description}</p>
                    <div class="product-meta">
                        <span>Price: $${formatMicrodollars(product.price_microusd)}</span>
                        <span>Stock: ${product.stock}</span>
                        <span class="status ${product.active ? 'active' : 'inactive'}">
                            ${product.active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>
                <div class="product-actions">
                    <button class="btn btn-outline edit-product" data-product-id="${product.id}">
                        Edit
                    </button>
                    <button class="btn btn-danger delete-product" data-product-id="${product.id}">
                        Delete
                    </button>
                </div>
            `
            productsList.appendChild(productItem)
        })

        // Add event listeners
        document.querySelectorAll('.edit-product').forEach(btn => {
            btn.addEventListener('click', editProduct)
        })

        document.querySelectorAll('.delete-product').forEach(btn => {
            btn.addEventListener('click', deleteProduct)
        })

    } catch (error) {
        console.error('Error loading products:', error)
    }
}

async function loadPendingWithdrawals() {
    try {
        const { data: withdrawals, error } = await supabase
            .from('withdrawals')
            .select(`
                *,
                users:user_id (display_name, email)
            `)
            .eq('status', 'requested')
            .order('created_at', { ascending: true })

        if (error) throw error

        const withdrawalsList = document.getElementById('pendingWithdrawalsList')
        withdrawalsList.innerHTML = ''

        if (withdrawals.length === 0) {
            withdrawalsList.innerHTML = '<div class="no-withdrawals">No pending withdrawals</div>'
            return
        }

        withdrawals.forEach(withdrawal => {
            const withdrawItem = document.createElement('div')
            withdrawItem.className = 'withdrawal-item'
            withdrawItem.innerHTML = `
                <div class="withdrawal-info">
                    <h4>${withdrawal.users.display_name || 'User'} (${withdrawal.users.email})</h4>
                    <p>Amount: $${formatMicrodollars(withdrawal.amount_microusd)}</p>
                    <p>Method: ${withdrawal.method.toUpperCase()}</p>
                    <p>Date: ${new Date(withdrawal.created_at).toLocaleDateString()}</p>
                </div>
                <div class="withdrawal-actions">
                    <button class="btn btn-primary approve-withdrawal" data-withdrawal-id="${withdrawal.id}">
                        Approve
                    </button>
                    <button class="btn btn-danger reject-withdrawal" data-withdrawal-id="${withdrawal.id}">
                        Reject
                    </button>
                </div>
            `
            withdrawalsList.appendChild(withdrawItem)
        })

        // Add event listeners
        document.querySelectorAll('.approve-withdrawal').forEach(btn => {
            btn.addEventListener('click', approveWithdrawal)
        })

        document.querySelectorAll('.reject-withdrawal').forEach(btn => {
            btn.addEventListener('click', rejectWithdrawal)
        })

    } catch (error) {
        console.error('Error loading withdrawals:', error)
    }
}

async function loadSettings() {
    try {
        const { data: settings, error } = await supabase
            .from('admin_settings')
            .select('settings')
            .eq('id', 1)
            .single()

        if (error) throw error

        document.getElementById('signupBonus').value = formatMicrodollars(settings.settings.signup_bonus_microusd)
        document.getElementById('referralBonus').value = formatMicrodollars(settings.settings.referral_bonus_microusd)
        document.getElementById('withdrawMin').value = formatMicrodollars(settings.settings.withdraw_min_microusd)
        document.getElementById('withdrawMax').value = formatMicrodollars(settings.settings.withdraw_max_microusd)

    } catch (error) {
        console.error('Error loading settings:', error)
    }
}

function setupEventListeners() {
    // Tab switching
    const tabBtns = document.querySelectorAll('.tab-btn')
    const tabContents = document.querySelectorAll('.admin-tab-content')
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab')
            
            // Update active tab
            tabBtns.forEach(b => b.classList.remove('active'))
            this.classList.add('active')
            
            // Show corresponding content
            tabContents.forEach(content => {
                content.classList.remove('active')
                if (content.id === `${tab}Tab`) {
                    content.classList.add('active')
                }
            })
        })
    })

    // Add task button
    document.getElementById('addTaskBtn').addEventListener('click', addNewTask)

    // Add product button
    document.getElementById('addProductBtn').addEventListener('click', addNewProduct)

    // Settings form
    document.getElementById('adminSettingsForm').addEventListener('submit', saveSettings)

    // Logout
    document.getElementById('adminLogout').addEventListener('click', logout)
}

function addNewTask() {
    // Implement task creation modal/form
    alert('Add new task feature coming soon!')
}

function addNewProduct() {
    // Implement product creation modal/form
    alert('Add new product feature coming soon!')
}

async function editTask(e) {
    const taskId = e.target.getAttribute('data-task-id')
    // Implement task editing
    alert(`Edit task ${taskId} - feature coming soon!`)
}

async function deleteTask(e) {
    const taskId = e.target.getAttribute('data-task-id')
    
    if (confirm('Are you sure you want to delete this task?')) {
        try {
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', taskId)

            if (error) throw error

            alert('Task deleted successfully!')
            await loadTasks()

        } catch (error) {
            console.error('Error deleting task:', error)
            alert('Failed to delete task: ' + error.message)
        }
    }
}

async function editProduct(e) {
    const productId = e.target.getAttribute('data-product-id')
    // Implement product editing
    alert(`Edit product ${productId} - feature coming soon!`)
}

async function deleteProduct(e) {
    const productId = e.target.getAttribute('data-product-id')
    
    if (confirm('Are you sure you want to delete this product?')) {
        try {
            const { error } = await supabase
                .from('marketplace_items')
                .delete()
                .eq('id', productId)

            if (error) throw error

            alert('Product deleted successfully!')
            await loadProducts()

        } catch (error) {
            console.error('Error deleting product:', error)
            alert('Failed to delete product: ' + error.message)
        }
    }
}

async function approveWithdrawal(e) {
    const withdrawalId = e.target.getAttribute('data-withdrawal-id')
    
    try {
        const { error } = await supabase
            .from('withdrawals')
            .update({
                status: 'processed',
                processed_at: new Date().toISOString()
            })
            .eq('id', withdrawalId)

        if (error) throw error

        alert('Withdrawal approved successfully!')
        await loadPendingWithdrawals()
        await loadDashboardStats()

    } catch (error) {
        console.error('Error approving withdrawal:', error)
        alert('Failed to approve withdrawal: ' + error.message)
    }
}

async function rejectWithdrawal(e) {
    const withdrawalId = e.target.getAttribute('data-withdrawal-id')
    
    try {
        // Get withdrawal details to refund user
        const { data: withdrawal, error: withdrawError } = await supabase
            .from('withdrawals')
            .select('user_id, amount_microusd')
            .eq('id', withdrawalId)
            .single()

        if (withdrawError) throw withdrawError

        // Refund user balance
        await supabase
            .from('users')
            .update({
                balance_microusd: supabase.raw('balance_microusd + ?', [withdrawal.amount_microusd])
            })
            .eq('id', withdrawal.user_id)

        // Update withdrawal status
        await supabase
            .from('withdrawals')
            .update({
                status: 'rejected',
                processed_at: new Date().toISOString()
            })
            .eq('id', withdrawalId)

        alert('Withdrawal rejected and amount refunded!')
        await loadPendingWithdrawals()
        await loadDashboardStats()

    } catch (error) {
        console.error('Error rejecting withdrawal:', error)
        alert('Failed to reject withdrawal: ' + error.message)
    }
}

async function saveSettings(e) {
    e.preventDefault()
    
    const submitBtn = e.target.querySelector('button[type="submit"]')
    const originalText = submitBtn.textContent
    
    submitBtn.innerHTML = '<div class="loading"></div>'
    submitBtn.disabled = true

    try {
        const settings = {
            signup_bonus_microusd: toMicrodollars(parseFloat(document.getElementById('signupBonus').value)),
            referral_bonus_microusd: toMicrodollars(parseFloat(document.getElementById('referralBonus').value)),
            withdraw_min_microusd: toMicrodollars(parseFloat(document.getElementById('withdrawMin').value)),
            withdraw_max_microusd: toMicrodollars(parseFloat(document.getElementById('withdrawMax').value))
        }

        const { error } = await supabase
            .from('admin_settings')
            .update({ settings: settings })
            .eq('id', 1)

        if (error) throw error

        alert('Settings saved successfully!')

        submitBtn.textContent = originalText
        submitBtn.disabled = false

    } catch (error) {
        console.error('Error saving settings:', error)
        alert('Failed to save settings: ' + error.message)
        submitBtn.textContent = originalText
        submitBtn.disabled = false
    }
}

function logout() {
    localStorage.removeItem('cryptra_user')
    window.location.href = 'index.html'
}
