import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'ID is required',
        });
    }

    try {
        const result = await query('SELECT * FROM menus WHERE id = $1', [id]);

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
        // Pass through 404/400 errors
        if (error.statusCode) throw error;

        console.error('Error fetching menu:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
        });
    }
});
