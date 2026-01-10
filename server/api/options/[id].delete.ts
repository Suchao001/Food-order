import { query } from '~/server/utils/db';
import { deleteFromCloudinary, extractPublicIdFromUrl } from '~/server/utils/cloudinary';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'ID is required',
        });
    }

    try {
        // 1. Get the option to find the image_url
        const checkResult = await query('SELECT image_url FROM options WHERE id = $1', [id]);

        if (checkResult.rows.length === 0) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Option not found',
            });
        }

        const imageUrl = checkResult.rows[0].image_url;

        // 2. Delete the image from Cloudinary if it exists
        if (imageUrl) {
            const publicId = extractPublicIdFromUrl(imageUrl);
            if (publicId) {
                await deleteFromCloudinary(publicId).catch(err => {
                    console.error('Failed to delete image from Cloudinary:', err);
                });
            }
        }

        // 3. Delete from Database
        await query('DELETE FROM options WHERE id = $1', [id]);

        return {
            success: true,
            message: 'Option deleted successfully'
        };
    } catch (error: any) {
        if (error.statusCode) throw error;

        console.error('Error deleting option:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
        });
    }
});
