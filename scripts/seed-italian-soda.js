import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

// Parse .env manually to find DATABASE_URL
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
        console.log('Connected to database successfully.');

        // 1. Get Beverage category ID
        const catRes = await client.query("SELECT id FROM categories WHERE name = 'Beverage'");
        if (catRes.rows.length === 0) {
            console.error('Beverage category not found. Please run migrate-cafe first.');
            process.exit(1);
        }
        const beverageCategoryId = catRes.rows[0].id;

        // 2. Insert Menu Item: Italian Soda (อิตาเลียนโซดา)
        const menuName = 'อิตาเลียนโซดา (Italian Soda)';
        const basePrice = 45;
        const imageUrl = 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=400';
        
        let menuId;
        const menuCheck = await client.query('SELECT id FROM menus WHERE name = $1', [menuName]);
        if (menuCheck.rows.length > 0) {
            menuId = menuCheck.rows[0].id;
            console.log(`Menu item "${menuName}" already exists (ID: ${menuId}). Updating info...`);
            await client.query(`
                UPDATE menus 
                SET base_price = $1, image_url = $2, category_id = $3, dept = 'Barista' 
                WHERE id = $4
            `, [basePrice, imageUrl, beverageCategoryId, menuId]);
        } else {
            const menuRes = await client.query(`
                INSERT INTO menus (name, base_price, image_url, category_id, dept) 
                VALUES ($1, $2, $3, $4, 'Barista') 
                RETURNING id;
            `, [menuName, basePrice, imageUrl, beverageCategoryId]);
            menuId = menuRes.rows[0].id;
            console.log(`Created menu item "${menuName}" successfully (ID: ${menuId}).`);
        }

        // 3. Get relevant options to link (Cold only, sweetness options, whip cream addon)
        // Note: No "ร้อน", no milk types, no espresso shot.
        const optionLabels = [
            'เย็น',
            'หวานปกติ (100%)',
            'หวานน้อย (50%)',
            'ไม่หวานเลย (0%)',
            'วิปครีม'
        ];

        const optRes = await client.query(`
            SELECT id, label FROM options WHERE label = ANY($1)
        `, [optionLabels]);

        console.log(`Found ${optRes.rows.length} matching options in database. Linking...`);

        // Clear existing options first to prevent duplicates or leftover invalid relations
        await client.query('DELETE FROM menu_options WHERE menu_id = $1', [menuId]);

        for (const row of optRes.rows) {
            await client.query(`
                INSERT INTO menu_options (menu_id, option_id) 
                VALUES ($1, $2) 
                ON CONFLICT DO NOTHING
            `, [menuId, row.id]);
            console.log(`  Linked option "${row.label}" (ID: ${row.id})`);
        }

        console.log('Italian Soda menu seeded and configured successfully with no Hot options!');
    } catch (error) {
        console.error('Failed to seed Italian Soda:', error);
    } finally {
        await client.end();
    }
}

run();
