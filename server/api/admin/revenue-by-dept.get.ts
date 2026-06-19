import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    try {
        const result = await query(`
            SELECT 
                m.dept,
                COUNT(oi.id) as item_count,
                SUM(oi.quantity * oi.item_price) as revenue
            FROM order_items oi
            JOIN menus m ON oi.menu_id = m.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.status = 'Completed'
            GROUP BY m.dept
        `);

        return {
            success: true,
            data: result.rows.map(r => ({
                dept: r.dept,
                itemCount: Number(r.item_count),
                revenue: Number(r.revenue) || 0
            }))
        };
    } catch (error: any) {
        console.error('Error fetching revenue by department:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
        });
    }
});
