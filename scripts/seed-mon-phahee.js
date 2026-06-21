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
        console.log('Connected to PostgreSQL successfully.');

        // 1. Get or create parent categories
        console.log('Verifying main categories (Beverage & Dessert)...');
        let bevCatId, desCatId;

        const bevRes = await client.query("SELECT id FROM categories WHERE name = 'Beverage'");
        if (bevRes.rows.length > 0) {
            bevCatId = bevRes.rows[0].id;
        } else {
            const insertBev = await client.query("INSERT INTO categories (name, icon, display_order) VALUES ('Beverage', '☕', 1) RETURNING id");
            bevCatId = insertBev.rows[0].id;
        }

        const desRes = await client.query("SELECT id FROM categories WHERE name = 'Dessert'");
        if (desRes.rows.length > 0) {
            desCatId = desRes.rows[0].id;
        } else {
            const insertDes = await client.query("INSERT INTO categories (name, icon, display_order) VALUES ('Dessert', '🍰', 2) RETURNING id");
            desCatId = insertDes.rows[0].id;
        }

        // 2. Get or create sub-categories under Beverage
        console.log('Verifying sub-categories under Beverage...');
        const subCatMap = {};
        const subCatsToVerify = [
            { name: 'Coffee', order: 1 },
            { name: 'Italian Soda', order: 2 },
            { name: 'Non-Coffee', order: 3 }
        ];

        for (const sub of subCatsToVerify) {
            const subRes = await client.query(
                "SELECT id FROM sub_categories WHERE name = $1 AND category_id = $2",
                [sub.name, bevCatId]
            );
            if (subRes.rows.length > 0) {
                subCatMap[sub.name] = subRes.rows[0].id;
            } else {
                const insertSub = await client.query(
                    "INSERT INTO sub_categories (category_id, name, display_order) VALUES ($1, $2, $3) RETURNING id",
                    [bevCatId, sub.name, sub.order]
                );
                subCatMap[sub.name] = insertSub.rows[0].id;
            }
        }

        // 3. Ensure options are seeded
        console.log('Verifying/Seeding base options...');
        const baseOptions = [
            { label: 'ร้อน', extra_price: 0, option_group: 'temperature' },
            { label: 'เย็น', extra_price: 10, option_group: 'temperature' },
            { label: 'หวานปกติ (100%)', extra_price: 0, option_group: 'sweetness' },
            { label: 'หวานน้อย (50%)', extra_price: 0, option_group: 'sweetness' },
            { label: 'ไม่หวานเลย (0%)', extra_price: 0, option_group: 'sweetness' }
        ];

        const optionMap = {};
        for (const opt of baseOptions) {
            const optRes = await client.query(
                "SELECT id FROM options WHERE label = $1 AND option_group = $2",
                [opt.label, opt.option_group]
            );
            if (optRes.rows.length > 0) {
                optionMap[opt.label] = optRes.rows[0].id;
            } else {
                const insertOpt = await client.query(
                    "INSERT INTO options (label, extra_price, option_group) VALUES ($1, $2, $3) RETURNING id",
                    [opt.label, opt.extra_price, opt.option_group]
                );
                optionMap[opt.label] = insertOpt.rows[0].id;
            }
        }

        // 4. Safely clean up previous menus that are not in use to avoid duplicates
        console.log('Cleaning up unused previous Beverage & Dessert menus...');
        // Delete associations for menus that can be deleted
        await client.query(`
            DELETE FROM menu_options 
            WHERE menu_id IN (
                SELECT id FROM menus 
                WHERE (category_id = $1 OR category_id = $2)
                AND id NOT IN (SELECT DISTINCT menu_id FROM order_items)
            )
        `, [bevCatId, desCatId]);

        // Delete the menus themselves if not in order history
        const deleteRes = await client.query(`
            DELETE FROM menus 
            WHERE (category_id = $1 OR category_id = $2)
            AND id NOT IN (SELECT DISTINCT menu_id FROM order_items)
        `, [bevCatId, desCatId]);
        console.log(`Deleted ${deleteRes.rowCount} unused old menus.`);

        // For menus that are in use and couldn't be deleted, rename them to mark them as historical
        await client.query(`
            UPDATE menus 
            SET name = '[Old] ' || name 
            WHERE (category_id = $1 OR category_id = $2)
            AND name NOT LIKE '[Old] %'
        `, [bevCatId, desCatId]);

        // 5. Seed New Menus from JSON
        console.log('Seeding new Mon Phahee Coffee menu items...');
        const newMenus = [
            // Coffees
            { name: 'เอสเพรสโซ่ (Espresso)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Coffee'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1510972527909-a01440b526d5?auto=format&fit=crop&q=80&w=400', options: ['ร้อน', 'เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'คาปูชิโน่ (Cappuccino)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Coffee'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&q=80&w=400', options: ['ร้อน', 'เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'มอคค่า (Mocha)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Coffee'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&q=80&w=400', options: ['ร้อน', 'เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'ลาเต้ (Latte)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Coffee'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=400', options: ['ร้อน', 'เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'อเมริกาโน่ (Americano)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Coffee'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1551030173-1d905a515b3d?auto=format&fit=crop&q=80&w=400', options: ['ร้อน', 'เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'อัฟโฟกาโต (Affogato)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Coffee'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1594911774802-8822a707cbb3?auto=format&fit=crop&q=80&w=400', options: ['เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] }, // only iced (+10 = 60)
            { name: 'กาแฟดริปผาฮี้ ⭐ (Pour over)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Coffee'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=400', options: ['ร้อน', 'เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },

            // Non-Coffees
            { name: 'ชาไทย (Thai Tea)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Non-Coffee'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&q=80&w=400', options: ['ร้อน', 'เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'ชาเขียว (Green Tea)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Non-Coffee'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&q=80&w=400', options: ['ร้อน', 'เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'ชามะนาว (Thai Lemon Tea)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Non-Coffee'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&q=80&w=400', options: ['ร้อน', 'เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'น้ำผึ้งมะนาว (Honey Lemon)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Non-Coffee'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1610632380989-680fe40816c6?auto=format&fit=crop&q=80&w=400', options: ['ร้อน', 'เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'โกโก้ (Cocoa)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Non-Coffee'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&q=80&w=400', options: ['ร้อน', 'เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'นมชมพู (Pink Milk)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Non-Coffee'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1546470530-941914988d57?auto=format&fit=crop&q=80&w=400', options: ['ร้อน', 'เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'นมสด (Milk)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Non-Coffee'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=400', options: ['ร้อน', 'เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },

            // Sodas (only Iced = 60, so base price 50 + cold option 10 = 60)
            { name: 'สตรอว์เบอร์รี่โซดา (Strawberry Soda)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Italian Soda'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&q=80&w=400', options: ['เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'บลูเบอร์รี่โซดา (Blueberry Soda)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Italian Soda'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?auto=format&fit=crop&q=80&w=400', options: ['เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'แอปเปิ้ลเขียวโซดา (Green Apple Soda)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Italian Soda'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=400', options: ['เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'มะม่วงโซดา (Mango Soda)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Italian Soda'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?auto=format&fit=crop&q=80&w=400', options: ['เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'บลูเลมอนโซดา (Blue Lemon Soda)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Italian Soda'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&q=80&w=400', options: ['เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'ลิ้นจี่โซดา (Lychee Soda)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Italian Soda'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=400', options: ['เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'เสาวรสโซดา (Passion Fruit Soda)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Italian Soda'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?auto=format&fit=crop&q=80&w=400', options: ['เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'ส้มโซดา (Orange Soda)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Italian Soda'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&q=80&w=400', options: ['เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'แตงโมโซดา (Watermelon Soda)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Italian Soda'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1589733901241-5e5148e88fb5?auto=format&fit=crop&q=80&w=400', options: ['เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'สับปะรดโซดา (Pineapple Soda)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Italian Soda'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1525385133772-2551b9425285?auto=format&fit=crop&q=80&w=400', options: ['เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'น้ำแดงโซดา (Red Soda)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Italian Soda'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=400', options: ['เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },
            { name: 'มะนาวโซดา (Lime Soda)', base_price: 50, category_id: bevCatId, sub_category_id: subCatMap['Italian Soda'], dept: 'Barista', image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=400', options: ['เย็น', 'หวานปกติ (100%)', 'หวานน้อย (50%)', 'ไม่หวานเลย (0%)'] },

            // Desserts (set base price to 60 or 50 as a reasonable mock price)
            { name: 'คุกกี้ (Cookies)', base_price: 60, category_id: desCatId, sub_category_id: null, dept: 'Bakery', image_url: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&q=80&w=400', options: [] },
            { name: 'บลูเบอร์รี่ชีสพาย (Blueberry Cheese Pie)', base_price: 60, category_id: desCatId, sub_category_id: null, dept: 'Bakery', image_url: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&q=80&w=400', options: [] },
            { name: 'สตรอว์เบอร์รี่ชีสพาย (Strawberry Cheese Pie)', base_price: 60, category_id: desCatId, sub_category_id: null, dept: 'Bakery', image_url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&q=80&w=400', options: [] },
            { name: 'บานอฟฟี่พาย (Banoffee Pie)', base_price: 60, category_id: desCatId, sub_category_id: null, dept: 'Bakery', image_url: 'https://images.unsplash.com/photo-1508737027454-e6454ef45afd?auto=format&fit=crop&q=80&w=400', options: [] },
            { name: 'บราวนี่ (Brownie)', base_price: 60, category_id: desCatId, sub_category_id: null, dept: 'Bakery', image_url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=400', options: [] },
            { name: 'ข้าวปุกงาปิ้ง ⭐ (Sesame Rice Cake)', base_price: 50, category_id: desCatId, sub_category_id: null, dept: 'Bakery', image_url: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&q=80&w=400', options: [] }
        ];

        for (const menu of newMenus) {
            // Check if it already exists to prevent duplicate runs
            const checkMenu = await client.query("SELECT id FROM menus WHERE name = $1", [menu.name]);
            let menuId;
            if (checkMenu.rows.length > 0) {
                menuId = checkMenu.rows[0].id;
                console.log(`Menu item "${menu.name}" already exists. Updating details...`);
                await client.query(
                    "UPDATE menus SET base_price = $1, category_id = $2, sub_category_id = $3, dept = $4, image_url = $5 WHERE id = $6",
                    [menu.base_price, menu.category_id, menu.sub_category_id, menu.dept, menu.image_url, menuId]
                );
            } else {
                const insertMenu = await client.query(
                    "INSERT INTO menus (name, base_price, category_id, sub_category_id, dept, image_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
                    [menu.name, menu.base_price, menu.category_id, menu.sub_category_id, menu.dept, menu.image_url]
                );
                menuId = insertMenu.rows[0].id;
                console.log(`Created menu item "${menu.name}".`);
            }

            // Sync menu options
            // First clear current links to ensure clean state
            await client.query("DELETE FROM menu_options WHERE menu_id = $1", [menuId]);
            
            for (const label of menu.options) {
                const optId = optionMap[label];
                if (optId) {
                    await client.query(
                        "INSERT INTO menu_options (menu_id, option_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                        [menuId, optId]
                    );
                }
            }
        }

        console.log('Seeding completed successfully!');
    } catch (err) {
        console.error('Failed to seed menus:', err);
    } finally {
        await client.end();
    }
}

run();
