import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
    try {
        const id = getRouterParam(event, 'id')
        const body = await readBody(event)

        if (!id) {
            throw createError({
                statusCode: 400,
                message: 'Order ID is required'
            })
        }

        const validStatuses = ['Pending', 'Cooking', 'Ready', 'Completed', 'Cancelled']
        if (!body.status || !validStatuses.includes(body.status)) {
            throw createError({
                statusCode: 400,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            })
        }

        // Update order status
        const result = await query(`
      UPDATE orders 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, status, location, total_price, created_at, updated_at
    `, [body.status, id])

        if (result.rows.length === 0) {
            throw createError({
                statusCode: 404,
                message: 'Order not found'
            })
        }

        return {
            success: true,
            data: result.rows[0]
        }
    } catch (error: any) {
        console.error('Update order status error:', error)
        if (error.statusCode) throw error
        throw createError({
            statusCode: 500,
            message: error.message || 'เกิดข้อผิดพลาดในการอัพเดทสถานะ order'
        })
    }
})
