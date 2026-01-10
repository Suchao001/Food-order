import { v2 as cloudinary } from 'cloudinary';

// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads a file buffer to Cloudinary
 * @param buffer - The file buffer
 * @param folder - Optional folder name
 * @returns Promise with upload result
 */
export const uploadToCloudinary = (buffer: Buffer, folder: string = 'food-order'): Promise<any> => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: 'auto'
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        ).end(buffer);
    });
};

/**
 * Deletes a file from Cloudinary
 * @param publicId - The public ID of the resource
 * @returns Promise with deletion result
 */
export const deleteFromCloudinary = (publicId: string): Promise<any> => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.destroy(publicId, (error, result) => {
            if (error) return reject(error);
            resolve(result);
        });
    });
};

/**
 * Extracts the public ID from a Cloudinary URL
 * @param url - The full Cloudinary URL
 * @returns The public ID or null if not found
 */
export const extractPublicIdFromUrl = (url: string): string | null => {
    try {
        if (!url.includes('cloudinary.com')) return null;

        // Example: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/public_id.jpg
        // A robust regex approach:
        const regex = /\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z]+$/;
        const match = url.match(regex);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
};

export default cloudinary;
