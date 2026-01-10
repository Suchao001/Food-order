import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    const body = await readBody(event);
    const { label, extra_price, image_url } = body;

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'ID is required',
        });
    }

    try {
        const result = await query(
            'UPDATE options SET label = $1, extra_price = $2, image_url = $3 WHERE id = $4 RETURNING *',
            [label, extra_price, image_url, id]
        );

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

        console.error('Error updating option:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
        });
    }
});
