# Smart Property — Real Estate Platform with Blockchain Documentation

منصة عقارات (Buy / Rent) موثَّقة عبر سلسلة هاش (Blockchain Hash-Chain).

## 🏗️ المعمارية الطبقية (Layered Architecture)

```
smart-proj/
├── presentation/           ← طبقة العرض (HTML + CSS فقط)
│   ├── home.html / home.css
│   ├── sign.html / sign.css
│   ├── property.html / property.css
│   └── contracts.html / contracts.css
│
├── logic/                  ← طبقة المنطق (JS — frontend + backend)
│   ├── server.js           السيرفر (Express)
│   ├── blockchain.js       طبقة Hash-Chain (SHA-256)
│   ├── home.js             منطق الصفحة الرئيسية
│   ├── sign.js             منطق Sign In / Sign Up
│   ├── property.js         منطق لوحة المالك
│   └── contracts.js        منطق صفحة العقد
│
├── data/                   ← طبقة البيانات
│   ├── smart.sqlite        قاعدة البيانات
│   ├── images/             صور العقارات
│   └── ownership_docs/     وثائق الملكية المرفوعة
│
├── blockchain/             ← العقد الذكي (للمرجعية)
│   └── SmartProperty.sol
│
├── package.json
└── node_modules/
```

## 🚀 التشغيل

```bash
npm start
# أو
node logic/server.js
```

ثم افتح: <http://localhost:3000>

## 👤 حساب جاهز للاختبار

- Email: `admin@gmail.com`
- Password: `12345`

أو سجِّل حساباً جديداً من زرّ **Sign Up**.

## 🔗 طبقة البلوكشين

كل العمليات الحسّاسة تُسجَّل في جدول `blockchain_log` كسلسلة هاش:

| النوع | متى | البيانات المحفوظة |
|---|---|---|
| `ADD_PROPERTY` | عند إضافة عقار | معرّف العقار + اسمه + المالك |
| `DELETE_PROPERTY` | عند حذف عقار | معرّف العقار + المالك |
| `CREATE_CONTRACT` | عند إبرام عقد بيع/إيجار | بيانات العقد كاملة |

كل كتلة:
- `prevHash` ← هاش الكتلة السابقة
- `hash`     ← `SHA-256(prevHash + type + data + timestamp)`

أيّ تعديل لكتلة قديمة يكسر السلسلة ويُكشَف عبر `GET /blockchain/verify`.

### عرض السلسلة كاملة

```
GET /blockchain          → كل الكتل
GET /blockchain/verify   → { valid: true/false }
```
