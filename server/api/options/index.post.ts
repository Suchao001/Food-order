import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { label, extra_price, image_url } = body;

    // Validation
    if (!label) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Label is required',
        });
    }

    try {
        const result = await query(
            'INSERT INTO options (label, extra_price, image_url) VALUES ($1, $2, $3) RETURNING *',
            [label, extra_price || 0, image_url]
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
