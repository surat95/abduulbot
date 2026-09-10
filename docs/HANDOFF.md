# อับดุล — ฟีเจอร์ "ยอดคลินิกวันนี้" (คู่มือส่งมอบ)

เอกสารนี้สรุปงานที่ทำไปแล้วทั้งหมด สำหรับเอาไปทำต่อบน MacBook

- **Repo:** https://github.com/surat95/abduulbot
- **Branch:** `claude/abdul-clinic-income-bot-3kptd5`
- **สถานะ:** โค้ดเสร็จ ทดสอบ 49 เคสผ่าน แต่ **ยังไม่เคยต่อกับ Cliniter จริง**

---

## 🚨 อ่านหัวข้อนี้ก่อน — ความเสี่ยงที่จะไปกวน project อับดุลตัวอื่น

ความกังวลของคุณถูกต้องครับ และมีจุดที่**ชนแน่นอน 1 จุด**

### LINE channel หนึ่งตั้ง Webhook URL ได้แค่ **อันเดียว**

ถ้าอับดุลตอนนี้ทำได้หลายอย่างอยู่แล้ว (ถามตอบความรู้ผู้ช่วย, ดึง post TikTok) แปลว่ามีบริการอะไรอยู่ตัวหนึ่ง**นั่งรับ webhook ของ channel นี้อยู่แล้ว**

ดังนั้น **ถ้าเอา URL ของบอทตัวใหม่ไปทับใน LINE Developers Console:**

| ผลที่เกิด | รายละเอียด |
|---|---|
| ❌ ฟีเจอร์เดิมหยุดทำงานทั้งหมด | LINE จะส่ง event ไปที่บอทใหม่เท่านั้น ตัวเดิมไม่ได้รับอะไรเลย |
| ❌ ถามเรื่องอื่นจะได้คำตอบมั่ว | บอทใหม่รู้จักแค่คำถามเรื่องยอด อย่างอื่นตอบ "ขอโทษครับ ผมยังไม่เข้าใจคำถามนี้" |

**อย่าเปลี่ยน Webhook URL จนกว่าจะเลือกทางเลือกด้านล่างได้ก่อน**

### ทางเลือกในการรวมเข้าด้วยกัน

#### ✅ ทางเลือก A — ยกโมดูล Cliniter ไปใส่ใน project อับดุลเดิม (แนะนำ ถ้าของเดิมเป็น Node.js)

Webhook URL **ไม่ต้องแตะเลย** ของเดิมไม่กระทบแม้แต่นิดเดียว

โค้ดส่วนที่คุยกับ Cliniter ออกแบบให้ยกไปใช้ที่อื่นได้ตั้งแต่แรก — ก็อปแค่ 2 โฟลเดอร์

```
src/cliniter/     ← ล็อกอิน + ดึง + อ่านยอด
src/util/         ← วันที่ (เวลาไทย/พ.ศ.), ตัวเลข, log
```

ทั้งสองโฟลเดอร์นี้พึ่งพา npm package แค่ **`cheerio`** ตัวเดียว (ไม่ต้องมี express หรือ @line/bot-sdk) ตรวจแล้วว่าไม่มีอะไรผูกกับส่วน LINE เลย

แล้วในโค้ดเดิมของอับดุล เพิ่มประมาณนี้

```ts
import { CliniterClient } from './cliniter/client.ts';
import { todayIn } from './util/datetime.ts';
import { formatBaht } from './util/number.ts';

const cliniter = new CliniterClient({
  baseUrl: 'https://wisedentalclinic.cliniterdental3.com',
  loginPath: '/login',
  reportPath: '/report/income-simple-daily',
  username: process.env.CLINITER_USERNAME!,
  password: process.env.CLINITER_PASSWORD!,
  dateFormat: 'YYYY-MM-DD',
});

// ในตัว router ที่มีอยู่แล้ว เพิ่มเงื่อนไขหนึ่งอัน
if (/ยอด|รายได้|กี่บาท/.test(ข้อความ)) {
  const report = await cliniter.getIncome(todayIn('Asia/Bangkok'));
  return `ยอดวันนี้ ${formatBaht(report.total)}`;
}
```

ถ้าอยากได้ข้อความตอบสวย ๆ พร้อมรายละเอียดแยกช่องทางชำระเงิน ก็ก็อป `src/line/messages.ts`
กับ `src/line/intent.ts` ไปด้วย (สองไฟล์นี้ก็ไม่ผูกกับ LINE SDK เหมือนกัน)

#### ✅ ทางเลือก B — รันแยกเป็น service แล้วให้บอทเดิมเรียกมาถาม

เหมาะเมื่อ project เดิม**ไม่ใช่ Node.js** (เช่น n8n, Make, Python, Google Apps Script)

```
LINE ──webhook──> อับดุลตัวเดิม (ไม่เปลี่ยน) ──HTTP──> service ยอดคลินิก (ตัวใหม่)
```

- บอทตัวใหม่**ไม่รับ webhook จาก LINE เลย** เป็นแค่ API ภายใน
- บอทเดิมยังเป็นคนตอบ LINE คนเดียว → ไม่มีปัญหาเรื่องแย่งกันตอบ
- ตอนนี้โค้ดยัง**ไม่มี** endpoint แบบนี้ (มีแค่ `/webhook` กับ `/healthz`) — บอกผมได้ ผมเพิ่ม `GET /income?date=...` พร้อม API key ให้

> ⚠️ เหตุผลที่ต้องให้บอทเดิมเป็นคนตอบคนเดียว: `replyToken` ของ LINE **ใช้ได้ครั้งเดียว** ถ้าสองบริการรับ event เดียวกันแล้วตอบทั้งคู่ ตัวที่ตอบทีหลังจะ error

#### ⚠️ ทางเลือก C — สร้าง LINE OA ใหม่แยกอีกตัว

ไม่ชนอะไรเลยจริง แต่จะกลายเป็นบอทคนละตัว ต้องเพิ่มเพื่อนใหม่และสลับห้องแชท — เดาว่าไม่ใช่สิ่งที่คุณอยากได้

---

### จุดอื่น ๆ ที่กังวล — ตรวจให้แล้ว

| จุด | ชนไหม | หมายเหตุ |
|---|---|---|
| **Webhook URL** | 🚨 **ชนแน่** | ตามหัวข้อด้านบน — จุดเดียวที่ชนจริง |
| **บัญชี Cliniter** | ⚠️ อาจชน | ถ้ามี project อื่นล็อกอิน Cliniter ด้วย user เดียวกัน บางระบบตัด session ตัวเก่าทิ้งเมื่อล็อกอินใหม่ → **แนะนำสร้าง user แยกให้บอทโดยเฉพาะ** (สิทธิ์อ่านรายงานพอ) |
| **Port 8080** | ⚠️ ชนตอนรันในเครื่อง | ถ้า project อื่นใช้ 8080 อยู่ เปลี่ยน `PORT=8081` ใน `.env` ได้เลย |
| Channel secret / access token | ✅ ไม่ชน | ใช้ค่าเดียวกันกับ project เดิมได้ เป็นการอ่านค่าเฉย ๆ |
| `node_modules` | ✅ ไม่ชน | ติดตั้งในโฟลเดอร์ project ตัวเองล้วน ไม่มี global install |
| ไฟล์ `.env` | ✅ ไม่ชน | อยู่ในโฟลเดอร์ project นี้เท่านั้น |
| git repo | ✅ ไม่ชน | คนละ repo คนละโฟลเดอร์ |
| การตั้งค่าในเครื่อง Mac | ✅ ไม่ชน | ไม่ได้แก้ไฟล์ใด ๆ นอกโฟลเดอร์ project |

**สรุป:** สิ่งที่ผมทำเป็น project ที่แยกขาดจากกันสมบูรณ์ — ที่ต้องระวังจริง ๆ มีแค่
**Webhook URL** (ชนแน่) และ **บัญชี Cliniter ที่ใช้ร่วมกัน** (อาจชน) เท่านั้น

---

## สิ่งที่ทำไปแล้ว

บอทที่ตอบคำถามอย่าง *"วันนี้ยอดคลินิกของฉันกี่บาทแล้ว"* โดยล็อกอินเข้า Cliniter
แล้วอ่านยอดจากหน้า `report/income-simple-daily`

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

### คำถามที่รองรับ

| ถามว่า | ได้อะไร |
|---|---|
| `วันนี้ยอดเท่าไหร่`, `ยอดคลินิกวันนี้กี่บาท` | ยอดรวมวันนี้ |
| `ยอดเมื่อวาน` | ยอดเมื่อวาน |
| `ยอดวันที่ 5/9`, `ยอด 5/9/2569` | วันที่ระบุ (รับทั้ง พ.ศ. และ ค.ศ.) |
| `help` | วิธีใช้ |

### เรื่องที่ตั้งใจทำเป็นพิเศษ

- **ใช้เวลาไทยตัดสินว่าวันไหนคือ "วันนี้"** ไม่ใช่ UTC ของเซิร์ฟเวอร์ — ถ้าไม่ทำ ช่วงเที่ยงคืนถึงตี 7 ตามเวลาไทยจะไปดึงยอดของเมื่อวาน
- **ล็อกอินใหม่ให้เองเมื่อ session หมดอายุ** ไม่ต้องรีสตาร์ท
- **ตรวจจับฟอร์มล็อกอินและ CSRF token อัตโนมัติ** — เพราะไม่รู้ชื่อ field จริงของ Cliniter
- **แคชยอด 60 วินาที** กันยิงถี่ใส่ Cliniter เวลาถามซ้ำ ๆ
- **ตรวจสิทธิ์ก่อนแตะข้อมูลรายได้** คนที่ไม่อยู่ใน allowlist ถูกปฏิเสธก่อนที่จะมีการเรียก Cliniter
- **กันไม่ให้หยิบ "รวมจำนวนคนไข้" มาเป็นยอดเงิน** — กับดักที่เจอบ่อยเวลา scrape ตารางรายงาน

### โครงสร้างไฟล์

```
src/
  index.ts              จุดเริ่ม — Express + LINE webhook + ตรวจลายเซ็น
  config.ts             อ่านและตรวจ environment variables
  cliniter/             ⭐ ส่วนนี้ยกไปใช้ที่อื่นได้ (ต้องการแค่ cheerio)
    http.ts             cookie jar + ตาม redirect เอง
    login-form.ts       ตรวจจับฟอร์มล็อกอิน + CSRF token อัตโนมัติ
    client.ts           ล็อกอิน จัดการ session ดึงรายงาน แคช
    parse.ts            แปลง HTML เป็นตัวเลขยอด (เดา 3 ชั้น)
    types.ts
  line/
    intent.ts           ตีความคำถามภาษาไทย
    handler.ts          ตัดสินใจว่าจะตอบอะไร
    messages.ts         ข้อความตอบกลับภาษาไทย
  util/                 ⭐ ยกไปใช้ที่อื่นได้ วันที่/ตัวเลข/log
scripts/
  check-income.ts       ทดสอบดึงยอดโดยไม่ผ่าน LINE
  debug-fetch.ts        ดัมพ์ HTML จริงไว้หา selector
test/                   49 เคส
Dockerfile
```

---

## เอาลง MacBook

ต้องมี Node.js 20 ขึ้นไป (เช็คด้วย `node -v`)

```bash
git clone https://github.com/surat95/abduulbot.git
cd abduulbot
git checkout claude/abdul-clinic-income-bot-3kptd5
npm install
cp .env.example .env
```

แล้วแก้ `.env` ใส่อย่างน้อย 2 ค่านี้ (แค่นี้ก็ทดสอบดึงยอดได้ ยังไม่ต้องมี LINE token)

```bash
CLINITER_USERNAME=ชื่อผู้ใช้ Cliniter
CLINITER_PASSWORD=รหัสผ่าน
```

---

## ⭐ ขั้นตอนสำคัญที่สุด — ตรวจว่าตัวเลขถูกต้อง

**ทำก่อนอย่างอื่นทั้งหมด** เพราะผมเขียนโค้ดนี้โดย**ยังไม่เคยเห็น HTML จริงของหน้ารายงาน**
(โดเมน Cliniter ถูก policy ของ session บล็อก เข้าไม่ได้ตอนพัฒนา)

```bash
npm run check:income
```

เอาตัวเลขที่ได้ไปเทียบกับหน้า `report/income-simple-daily` บนเว็บจริง

| ผลลัพธ์ | ทำอะไรต่อ |
|---|---|
| ✅ ตัวเลขตรงกัน | ใช้ได้เลย ไปขั้นตอน deploy |
| ❌ ตัวเลขไม่ตรง / error | ทำตามหัวข้อ "จูนตัวอ่านยอด" ด้านล่าง |

### จูนตัวอ่านยอด

```bash
npm run debug:dump      # ได้ไฟล์ debug-output/report-YYYY-MM-DD.html
open debug-output/report-*.html
```

คลิกขวาที่ตัวเลขยอดรวมในหน้านั้น → Inspect → หา CSS selector → ใส่ใน `.env`

```bash
CLINITER_TOTAL_SELECTOR=#total-amount     # ตัวอย่าง
```

ค่าอื่นที่จูนได้เมื่อการเดาอัตโนมัติไม่ตรง

```bash
CLINITER_USERNAME_FIELD=username     # ถ้าหาช่อง username ในฟอร์มไม่เจอ
CLINITER_PASSWORD_FIELD=password
CLINITER_REPORT_QUERY=date={date}    # query string สำหรับถามยอดย้อนหลัง
CLINITER_DATE_FORMAT=DD/MM/BBBB      # ถ้า Cliniter ใช้ พ.ศ. ใน URL
```

> ถามยอด**ของวันนี้**ไม่ต้องตั้ง `CLINITER_REPORT_QUERY` เพราะหน้ารายงานเปล่า ๆ แสดงของวันนี้อยู่แล้ว

**ถ้าจูนไม่ผ่าน ส่งไฟล์ `debug-output/report-*.html` มาให้ผม ผมจูนให้แม่นได้เลย**
(ลบข้อมูลคนไข้ออกก่อนได้ ผมต้องการดูแค่โครงสร้างตารางกับตัวเลขยอดรวม)

---

## รันในเครื่อง

```bash
npm run dev         # โหมดพัฒนา auto-reload
npm test            # 49 เคส
npm run typecheck   # ตรวจ type
```

---

## Deploy (ทำเมื่อเลือกทางเลือกได้แล้ว)

รายละเอียดครบใน `README.md` — สรุปสั้น ๆ ด้วย Google Cloud Run

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

- ใส่รหัสผ่าน Cliniter ผ่าน Secret Manager เสมอ **อย่า commit `.env`** (มี `.gitignore` กันไว้แล้ว)
- เช็คว่าเซิร์ฟเวอร์ยังมีชีวิตได้ที่ `GET /healthz`
- 🚨 **การตั้ง Webhook URL ให้อ่านหัวข้อความเสี่ยงด้านบนก่อน**

### หา LINE userId ของตัวเอง (สำหรับ allowlist)

ปล่อย `ALLOWED_LINE_USER_IDS` ว่างไว้ก่อน → ทักบอทหนึ่งครั้ง → ดู log
จะเจอ `"message":"ได้รับข้อความ","userId":"Uxxxxxxxx..."` → เอาไปใส่แล้ว deploy ใหม่

---

## ที่ทดสอบแล้ว vs. ที่ยังไม่ได้ทดสอบ

### ✅ ทดสอบแล้วว่าทำงานจริง

ผมตั้งเซิร์ฟเวอร์ Cliniter ปลอมขึ้นมาแล้วยิง webhook ที่เซ็นลายเซ็นถูกต้องเข้าไป ผ่านครบทั้งเส้น

- ล็อกอินพร้อม CSRF token → เก็บ cookie → ตาม 302 → เข้าหน้ารายงาน → อ่านยอดได้ 52,550 บาท
- ไม่ส่ง checkbox ที่ไม่ได้ติ๊ก (เหมือนที่เบราว์เซอร์ทำ)
- ลายเซ็นผิด → ตอบ 401
- คนที่ไม่อยู่ใน allowlist → ถูกปฏิเสธ**ก่อน**เรียก Cliniter
- error ที่ตอบผู้ใช้ไม่มีรายละเอียดภายในหลุดออกไป
- เทสต์ 49 เคส (การอ่านตัวเลข, ตรวจจับฟอร์ม, ตีความคำถาม, ข้อความตอบกลับ, เวลาไทย)

### ⚠️ ยังไม่ได้ทดสอบ

| เรื่อง | เพราะอะไร |
|---|---|
| **การต่อกับ Cliniter จริง** | โดเมนถูก egress policy บล็อกตอนพัฒนา → **นี่คือเหตุผลที่ต้องรัน `check:income` ก่อนใช้งาน** |
| **Docker build** | ไม่มี Docker ใน session ที่พัฒนา (ตรวจได้แค่ว่า path ที่ Dockerfile อ้างอิงมีครบ และ runtime ใช้แค่ 3 dependencies ที่เป็น production) |
| การเชื่อมกับ project อับดุลตัวอื่น | ยังไม่รู้ว่าของเดิมเขียนด้วยอะไร |

---

## สิ่งที่ผมทำต่อให้ได้ ถ้าต้องการ

1. **รวมเข้ากับ project อับดุลเดิม** — บอกว่าของเดิมเขียนด้วยอะไร / อยู่ repo ไหน แล้วผมทำให้
2. **เพิ่ม endpoint สำหรับทางเลือก B** — `GET /income?date=...` พร้อม API key
3. **จูน selector ให้แม่น** — ส่ง `debug-output/report-*.html` มา
4. **สรุปยอดส่งเข้า LINE อัตโนมัติทุกวันตอนปิดคลินิก** (push message + cron)
5. **เปิด PR ให้**
