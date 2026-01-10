import { query } from '~/server/utils/db'

// Migration to add new columns for order system
export default defineEventHandler(async (event) => {
    try {
        const migrations = [
            {
                name: 'Add is_takeaway to order_items',
                sql: `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_takeaway BOOLEAN DEFAULT false`
            },
            {
                name: 'Add is_special to order_items',
                sql: `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_special BOOLEAN DEFAULT false`
            },
            {
                name: 'Add quantity to order_item_selected_options',
                sql: `ALTER TABLE order_item_selected_options ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1`
            }
        ]

        const results = []

        for (const migration of migrations) {
            try {
                await query(migration.sql)
                results.push({ name: migration.name, status: 'success' })
            } catch (e: any) {
                // Column already exists - that's fine
                if (e.code === '42701') {
                    results.push({ name: migration.name, status: 'skipped (already exists)' })
                } else {
                    results.push({ name: migration.name, status: 'error', error: e.message })
                }
            }
        }

        return {
            success: true,
            data: results
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message
        }
    }
})
