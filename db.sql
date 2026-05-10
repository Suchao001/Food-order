-- postgresql db
-- 1. สร้าง Enum สำหรับสถานะออร์เดอร์

CREATE TYPE order_status AS ENUM ('Pending', 'Cooking', 'Ready', 'Completed', 'Cancelled');

-- 2. ตารางเมนูหลัก (เช่น ข้าวกะเพรา, ข้าวผัด)
CREATE TABLE menus (
id SERIAL PRIMARY KEY,
name TEXT NOT NULL,                -- ชื่อเมนู (ใช้ TTS อ่าน)
image_url TEXT NOT NULL,           -- URL รูปภาพขนาดใหญ่
base_price DECIMAL(10, 2) NOT NULL, -- ราคาเริ่มต้น
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. ตารางตัวเลือกเสริม (เช่น ไข่ดาว, หมูสับ, ไก่, เพิ่มข้าว)
CREATE TABLE options (
id SERIAL PRIMARY KEY,
label TEXT NOT NULL,               -- ชื่อตัวเลือก (เช่น "ไข่ดาว")
extra_price DECIMAL(10, 2) DEFAULT 0, -- ราคาที่ต้องบวกเพิ่ม
option_group TEXT,                 -- กลุ่มของตัวเลือก (เช่น "เนื้อสัตว์", "เครื่องเคียง")
image_url TEXT                     -- รูปภาพเล็กๆ สำหรับตัวเลือก (ถ้ามี)
);

-- 4. ตารางเชื่อมเมนูและตัวเลือก (เมนูนี้มีตัวเลือกอะไรให้เลือกบ้าง)
CREATE TABLE menu_options (
menu_id INTEGER REFERENCES menus(id) ON DELETE CASCADE,
option_id INTEGER REFERENCES options(id) ON DELETE CASCADE,
PRIMARY KEY (menu_id, option_id)
);

-- 5. ตารางออร์เดอร์หลัก
CREATE TABLE orders (
id SERIAL PRIMARY KEY,
status order_status DEFAULT 'Pending',
location TEXT,                     -- สถานที่/โต๊ะ
total_price DECIMAL(10, 2) NOT NULL,
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. ตารางรายการอาหารในแต่ละออร์เดอร์
CREATE TABLE order_items (
id SERIAL PRIMARY KEY,
order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
menu_id INTEGER REFERENCES menus(id),
quantity INTEGER DEFAULT 1,
notes TEXT,                        -- คำอธิบายเพิ่มเติม (เผ็ดมาก, ข้าวน้อย)
item_price DECIMAL(10, 2) NOT NULL, -- ราคาสรุปต่อชิ้น (base + extras)
is_takeaway BOOLEAN DEFAULT false,  -- ใส่กล่อง
is_special BOOLEAN DEFAULT false,   -- พิเศษ (+10฿)
protein_type TEXT DEFAULT 'หมู'    -- 'หมู' | 'หมูสับ' | 'หมูชิ้น' | 'ไก่'
);

-- 7. ตารางเก็บตัวเลือกที่ผู้ใช้เลือกจริงในออร์เดอร์นั้น
CREATE TABLE order_item_selected_options (
order_item_id INTEGER REFERENCES order_items(id) ON DELETE CASCADE,
option_id INTEGER REFERENCES options(id),
quantity INTEGER DEFAULT 1,        -- จำนวนของ option ที่เลือก
PRIMARY KEY (order_item_id, option_id)
);