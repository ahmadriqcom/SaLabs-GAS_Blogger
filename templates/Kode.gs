/**
 * ============================================================================
 * GAS-BLOGGER GENERATOR: BACKEND STARTER BOILERPLATE (15 SECTIONS)
 * ============================================================================
 * Deskripsi: Backend REST-like API menggunakan Google Apps Script (GAS) dengan
 *            database Google Sheets, siap dihubungkan ke Frontend Blogger.
 * Arsitektur: 15 Section Modular, Concurrency-Safe (LockService), CORS-friendly.
 * ============================================================================
 */

/* ==========================================================================
 * SECTION 1: CONFIGURATION & CONSTANTS
 * ========================================================================== */
const CONFIG = {
  APP_NAME: 'SaLabs GAS Blogger API',
  VERSION: '1.0.0',
  DEFAULT_SHEET_NAME: 'Items',
  LOCK_TIMEOUT_MS: 30000,       // 30 detik batas antrean LockService
  CACHE_DURATION_SEC: 300,      // 5 menit cache durasi default
  AUTH_REQUIRED: false,         // Set true jika ingin menggunakan validasi API Key
  HEADERS: [
    'id',
    'title',
    'category',
    'content',
    'status',
    'author',
    'created_at',
    'updated_at'
  ]
};

/* ==========================================================================
 * SECTION 2: GLOBAL STATE & PROPERTIES MANAGER
 * ========================================================================== */
const PropertiesManager = {
  getSpreadsheetId: function() {
    const props = PropertiesService.getScriptProperties();
    let sheetId = props.getProperty('SPREADSHEET_ID');
    if (!sheetId) {
      // Fallback ke spreadsheet aktif jika script di-bind langsung
      try {
        sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
      } catch (e) {
        throw new Error('SPREADSHEET_ID belum dikonfigurasi di Script Properties!');
      }
    }
    return sheetId;
  },

  getApiKey: function() {
    return PropertiesService.getScriptProperties().getProperty('API_KEY') || 'default-secret-token';
  },

  setProperty: function(key, value) {
    PropertiesService.getScriptProperties().setProperty(key, value);
  }
};

/* ==========================================================================
 * SECTION 3: ENTRY POINTS (doGet & doPost)
 * ========================================================================== */
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = params.action || 'healthCheck';
    return Router.dispatch(action, params, 'GET');
  } catch (err) {
    return ResponseFormatter.error(err.message, 500);
  }
}

function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        // Fallback untuk x-www-form-urlencoded
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || (e && e.parameter && e.parameter.action) || 'ping';
    return Router.dispatch(action, payload, 'POST');
  } catch (err) {
    return ResponseFormatter.error(err.message, 500);
  }
}

/* ==========================================================================
 * SECTION 4: ROUTER & ACTION DISPATCHER
 * ========================================================================== */
const Router = {
  dispatch: function(action, payload, httpMethod) {
    LoggerService.log('Incoming ' + httpMethod + ' action: ' + action);

    // Verifikasi Token Keamanan (jika diaktifkan)
    if (CONFIG.AUTH_REQUIRED && !SecurityManager.verifyAuth(payload)) {
      return ResponseFormatter.error('Akses ditolak: API Key tidak valid.', 401);
    }

    switch (action) {
      // Read Operations (Bisa dipanggil via GET / POST)
      case 'ping':
      case 'healthCheck':
        return ResponseFormatter.success(HealthCheckService.run());

      case 'list':
      case 'getItems':
        return ResponseFormatter.success(ItemService.list(payload));

      case 'get':
      case 'getItem':
        return ResponseFormatter.success(ItemService.getById(payload.id));

      case 'stats':
        return ResponseFormatter.success(ItemService.getStats());

      // Write Operations (Wajib Concurrency Lock via POST)
      case 'create':
      case 'addItem':
        return LockEngine.executeWithLock(function() {
          return ResponseFormatter.success(ItemService.create(payload.data || payload));
        });

      case 'update':
      case 'editItem':
        return LockEngine.executeWithLock(function() {
          return ResponseFormatter.success(ItemService.update(payload.id, payload.data || payload));
        });

      case 'delete':
      case 'deleteItem':
        return LockEngine.executeWithLock(function() {
          return ResponseFormatter.success(ItemService.remove(payload.id));
        });

      default:
        return ResponseFormatter.error('Aksi tidak dikenali: ' + action, 404);
    }
  }
};

/* ==========================================================================
 * SECTION 5: CONCURRENCY & LOCK ENGINE
 * ========================================================================== */
const LockEngine = {
  executeWithLock: function(criticalFunction) {
    const lock = LockService.getScriptLock();
    const startTime = new Date().getTime();
    const hasLock = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);

    if (!hasLock) {
      LoggerService.log('Lock timeout terlampaui setelah ' + (new Date().getTime() - startTime) + 'ms');
      return ResponseFormatter.error('Server sedang sibuk memproses antrean data. Silakan coba kembali sesaat lagi.', 429);
    }

    try {
      return criticalFunction();
    } catch (error) {
      LoggerService.error('Error saat lock aktif: ' + error.message, error.stack);
      return ResponseFormatter.error(error.message, 500);
    } finally {
      lock.releaseLock();
    }
  }
};

/* ==========================================================================
 * SECTION 6: RESPONSE & CORS FORMATTER
 * ========================================================================== */
const ResponseFormatter = {
  json: function(dataObject) {
    const output = ContentService.createTextOutput(JSON.stringify(dataObject));
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
  },

  success: function(data, message) {
    return this.json({
      success: true,
      message: message || 'Operasi berhasil',
      data: data,
      timestamp: new Date().toISOString()
    });
  },

  error: function(errorMessage, code) {
    return this.json({
      success: false,
      code: code || 400,
      error: errorMessage || 'Terjadi kesalahan sistem',
      timestamp: new Date().toISOString()
    });
  }
};

/* ==========================================================================
 * SECTION 7: VALIDATION & SANITIZATION LAYER
 * ========================================================================== */
const Validator = {
  validateItemPayload: function(payload) {
    if (!payload) throw new Error('Data payload tidak boleh kosong.');
    if (!payload.title || typeof payload.title !== 'string' || payload.title.trim() === '') {
      throw new Error('Kolom "title" wajib diisi.');
    }
    return {
      title: Utils.sanitize(payload.title),
      category: Utils.sanitize(payload.category || 'General'),
      content: Utils.sanitize(payload.content || ''),
      status: Utils.sanitize(payload.status || 'Draft'),
      author: Utils.sanitize(payload.author || 'Anonymous')
    };
  }
};

/* ==========================================================================
 * SECTION 8: SECURITY & AUTHENTICATION
 * ========================================================================== */
const SecurityManager = {
  verifyAuth: function(payload) {
    const clientKey = (payload && (payload.apiKey || payload.token)) || '';
    return clientKey === PropertiesManager.getApiKey();
  }
};

/* ==========================================================================
 * SECTION 9: DATABASE / SHEET ADAPTER
 * ========================================================================== */
const SheetAdapter = {
  getSpreadsheet: function() {
    return SpreadsheetApp.openById(PropertiesManager.getSpreadsheetId());
  },

  getSheet: function(sheetName) {
    const ss = this.getSpreadsheet();
    let sheet = ss.getSheetByName(sheetName || CONFIG.DEFAULT_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName || CONFIG.DEFAULT_SHEET_NAME);
      sheet.appendRow(CONFIG.HEADERS);
    }
    return sheet;
  },

  getAllRowsAsJSON: function(sheetName) {
    const sheet = this.getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const headers = data[0].map(function(h) { return String(h).trim(); });
    const rows = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const item = {};
      for (let j = 0; j < headers.length; j++) {
        item[headers[j]] = row[j];
      }
      item._rowIndex = i + 1; // 1-based index untuk keperluan update/delete
      rows.push(item);
    }
    return rows;
  },

  appendRow: function(sheetName, rowArray) {
    const sheet = this.getSheet(sheetName);
    sheet.appendRow(rowArray);
    SpreadsheetApp.flush();
    return true;
  },

  findRowById: function(sheetName, id) {
    const all = this.getAllRowsAsJSON(sheetName);
    for (let i = 0; i < all.length; i++) {
      if (String(all[i].id) === String(id)) {
        return all[i];
      }
    }
    return null;
  },

  updateRowById: function(sheetName, id, updatedItem) {
    const sheet = this.getSheet(sheetName);
    const item = this.findRowById(sheetName, id);
    if (!item) throw new Error('Data dengan ID ' + id + ' tidak ditemukan.');

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRow = [];

    for (let j = 0; j < headers.length; j++) {
      const colName = headers[j];
      if (updatedItem.hasOwnProperty(colName)) {
        newRow.push(updatedItem[colName]);
      } else {
        newRow.push(item[colName]);
      }
    }

    sheet.getRange(item._rowIndex, 1, 1, newRow.length).setValues([newRow]);
    SpreadsheetApp.flush();
    return true;
  },

  deleteRowById: function(sheetName, id) {
    const sheet = this.getSheet(sheetName);
    const item = this.findRowById(sheetName, id);
    if (!item) throw new Error('Data dengan ID ' + id + ' tidak ditemukan.');

    sheet.deleteRow(item._rowIndex);
    SpreadsheetApp.flush();
    return true;
  }
};

/* ==========================================================================
 * SECTION 10: BUSINESS LOGIC / SERVICES
 * ========================================================================== */
const ItemService = {
  list: function(filterParams) {
    let items = CacheManager.get('items_list');
    if (!items) {
      items = SheetAdapter.getAllRowsAsJSON(CONFIG.DEFAULT_SHEET_NAME);
      CacheManager.put('items_list', items, CONFIG.CACHE_DURATION_SEC);
    }

    // Filter sederhana
    if (filterParams && filterParams.status) {
      items = items.filter(function(x) { return x.status === filterParams.status; });
    }
    if (filterParams && filterParams.category) {
      items = items.filter(function(x) { return x.category === filterParams.category; });
    }

    return items;
  },

  getById: function(id) {
    if (!id) throw new Error('Parameter ID dibutuhkan.');
    const item = SheetAdapter.findRowById(CONFIG.DEFAULT_SHEET_NAME, id);
    if (!item) throw new Error('Item tidak ditemukan.');
    return item;
  },

  create: function(rawPayload) {
    const validated = Validator.validateItemPayload(rawPayload);
    const newId = Utils.generateUUID();
    const now = new Date().toISOString();

    const record = [
      newId,
      validated.title,
      validated.category,
      validated.content,
      validated.status,
      validated.author,
      now,
      now
    ];

    SheetAdapter.appendRow(CONFIG.DEFAULT_SHEET_NAME, record);
    CacheManager.invalidate('items_list');

    return {
      id: newId,
      title: validated.title,
      created_at: now
    };
  },

  update: function(id, rawPayload) {
    if (!id) throw new Error('ID target wajib disertakan untuk pembaruan.');
    const existing = SheetAdapter.findRowById(CONFIG.DEFAULT_SHEET_NAME, id);
    if (!existing) throw new Error('Data tidak ditemukan.');

    const now = new Date().toISOString();
    const updateData = {
      title: rawPayload.title ? Utils.sanitize(rawPayload.title) : existing.title,
      category: rawPayload.category ? Utils.sanitize(rawPayload.category) : existing.category,
      content: rawPayload.content !== undefined ? Utils.sanitize(rawPayload.content) : existing.content,
      status: rawPayload.status ? Utils.sanitize(rawPayload.status) : existing.status,
      author: rawPayload.author ? Utils.sanitize(rawPayload.author) : existing.author,
      updated_at: now
    };

    SheetAdapter.updateRowById(CONFIG.DEFAULT_SHEET_NAME, id, updateData);
    CacheManager.invalidate('items_list');
    return { id: id, updated_at: now };
  },

  remove: function(id) {
    if (!id) throw new Error('ID target wajib disertakan untuk penghapusan.');
    SheetAdapter.deleteRowById(CONFIG.DEFAULT_SHEET_NAME, id);
    CacheManager.invalidate('items_list');
    return { id: id, deleted: true };
  },

  getStats: function() {
    const items = this.list({});
    return {
      total: items.length,
      published: items.filter(function(i) { return i.status === 'Published'; }).length,
      drafts: items.filter(function(i) { return i.status === 'Draft'; }).length,
      categories: [...new Set(items.map(function(i) { return i.category; }))]
    };
  }
};

/* ==========================================================================
 * SECTION 11: CACHE MANAGER
 * ========================================================================== */
const CacheManager = {
  cache: CacheService.getScriptCache(),

  get: function(key) {
    try {
      const data = this.cache.get(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  put: function(key, data, seconds) {
    try {
      this.cache.put(key, JSON.stringify(data), seconds || 300);
    } catch (e) {
      LoggerService.log('Gagal menyimpan cache: ' + e.message);
    }
  },

  invalidate: function(key) {
    try {
      this.cache.remove(key);
    } catch (e) {
      LoggerService.log('Gagal menghapus cache: ' + e.message);
    }
  }
};

/* ==========================================================================
 * SECTION 12: ERROR LOGGING & MONITORING
 * ========================================================================== */
const LoggerService = {
  log: function(msg) {
    Logger.log('[INFO] ' + msg);
  },

  error: function(msg, stack) {
    Logger.log('[ERROR] ' + msg + (stack ? '\nStack: ' + stack : ''));
  }
};

/* ==========================================================================
 * SECTION 13: INITIALIZER & SEEDER
 * ========================================================================== */
function setupDatabase() {
  LoggerService.log('Menjalankan setup dan inisialisasi database...');
  const sheet = SheetAdapter.getSheet(CONFIG.DEFAULT_SHEET_NAME);

  // Jika sheet kosong, tuliskan header
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CONFIG.HEADERS);
    sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setFontWeight('bold').setBackground('#E8F0FE');
    sheet.setFrozenRows(1);

    // Seed data perdana
    const seedId = Utils.generateUUID();
    const now = new Date().toISOString();
    sheet.appendRow([
      seedId,
      'Halo Dunia dari GAS!',
      'Pengumuman',
      'Ini adalah contoh data awal yang dibuat otomatis saat inisialisasi sheet.',
      'Published',
      'Administrator',
      now,
      now
    ]);
    LoggerService.log('Header dan data seed berhasil ditambahkan.');
  } else {
    LoggerService.log('Sheet sudah memiliki struktur.');
  }

  return 'Database setup selesai. Sheet: ' + sheet.getName();
}

/* ==========================================================================
 * SECTION 14: UTILITIES & HELPERS
 * ========================================================================== */
const Utils = {
  generateUUID: function() {
    return Utilities.getUuid();
  },

  sanitize: function(input) {
    if (typeof input !== 'string') return input;
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

/* ==========================================================================
 * SECTION 15: HEALTH CHECK & TEST SUITE
 * ========================================================================== */
const HealthCheckService = {
  run: function() {
    return {
      status: 'UP',
      app: CONFIG.APP_NAME,
      version: CONFIG.VERSION,
      timestamp: new Date().toISOString(),
      spreadsheetConfigured: !!PropertiesManager.getSpreadsheetId()
    };
  }
};

function runTestSuite() {
  LoggerService.log('Memulai pengujian backend...');
  const health = HealthCheckService.run();
  LoggerService.log('HealthCheck: ' + JSON.stringify(health));

  const stats = ItemService.getStats();
  LoggerService.log('Current Stats: ' + JSON.stringify(stats));

  return 'Pengujian selesai tanpa kesalahan fatal.';
}
