import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    const body = await readBody(event);
    const { name, icon, display_order } = body;

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'ID is required',
        });
    }

    if (!name || !icon || display_order === undefined) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Missing required fields: name, icon, display_order',
        });
    }

    try {
        const result = await query(
            'UPDATE categories SET name = $1, icon = $2, display_order = $3 WHERE id = $4 RETURNING *',
            [name, icon, display_order, id]
        );

        if (result.rows.length === 0) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Category not found',
            });
        }

        return {
            success: true,
            data: result.rows[0]
        };
    } catch (error: any) {
        if (error.statusCode) throw error;
        console.error('Error updating category:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
        });
    }
});
