ระบบแอปพลิเคชันสั่งอาหาร (Visual & Audio First Logic)

เอกสารนี้ใช้สำหรับเป็น Reference ให้ AI Agent ในการพัฒนาระบบ โดยเน้นการออกแบบเพื่อผู้ใช้ที่ไม่เน้นการอ่านเขียน (แม่) และระบบจัดการหลังบ้าน (ผู้จัดการ)

1. ข้อมูลทางเทคนิค (Tech Stack)

Frontend/Backend: Nuxt 3

Database: Neon (Postgres)

Styling: Tailwind CSS (Mobile First)

Speech API: Browser Web Speech API (Text-to-Speech)

2. โครงสร้างตรรกะทางธุรกิจ (Core Business Logic)

2.1 ระบบราคา (Pricing Logic)

Total Item Price: base_price (จากเมนู) + Σ extra_price (จาก options ที่เลือก)

Order Total: Σ (item_price * quantity)

Note: ทุกครั้งที่มีการเปลี่ยนแปลง Option หรือจำนวน ต้องคำนวณราคาสด (Reactive) และแสดงผลเป็นตัวเลขขนาดใหญ่พร้อมเสียงอ่านเมื่อมีการกดสรุปยอด

2.2 วงจรสถานะออร์เดอร์ (Order Lifecycle)

Pending (รอดำเนินการ): ออร์เดอร์ถูกส่งเข้าฐานข้อมูล สถานะเริ่มต้น

Cooking (กำลังทำ): ผู้จัดการกดรับออร์เดอร์ -> ระบบต้องส่ง Signal ไปที่หน้าจอของแม่ (อาจใช้ Polling ทุก 30 วิ หรือ Real-time)

Ready (เสร็จแล้ว): ผู้จัดการกดเสร็จ -> Trigger สำคัญ: แอปฝั่งแม่ต้องส่งเสียงแจ้งเตือน "อาหารเสร็จแล้วจ้า"

Completed (ส่งมอบแล้ว): ปิดออร์เดอร์เพื่อนำไปคำนวณรายได้

3. ตรรกะการออกแบบเพื่อแม่ (Accessibility Logic)

3.1 การโต้ตอบด้วยภาพและเสียง (Visual-Audio Mapping)

On Click Image: เมื่อแตะที่รูปอาหาร menus.image_url ให้เรียกฟังก์ชัน speak(menus.name)

Quantity Change: เมื่อกด + หรือ - ให้พูด "เพิ่ม/ลด [ชื่อเมนู]" และพูดจำนวนปัจจุบัน

Option Selection: เมื่อเลือก Option (เช่น ไข่ดาว) ให้พูดชื่อ Option และราคาที่บวกเพิ่ม

3.2 ระบบยืนยันออร์เดอร์

ก่อนกด "สั่งเลย" (Checkout) ระบบต้องวนลูปอ่านรายการในตะกร้าให้ฟังทั้งหมด 1 รอบ

ตัวอย่างเสียง: "สั่งข้าวกะเพราไก่ หมูสับ เผ็ดมาก 1 จาน ราคารวม 60 บาท นะคะ"

4. โครงสร้าง API (Server Routes ใน Nuxt)

AI Agent ควรสร้าง Endpoint ดังนี้:

GET /api/menus: ดึงรายการเมนูพร้อม Options ทั้งหมด (Join Table: menu_options)

POST /api/orders: บันทึกออร์เดอร์ใหม่ลงใน orders, order_items และ order_item_selected_options

PATCH /api/orders/:id/status: อัปเดตสถานะออร์เดอร์ (สำหรับผู้จัดการ)

GET /api/revenue: คำนวณยอดขายโดย Group ตามวัน/สัปดาห์

5. กฎเหล็กสำหรับการเขียนโค้ด (Coding Rules for Agent)

No Small Text: ห้ามใช้ Font ขนาดเล็กกว่า text-lg ในหน้าจอของแม่

High Contrast: ปุ่ม "สั่งอาหาร" ต้องเป็นสีเขียว (Success) และปุ่ม "ยกเลิก" ต้องเป็นสีแดง (Danger) เสมอ

Error Handling: หาก Database เชื่อมต่อไม่ได้ ให้มีเสียงพูดเตือนว่า "ระบบมีปัญหาจ้า ลองใหม่อีกครั้งนะ" (ห้ามใช้ Alert Box อย่างเดียว)

Image Fallback: หากโหลดรูปอาหารไม่ได้ ให้แสดง Emoji อาหารขนาดใหญ่แทน เพื่อไม่ให้หน้าจอว่างเปล่า

6. ลำดับการทำงานของ AI (Prompt Sequence)

Step 1: สร้าง Database ตาม SQL Schema ที่ออกแบบไว้

Step 2: เขียน API สำหรับ CRUD เมนูและอัปโหลดรูป

Step 3: สร้างหน้า UI "แม่" โดยเน้น Grid Layout และ Mobile Responsive

Step 4: รวมระบบ Web Speech API เข้ากับ UI Events

Step 5: สร้างหน้า Dashboard ของผู้จัดการเพื่อรับออร์เดอร์