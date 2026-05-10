import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
    const itemId = parseInt(getRouterParam(event, 'id') || '0', 10)
    if (!itemId) throw createError({ statusCode: 400, message: 'Invalid item id' })

    const body = await readBody(event)
    const { quantity, notes, proteinType, isTakeaway, isSpecial, itemPrice, selectedOptions } = body

    await query('BEGIN')
    try {
        await query(
            `UPDATE order_items
             SET quantity=$1, notes=$2, protein_type=$3, is_takeaway=$4, is_special=$5, item_price=$6
             WHERE id=$7`,
            [quantity || 1, notes || null, proteinType || 'หมู', isTakeaway || false, isSpecial || false, itemPrice, itemId]
        )

        await query('DELETE FROM order_item_selected_options WHERE order_item_id=$1', [itemId])

        if (selectedOptions?.length) {
            for (const opt of selectedOptions) {
                await query(
                    'INSERT INTO order_item_selected_options(order_item_id, option_id, quantity) VALUES($1,$2,$3)',
                    [itemId, opt.optionId, opt.quantity || 1]
                )
            }
        }

        // Recalculate order total_price
        await query(
            `UPDATE orders SET total_price=(
               SELECT COALESCE(SUM(item_price * quantity), 0)
               FROM order_items WHERE order_id=(SELECT order_id FROM order_items WHERE id=$1)
             ) WHERE id=(SELECT order_id FROM order_items WHERE id=$1)`,
            [itemId]
        )

        await query('COMMIT')
        return { success: true }
    } catch (err) {
        await query('ROLLBACK')
        throw createError({ statusCode: 500, message: 'Failed to update order item' })
    }
})
