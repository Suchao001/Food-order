import { uploadToCloudinary } from '~/server/utils/cloudinary';

export default defineEventHandler(async (event) => {
    try {
        const formData = await readMultipartFormData(event);

        if (!formData || formData.length === 0) {
            throw createError({
                statusCode: 400,
                statusMessage: 'No file uploaded'
            });
        }

        const file = formData.find(item => item.name === 'file');

        if (!file || !file.data) {
            throw createError({
                statusCode: 400,
                statusMessage: 'File data is missing'
            });
        }

        const result = await uploadToCloudinary(file.data);

        return {
            success: true,
            url: result.secure_url,
            public_id: result.public_id
        };

    } catch (error: any) {
        console.error('Upload error:', error);
        throw createError({
            statusCode: 500,
            statusMessage: error.message || 'File upload failed'
        });
    }
});
