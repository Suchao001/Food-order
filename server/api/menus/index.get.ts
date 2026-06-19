import { query } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
    try {
        const result = await query(`
            SELECT m.*, 
                   coalesce(
                     json_agg(
                       json_build_object(
                         'id', o.id,
                         'label', o.label,
                         'extra_price', o.extra_price,
                         'option_group', o.option_group
                       )
                     ) FILTER (WHERE o.id IS NOT NULL),
                     '[]'
                   ) as options
            FROM menus m
            LEFT JOIN menu_options mo ON m.id = mo.menu_id
            LEFT JOIN options o ON mo.option_id = o.id
            GROUP BY m.id
            ORDER BY m.id DESC
        `);
        return {
            success: true,
            data: result.rows
        };
    } catch (error) {
        console.error('Error fetching menus:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
        });
    }
});
