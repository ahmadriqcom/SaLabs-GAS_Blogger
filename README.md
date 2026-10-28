# 🚀 SaLabs GAS Blogger Generator

> **Arsitektur Web App Serverless Gratis**: Integrasi backend **Google Apps Script (GAS)** & **Google Sheets** dengan frontend Single Page Application (SPA) berbasis **Blogger (Blogspot)**.

---

## 📂 Struktur Repositori

```text
gas-blogger-generator/
├── prompts/
│   └── system-instructions.md    # Single source of truth untuk instruksi sistem / AI prompt
├── templates/
│   ├── Kode.gs                   # Boilerplate starter backend (struktur 15 section)
│   └── Index.html                # Boilerplate starter frontend Blogger (struktur 19 section)
├── docs/
│   ├── deployment-guide.md       # Panduan Script Properties, Web App /exec, & Blogger
│   └── architecture.md           # Diagram alur fetch(), router doPost, & lock engine
├── .gitignore                    # Berkas filter git
├── sync.sh                       # Skrip bash sinkronisasi push otomatis
├── sync.ps1                      # Skrip PowerShell sinkronisasi untuk Windows
└── README.md                     # Halaman dokumentasi repositori
```

---

## 🌟 Fitur Utama

- **100% Bebas Biaya Hosting**: Memanfaatkan infrastruktur Google Apps Script sebagai serverless compute dan Blogger sebagai static host dengan CDN global.
- **Concurrency-Safe Database**: Menggunakan `LockService` 30-detik antrean serial untuk mencegah *race condition* dan data saling tindih pada Google Sheets.
- **Bypass CORS & Google 302 Redirect**: Adapter `fetch()` yang dirancang khusus untuk melewati preflight CORS `OPTIONS` Google Apps Script tanpa error network.
- **Scoped UI Styling**: Desain modern berbasis Tailwind CSS & Lucide Icons dengan reset CSS khusus agar tidak merusak tema/desain bawaan template Blogger.
- **Modular 15 Section Backend & 19 Section Frontend**: Kode terstruktur rapi, mudah dibaca, dan mudah diperluas sesuai kebutuhan bisnis Anda.

---

## ⚡ Panduan Cepat (Quick Start)

### 1. Siapkan Backend (Google Apps Script)
1. Buka spreadsheet baru di Google Sheets.
2. Buka menu **Ekstensi** > **Apps Script**, lalu salin seluruh isi [templates/Kode.gs](templates/Kode.gs).
3. Atur `SPREADSHEET_ID` di **Project Settings** > **Script Properties**.
4. Jalankan fungsi `setupDatabase()` sekali untuk membuat tabel & sampel data.
5. Lakukan deployment Web App (**Execute as: Me**, **Who has access: Anyone**), lalu salin URL `/exec`.

### 2. Pasang Frontend (Blogger)
1. Buka [templates/Index.html](templates/Index.html), perbarui baris `API_URL` dengan URL `/exec` yang diperoleh dari langkah di atas.
2. Buka dashboard Blogger > **Halaman (Pages)** > **Halaman Baru**.
3. Ubah mode penulisan ke **Tampilan HTML**, tempelkan seluruh kode `Index.html`, lalu klik **Publikasikan**.

📖 Untuk panduan lengkap bergambar dan penanganan masalah, baca **[docs/deployment-guide.md](docs/deployment-guide.md)**.  
🔍 Untuk pemahaman mendalam tentang siklus data, baca **[docs/architecture.md](docs/architecture.md)**.

---

## 🔄 Sinkronisasi Git Otomatis

Repositori ini telah dilengkapi skrip otomatisasi satu klik untuk menyimpan perubahan ke GitHub:

**Menggunakan Git Bash:**
```bash
./sync.sh "Pesan pembaruan Anda"
```

**Menggunakan Windows PowerShell:**
```powershell
powershell -ExecutionPolicy Bypass -File .\sync.ps1 "Pesan pembaruan Anda"
```
*(Jika pesan commit dikosongkan, skrip otomatis menyertakan stempel waktu tanggal dan jam saat ini).*

---

## 📜 Lisensi
Dikelola oleh **[ahmadriqcom](https://github.com/ahmadriqcom)** di bawah lisensi MIT. Silakan gunakan dan kembangkan untuk proyek Anda!
