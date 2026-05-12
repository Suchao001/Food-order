import { query } from '~/server/utils/db'
import { sendPushToAll } from '~/server/utils/push'
import { sendTelegramMessage } from '~/server/utils/telegram'

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event)
        const { items, totalPrice, location } = body

        if (!items || !Array.isArray(items) || items.length === 0) {
            throw createError({
                statusCode: 400,
                message: 'Order items are required'
            })
        }

        // Start transaction
        await query('BEGIN')

        try {
            // 1. Create Order
            const orderResult = await query(
                `INSERT INTO orders (status, location, total_price) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
                ['Pending', location || null, totalPrice]
            )

            const orderId = orderResult.rows[0].id

            // 2. Insert Items
            for (const item of items) {
                const itemResult = await query(
                    `INSERT INTO order_items (order_id, menu_id, quantity, notes, item_price, is_takeaway, is_special, protein_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
                    [
                        orderId,
                        item.menuId,
                        item.quantity,
                        item.notes || null,
                        item.totalPrice,
                        item.isTakeaway || false,
                        item.isSpecial || false,
                        item.proteinType || 'หมู'
                    ]
                )

                const orderItemId = itemResult.rows[0].id

                // 3. Insert Selected Options
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

            // Query menu names and option names for notification
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
            const pushBody = items.map((i: any) => `${menuMap[i.menuId] || '?'} x${i.quantity}`).join(', ')

            // Send push notification to kitchen (fire-and-forget)
            sendPushToAll({
                title: `🍽️ ออเดอร์ใหม่!${locationText}`,
                body: pushBody,
                orderId
            }).catch(() => {})

            // Send Telegram notification (fire-and-forget)
            sendTelegramMessage(
                `🍽️ <b>ออเดอร์ใหม่!</b>${locationText}\n\n${itemLines}\n\n💰 ฿${totalPrice}`
            ).catch(() => {})

            return {
                success: true,
                data: {
                    orderId,
                    message: 'Order created successfully'
                }
            }
        } catch (err) {
            await query('ROLLBACK')
            throw err
        }

    } catch (error: any) {
        console.error('Create order error:', error)
        throw createError({
            statusCode: 500,
            message: error.message || 'Failed to create order'
        })
    }
})
