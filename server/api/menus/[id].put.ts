import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    const body = await readBody(event);
    const { name, image_url, base_price } = body;

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'ID is required',
        });
    }

    try {
        const result = await query(
            'UPDATE menus SET name = $1, image_url = $2, base_price = $3 WHERE id = $4 RETURNING *',
            [name, image_url, base_price, id]
        );

        if (result.rows.length === 0) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Menu not found',
            });
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
