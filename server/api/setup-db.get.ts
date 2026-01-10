import { query } from '~/server/utils/db';
import fs from 'node:fs';
import path from 'node:path';

export default defineEventHandler(async (event) => {
    try {
        const sqlPath = path.resolve(process.cwd(), 'db.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolon to execute statements individually
        // This is a naive split but works for the provided schema
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        const checkEnum = await query("SELECT 1 FROM pg_type WHERE typname = 'order_status'");
        const enumExists = (checkEnum.rowCount ?? 0) > 0;

        const results = [];

        for (const statement of statements) {
            // Skip ENUM creation if it already exists to avoid error
            if (enumExists && statement.includes('CREATE TYPE order_status')) {
                results.push({ status: 'skipped', statement: 'CREATE TYPE (already exists)' });
                continue;
            }

            try {
                await query(statement);
                results.push({ status: 'success', statement: statement.substring(0, 30) + '...' });
            } catch (e: any) {
                // Ignore "relation already exists" errors
                if (e.code === '42P07') {
                    results.push({ status: 'skipped', statement: 'Table already exists' });
                } else {
                    console.error('SQL Error:', e);
                    results.push({ status: 'error', error: e.message, statement: statement.substring(0, 30) + '...' });
                }
            }
        }

        return {
            success: true,
            data: results
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message
        };
    }
});
