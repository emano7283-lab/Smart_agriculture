// =====================================================================
// طبقة البلوكشين الداخلية (Hash-Chain على SQLite)
// كل عملية (إضافة عقار / حذف عقار / إنشاء عقد) تُسجَّل ككتلة لها:
//   - hash      : SHA-256( prevHash + type + JSON.stringify(data) + timestamp )
//   - prevHash  : هاش الكتلة السابقة (genesis = 64 صفر)
//   - data      : محتوى المعاملة كـ JSON
// السلسلة قابلة للتحقق لاحقاً عبر verifyChain() — أي تعديل لكتلة قديمة
// يكسر الهاش ويُكشف فوراً (هذا جوهر التوثيق بالـ blockchain).
// =====================================================================

const crypto = require('crypto');

const GENESIS_PREV_HASH = '0'.repeat(64);

function sha256(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * يُهيّئ جدول blockchain_log إذا لم يكن موجوداً.
 */
function initBlockchain(db, saveDatabase) {
    db.run(`CREATE TABLE IF NOT EXISTS blockchain_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        prevHash TEXT NOT NULL,
        hash TEXT NOT NULL,
        timestamp INTEGER NOT NULL
    );`);
    saveDatabase();
}

/**
 * يُرجع آخر كتلة في السلسلة (أو null إن لم توجد).
 */
function getLastBlock(db) {
    const stmt = db.prepare("SELECT * FROM blockchain_log ORDER BY id DESC LIMIT 1");
    let last = null;
    if (stmt.step()) last = stmt.getAsObject();
    stmt.free();
    return last;
}

/**
 * يضيف كتلة جديدة للسلسلة ويُرجعها.
 *  type : "ADD_PROPERTY" | "DELETE_PROPERTY" | "CREATE_CONTRACT"
 *  data : object يصف المعاملة (سيُخزَّن JSON.stringified)
 */
function addBlock(db, saveDatabase, type, data) {
    const last = getLastBlock(db);
    const prevHash = last ? last.hash : GENESIS_PREV_HASH;
    const timestamp = Date.now();
    const dataStr = JSON.stringify(data);
    const hash = sha256(prevHash + type + dataStr + timestamp);

    db.run(
        `INSERT INTO blockchain_log (type, data, prevHash, hash, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        [type, dataStr, prevHash, hash, timestamp]
    );
    saveDatabase();

    return { type, data, prevHash, hash, timestamp };
}

/**
 * يُرجع كل السلسلة (للعرض / التدقيق).
 */
function getChain(db) {
    const stmt = db.prepare("SELECT * FROM blockchain_log ORDER BY id ASC");
    const blocks = [];
    while (stmt.step()) {
        const b = stmt.getAsObject();
        b.data = JSON.parse(b.data);
        blocks.push(b);
    }
    stmt.free();
    return blocks;
}

/**
 * يتحقق من سلامة السلسلة عبر إعادة حساب الهاشات.
 * يُرجع { valid: true } أو { valid: false, brokenAt: id }.
 */
function verifyChain(db) {
    const stmt = db.prepare("SELECT * FROM blockchain_log ORDER BY id ASC");
    let prev = GENESIS_PREV_HASH;
    while (stmt.step()) {
        const b = stmt.getAsObject();
        const recomputed = sha256(b.prevHash + b.type + b.data + b.timestamp);
        if (b.prevHash !== prev || recomputed !== b.hash) {
            stmt.free();
            return { valid: false, brokenAt: b.id };
        }
        prev = b.hash;
    }
    stmt.free();
    return { valid: true };
}

module.exports = { initBlockchain, addBlock, getChain, verifyChain };
