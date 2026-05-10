import { query } from '~/server/utils/db'

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
