import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    try {
        // Determine if we want just menus or joined with options
        // For now, let's just get the main menus list
        const result = await query('SELECT * FROM menus ORDER BY id DESC');
        return {
            success: true,
            data: result.rows
        };
    } catch (error) {
        console.error('Error fetching menus:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
        });
    }
});
