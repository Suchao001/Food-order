import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    const body = await readBody(event);
    const { name, image_url, base_price, category_id, dept, optionIds } = body;

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'ID is required',
        });
    }

    try {
        const result = await query(
            'UPDATE menus SET name = $1, image_url = $2, base_price = $3, category_id = $4, dept = $5 WHERE id = $6 RETURNING *',
            [name, image_url, base_price, category_id || null, dept || 'Kitchen', id]
        );

        if (result.rows.length === 0) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Menu not found',
            });
        }

        // Update option links if optionIds is provided as an array
        if (optionIds && Array.isArray(optionIds)) {
            // Remove existing relationships
            await query('DELETE FROM menu_options WHERE menu_id = $1', [id]);
            
            // Insert new relationships
            for (const optId of optionIds) {
                await query('INSERT INTO menu_options (menu_id, option_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, optId]);
            }
        }

        return {
            success: true,
            data: result.rows[0]
        };
    } catch (error: any) {
        if (error.statusCode) throw error;

        console.error('Error updating menu:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
        });
    }
});
