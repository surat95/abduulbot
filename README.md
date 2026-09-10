# อับดุล (abduulbot)

LINE bot ที่ตอบคำถามว่า **"วันนี้ยอดคลินิกกี่บาทแล้ว"** โดยดึงข้อมูลจากหน้ารายงาน
`report/income-simple-daily` ของระบบ Cliniter ของ Wise Dental Clinic

```
คุณ:    วันนี้ยอดคลินิกของฉันกี่บาทแล้ว
อับดุล: ยอดคลินิกวันนี้ (วันพุธที่ 9 กันยายน 2569)

        💰 52,550.00 บาท

        รายละเอียด:
        • เงินสด: 18,400.00 บาท
        • โอน/QR: 25,150.00 บาท
        • บัตรเครดิต: 9,000.00 บาท

        ข้อมูล ณ 14:05 น.
```

> 📄 **กำลังจะเอาไปทำต่อในเครื่องตัวเอง หรือมี project อับดุลตัวอื่นอยู่แล้ว?**
> อ่าน [`docs/HANDOFF.md`](docs/HANDOFF.md) ก่อน — มีเรื่องที่จะไปชนกับ project เดิมและวิธีเลี่ยง

## ⚠️ อ่านก่อนใช้งานจริง

Cliniter **ไม่มี API สาธารณะ** บอทตัวนี้จึงล็อกอินเข้าเว็บแล้วอ่านตัวเลขจากหน้า HTML
(web scraping) ซึ่งมีข้อควรระวังคือ

1. **ต้องตรวจสอบตัวเลขก่อนเชื่อ** — รัน `npm run check:income` แล้วเทียบกับหน้าเว็บจริง
   อย่างน้อยหนึ่งครั้งก่อนใช้งาน และเทียบซ้ำเป็นระยะ
2. **ถ้า Cliniter อัปเดตหน้าเว็บ ตัวอ่านอาจพัง** — แก้ได้โดยตั้ง `CLINITER_TOTAL_SELECTOR` ใหม่
   (ดูหัวข้อ [จูนตัวอ่านยอด](#จูนตัวอ่านยอด))
3. ตัวโค้ดนี้เขียนขึ้นโดย **ยังไม่เคยเห็น HTML จริงของหน้ารายงาน** (ตอนพัฒนาเข้าเว็บไม่ได้)
   จึงใช้วิธีเดาโครงสร้างหลายชั้น — ขั้นตอน "ตรวจสอบตัวเลข" ด้านล่างจึงสำคัญมาก

## สิ่งที่บอททำได้

| ถามว่า | ได้อะไร |
|---|---|
| `วันนี้ยอดเท่าไหร่`, `ยอดคลินิกวันนี้กี่บาท` | ยอดรวมของวันนี้ (ตามเวลาไทย) |
| `ยอดเมื่อวาน` | ยอดของเมื่อวาน |
| `ยอดวันที่ 5/9`, `ยอด 5/9/2569` | ยอดของวันที่ระบุ (รับทั้ง พ.ศ. และ ค.ศ.) |
| `help` | วิธีใช้ |

## ติดตั้งและตั้งค่า

ต้องใช้ Node.js 20 ขึ้นไป

```bash
npm install
cp .env.example .env    # แล้วแก้ค่าใน .env
```

ค่าที่ต้องกรอกใน `.env`

| ตัวแปร | คืออะไร |
|---|---|
| `LINE_CHANNEL_SECRET` | จาก LINE Developers Console → channel อับดุล → Basic settings |
| `LINE_CHANNEL_ACCESS_TOKEN` | จาก Messaging API → Channel access token (long-lived) |
| `ALLOWED_LINE_USER_IDS` | userId ของคนที่ให้ดูยอดได้ คั่นด้วย comma — **ควรตั้งเสมอ** |
| `CLINITER_USERNAME` / `CLINITER_PASSWORD` | บัญชีที่ใช้ล็อกอิน Cliniter |
| `CLINITER_BASE_URL` | `https://wisedentalclinic.cliniterdental3.com` |

### หา LINE userId ของตัวเอง

ทิ้ง `ALLOWED_LINE_USER_IDS` ว่างไว้ก่อน แล้ว deploy → ทักบอทหนึ่งครั้ง → ดู log
จะเจอบรรทัด `"message":"ได้รับข้อความ","userId":"Uxxxxxxxx..."` เอา userId นั้นไปใส่แล้ว deploy ใหม่

## ตรวจสอบตัวเลขก่อนใช้งานจริง

**ทำขั้นตอนนี้ก่อนเปิดใช้เสมอ** — ทดสอบดึงยอดโดยไม่ต้องผ่าน LINE

```bash
npm run check:income              # ยอดวันนี้
npm run check:income -- 2026-09-05  # ยอดวันที่ระบุ
```

เอาตัวเลขที่ได้ไปเทียบกับหน้า `report/income-simple-daily` บนเว็บจริง
- **ตรงกัน** → ใช้ได้เลย
- **ไม่ตรง / error** → ไปที่หัวข้อถัดไป

## จูนตัวอ่านยอด

ถ้าตัวเลขไม่ตรงหรืออ่านไม่ออก ให้ดัมพ์ HTML จริงออกมาดู

```bash
npm run debug:dump          # ได้ไฟล์ debug-output/report-YYYY-MM-DD.html
```

เปิดไฟล์นั้นในเบราว์เซอร์ → คลิกขวาที่ตัวเลขยอดรวม → Inspect → หา CSS selector ของมัน
แล้วใส่ใน `.env`

```bash
CLINITER_TOTAL_SELECTOR=#total-amount        # ตัวอย่าง
```

ค่าอื่นที่จูนได้เมื่อการเดาอัตโนมัติไม่ตรง

```bash
CLINITER_USERNAME_FIELD=username    # ถ้าหาช่อง username ในฟอร์มไม่เจอ
CLINITER_PASSWORD_FIELD=password
CLINITER_REPORT_QUERY=date={date}   # query string สำหรับเลือกวันย้อนหลัง
CLINITER_DATE_FORMAT=YYYY-MM-DD     # หรือ DD/MM/BBBB ถ้า Cliniter ใช้ พ.ศ.
```

> การถามยอด **ของวันนี้** ไม่ต้องตั้ง `CLINITER_REPORT_QUERY` เพราะหน้ารายงานเปล่า ๆ
> แสดงของวันนี้อยู่แล้ว — ตั้งเมื่ออยากถามยอดย้อนหลังเท่านั้น

## รันในเครื่อง

```bash
npm run dev        # โหมดพัฒนา (auto-reload)
npm test           # รันชุดทดสอบ
npm run typecheck  # ตรวจ type
```

## Deploy

บอทเป็น HTTP server ธรรมดา ใช้ที่ไหนก็ได้ที่รัน Docker ได้ ตัวอย่างด้วย Google Cloud Run

```bash
gcloud run deploy abduulbot \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars TZ=Asia/Bangkok,CLINITER_BASE_URL=https://wisedentalclinic.cliniterdental3.com \
  --set-env-vars ALLOWED_LINE_USER_IDS=Uxxxxxxxx \
  --set-secrets LINE_CHANNEL_SECRET=line-secret:latest,LINE_CHANNEL_ACCESS_TOKEN=line-token:latest \
  --set-secrets CLINITER_USERNAME=cliniter-user:latest,CLINITER_PASSWORD=cliniter-pass:latest
```

> ใส่รหัสผ่าน Cliniter ผ่าน Secret Manager หรือระบบ secret ของแพลตฟอร์มเสมอ
> **อย่า commit ไฟล์ `.env` ลง git** (มี `.gitignore` กันไว้ให้แล้ว)

เสร็จแล้วเอา URL ที่ได้ไปตั้งเป็น **Webhook URL** ใน LINE Developers Console

```
https://<โดเมนที่ deploy>/webhook
```

แล้วเปิด "Use webhook" และปิด "Auto-reply messages" กับ "Greeting messages"

ตรวจว่าเซิร์ฟเวอร์ยังมีชีวิตได้ที่ `GET /healthz`

## โครงสร้างโค้ด

```
src/
  index.ts              จุดเริ่ม — Express + LINE webhook + ตรวจลายเซ็น
  config.ts             อ่านและตรวจ environment variables
  cliniter/
    http.ts             cookie jar + ตาม redirect เอง
    login-form.ts       ตรวจจับฟอร์มล็อกอินและ CSRF token อัตโนมัติ
    client.ts           ล็อกอิน จัดการ session ดึงรายงาน แคชสั้น ๆ
    parse.ts            แปลง HTML เป็นตัวเลขยอด (เดาหลายชั้น)
  line/
    intent.ts           ตีความคำถามภาษาไทย
    handler.ts          ตัดสินใจว่าจะตอบอะไร
    messages.ts         ข้อความตอบกลับภาษาไทย
  util/                 วันที่ (เวลาไทย/พ.ศ.), ตัวเลข, log
scripts/
  check-income.ts       ทดสอบดึงยอดโดยไม่ผ่าน LINE
  debug-fetch.ts        ดัมพ์ HTML จริงไว้หา selector
```

## ความปลอดภัย

- ตรวจลายเซ็น `X-Line-Signature` ทุก request — ลายเซ็นไม่ผ่านตอบ 401
- `ALLOWED_LINE_USER_IDS` กันไม่ให้คนอื่นที่เพิ่มเพื่อนกับ OA ดูยอดคลินิกได้
  (การตรวจสิทธิ์เกิด **ก่อน** เรียก Cliniter)
- ข้อความ error ที่ตอบกลับผู้ใช้ไม่มีรายละเอียดภายในระบบ — รายละเอียดอยู่ใน log เท่านั้น
- ไม่มี log ไหนบันทึกรหัสผ่าน Cliniter
