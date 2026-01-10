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
        const result = await query('SELECT * FROM options WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Option not found',
            });
        }

        return {
            success: true,
            data: result.rows[0]
        };
    } catch (error: any) {
        if (error.statusCode) throw error;

        console.error('Error fetching option:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
        });
    }
});
