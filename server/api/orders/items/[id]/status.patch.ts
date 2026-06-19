import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    const itemId = parseInt(getRouterParam(event, 'id') || '0', 10);
    if (!itemId) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid item ID',
        });
    }

    const body = await readBody(event);
    const { status } = body; // 'Pending' | 'Preparing' | 'Ready' | 'Cancelled'

    if (!status) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Status is required',
        });
    }

    const client = await query('BEGIN');
    try {
        // 1. Update the item status
        const updateResult = await query(
            `UPDATE order_items 
             SET status = $1 
             WHERE id = $2 
             RETURNING order_id`,
            [status, itemId]
        );

        if (updateResult.rows.length === 0) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Order item not found',
            });
        }

        const orderId = updateResult.rows[0].order_id;

        // 2. Check if all items in this order are finished (Ready or Cancelled)
        const checkResult = await query(
            `SELECT 
                COUNT(*) as total_items,
                SUM(CASE WHEN status IN ('Ready', 'Cancelled') THEN 1 ELSE 0 END) as finished_items
             FROM order_items
             WHERE order_id = $1`,
            [orderId]
        );

        const { total_items, finished_items } = checkResult.rows[0];

        // 3. Update main order status accordingly
        if (Number(total_items) === Number(finished_items)) {
            await query(
                `UPDATE orders 
                 SET status = 'Ready', updated_at = CURRENT_TIMESTAMP 
                 WHERE id = $1`,
                [orderId]
            );
        } else {
            // If some items are preparing or ready, but not all, set main order to 'Cooking'
            await query(
                `UPDATE orders 
                 SET status = 'Cooking', updated_at = CURRENT_TIMESTAMP 
                 WHERE id = $1 AND status = 'Pending'`,
                [orderId]
            );
        }

        await query('COMMIT');
        return { success: true };
    } catch (error: any) {
        await query('ROLLBACK');
        console.error('Error updating order item status:', error);
        throw createError({
            statusCode: 500,
            statusMessage: error.message || 'Failed to update order item status',
        });
    }
});
