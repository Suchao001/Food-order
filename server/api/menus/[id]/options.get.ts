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
        const result = await query(`
            SELECT o.* 
            FROM options o
            JOIN menu_options mo ON o.id = mo.option_id
            WHERE mo.menu_id = $1
        `, [id]);

        return {
            success: true,
            data: result.rows
        };
    } catch (error: any) {
        console.error('Error fetching menu options:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
        });
    }
});
