import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { name, image_url, base_price, category_id, sub_category_id, dept, optionIds } = body;

    if (!name || !image_url || base_price === undefined) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Missing required fields: name, image_url, base_price',
        });
    }

    try {
        const result = await query(
            'INSERT INTO menus (name, image_url, base_price, category_id, sub_category_id, dept) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, image_url, base_price, category_id || null, sub_category_id || null, dept || 'Kitchen']
        );

        const newMenu = result.rows[0];

        // Link options to the menu if provided
        if (optionIds && Array.isArray(optionIds) && optionIds.length > 0) {
            for (const optId of optionIds) {
                await query('INSERT INTO menu_options (menu_id, option_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [newMenu.id, optId]);
            }
        }

        return {
            success: true,
            data: newMenu
        };
    } catch (error) {
        console.error('Error creating menu:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
        });
    }
});
