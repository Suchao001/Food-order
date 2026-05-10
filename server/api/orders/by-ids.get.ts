import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
    try {
        const queryParams = getQuery(event)
        const idsParam = queryParams.ids as string || ''
        if (!idsParam.trim()) {
            return { success: true, data: [] }
        }

        const ids = idsParam.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0)
        if (ids.length === 0) {
            return { success: true, data: [] }
        }

        const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')

        const result = await query(`
            SELECT
                o.id as order_id,
                o.status as order_status,
                o.location,
                o.total_price,
                o.created_at as order_created_at,
                o.updated_at as order_updated_at,
                oi.id as item_id,
                oi.quantity as item_quantity,
                oi.notes as item_notes,
                oi.item_price,
                oi.is_takeaway,
                oi.is_special,
                oi.protein_type,
                m.id as menu_id,
                m.name as menu_name,
                oiso.quantity as option_quantity,
                opts.id as option_id,
                opts.label as option_label
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN menus m ON oi.menu_id = m.id
            LEFT JOIN order_item_selected_options oiso ON oi.id = oiso.order_item_id
            LEFT JOIN options opts ON oiso.option_id = opts.id
            WHERE o.id IN (${placeholders})
            ORDER BY o.created_at DESC, oi.id ASC
        `, ids)

        const ordersMap = new Map()

        for (const row of result.rows) {
            if (!ordersMap.has(row.order_id)) {
                ordersMap.set(row.order_id, {
                    id: row.order_id,
                    status: row.order_status,
                    location: row.location,
                    total_price: row.total_price,
                    created_at: row.order_created_at,
                    updated_at: row.order_updated_at,
                    items: []
                })
            }

            const order = ordersMap.get(row.order_id)

            if (row.item_id) {
                let item = order.items.find((i: any) => i.id === row.item_id)
                if (!item) {
                    item = {
                        id: row.item_id,
                        menu_id: row.menu_id,
                        menu_name: row.menu_name,
                        quantity: row.item_quantity,
                        notes: row.item_notes,
                        item_price: row.item_price,
                        is_takeaway: row.is_takeaway,
                        is_special: row.is_special,
                        protein_type: row.protein_type,
                        options: []
                    }
                    order.items.push(item)
                }

                if (row.option_id) {
                    item.options.push({
                        option_id: row.option_id,
                        label: row.option_label,
                        quantity: row.option_quantity
                    })
                }
            }
        }

        return {
            success: true,
            data: Array.from(ordersMap.values())
        }
    } catch (error: any) {
        console.error('Get orders by ids error:', error)
        throw createError({
            statusCode: 500,
            message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล orders'
        })
    }
})
