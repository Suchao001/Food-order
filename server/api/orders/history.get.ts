import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
    try {
        const queryParams = getQuery(event)
        const dateFilter = queryParams.date as string || '' // Format: YYYY-MM-DD

        // Build conditions - only count completed orders
        let whereConditions = ["o.status = 'Completed'"]
        let params: any[] = []
        let paramIndex = 1

        if (dateFilter) {
            whereConditions.push(`DATE(o.created_at) = $${paramIndex}`)
            params.push(dateFilter)
            paramIndex++
        }

        const whereClause = 'WHERE ' + whereConditions.join(' AND ')

        // Get orders with items
        const result = await query(`
            SELECT 
                o.id as order_id,
                o.status as order_status,
                o.location,
                o.total_price,
                o.created_at as order_created_at,
                oi.id as item_id,
                oi.quantity as item_quantity,
                oi.item_price,
                oi.is_takeaway,
                oi.is_special,
                m.name as menu_name
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN menus m ON oi.menu_id = m.id
            ${whereClause}
            ORDER BY o.created_at DESC, oi.id ASC
        `, params)

        // Group by order
        const ordersMap = new Map()

        for (const row of result.rows) {
            if (!ordersMap.has(row.order_id)) {
                ordersMap.set(row.order_id, {
                    id: row.order_id,
                    status: row.order_status,
                    location: row.location,
                    total_price: row.total_price,
                    created_at: row.order_created_at,
                    items: []
                })
            }

            const order = ordersMap.get(row.order_id)

            if (row.item_id) {
                order.items.push({
                    id: row.item_id,
                    menu_name: row.menu_name,
                    quantity: row.item_quantity,
                    item_price: row.item_price,
                    is_takeaway: row.is_takeaway,
                    is_special: row.is_special
                })
            }
        }

        const orders = Array.from(ordersMap.values())

        // Group by date
        const groupedByDate: Record<string, any> = {}

        for (const order of orders) {
            const dateKey = new Date(order.created_at).toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })

            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = {
                    date: dateKey,
                    orders: [],
                    totalRevenue: 0,
                    orderCount: 0
                }
            }

            groupedByDate[dateKey].orders.push(order)
            groupedByDate[dateKey].totalRevenue += Number(order.total_price) || 0
            groupedByDate[dateKey].orderCount++
        }

        return {
            success: true,
            data: Object.values(groupedByDate)
        }
    } catch (error: any) {
        console.error('Get order history error:', error)
        throw createError({
            statusCode: 500,
            message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติ orders'
        })
    }
})
