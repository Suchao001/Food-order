import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    try {
        const result = await query('SELECT * FROM options ORDER BY id DESC');
        return {
            success: true,
            data: result.rows
        };
    } catch (error) {
        console.error('Error fetching options:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
        });
    }
});
