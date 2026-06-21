import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { name, icon, display_order } = body;

    if (!name || !icon) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Missing required fields: name, icon',
        });
    }

    try {
        let orderVal = display_order;
        if (orderVal === undefined || orderVal === null) {
            const maxOrderRes = await query('SELECT COALESCE(MAX(display_order), 0) as max_order FROM categories');
            orderVal = Number(maxOrderRes.rows[0].max_order) + 1;
        }

        const result = await query(
            'INSERT INTO categories (name, icon, display_order) VALUES ($1, $2, $3) RETURNING *',
            [name, icon, orderVal]
        );

        return {
            success: true,
            data: result.rows[0]
        };
    } catch (error: any) {
        console.error('Error creating category:', error);
        throw createError({
            statusCode: 500,
            statusMessage: error.message || 'Internal Server Error',
        });
    }
});
