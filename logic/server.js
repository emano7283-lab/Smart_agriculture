// =====================================================================
// Smart Property — Server (طبقة المنطق / السيرفر)
// =====================================================================
const express     = require('express');
const fs          = require('fs');
const path        = require('path');
const bodyParser  = require('body-parser');
const initSqlJs   = require('sql.js');
const multer      = require('multer');

const { initBlockchain, addBlock, getChain, verifyChain } = require('./blockchain');

const app  = express();
const PORT = 3000;

// ===== مسارات الجذور (طبقة العرض / البيانات) =====
const ROOT       = path.join(__dirname, '..');             // smart-proj/
const VIEWS_DIR  = path.join(ROOT, 'presentation');        // طبقة العرض
const LOGIC_DIR  = path.join(ROOT, 'logic');               // طبقة المنطق
const DATA_DIR   = path.join(ROOT, 'data');                // طبقة البيانات
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const DOCS_DIR   = path.join(DATA_DIR, 'ownership_docs');
const DB_FILE    = path.join(DATA_DIR, 'smart.sqlite');

// ===== Middleware =====
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// ===== Multer (رفع الصور والوثائق) =====
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let dir;
        if (file.fieldname === "image")          dir = IMAGES_DIR;
        if (file.fieldname === "ownershipDocs")  dir = DOCS_DIR;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// ===== ملفات ثابتة =====
app.use(express.static(VIEWS_DIR));                // home.html, *.css …
app.use('/logic',           express.static(LOGIC_DIR));
app.use('/images',          express.static(IMAGES_DIR));
app.use('/ownership_docs',  express.static(DOCS_DIR));

// ===== صفحات HTML =====
app.get('/',               (req, res) => res.sendFile(path.join(VIEWS_DIR, 'home.html')));
app.get('/home.html',      (req, res) => res.sendFile(path.join(VIEWS_DIR, 'home.html')));
app.get('/sign.html',      (req, res) => res.sendFile(path.join(VIEWS_DIR, 'sign.html')));
app.get('/login',          (req, res) => res.sendFile(path.join(VIEWS_DIR, 'sign.html')));
app.get('/property.html',  (req, res) => res.sendFile(path.join(VIEWS_DIR, 'property.html')));
app.get('/contracts.html', (req, res) => res.sendFile(path.join(VIEWS_DIR, 'contracts.html')));

// ===== قاعدة البيانات =====
let db;

async function initDatabase() {
    const SQL = await initSqlJs({
        locateFile: file => path.join(ROOT, 'node_modules/sql.js/dist', file)
    });

    db = fs.existsSync(DB_FILE)
        ? new SQL.Database(fs.readFileSync(DB_FILE))
        : new SQL.Database();

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        email     TEXT UNIQUE NOT NULL,
        password  TEXT NOT NULL
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS properties (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        propertyName      TEXT,
        price             TEXT,
        propertyType      TEXT,
        location          TEXT,
        description       TEXT,
        image             TEXT,
        ownershipDocs     TEXT,
        ownerName         TEXT,
        ownerNationalId   TEXT
    );`);

    // ترقية الجدول: إضافة عمود ownerEmail لو غير موجود
    try { db.run("ALTER TABLE properties ADD COLUMN ownerEmail TEXT"); } catch (e) {}

    db.run(`CREATE TABLE IF NOT EXISTS contracts (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        propertyId      INTEGER NOT NULL,
        action          TEXT NOT NULL,                -- "buy" | "rent"
        clientEmail     TEXT,
        clientName      TEXT,
        clientNationalId TEXT,
        clientPhone     TEXT,
        paymentMethod   TEXT,
        startDate       TEXT,
        durationMonths  INTEGER,
        price           TEXT,
        ownerEmail      TEXT,
        txHash          TEXT,                          -- هاش الكتلة على البلوكشين
        createdAt       INTEGER
    );`);

    initBlockchain(db, saveDatabase);
    saveDatabase();
}

function saveDatabase() {
    fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
}

// =====================================================================
// حالة العقار  (محسوبة من جدول contracts)
//   - sold      : أي عقد buy يجعل العقار مبيعاً نهائياً
//   - rented    : أي عقد rent لم تنتهِ مدّته بعد
//   - available : غير ذلك
// =====================================================================
function computePropertyStatus(propertyId) {
    const stmt = db.prepare(`
        SELECT action, startDate, durationMonths
        FROM contracts
        WHERE propertyId = ?
        ORDER BY createdAt DESC
    `);
    stmt.bind([propertyId]);
    const all = [];
    while (stmt.step()) all.push(stmt.getAsObject());
    stmt.free();

    // أي عقد بيع => مباع نهائياً
    if (all.some(c => c.action === 'buy')) {
        return { status: 'sold' };
    }

    // ابحث عن عقد إيجار نشط
    const now = Date.now();
    for (const c of all) {
        if (c.action !== 'rent' || !c.startDate) continue;
        const start  = new Date(c.startDate).getTime();
        if (isNaN(start)) continue;
        const months = Number(c.durationMonths || 0);
        const endTs  = start + months * 30 * 24 * 60 * 60 * 1000;
        if (now < endTs) {
            return { status: 'rented', untilDate: endTs };
        }
    }

    return { status: 'available' };
}

// =====================================================================
// AUTH
// =====================================================================

// تسجيل الدخول
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const stmt = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?');
    stmt.bind([email, password]);
    if (stmt.step()) {
        stmt.free();
        return res.json({ success: true, email });
    }
    stmt.free();
    res.json({ success: false, message: 'Email or password incorrect.' });
});

// إنشاء حساب
app.post('/signup', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.json({ success: false, message: 'Email and password are required.' });
    }

    // هل الإيميل موجود؟
    const check = db.prepare('SELECT id FROM users WHERE email = ?');
    check.bind([email]);
    if (check.step()) {
        check.free();
        return res.json({ success: false, message: 'This email is already registered.' });
    }
    check.free();

    try {
        db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, password]);
        saveDatabase();
        res.json({ success: true, email });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: 'Could not create account.' });
    }
});

// =====================================================================
// PROPERTIES
// =====================================================================

// إضافة عقار  (يُسجَّل على البلوكشين)
app.post('/add-property', upload.fields([
    { name: "image",          maxCount: 1 },
    { name: "ownershipDocs",  maxCount: 5 }
]), (req, res) => {
    const {
        propertyName, price, propertyType, location, description,
        ownerName, ownerNationalId, ownerEmail
    } = req.body;

    const image         = req.files.image
        ? `/images/${req.files.image[0].filename}` : "";
    const ownershipDocs = req.files.ownershipDocs
        ? req.files.ownershipDocs.map(f => `/ownership_docs/${f.filename}`) : [];

    try {
        db.run(`INSERT INTO properties (
            propertyName, price, propertyType, location, description,
            image, ownershipDocs, ownerName, ownerNationalId, ownerEmail
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            propertyName, price, propertyType, location, description,
            image, JSON.stringify(ownershipDocs),
            ownerName, ownerNationalId, ownerEmail || null
        ]);

        // آخر id (sql.js)
        const idStmt = db.prepare("SELECT last_insert_rowid() AS id");
        idStmt.step();
        const newId = idStmt.getAsObject().id;
        idStmt.free();

        // 🔗 سجِّل على البلوكشين
        const block = addBlock(db, saveDatabase, 'ADD_PROPERTY', {
            propertyId: newId,
            propertyName, price, propertyType, location,
            ownerName, ownerNationalId, ownerEmail: ownerEmail || null
        });

        saveDatabase();
        res.json({ success: true, propertyId: newId, txHash: block.hash });
    } catch (err) {
        console.error(err);
        res.json({ success: false });
    }
});

// جلب جميع العقارات (للصفحة الرئيسية) — أو فقط الخاصة بمستخدم لو مرَّ ?owner=
app.get('/get-properties', (req, res) => {
    const owner = req.query.owner;
    try {
        let stmt;
        if (owner) {
            stmt = db.prepare("SELECT * FROM properties WHERE ownerEmail = ?");
            stmt.bind([owner]);
        } else {
            stmt = db.prepare("SELECT * FROM properties");
        }
        const properties = [];
        while (stmt.step()) properties.push(stmt.getAsObject());
        stmt.free();

        // أرفق الحالة لكل عقار
        properties.forEach(p => {
            const s = computePropertyStatus(p.id);
            p.status      = s.status;
            p.statusUntil = s.untilDate || null;
        });

        res.json({ properties });
    } catch (err) {
        console.error(err);
        res.json({ properties: [] });
    }
});

// عقار واحد
app.get('/get-property/:id', (req, res) => {
    try {
        const stmt = db.prepare("SELECT * FROM properties WHERE id = ?");
        stmt.bind([req.params.id]);
        let property = null;
        if (stmt.step()) {
            property = stmt.getAsObject();
            property.ownershipDocs = property.ownershipDocs
                ? JSON.parse(property.ownershipDocs) : [];
            const s = computePropertyStatus(property.id);
            property.status      = s.status;
            property.statusUntil = s.untilDate || null;
        }
        stmt.free();
        res.json({ property });
    } catch (err) {
        console.error(err);
        res.json({ property: null });
    }
});

// تحديث عقار  (الـ endpoint كان مفقوداً في الإصدار القديم)
app.put('/update-property/:id', (req, res) => {
    const id = req.params.id;
    const { propertyName, price, propertyType, location, description } = req.body;
    try {
        db.run(
            `UPDATE properties
             SET propertyName=?, price=?, propertyType=?, location=?, description=?
             WHERE id=?`,
            [propertyName, price, propertyType, location, description, id]
        );
        saveDatabase();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.json({ success: false });
    }
});

// حذف عقار  (يُسجَّل على البلوكشين)
app.delete('/delete-property/:id', (req, res) => {
    const id = req.params.id;
    try {
        // اقرأ معلومات العقار قبل الحذف للتسجيل
        const sel = db.prepare("SELECT propertyName, ownerEmail FROM properties WHERE id = ?");
        sel.bind([id]);
        let snapshot = null;
        if (sel.step()) snapshot = sel.getAsObject();
        sel.free();

        db.run("DELETE FROM properties WHERE id = ?", [id]);

        const block = addBlock(db, saveDatabase, 'DELETE_PROPERTY', {
            propertyId: Number(id),
            propertyName: snapshot ? snapshot.propertyName : null,
            ownerEmail:   snapshot ? snapshot.ownerEmail   : null
        });

        saveDatabase();
        res.json({ success: true, txHash: block.hash });
    } catch (err) {
        console.error(err);
        res.json({ success: false });
    }
});

// =====================================================================
// CONTRACTS  (Buy / Rent — يُسجَّل على البلوكشين)
// =====================================================================
app.post('/create-contract', (req, res) => {
    const {
        propertyId, action,
        clientName, clientNationalId, clientEmail, clientPhone,
        paymentMethod, startDate, durationMonths
    } = req.body;

    if (!propertyId || !action) {
        return res.json({ success: false, message: 'Missing propertyId or action.' });
    }

    // الإيجار يحتاج مدّة وتاريخ بداية
    if (action === 'rent') {
        if (!startDate) {
            return res.json({ success: false, message: 'Start date is required for rent.' });
        }
        if (!durationMonths || Number(durationMonths) <= 0) {
            return res.json({ success: false, message: 'Duration (in months) must be greater than 0.' });
        }
    }

    // 🛡️ منع التوثيق المكرر
    const status = computePropertyStatus(propertyId);
    if (status.status === 'sold') {
        return res.json({
            success: false,
            message: 'This property has already been sold and cannot be contracted again.'
        });
    }
    if (status.status === 'rented') {
        const until = new Date(status.untilDate).toLocaleDateString();
        return res.json({
            success: false,
            message: `This property is currently rented until ${until}. Please try again later.`
        });
    }

    try {
        // اجلب بيانات العقار (للسعر والمالك)
        const pStmt = db.prepare("SELECT price, ownerEmail FROM properties WHERE id = ?");
        pStmt.bind([propertyId]);
        let prop = null;
        if (pStmt.step()) prop = pStmt.getAsObject();
        pStmt.free();
        if (!prop) return res.json({ success: false, message: 'Property not found.' });

        const createdAt = Date.now();

        db.run(
            `INSERT INTO contracts (
                propertyId, action, clientEmail, clientName, clientNationalId,
                clientPhone, paymentMethod, startDate, durationMonths, price,
                ownerEmail, txHash, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                propertyId, action, clientEmail || null, clientName, clientNationalId,
                clientPhone, paymentMethod, startDate, durationMonths || null, prop.price,
                prop.ownerEmail, null, createdAt
            ]
        );

        const idStmt = db.prepare("SELECT last_insert_rowid() AS id");
        idStmt.step();
        const newId = idStmt.getAsObject().id;
        idStmt.free();

        // 🔗 البلوكشين
        const block = addBlock(db, saveDatabase, 'CREATE_CONTRACT', {
            contractId: newId,
            propertyId: Number(propertyId),
            action,
            clientEmail, clientName, clientNationalId,
            price: prop.price,
            ownerEmail: prop.ownerEmail,
            startDate,
            durationMonths: durationMonths || null
        });

        // حدِّث txHash في صف العقد
        db.run("UPDATE contracts SET txHash = ? WHERE id = ?", [block.hash, newId]);
        saveDatabase();

        res.json({ success: true, contractId: newId, txHash: block.hash });
    } catch (err) {
        console.error(err);
        res.json({ success: false });
    }
});

// عقود مستخدم معيّن (مشترياته/استئجاراته) + معلومات العقار المرافقة
app.get('/get-my-contracts', (req, res) => {
    const email = req.query.email;
    if (!email) return res.json({ contracts: [] });
    try {
        const stmt = db.prepare(`
            SELECT c.*, p.propertyName, p.location, p.propertyType, p.image
            FROM contracts c
            LEFT JOIN properties p ON p.id = c.propertyId
            WHERE c.clientEmail = ?
            ORDER BY c.createdAt DESC
        `);
        stmt.bind([email]);
        const contracts = [];
        while (stmt.step()) contracts.push(stmt.getAsObject());
        stmt.free();
        res.json({ contracts });
    } catch (err) {
        console.error(err);
        res.json({ contracts: [] });
    }
});

// العقود التي تمت على عقارات هذا المالك (يراها المالك في لوحته)
app.get('/get-contracts-on-my-properties', (req, res) => {
    const email = req.query.owner;
    if (!email) return res.json({ contracts: [] });
    try {
        const stmt = db.prepare(`
            SELECT c.*, p.propertyName, p.location, p.propertyType
            FROM contracts c
            JOIN properties p ON p.id = c.propertyId
            WHERE p.ownerEmail = ?
            ORDER BY c.createdAt DESC
        `);
        stmt.bind([email]);
        const contracts = [];
        while (stmt.step()) {
            const c = stmt.getAsObject();
            // احسب تاريخ نهاية الإيجار للعرض
            if (c.action === 'rent' && c.startDate && c.durationMonths) {
                const start  = new Date(c.startDate).getTime();
                if (!isNaN(start)) {
                    const endTs = start + Number(c.durationMonths) * 30 * 24 * 60 * 60 * 1000;
                    c.endDate = endTs;
                }
            }
            contracts.push(c);
        }
        stmt.free();
        res.json({ contracts });
    } catch (err) {
        console.error(err);
        res.json({ contracts: [] });
    }
});

// =====================================================================
// BLOCKCHAIN — عرض السلسلة + التحقق
// =====================================================================
app.get('/blockchain',         (req, res) => res.json({ chain: getChain(db) }));
app.get('/blockchain/verify',  (req, res) => res.json(verifyChain(db)));

// =====================================================================
// START
// =====================================================================
initDatabase().then(() => {
    app.listen(PORT, () =>
        console.log(`✅ Server running on http://localhost:${PORT}`));
});
