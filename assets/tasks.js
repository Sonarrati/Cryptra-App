import { supabase, requireAuth, formatMicrodollars } from './supabaseClient.js'

document.addEventListener('DOMContentLoaded', async function() {
    const user = requireAuth()
    if (!user) return

    await loadTasks()
})

async function loadTasks() {
    try {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })

        if (error) throw error

        const tasksList = document.getElementById('tasksList')
        tasksList.innerHTML = ''

        if (tasks.length === 0) {
            tasksList.innerHTML = '<div class="no-tasks">No tasks available at the moment</div>'
            return
        }

        tasks.forEach(task => {
            const taskItem = document.createElement('div')
            taskItem.className = 'task-item'
            taskItem.innerHTML = `
                <div class="task-info">
                    <h4>${task.title}</h4>
                    <p>${task.description}</p>
                    <div class="task-reward">Reward: $${formatMicrodollars(task.reward_microusd)}</div>
                </div>
                <button class="btn btn-primary complete-task" data-task-id="${task.id}">
                    Complete
                </button>
            `
            tasksList.appendChild(taskItem)
        })

        // Add event listeners to complete buttons
        document.querySelectorAll('.complete-task').forEach(btn => {
            btn.addEventListener('click', completeTask)
        })

    } catch (error) {
        console.error('Error loading tasks:', error)
    }
}

async function completeTask(e) {
    const btn = e.target
    const taskId = btn.getAttribute('data-task-id')
    const originalText = btn.textContent
    
    btn.innerHTML = '<div class="loading"></div>'
    btn.disabled = true

    try {
        const user = JSON.parse(localStorage.getItem('cryptra_user'))

        // Check if task already completed
        const { data: existing, error: checkError } = await supabase
            .from('earnings')
            .select('id')
            .eq('user_id', user.id)
            .eq('source', 'task')
            .eq('related_id', taskId)
            .single()

        if (existing) {
            alert('You have already completed this task!')
            btn.textContent = 'Completed'
            btn.disabled = true
            return
        }

        // Get task details
        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('reward_microusd')
            .eq('id', taskId)
            .single()

        if (taskError) throw taskError

        // Update user balance
        await supabase
            .from('users')
            .update({
                balance_microusd: supabase.raw('balance_microusd + ?', [task.reward_microusd]),
                total_earnings_microusd: supabase.raw('total_earnings_microusd + ?', [task.reward_microusd])
            })
            .eq('id', user.id)

        // Create earning record
        await supabase
            .from('earnings')
            .insert([{
                user_id: user.id,
                source: 'task',
                amount_microusd: task.reward_microusd,
                related_id: taskId,
                created_at: new Date().toISOString()
            }])

        btn.textContent = 'Completed'
        btn.disabled = true

        alert(`Task completed! $${formatMicrodollars(task.reward_microusd)} added to your balance.`)

    } catch (error) {
        console.error('Error completing task:', error)
        alert('Failed to complete task: ' + error.message)
        btn.textContent = originalText
        btn.disabled = false
    }
}
