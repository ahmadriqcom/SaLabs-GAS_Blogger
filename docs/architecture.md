# Arsitektur Sistem: GAS + Blogger Web App

Dokumen ini menguraikan arsitektur teknis, alur data (*data lifecycle*), penanganan *concurrency* (*race condition*), serta mekanisme *bypass* CORS antara antarmuka Blogger dan Google Apps Script.

---

## 🏛️ Diagram Arsitektur Alur Data

```mermaid
flowchart TD
    subgraph Frontend["Frontend Layer (Blogger Page)"]
        User(["Pengguna Blog"])
        UI["UI Controls & Form Modal"]
        Controller["AppController & Reactive Store"]
        FetchClient["FetchClient Adapter"]
    end

    subgraph Transport["Network & CORS Layer"]
        HTTP["HTTP POST (text/plain)"]
        Redirect["Google 302 Redirect Handler"]
    end

    subgraph Backend["Backend Layer (Google Apps Script)"]
        doPost["doPost(e) Entry Point"]
        Router["Router & Action Dispatcher"]
        Lock["LockService Engine (30s Queue)"]
        Service["ItemService Business Logic"]
        Cache["CacheService (Memory L1)"]
        Formatter["ResponseFormatter (JSON)"]
    end

    subgraph Storage["Database Layer"]
        Sheets[("Google Sheets Spreadsheet")]
    end

    User -->|Interaksi Form / Filter| UI
    UI --> Controller
    Controller --> FetchClient
    FetchClient -->|Bypass Preflight| HTTP
    HTTP --> Redirect
    Redirect --> doPost
    doPost --> Router
    Router -->|Operasi Tulis| Lock
    Router -->|Operasi Baca| Cache
    Cache -.->|Cache Miss| Service
    Lock --> Service
    Service --> Sheets
    Service --> Formatter
    Formatter -->|JSON Output| FetchClient
    FetchClient --> Controller
    Controller -->|Render DOM| UI
```

---

## 🔄 Sequence Diagram: Operasi Write (Create / Update / Delete)

```mermaid
sequenceDiagram
    autonumber
    actor Pengguna
    participant Frontend as Blogger Frontend (Index.html)
    participant GAS as Google Apps Script (doPost)
    participant Lock as LockService Engine
    participant Sheets as Google Sheets DB

    Pengguna->>Frontend: Klik Simpan (Form Submit)
    Frontend->>Frontend: Tampilkan Spinner & Validasi Input
    Frontend->>GAS: POST /exec (action: 'create', payload, mode: 'cors')
    Note over Frontend,GAS: Header 'Content-Type: text/plain' mencegah OPTIONS Preflight
    GAS->>Lock: tryLock(30000ms)
    alt Lock Berhasil Diperoleh
        Lock-->>GAS: Lock Acquired
        GAS->>Sheets: Append / Update / Delete Row
        Sheets-->>GAS: Flush Berhasil
        GAS->>Lock: releaseLock()
        GAS-->>Frontend: 200 OK { success: true, data: {...} }
        Frontend->>Frontend: Tampilkan Toast Sukses & Refresh Data
    else Lock Timeout / Antrean Penuh
        Lock-->>GAS: Timeout (false)
        GAS-->>Frontend: 429 Status { success: false, error: 'Server sibuk' }
        Frontend->>Frontend: Tampilkan Toast Peringatan
    end
```

---

## 🔑 Komponen Kunci Arsitektur

### 1. Solusi Masalah CORS & 302 Redirect pada Google Apps Script
Google Apps Script Web App memiliki perilaku unik:
1. **Tidak Mendukung CORS Preflight (`OPTIONS`)**: Jika frontend mengirimkan request dengan header `Content-Type: application/json`, browser modern akan mengirimkan permintaan preflight HTTP `OPTIONS`. GAS akan merespons dengan kegagalan (405/CORS error).
   - **Solusi**: Menggunakan `Content-Type: text/plain;charset=utf-8` saat mengirim `fetch()`. Browser menganggap ini sebagai *simple request* sehingga langsung mengirimkan `POST` tanpa preflight `OPTIONS`. Di sisi backend, `JSON.parse(e.postData.contents)` tetap mampu membaca isinya dengan sempurna.
2. **HTTP 302 Redirect**: GAS selalu me-redirect URL deployment awal ke server backend sementara Google (`script.googleusercontent.com`).
   - **Solusi**: Frontend menyertakan opsi `redirect: 'follow'` pada konfigurasi `fetch`.

### 2. Concurrency Control dengan Lock Engine
Google Sheets bukanlah sistem database relasional murni dengan fitur ACID built-in tingkat rendah. Jika dua pengguna menekan tombol "Simpan" pada milidetik yang sama, kedua request dapat menimpa baris yang sama (*race condition*).

Modul `LockEngine` pada `templates/Kode.gs` menggunakan `LockService.getScriptLock()`:
```javascript
const lock = LockService.getScriptLock();
const hasLock = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS); // Batas tunggu 30 detik
try {
  if (!hasLock) throw new Error('Server sibuk...');
  return criticalFunction();
} finally {
  lock.releaseLock(); // Selalu dilepas walau terjadi error
}
```
Mekanisme ini memastikan antrean serial aman untuk setiap operasi tulis.

### 3. Layer Caching Cerdas
Untuk mempercepat pembacaan data (misalnya saat ribuan pengunjung membuka blog), `ItemService` memanfaatkan `CacheService.getScriptCache()`:
- Data `list` disimpan dalam memory cache selama 5 menit (`300 detik`).
- Setiap kali ada operasi tulis (`create`, `update`, `delete`), cache otomatis di-invalidasi (`invalidate('items_list')`) agar pengunjung langsung mendapatkan data terkini.
