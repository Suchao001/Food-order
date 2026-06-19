import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    try {
        const result = await query('SELECT * FROM categories ORDER BY display_order ASC');
        return {
            success: true,
            data: result.rows
        };
    } catch (error) {
        console.error('Error fetching categories:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
        });
    }
});
