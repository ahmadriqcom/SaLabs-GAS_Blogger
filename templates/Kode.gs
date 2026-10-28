/**
 * ====================================================================
 * BACKEND API GOOGLE APPS SCRIPT
 * Standar Arsitektur: Decoupled Web App (Blogger + GAS + Spreadsheet)
 * ====================================================================
 */

// 1. CONFIGURATION
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
const APP_CONFIG = {
  APP_NAME: "Web App Generator",
  VERSION: "1.0.0",
  SESSION_DURATION_HOURS: 24
};

// 2. API ENTRY POINT
function doGet(e) {
  return jsonResponse({
    success: true,
    message: "API aktif dan siap menerima request.",
    version: APP_CONFIG.VERSION
  });
}

function doPost(e) {
  try {
    const rawContent = e.postData && e.postData.contents ? e.postData.contents : '{}';
    const request = JSON.parse(rawContent);

    const action = request.action;
    const payload = request.payload || {};
    const token = request.token || null;

    // 5. ROUTER
    const routes = {
      ping: () => ({ success: true, message: "PONG" }),
      login: () => handleLogin(payload),
      logout: () => handleLogout(token),
      checkSession: () => handleCheckSession(token),
      getItems: () => getItemsList(payload, token),
      createItem: () => createItemRecord(payload, token),
      updateItem: () => updateItemRecord(payload, token),
      deleteItem: () => deleteItemRecord(payload, token)
    };

    if (!routes[action]) {
      return jsonResponse({
        success: false,
        message: `Action '${action}' tidak valid atau tidak terdaftar.`,
        errorCode: "INVALID_ACTION",
        data: null
      });
    }

    const result = routes[action]();
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({
      success: false,
      message: error.message || "Terjadi kesalahan pada internal server.",
      errorCode: "SERVER_ERROR",
      data: null
    });
  }
}

// 3. RESPONSE HELPERS
function jsonResponse(result) {
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// 4. REQUEST PARSER & SANITIZATION
function sanitizeFormula(input) {
  if (typeof input === 'string' && /^[=+\-@]/.test(input)) {
    return "'" + input;
  }
  return input;
}

// 6. AUTHENTICATION & SESSION
function handleLogin(payload) {
  const { username, password } = payload;
  if (!username || !password) {
    return { success: false, message: "Username dan password wajib diisi.", errorCode: "INVALID_PAYLOAD" };
  }

  const sheet = getSheet("Users");
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: false, message: "Pengguna tidak ditemukan.", errorCode: "USER_NOT_FOUND" };

  const headers = data[0];
  const uIdx = headers.indexOf("username");
  const pIdx = headers.indexOf("password_hash");
  const sIdx = headers.indexOf("password_salt");
  const rIdx = headers.indexOf("role");
  const idIdx = headers.indexOf("id");

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[uIdx] === username && !row[headers.indexOf("deleted_at")]) {
      const calculatedHash = hashPasswordWithSalt(password, row[sIdx]);
      if (calculatedHash === row[pIdx]) {
        const rawToken = Utilities.getUuid();
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + APP_CONFIG.SESSION_DURATION_HOURS * 3600000).toISOString();

        const sessionSheet = getSheet("Sessions");
        sessionSheet.appendRow([
          Utilities.getUuid(),
          row[idIdx],
          tokenHash,
          expiresAt,
          new Date().toISOString(),
          new Date().toISOString(),
          "",
          payload.userAgent || "Unknown"
        ]);

        return {
          success: true,
          message: "Login berhasil.",
          data: {
            token: rawToken,
            user: { id: row[idIdx], name: row[headers.indexOf("name")], role: row[rIdx] }
          }
        };
      }
    }
  }
  return { success: false, message: "Kredensial tidak valid.", errorCode: "INVALID_CREDENTIALS" };
}

function handleLogout(token) {
  if (!token) return { success: true, message: "Session telah dibersihkan." };
  const tokenHash = hashToken(token);
  const sheet = getSheet("Sessions");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === tokenHash) {
      sheet.getRange(i + 1, 7).setValue(new Date().toISOString());
      break;
    }
  }
  return { success: true, message: "Logout berhasil." };
}

function handleCheckSession(token) {
  const session = validateSessionToken(token);
  if (!session.valid) return { success: false, message: "Session tidak valid atau kedaluwarsa.", errorCode: "SESSION_EXPIRED" };
  return { success: true, message: "Session aktif.", data: session.user };
}

function validateSessionToken(token) {
  if (!token) return { valid: false };
  const tokenHash = hashToken(token);
  const sSheet = getSheet("Sessions");
  const sData = sSheet.getDataRange().getValues();
  for (let i = 1; i < sData.length; i++) {
    if (sData[i][2] === tokenHash && !sData[i][6]) {
      if (new Date(sData[i][3]) < new Date()) return { valid: false };
      const userId = sData[i][1];
      const uSheet = getSheet("Users");
      const uData = uSheet.getDataRange().getValues();
      for (let j = 1; j < uData.length; j++) {
        if (uData[j][0] === userId && !uData[j][uData[0].indexOf("deleted_at")]) {
          return {
            valid: true,
            user: { id: uData[j][0], name: uData[j][1], role: uData[j][6] }
          };
        }
      }
    }
  }
  return { valid: false };
}

function hashPasswordWithSalt(password, salt) {
  const rawBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt, Utilities.Charset.UTF_8);
  return rawBytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

function hashToken(token) {
  const rawBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8);
  return rawBytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

// 7. AUTHORIZATION
function requireRole(sessionUser, allowedRoles = []) {
  if (!sessionUser || !allowedRoles.includes(sessionUser.role)) {
    throw new Error("Akses ditolak: role tidak memiliki wewenang.");
  }
}

// 8. DATABASE HELPERS
function getSpreadsheet() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error(`Sheet '${name}' tidak ditemukan.`);
  return sheet;
}

// 9. CACHE HELPERS
function getFromCache(key) {
  return CacheService.getScriptCache().get(key);
}

function putToCache(key, value, sec = 300) {
  CacheService.getScriptCache().put(key, JSON.stringify(value), sec);
}

function clearCache(key) {
  CacheService.getScriptCache().remove(key);
}

// 12. CRUD HANDLERS WITH PAGINATION & LOCK
function getItemsList(payload, token) {
  const page = Math.max(1, parseInt(payload.page) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(payload.limit) || 10));
  const search = (payload.search || "").toLowerCase().trim();

  const sheet = getSheet("Items");
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: true, message: "Data kosong", data: [], meta: { page: 1, limit, total: 0, totalPages: 0 } };
  }

  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[headers.indexOf("deleted_at")]) continue;
    
    const record = {};
    headers.forEach((h, idx) => record[h] = row[idx]);

    if (search) {
      const match = Object.values(record).some(val => String(val).toLowerCase().includes(search));
      if (!match) continue;
    }
    rows.push(record);
  }

  const total = rows.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedData = rows.slice(startIndex, startIndex + limit);

  return {
    success: true,
    message: "Data berhasil dimuat.",
    data: paginatedData,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1
    }
  };
}

function createItemRecord(payload, token) {
  const session = validateSessionToken(token);
  if (!session.valid) throw new Error("Autentikasi diperlukan.");

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet("Items");
    const id = Utilities.getUuid();
    const now = new Date().toISOString();

    const row = [
      id,
      sanitizeFormula(payload.name || ""),
      sanitizeFormula(payload.category || ""),
      Number(payload.price) || 0,
      Number(payload.stock) || 0,
      now,
      now,
      session.user.id,
      session.user.id,
      "",
      "active"
    ];

    sheet.appendRow(row);
    clearCache("dashboard_summary");
    return { success: true, message: "Item berhasil dibuat.", data: { id } };
  } finally {
    lock.releaseLock();
  }
}

function updateItemRecord(payload, token) {
  const session = validateSessionToken(token);
  if (!session.valid) throw new Error("Autentikasi diperlukan.");

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet("Items");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIdx = headers.indexOf("id");

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === payload.id && !data[i][headers.indexOf("deleted_at")]) {
        const rowIndex = i + 1;
        if (payload.name !== undefined) sheet.getRange(rowIndex, headers.indexOf("name") + 1).setValue(sanitizeFormula(payload.name));
        if (payload.price !== undefined) sheet.getRange(rowIndex, headers.indexOf("price") + 1).setValue(Number(payload.price) || 0);
        sheet.getRange(rowIndex, headers.indexOf("updated_at") + 1).setValue(new Date().toISOString());
        sheet.getRange(rowIndex, headers.indexOf("updated_by") + 1).setValue(session.user.id);
        
        clearCache("dashboard_summary");
        return { success: true, message: "Item berhasil diperbarui." };
      }
    }
    return { success: false, message: "Data tidak ditemukan.", errorCode: "NOT_FOUND" };
  } finally {
    lock.releaseLock();
  }
}

function deleteItemRecord(payload, token) {
  const session = validateSessionToken(token);
  if (!session.valid) throw new Error("Autentikasi diperlukan.");

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet("Items");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIdx = headers.indexOf("id");

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === payload.id) {
        sheet.getRange(i + 1, headers.indexOf("deleted_at") + 1).setValue(new Date().toISOString());
        clearCache("dashboard_summary");
        return { success: true, message: "Item berhasil dihapus (soft-delete)." };
      }
    }
    return { success: false, message: "Data tidak ditemukan.", errorCode: "NOT_FOUND" };
  } finally {
    lock.releaseLock();
  }
}

// 15. SETUPDATABASE (Idempotent)
function SETUPDATABASE() {
  const ss = getSpreadsheet();
  
  const tables = {
    Users: ["id", "name", "username", "password_hash", "password_salt", "role", "status", "created_at", "updated_at", "deleted_at"],
    Sessions: ["id", "user_id", "token_hash", "expired_at", "last_activity_at", "created_at", "revoked_at", "user_agent"],
    Items: ["id", "name", "category", "price", "stock", "created_at", "updated_at", "created_by", "updated_by", "deleted_at", "status"]
  };

  Object.keys(tables).forEach(tName => {
    let sheet = ss.getSheetByName(tName);
    if (!sheet) sheet = ss.insertSheet(tName);

    const headers = tables[tName];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  });

  // Admin Awal (admin / admin123)
  const uSheet = ss.getSheetByName("Users");
  if (uSheet.getLastRow() <= 1) {
    const salt = Utilities.getUuid();
    const hash = hashPasswordWithSalt("admin123", salt);
    uSheet.appendRow([
      Utilities.getUuid(),
      "Administrator",
      "admin",
      hash,
      salt,
      "admin",
      "active",
      new Date().toISOString(),
      new Date().toISOString(),
      ""
    ]);
  }
  Logger.log("SETUPDATABASE selesai: Seluruh tabel dan skema berhasil disiapkan.");
}
