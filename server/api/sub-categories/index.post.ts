import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { category_id, name, display_order } = body;

    if (!category_id || !name) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Missing required fields: category_id, name',
        });
    }

    try {
        let orderVal = display_order;
        if (orderVal === undefined || orderVal === null) {
            const maxOrderRes = await query('SELECT COALESCE(MAX(display_order), 0) as max_order FROM sub_categories WHERE category_id = $1', [Number(category_id)]);
            orderVal = Number(maxOrderRes.rows[0].max_order) + 1;
        }

        const result = await query(
            'INSERT INTO sub_categories (category_id, name, display_order) VALUES ($1, $2, $3) RETURNING *',
            [Number(category_id), name, orderVal]
        );

        return {
            success: true,
            data: result.rows[0]
        };
    } catch (error: any) {
        console.error('Error creating sub-category:', error);
        throw createError({
            statusCode: 500,
            statusMessage: error.message || 'Internal Server Error',
        });
    }
});
