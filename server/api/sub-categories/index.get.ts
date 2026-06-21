import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    const queryParams = getQuery(event);
    const categoryId = queryParams.categoryId;

    try {
        let sql = 'SELECT * FROM sub_categories ORDER BY display_order ASC';
        let params: any[] = [];

        if (categoryId) {
            sql = 'SELECT * FROM sub_categories WHERE category_id = $1 ORDER BY display_order ASC';
            params = [Number(categoryId)];
        }

        const result = await query(sql, params);
        return {
            success: true,
            data: result.rows
        };
    } catch (error) {
        console.error('Error fetching sub-categories:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
        });
    }
});
