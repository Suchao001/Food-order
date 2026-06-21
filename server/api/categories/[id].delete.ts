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
        // Delete the category. Postgres constraint "ON DELETE SET NULL" handles resetting category_id in menus table.
        const result = await query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Category not found',
            });
        }

        return {
            success: true,
            message: 'Category deleted successfully'
        };
    } catch (error: any) {
        if (error.statusCode) throw error;
        console.error('Error deleting category:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
        });
    }
});
