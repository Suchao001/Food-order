import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
    try {
        const queryParams = getQuery(event)
        const year = queryParams.year as string || new Date().getFullYear().toString()

        // Get monthly summary
        const result = await query(`
            SELECT 
                EXTRACT(MONTH FROM created_at) as month,
                COUNT(*) as order_count,
                SUM(total_price) as total_revenue
            FROM orders
            WHERE EXTRACT(YEAR FROM created_at) = $1 AND status = 'Completed'
            GROUP BY EXTRACT(MONTH FROM created_at)
            ORDER BY month DESC
        `, [year])

        // Format months
        const monthNames = [
            '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
            'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
            'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ]

        const data = result.rows.map(row => ({
            month: Number(row.month),
            monthName: monthNames[Number(row.month)],
            orderCount: Number(row.order_count),
            totalRevenue: Number(row.total_revenue) || 0
        }))

        // Calculate yearly total
        const yearlyTotal = data.reduce((sum, m) => sum + m.totalRevenue, 0)
        const yearlyOrders = data.reduce((sum, m) => sum + m.orderCount, 0)

        return {
            success: true,
            year: Number(year),
            yearlyTotal,
            yearlyOrders,
            data
        }
    } catch (error: any) {
        console.error('Get monthly summary error:', error)
        throw createError({
            statusCode: 500,
            message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลสรุปรายเดือน'
        })
    }
})
