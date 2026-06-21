import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

// Parse .env manually to avoid extra dependencies
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
let dbUrl = '';
for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
        dbUrl = line.substring('DATABASE_URL='.length).replace(/['"]/g, '').trim();
    }
}

if (!dbUrl) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
}

const { Client } = pg;
const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log('Connected to PostgreSQL successfully.');

        // 1. Create sub_categories table
        console.log('Creating sub_categories table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS sub_categories (
                id SERIAL PRIMARY KEY,
                category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
                name VARCHAR(50) NOT NULL,
                display_order INT DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Alter menus table to add sub_category_id referencing sub_categories
        console.log('Altering menus table to add sub_category_id column...');
        await client.query(`
            ALTER TABLE menus 
            ADD COLUMN IF NOT EXISTS sub_category_id INTEGER REFERENCES sub_categories(id) ON DELETE SET NULL;
        `);

        // 3. Seed default sub-categories for Beverages (Beverage category usually has id 2 or name 'Beverage')
        console.log('Finding parent category for Beverages...');
        const catRes = await client.query("SELECT id FROM categories WHERE name = 'Beverage'");
        if (catRes.rows.length === 0) {
            console.error('Beverage category not found. Seeding skipped.');
            return;
        }
        const bevCatId = catRes.rows[0].id;

        console.log(`Seeding sub-categories for Beverage (ID: ${bevCatId})...`);
        const subCats = [
            { name: 'Coffee', display_order: 1 },
            { name: 'Italian Soda', display_order: 2 },
            { name: 'Non-Coffee', display_order: 3 }
        ];

        const insertedSubCats = {};
        for (const sub of subCats) {
            const checkRes = await client.query(
                "SELECT id FROM sub_categories WHERE name = $1 AND category_id = $2",
                [sub.name, bevCatId]
            );

            let subId;
            if (checkRes.rows.length > 0) {
                subId = checkRes.rows[0].id;
                console.log(`Sub-category "${sub.name}" already exists.`);
            } else {
                const insertRes = await client.query(
                    "INSERT INTO sub_categories (category_id, name, display_order) VALUES ($1, $2, $3) RETURNING id",
                    [bevCatId, sub.name, sub.display_order]
                );
                subId = insertRes.rows[0].id;
                console.log(`Sub-category "${sub.name}" created successfully.`);
            }
            insertedSubCats[sub.name] = subId;
        }

        // 4. Map existing beverage menus to their sub-categories
        console.log('Mapping existing beverage menus to sub-categories...');
        
        // Coffee Mapping
        const coffeeId = insertedSubCats['Coffee'];
        if (coffeeId) {
            await client.query(`
                UPDATE menus 
                SET sub_category_id = $1 
                WHERE category_id = $2 AND (
                    name ILIKE '%เอสเพรสโซ่%' OR 
                    name ILIKE '%คาปูชิโน่%' OR 
                    name ILIKE '%ลาเต้%' OR 
                    name ILIKE '%Espresso%' OR 
                    name ILIKE '%Cappuccino%' OR 
                    name ILIKE '%Latte%' OR 
                    name ILIKE '%อเมริกาโน่%' OR 
                    name ILIKE '%Americano%'
                )
            `, [coffeeId, bevCatId]);
        }

        // Non-Coffee Mapping
        const nonCoffeeId = insertedSubCats['Non-Coffee'];
        if (nonCoffeeId) {
            await client.query(`
                UPDATE menus 
                SET sub_category_id = $1 
                WHERE category_id = $2 AND (
                    name ILIKE '%ชาเขียว%' OR 
                    name ILIKE '%โกโก้%' OR 
                    name ILIKE '%ช็อกโกแลต%' OR 
                    name ILIKE '%Matcha%' OR 
                    name ILIKE '%Cocoa%' OR 
                    name ILIKE '%Chocolate%' OR
                    name ILIKE '%ชาไทย%' OR
                    name ILIKE '%นม%'
                ) AND sub_category_id IS NULL
            `, [nonCoffeeId, bevCatId]);
        }

        // Italian Soda Mapping
        const sodaId = insertedSubCats['Italian Soda'];
        if (sodaId) {
            await client.query(`
                UPDATE menus 
                SET sub_category_id = $1 
                WHERE category_id = $2 AND (
                    name ILIKE '%โซดา%' OR 
                    name ILIKE '%Soda%' OR 
                    name ILIKE '%อิตาเลียน%'
                ) AND sub_category_id IS NULL
            `, [sodaId, bevCatId]);
        }

        console.log('Migration successfully completed!');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await client.end();
    }
}

run();
