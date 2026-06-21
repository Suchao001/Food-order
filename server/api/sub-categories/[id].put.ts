import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    const body = await readBody(event);
    const { name, display_order } = body;

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'ID is required',
        });
    }

    if (!name || display_order === undefined) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Missing required fields: name, display_order',
        });
    }

    try {
        const result = await query(
            'UPDATE sub_categories SET name = $1, display_order = $2 WHERE id = $3 RETURNING *',
            [name, display_order, id]
        );

        if (result.rows.length === 0) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Sub-category not found',
            });
        }

        return {
            success: true,
            data: result.rows[0]
        };
    } catch (error: any) {
        if (error.statusCode) throw error;
        console.error('Error updating sub-category:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
        });
    }
});
