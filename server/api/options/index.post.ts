import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { label, extra_price, image_url, option_group } = body;

    // Validation
    if (!label) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Label is required',
        });
    }

    try {
        const result = await query(
            'INSERT INTO options (label, extra_price, image_url, option_group) VALUES ($1, $2, $3, $4) RETURNING *',
            [label, extra_price || 0, image_url, option_group || 'addons']
        );

        return {
            success: true,
            data: result.rows[0]
        };
    } catch (error: any) {
        console.error('Error creating option:', error);
        throw createError({
            statusCode: 500,
            statusMessage: error.message || 'Internal Server Error',
        });
    }
});
