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

        // 1. Create Enums and Categories Table
        console.log('Creating ENUM types and categories table...');
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'preparation_dept') THEN
                    CREATE TYPE preparation_dept AS ENUM ('Kitchen', 'Barista', 'Bakery');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_status') THEN
                    CREATE TYPE item_status AS ENUM ('Pending', 'Preparing', 'Ready', 'Cancelled');
                END IF;
            END$$;
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) NOT NULL UNIQUE,
                icon VARCHAR(10) NOT NULL,
                display_order INT DEFAULT 0
            );
        `);

        // 2. Seed Categories
        console.log('Seeding default categories...');
        await client.query(`
            INSERT INTO categories (name, icon, display_order) VALUES
            ('Food', '🍜', 1),
            ('Beverage', '☕', 2),
            ('Dessert', '🍰', 3)
            ON CONFLICT (name) DO NOTHING;
        `);

        // 3. Alter Menus and Order Items Table
        console.log('Altering menus and order_items tables...');
        
        // Add category_id and dept to menus
        await client.query(`
            ALTER TABLE menus ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
        `);
        await client.query(`
            ALTER TABLE menus ADD COLUMN IF NOT EXISTS dept preparation_dept NOT NULL DEFAULT 'Kitchen';
        `);

        // Add status to order_items
        await client.query(`
            ALTER TABLE order_items ADD COLUMN IF NOT EXISTS status item_status DEFAULT 'Pending';
        `);

        // 4. Update existing items to 'Food' and 'Kitchen'
        console.log('Updating existing menu items to default category (Food)...');
        await client.query(`
            UPDATE menus 
            SET category_id = (SELECT id FROM categories WHERE name = 'Food'), 
                dept = 'Kitchen'
            WHERE category_id IS NULL;
        `);

        // 5. Seed Cafe Options
        console.log('Seeding sample beverage and dessert options...');
        
        const optionsSeed = [
            { label: 'ร้อน', extra_price: 0, option_group: 'temperature' },
            { label: 'เย็น', extra_price: 10, option_group: 'temperature' },
            { label: 'ปั่น', extra_price: 15, option_group: 'temperature' },
            { label: 'หวานปกติ (100%)', extra_price: 0, option_group: 'sweetness' },
            { label: 'หวานน้อย (50%)', extra_price: 0, option_group: 'sweetness' },
            { label: 'ไม่หวานเลย (0%)', extra_price: 0, option_group: 'sweetness' },
            { label: 'นมโอ๊ต (Oat Milk)', extra_price: 15, option_group: 'milk_type' },
            { label: 'นมถั่วเหลือง (Soy Milk)', extra_price: 10, option_group: 'milk_type' },
            { label: 'เพิ่มช็อตกาแฟ', extra_price: 15, option_group: 'addons' },
            { label: 'วิปครีม', extra_price: 10, option_group: 'addons' }
        ];

        const insertedOptions = {};
        for (const opt of optionsSeed) {
            const getOpt = await client.query(`
                SELECT id FROM options WHERE label = $1 AND option_group = $2;
            `, [opt.label, opt.option_group]);
            
            let optId;
            if (getOpt.rows.length > 0) {
                optId = getOpt.rows[0].id;
            } else {
                const optRes = await client.query(`
                    INSERT INTO options (label, extra_price, option_group) 
                    VALUES ($1, $2, $3) 
                    RETURNING id;
                `, [opt.label, opt.extra_price, opt.option_group]);
                optId = optRes.rows[0].id;
            }
            insertedOptions[opt.label] = optId;
        }

        // 6. Seed Cafe Items
        console.log('Seeding sample beverages and desserts...');
        const beverageCategoryId = (await client.query("SELECT id FROM categories WHERE name = 'Beverage'")).rows[0].id;
        const dessertCategoryId = (await client.query("SELECT id FROM categories WHERE name = 'Dessert'")).rows[0].id;

        const menusSeed = [
            { name: 'เอสเพรสโซ่ (Espresso)', base_price: 45, category_id: beverageCategoryId, dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1510972527909-a01440b526d5?auto=format&fit=crop&q=80&w=400' },
            { name: 'คาปูชิโน่ (Cappuccino)', base_price: 55, category_id: beverageCategoryId, dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&q=80&w=400' },
            { name: 'ลาเต้ (Latte)', base_price: 55, category_id: beverageCategoryId, dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=400' },
            { name: 'ชาเขียวมัทฉะ (Matcha Latte)', base_price: 60, category_id: beverageCategoryId, dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&q=80&w=400' },
            { name: 'เค้กช็อกโกแลต (Chocolate Cake)', base_price: 75, category_id: dessertCategoryId, dept: 'Bakery', image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=400' },
            { name: 'ครัวซองต์เนยสด (Butter Croissant)', base_price: 60, category_id: dessertCategoryId, dept: 'Bakery', image_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=400' }
        ];

        for (const menu of menusSeed) {
            const getMenu = await client.query(`
                SELECT id FROM menus WHERE name = $1;
            `, [menu.name]);

            let menuId;
            if (getMenu.rows.length > 0) {
                menuId = getMenu.rows[0].id;
                console.log(`Menu "${menu.name}" already exists. Skipping insertion.`);
            } else {
                const menuRes = await client.query(`
                    INSERT INTO menus (name, image_url, base_price, category_id, dept)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id;
                `, [menu.name, menu.image_url, menu.base_price, menu.category_id, menu.dept]);
                menuId = menuRes.rows[0].id;
                console.log(`Menu "${menu.name}" created successfully.`);
            }

            // Link options to menus using menu_options
            if (menu.category_id === beverageCategoryId) {
                const optionsToLink = [
                    'ร้อน', 'เย็น', 'ปั่น', 
                    'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)',
                    'นมโอ๊ต (Oat Milk)', 'นมถั่วเหลือง (Soy Milk)', 
                    'เพิ่มช็อตกาแฟ', 'วิปครีม'
                ];
                for (const label of optionsToLink) {
                    const optId = insertedOptions[label];
                    if (optId) {
                        await client.query(`
                            INSERT INTO menu_options (menu_id, option_id) 
                            VALUES ($1, $2) 
                            ON CONFLICT DO NOTHING;
                        `, [menuId, optId]);
                    }
                }
            } else if (menu.category_id === dessertCategoryId) {
                const optId = insertedOptions['วิปครีม'];
                if (optId) {
                    await client.query(`
                        INSERT INTO menu_options (menu_id, option_id) 
                        VALUES ($1, $2) 
                        ON CONFLICT DO NOTHING;
                    `, [menuId, optId]);
                }
            }
        }

        console.log('Seeding and migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await client.end();
    }
}

run();
