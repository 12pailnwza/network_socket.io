# บันทึกการทำงาน — Realm Chat

วันที่: 2 พฤศจิกายน 2026 (Asia/Bangkok)  
สถานะ: **ผู้ใช้ให้ทำต่อแล้ว** งานในเครื่องตรวจเพิ่มตามบันทึกด้านล่าง ยังไม่มี AI key และยังไม่ deploy ออนไลน์

## ผลงานหลังกลับมาทำต่อ

- ผู้ใช้แจ้งว่า “ยังไม่มี key ทำส่วนอื่นต่อก่อน” ไม่ต้องถาม key ซ้ำหรือเรียก provider จริง
- แก้ request/message IDs บน HTTP LAN: ใช้ randomUUID เมื่อมี และใช้ getRandomValues สร้าง UUID เมื่อเป็น origin ที่ไม่ใช่ secure context
- แก้การรวมประวัติหลัง reconnect: โหลดหน้าล่าสุดที่ต่อเนื่องกันก่อน แล้วจึงแบ่งหน้าอ่านย้อนหลังได้ครบ แม้ขาดข้อความมากกว่า 50 รายการ พร้อมเก็บ live events ที่มาถึงระหว่างโหลด
- ตรวจ session ก่อนส่งทุก WebSocket frame เพื่อไม่ส่งข้อมูลให้ session ที่เพิ่งหมดอายุก่อนรอบ heartbeat
- รวม HTTP body เป็น Buffer ก่อน decode UTF-8 เพื่อไม่ทำชื่อ/ข้อความเสียหายเมื่อ packet ถูกแบ่งกลางอักขระ
- เพิ่ม test/client-state.test.mjs และ regression/integration tests รอบล่าสุด `npm test` ผ่าน **15 กลุ่ม** และ `npm run build` ผ่าน
- ทดสอบ 9 บัญชีพร้อมกัน: 29 ข้อความที่บันทึกและ 249 การส่งถึงสมาชิกที่คาดไว้ ครบและไม่ซ้ำ (ทดสอบในเครื่องเดียว ไม่ใช่ผลรับประกัน latency บนอินเทอร์เน็ต)
- ตรวจเบราว์เซอร์ผ่าน IP Wi-Fi แบบ HTTP สมัคร/Join World/ส่งข้อความไทยกับอีโมจิสำเร็จ ไม่มี browser errors ภาพอยู่ที่ docs/screenshots/realm-lan.png
- เปิด Docker Desktop ที่ติดตั้งอยู่แล้ว สร้าง image `realm-chat:local` สำเร็จ
- เพิ่ม `npm run test:docker`: ผ่านหน้าเว็บ HTTP/WebSocket, เขียน SQLite, backup ขณะทำงาน, restart และคง session/ประวัติ ใช้ container/volume QA ชื่อเฉพาะที่สร้างเองและลบทิ้งแล้ว
- แก้ fixture Docker ให้ค้นหา published port อีกครั้งหลัง restart เพราะ Docker อาจเปลี่ยน port เมื่อให้เลือกอัตโนมัติ ความล้มเหลวครั้งแรกเกิดใน fixture ช่วงรอ URL เดิม รอบหลังผ่าน
- อัปเดต README และ VALIDATION แล้ว ไม่มีการเปลี่ยนแผนฐานข้อมูล/AI หรือสมัครบริการภายนอกแทนผู้ใช้
- ปิดแท็บ QA และหยุดเซิร์ฟเวอร์ทดลองรอบนี้แล้ว ข้อมูล QA อยู่ใน test-results/resume-preview.sqlite แยกจากฐานข้อมูลเริ่มต้นของผู้ใช้ เปิดใช้งานใหม่ด้วย npm run dev ได้

### งานที่ยังต้องใช้บริการ/อุปกรณ์จริง

1. ทดสอบ R1 จากคอมพิวเตอร์จริงอีกเครื่อง (ตอนนี้ตรวจ IP LAN จาก browser ในเครื่องเซิร์ฟเวอร์และ 9 clients อัตโนมัติแล้ว)
2. เลือก/ใช้บัญชีโฮสต์ฟรีไม่ใช้บัตร ทดสอบ HTTPS/WSS + SQLite persistence บนโฮสต์จริงและ deploy
3. OpenRouter จริงรอผู้ใช้ตั้ง key ภายหลัง พร้อมเลือก/บันทึก model ที่ใช้จริง

บันทึกส่วนถัดไปเป็นสถานะตอนพักครั้งก่อน ข้อความ “ยังไม่ได้ทดสอบ Docker/9 บัญชี” ในส่วนประวัติถูกแทนที่ด้วยผลตรวจล่าสุดข้างต้น

## เป้าหมายและข้อสรุป

- เว็บแชทธีม MMORPG พิกเซลย้อนยุค อิงบรรยากาศ Ragnarok ชื่อ Realm เป็นชื่อชั่วคราว
- UI ภาษาอังกฤษ ข้อความแชทรองรับภาษาไทยและอีโมจิ
- แชทเป็นพื้นที่หลัก มีแท็บ World / Guild / Private แสดงทีละห้อง มีตัวเลขยังไม่อ่านห้องอื่น รายชื่อคนออนไลน์รวมตัวเองอยู่ด้านข้าง
- สมัครเองด้วยชื่อและรหัสผ่าน ไม่ใช้อีเมล ใช้ชื่อบัญชีเป็นชื่อตัวละครไม่ซ้ำกัน
- เลือกรูปตัวละครจากชุดพิกเซลที่เตรียมไว้ ไม่มีอัปโหลดรูปหรือตรากิลด์
- Guild สร้าง เข้าร่วมเอง ออก โอนเจ้าของ และยุบได้ เริ่มต้นมีผู้สร้างคนเดียว รองรับหลายกิลด์ต่อบัญชี สมาชิกใหม่อ่านประวัติทั้งหมดได้
- การยุบกิลด์ใช้ archive และปิดการเข้าถึงของผู้เล่น เก็บประวัติไว้ตามข้อเสนอเริ่มต้น มีข้อความอธิบายใน UI/README ไม่ลบถาวร
- ข้อความและอีโมจิ Enter ส่ง Shift+Enter ขึ้นบรรทัดใหม่ ยังไม่รวม reply/edit/delete ข้อความ
- เน้นคอมพิวเตอร์และรองรับมือถือ ผู้ใช้พร้อมกันเป้าหมายไม่ถึง 10 คน
- SQLite ฝั่งเซิร์ฟเวอร์ ไม่เปลี่ยนเป็น PostgreSQL
- ต้องการออนไลน์ตั้งแต่เวอร์ชันแรก โฮสต์ต้องฟรีและไม่ใช้บัตร ยังไม่ได้เลือกบัญชี/โฮสต์ที่ทดสอบจริง
- ฟีเจอร์พิเศษ: AI สรุปแชท ค้นหาข้อความ จำนวนยังไม่อ่าน และกำลังพิมพ์
- หลังหารือ OpenRouter ใช้แนวทางโมเดลฟรี เตรียม `openrouter/free` เป็นค่าเริ่มต้น ยังไม่มี key จริงและยังไม่เรียก provider จริง
- ผู้ใช้ให้กลับมาเริ่มสร้างแล้ว ต่อมาขอพักและเก็บ log ในเทิร์นล่าสุดนี้

## งานที่ทำแล้ว

### เซิร์ฟเวอร์

- Node.js 24 + HTTP server + ไลบรารี ws มี session cookie HttpOnly/SameSite, password hashing ด้วย scrypt, origin checks และ rate limits
- SQLite มี schema migration เพิ่ม avatar, archived, last_read, client_id และตาราง summaries โดยไม่ต้องล้างฐานข้อมูลเดิม
- WebSocket รองรับ join/createGuild/private/history/message/typing/leave/transfer/disband/read/search
- ตรวจสิทธิ์สมาชิกฝั่งเซิร์ฟเวอร์ทุกครั้ง รวมประวัติ ค้นหา และ AI ไม่ broadcast ข้อความห้องไปยังบุคคลภายนอก
- บันทึกข้อความก่อนตอบรับ แบ่งหน้า history/search ครั้งละ 50 และกัน retry ซ้ำด้วย client message ID
- unread เก็บตำแหน่งอ่านในฐานข้อมูล ไม่นับข้อความของตัวเอง โอนไปคนที่เป็นสมาชิกอยู่แล้วเท่านั้น
- ยกเลิก session และปิด socket ของ session นั้นเมื่อ logout; ตรวจ session หมดอายุและ heartbeat
- AI `/api/summary` เชื่อม OpenRouter ฝั่งเซิร์ฟเวอร์ จำกัดเป็นโมเดลฟรี ต้องยินยอมส่งข้อมูล มี cache/cooldown และตรวจสิทธิ์ซ้ำหลังรอผล

### หน้าเว็บ

- React + TypeScript + Vite มีสมัคร/ล็อกอิน เลือกรูป โปรไฟล์ ออกจากระบบ และหน้าต่างแชท responsive
- World/Guild/Private, guild directory/create/manage/transfer/disband/leave, history/search, unread, typing, emoji picker
- ข้อความร่างแยกห้องและเก็บไว้เมื่อส่งล้มเหลว reconnect ด้วย backoff และโหลดประวัติใหม่
- มี SVG ภาพหมู่บ้านและตัวละครพิกเซล 6 แบบที่สร้างสำหรับโปรเจกต์
- แก้บั๊กแท็บ Guild ว่างเด้งกลับ World และปรับเนื้อหาล้นในหน้าต่างเตี้ย/สีข้อความรอง
- แก้ `npm run dev` รีสตาร์ตวนจาก Node watch เห็นไฟล์ชั่วคราวของ Vite โดยเอา `--watch` ออก หน้า React/CSS ยังใช้ Vite HMR; แก้ server ต้อง restart เอง

### เอกสารและการติดตั้ง

- README.md มีวิธีติดตั้ง รัน ตั้งค่า SQLite/backup, OpenRouter, ทดลอง LAN, เงื่อนไข deploy, ตาราง R1–R11 และข้อจำกัด
- docs/DESIGN.md บันทึกการตัดสินใจและสถานะพัฒนา
- docs/HOSTING.md ผลสำรวจโฮสต์ ยังไม่มีบริการที่ยืนยัน deploy แล้ว
- docs/AI.md แนวทาง OpenRouter และผลสำรวจ Groq/Gemini เดิม
- เตรียม docs/VALIDATION.md และรูป docs/screenshots/realm-desktop.png, realm-mobile.png
- scripts/backup.mjs ใช้ SQLite backup API ไม่ทับไฟล์ที่มีอยู่
- มี Dockerfile, .dockerignore, deploy/Caddyfile.example แต่ **ยังไม่ได้ทดสอบ Docker image**
- .env.example มี HOST/PORT/DATABASE_PATH/PUBLIC_ORIGIN/COOKIE_SECURE/OPENROUTER_API_KEY/AI_MODEL ไม่มี key จริง

## ผลตรวจที่ทำจริง

- `npm run build` ผ่าน TypeScript และ Vite production build
- `npm test` รอบล่าสุดผ่าน **9 กลุ่ม ไม่มีรายการล้มเหลว**
- ตรวจ syntax server/app.mjs, server/store.mjs, scripts/backup.mjs ผ่าน
- Integration tests ใช้ HTTP/WebSocket จริง ครอบคลุมบัญชี/session/origin, Private กันบัญชีที่สาม, opt-in groups, transfer/leave/archive, pagination/search, unread, retry, persistence/backup และ AI จำลอง success/cache/quota/ถอนสิทธิ์ขณะรอ
- ตรวจผ่านเบราว์เซอร์ด้วย AsterQA และ LunaQA ในฐานข้อมูลทดลองเดียวกัน แยก cookie ด้วย 127.0.0.1 และ localhost
- สมัคร เลือก avatar, World/Private รับส่งจริง, badge unread, search, สร้างกิลด์/เข้าร่วมเอง และโอนเจ้าของผ่าน UI ได้
- หลัง refresh ผู้รับการโอนเห็นชื่อเจ้าของใหม่และสิทธิ์เจ้าของจริง
- Shift+Enter ไม่ส่งทันที Enter ส่งได้
- Desktop ตรวจที่ 1280×900, mobile 390×844 มี scrollWidth=390 ไม่ล้นแนวนอน และเปิดแผง Channels ได้
- ตรวจ `npm run dev` ที่แก้แล้ว เปิดหน้าแอปผ่าน http://localhost:3002 ได้ ไม่มี restart วนในช่วงตรวจ

## ส่วนที่ยังไม่เสร็จ/ต้องตรวจเมื่อกลับมาทำ

1. ตรวจยืนยันขณะพักแล้วว่า README, DESIGN, AI, HOSTING, VALIDATION และภาพ desktop/mobile มีอยู่ครบ หากกลับมาแก้ต่อให้อัปเดตผลตรวจตามโค้ดล่าสุด
2. อ่านโค้ดและสถานะ Git ปัจจุบันก่อนแก้ต่อ ไฟล์โปรเจกต์ส่วนใหญ่ยังเป็น untracked ยังไม่ได้ commit หรือ push
3. ถ้าแก้โค้ดเพิ่ม รัน build/tests ตามส่วนที่เปลี่ยน รอบที่ผ่านล่าสุดมี 9 กลุ่ม
4. ยังไม่ได้ทดสอบผู้ใช้จริงคนละคอมพิวเตอร์ตาม R1 หรือโหลดพร้อมกันตามเป้าหมาย <10 คน
5. ยังไม่มี OpenRouter key: ต้องให้ผู้ใช้ตั้งใน .env/secret ของโฮสต์เอง ไม่ส่ง key ลงแชท ไม่ commit ไม่ใช้ VITE_* ตั้งค่าที่ frontend
6. ยังไม่ได้เรียก OpenRouter จริง ต้องทดสอบ free model คุณภาพสรุป/ภาษา/โควตา และบันทึกโมเดลที่ใช้สำหรับสไลด์
7. โฮสต์ยังต้องเลือกและทดสอบ SQLite persistence + HTTPS/WSS + cookie + restart/deploy จริง เงื่อนไขคือฟรีและไม่ใช้บัตร
8. Weeny และ Wispbyte เป็นเพียงตัวเลือกสำรวจ ยังไม่พิสูจน์ WSS/lifecycle ในบัญชีจริง alwaysdata ตัดจากตัวเลือกหลักเรื่องบัตร Render Free ไม่เหมาะเก็บ SQLite ถาวร
9. Vercel ใช้หน้าเว็บได้และปัจจุบันรองรับ WebSocket Functions แต่ไฟล์ SQLite เขียนถาวรโดยตรงไม่ได้ โค้ดปัจจุบันออกแบบ origin เดียว ยังไม่มี config แยก frontend/backend
10. Dockerfile ยังไม่ผ่านการ build/run จริง อย่ารายงานว่า Docker หรือออนไลน์พร้อมใช้แล้ว
11. วันส่งงานยังไม่ได้ระบุ ไม่มีความจำเป็นต้องหยุดงานเพื่อถามก่อนทำงานในเครื่องต่อเมื่อผู้ใช้ให้เริ่มใหม่

## วิธีรันต่อ

```powershell
npm ci
npm run dev
# เปิด http://localhost:3000
```

```powershell
npm run build
npm test
npm start
```

โหมด dev กับ start ใช้ port เดียวกัน อย่าเปิดพร้อมกัน คำสั่ง test ต้องเชื่อม localhost ได้ ในสภาพแวดล้อมเอเจนต์เคยต้องขอสิทธิ์ network จึงจะทดสอบ HTTP/WebSocket ได้

## ข้อมูลทดลองและการหยุดงาน

- เซิร์ฟเวอร์ UI QA ใช้ `test-results/browser-preview.sqlite` ไม่ใช่ฐานข้อมูลเริ่มต้น `data/realm.sqlite`
- Dev smoke ใช้ `test-results/dev-smoke.sqlite` ที่ port 3002
- มี SQLite สำหรับ persistence/backup tests ใน test-results และ screenshot บางชุดที่นั่น ข้อมูลนี้ถูก Git ignore ไม่ลบข้อมูลผู้ใช้จริง
- เมื่อผู้ใช้ขอพัก ได้ส่ง Ctrl+C หยุดเซิร์ฟเวอร์ QA port 3000 (session 74933) และ dev smoke port 3002 (session 37150) แล้ว ทั้งสอง session จบ
- ยังไม่ได้สมัครบริการ เพิ่มบัตร จ่ายเงิน deploy ออนไลน์ commit หรือ push
- ขั้นต่อไปต้องรอคำสั่งให้กลับมาทำงานจากผู้ใช้
