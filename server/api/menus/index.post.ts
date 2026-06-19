import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { name, image_url, base_price, category_id, dept } = body;

    if (!name || !image_url || base_price === undefined) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Missing required fields: name, image_url, base_price',
        });
    }

    try {
        const result = await query(
            'INSERT INTO menus (name, image_url, base_price, category_id, dept) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, image_url, base_price, category_id || null, dept || 'Kitchen']
        );

        return {
            success: true,
            data: result.rows[0]
        };
    } catch (error) {
        console.error('Error creating menu:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
        });
    }
});
