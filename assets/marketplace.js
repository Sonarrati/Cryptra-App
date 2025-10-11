import { supabase, requireAuth, formatMicrodollars } from './supabaseClient.js'

document.addEventListener('DOMContentLoaded', async function() {
    const user = requireAuth()
    if (!user) return

    await loadMarketplaceItems()
    await loadUserBalance()
})

async function loadMarketplaceItems() {
    try {
        const { data: items, error } = await supabase
            .from('marketplace_items')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false })

        if (error) throw error

        const itemsGrid = document.getElementById('marketplaceItems')
        itemsGrid.innerHTML = ''

        items.forEach(item => {
            const itemCard = document.createElement('div')
            itemCard.className = 'marketplace-item'
            itemCard.innerHTML = `
                <div class="item-image">
                    <i class="fas fa-${item.type === 'physical' ? 'box' : 'download'}"></i>
                </div>
                <div class="item-info">
                    <h4>${item.title}</h4>
                    <p class="item-type">${item.type === 'physical' ? 'Physical Product' : 'Digital Product'}</p>
                    <div class="item-price">$${formatMicrodollars(item.price_microusd)}</div>
                    ${item.stock > 0 ? 
                        `<div class="item-stock">In stock: ${item.stock}</div>` :
                        '<div class="item-stock out-of-stock">Out of stock</div>'
                    }
                </div>
                <button class="btn btn-primary buy-btn" 
                        data-item-id="${item.id}" 
                        data-price="${item.price_microusd}"
                        ${item.stock === 0 ? 'disabled' : ''}>
                    ${item.stock === 0 ? 'Out of Stock' : 'Buy Now'}
                </button>
            `
            itemsGrid.appendChild(itemCard)
        })

        // Add event listeners to buy buttons
        document.querySelectorAll('.buy-btn').forEach(btn => {
            btn.addEventListener('click', purchaseItem)
        })

    } catch (error) {
        console.error('Error loading marketplace items:', error)
    }
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

async function purchaseItem(e) {
    const btn = e.target
    const itemId = btn.getAttribute('data-item-id')
    const price = parseInt(btn.getAttribute('data-price'))
    const originalText = btn.textContent
    
    btn.innerHTML = '<div class="loading"></div>'
    btn.disabled = true

    try {
        const user = JSON.parse(localStorage.getItem('cryptra_user'))

        // Check user balance
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('balance_microusd')
            .eq('id', user.id)
            .single()

        if (userError) throw userError

        if (userData.balance_microusd < price) {
            alert('Insufficient balance!')
            btn.textContent = originalText
            btn.disabled = false
            return
        }

        // Check item stock
        const { data: item, error: itemError } = await supabase
            .from('marketplace_items')
            .select('stock, title')
            .eq('id', itemId)
            .single()

        if (itemError) throw itemError

        if (item.stock <= 0) {
            alert('Item is out of stock!')
            btn.textContent = 'Out of Stock'
            btn.disabled = true
            return
        }

        // Create order
        const { error: orderError } = await supabase
            .from('orders')
            .insert([{
                user_id: user.id,
                item_id: itemId,
                qty: 1,
                amount_microusd: price,
                status: 'pending',
                created_at: new Date().toISOString()
            }])

        if (orderError) throw orderError

        // Update user balance
        await supabase
            .from('users')
            .update({
                balance_microusd: supabase.raw('balance_microusd - ?', [price])
            })
            .eq('id', user.id)

        // Update item stock
        await supabase
            .from('marketplace_items')
            .update({
                stock: supabase.raw('stock - 1')
            })
            .eq('id', itemId)

        // Create earning record for purchase
        await supabase
            .from('earnings')
            .insert([{
                user_id: user.id,
                source: 'marketplace_purchase',
                amount_microusd: -price,
                related_id: itemId,
                created_at: new Date().toISOString()
            }])

        btn.textContent = 'Purchased'
        btn.disabled = true

        alert(`Successfully purchased ${item.title}! Order has been placed.`)

        // Reload data
        await loadMarketplaceItems()
        await loadUserBalance()

    } catch (error) {
        console.error('Error purchasing item:', error)
        alert('Failed to purchase item: ' + error.message)
        btn.textContent = originalText
        btn.disabled = false
    }
}
