import { query } from '~/server/utils/db'
import { editTelegramMessage } from '~/server/utils/telegram'

export default defineEventHandler(async (event) => {
    try {
        const id = parseInt(getRouterParam(event, 'id') || '0', 10)
        if (!id) {
            throw createError({
                statusCode: 400,
                message: 'Order ID is required'
            })
        }

        const body = await readBody(event)
        const { items, totalPrice, location } = body

        if (!items || !Array.isArray(items) || items.length === 0) {
            throw createError({
                statusCode: 400,
                message: 'Order items are required'
            })
        }

        // Get the current order first to know status and telegram message id
        const currentOrderResult = await query(
            `SELECT status, telegram_message_id FROM orders WHERE id = $1`,
            [id]
        )
        if (currentOrderResult.rows.length === 0) {
            throw createError({
                statusCode: 404,
                message: 'Order not found'
            })
        }
        const currentOrder = currentOrderResult.rows[0]

        // Start transaction
        await query('BEGIN')

        try {
            // 1. Update Order
            await query(
                `UPDATE orders 
                 SET location = $1, total_price = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [location || null, totalPrice, id]
            )

            // 2. Delete existing items (cascade will delete options)
            await query(`DELETE FROM order_items WHERE order_id = $1`, [id])

            // 3. Insert Items
            for (const item of items) {
                const itemResult = await query(
                    `INSERT INTO order_items (order_id, menu_id, quantity, notes, item_price, is_takeaway, is_special, protein_type, discount)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                     RETURNING id`,
                    [
                        id,
                        item.menuId,
                        item.quantity,
                        item.notes || null,
                        item.totalPrice,
                        item.isTakeaway || false,
                        item.isSpecial || false,
                        item.proteinType || 'หมู',
                        item.discount || 0
                    ]
                )

                const orderItemId = itemResult.rows[0].id

                // 4. Insert Selected Options
                if (item.selectedOptions && item.selectedOptions.length > 0) {
                    for (const opt of item.selectedOptions) {
                        await query(
                            `INSERT INTO order_item_selected_options (order_item_id, option_id, quantity) 
                             VALUES ($1, $2, $3)`,
                            [orderItemId, opt.optionId, opt.quantity || 1]
                        )
                    }
                }
            }

            await query('COMMIT')

            // Update Telegram Message if telegram_message_id exists
            if (currentOrder.telegram_message_id) {
                const menuIds = [...new Set(items.map((i: any) => i.menuId))]
                const allOptionIds = items.flatMap((i: any) => (i.selectedOptions || []).map((o: any) => o.optionId))
                const uniqueOptionIds = [...new Set(allOptionIds)]

                const [menuResult, optionResult] = await Promise.all([
                    query(`SELECT id, name FROM menus WHERE id = ANY($1)`, [menuIds]),
                    uniqueOptionIds.length > 0
                        ? query(`SELECT id, label FROM options WHERE id = ANY($1)`, [uniqueOptionIds])
                        : Promise.resolve({ rows: [] })
                ])
                const menuMap = Object.fromEntries(menuResult.rows.map((r: any) => [r.id, r.name]))
                const optionMap = Object.fromEntries(optionResult.rows.map((r: any) => [r.id, r.label]))

                const itemLines = items.map((i: any) => {
                    const name = menuMap[i.menuId] || 'รายการ'
                    const tags = [
                        i.proteinType ? i.proteinType : null,
                        i.isSpecial ? 'พิเศษ' : null,
                        i.isTakeaway ? 'ใส่กล่อง' : null,
                    ].filter(Boolean).join(' ')
                    const opts = (i.selectedOptions || [])
                        .map((o: any) => `${optionMap[o.optionId] || '?'}${o.quantity > 1 ? ` x${o.quantity}` : ''}`)
                        .join(', ')
                    const notes = i.notes ? ` 📝 ${i.notes}` : ''
                    return `• ${name} x${i.quantity}${tags ? ` (${tags})` : ''}${opts ? ` +${opts}` : ''} — ฿${i.totalPrice}${notes}`
                }).join('\n')

                const locationText = location ? ` • ${location}` : ''
                
                let title = 'ออเดอร์ใหม่ (แก้ไข)!'
                let telegramStatus: 'pending' | 'cooking' | 'completed' = 'pending'
                
                if (currentOrder.status === 'Cooking') {
                    title = 'กำลังทำ! 🍳 (แก้ไข)'
                    telegramStatus = 'cooking'
                } else if (currentOrder.status === 'Completed') {
                    title = 'เสร็จแล้ว! ✅ (แก้ไข)'
                    telegramStatus = 'completed'
                } else if (currentOrder.status === 'Ready') {
                    title = 'พร้อมเสิร์ฟ! 🔔 (แก้ไข)'
                    telegramStatus = 'completed'
                } else if (currentOrder.status === 'Cancelled') {
                    title = 'ยกเลิกแล้ว! ❌'
                    telegramStatus = 'completed'
                }

                const text = `🍽️ <b>${title}</b>${locationText}\n\n${itemLines}\n\n💰 ฿${totalPrice}`

                await editTelegramMessage(
                    currentOrder.telegram_message_id,
                    text,
                    telegramStatus,
                    id
                ).catch((e) => console.error('Failed to update telegram message on edit:', e))
            }

            return {
                success: true,
                data: {
                    orderId: id,
                    message: 'Order updated successfully'
                }
            }
        } catch (err) {
            await query('ROLLBACK')
            throw err
        }
    } catch (error: any) {
        console.error('Update order error:', error)
        throw createError({
            statusCode: error.statusCode || 500,
            message: error.message || 'Failed to update order'
        })
    }
})
