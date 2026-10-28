# Panduan Deployment: GAS + Blogger Web App

Panduan langkah-demi-langkah ini menjelaskan cara menghubungkan **Google Apps Script (GAS)** sebagai backend REST API berbasis Google Sheets dan menyematkan **Frontend SPA** ke dalam platform **Blogger (Blogspot)**.

---

## 📋 Prasyarat
- Akun Google (untuk Google Drive, Sheets, dan Apps Script).
- Blog di Blogger / Blogspot dengan hak akses Administrator.
- Repositori lokal ini (`templates/Kode.gs` dan `templates/Index.html`).

---

## 🛠️ Langkah 1: Persiapan Google Sheets & Apps Script

1. Buka [Google Sheets](https://sheets.new) dan buat spreadsheet baru.
2. Beri nama file, misalnya: `DB_GAS_Blogger`.
3. Salin **Spreadsheet ID** dari URL browser:
   ```text
   https://docs.google.com/spreadsheets/d/[SALIN_ID_DI_SINI]/edit
   ```
4. Di menu Google Sheets, klik **Ekstensi (Extensions)** > **Apps Script**.
5. Ganti nama project Apps Script (misalnya: `Backend_Blogger_API`).

---

## ⚙️ Langkah 2: Memasang Kode Backend (`Kode.gs`)

1. Pada editor Apps Script, buka file `Code.gs` (atau buat file baru bernama `Kode.gs`).
2. Hapus seluruh isi default, lalu salin dan tempel seluruh isi dari:
   `templates/Kode.gs`
3. Simpan perubahan (`Ctrl + S` atau ikon disket).

---

## 🔐 Langkah 3: Konfigurasi Script Properties

Script Properties digunakan untuk menyimpan variabel sensitif atau dinamis tanpa mengotori source code:

1. Di Apps Script, klik ikon **Roda Gigi (Project Settings)** pada panel navigasi kiri.
2. Gulir ke bawah hingga bagian **Script Properties (Properti Skrip)**.
3. Klik **Add script property (Tambahkan properti skrip)**:
   - **Property**: `SPREADSHEET_ID`
   - **Value**: `[Paste ID Spreadsheet Anda dari Langkah 1]`
   - *(Opsional)* **Property**: `API_KEY`
   - *(Opsional)* **Value**: `rahasia-token-anda`
4. Klik **Save script properties**.

---

## 🚀 Langkah 4: Inisialisasi Database (Seeding)

1. Kembali ke editor kode (`< > Editor`).
2. Pada dropdown pilihan fungsi di toolbar atas, pilih fungsi `setupDatabase`.
3. Klik **Run (Jalankan)**.
4. Google akan meminta **Review Permissions (Otorisasi Akses)**:
   - Klik akun Google Anda.
   - Klik **Advanced (Lanjutan)** > **Go to Backend_Blogger_API (unsafe)**.
   - Klik **Allow (Izinkan)**.
5. Periksa spreadsheet Anda: Sheet baru bernama `Items` akan otomatis terbuat lengkap dengan header baris dan data sampel awal.

---

## 🌐 Langkah 5: Deployment sebagai Web App (`/exec`)

> [!IMPORTANT]
> Konfigurasi hak akses di bawah ini sangat krusial agar frontend Blogger dapat mengakses API tanpa terkendala login Google.

1. Di pojok kanan atas Apps Script, klik tombol biru **Deploy** > **New deployment**.
2. Klik ikon gerigi di sebelah kiri **Select type** > pilih **Web app**.
3. Isi konfigurasi sebagai berikut:
   - **Description**: `Production v1`
   - **Execute as**: `Me (email-anda@gmail.com)` *(Wajib Me agar skrip membaca sheet milik Anda)*
   - **Who has access**: `Anyone` *(Wajib Anyone agar pengunjung blog dapat memuat data)*
4. Klik **Deploy**.
5. Salin **Web App URL** yang berakhiran `/exec`.
   Contoh format:
   ```text
   https://script.google.com/macros/s/AKfycbx.../exec
   ```

---

## 🎨 Langkah 6: Konfigurasi Frontend (`Index.html`)

1. Buka file `templates/Index.html` pada editor teks Anda.
2. Cari baris konfigurasi `AppConfig` (pada **Section 4**):
   ```javascript
   const AppConfig = {
     API_URL: 'https://script.google.com/macros/s/AKfycbx.../exec',
     TIMEOUT_MS: 20000
   };
   ```
3. Ganti URL tersebut dengan URL Web App `/exec` yang Anda peroleh di Langkah 5.
4. Simpan file.

---

## 📝 Langkah 7: Publikasi ke Halaman Blogger

1. Buka dashboard [Blogger](https://www.blogger.com/).
2. Di menu kiri, pilih **Halaman (Pages)** > **Halaman baru (New Page)**.
3. Beri judul halaman, misalnya: `Portal Aplikasi`.
4. Di pojok kiri atas area penulisan, klik ikon pensil > ubah ke **Tampilan HTML (HTML view)**.
5. Tempelkan seluruh isi file `templates/Index.html` ke dalam editor HTML tersebut.
6. Pada panel samping kanan (Page settings):
   - Di opsi **Komentar Pembaca (Reader Comments)**, pilih **Jangan izinkan, sembunyikan yang ada (Do not allow, hide existing)**.
7. Klik **Publikasikan (Publish)**.
8. Klik ikon mata untuk melihat halaman Anda. Aplikasi SPA langsung berjalan mulus!

---

## 💡 Tips & Trik Tambahan

### Cara Memperbarui Kode Backend (Re-deploy)
Setiap kali Anda mengubah kode `Kode.gs`:
1. Klik **Deploy** > **Manage deployments**.
2. Klik ikon pensil (Edit) pada deployment aktif.
3. Ubah **Version** menjadi **New version**.
4. Klik **Deploy**. (URL Web App tidak akan berubah jika menggunakan cara ini).

### Trik Tampilan Penuh (Full-Width) di Blogger
Jika template Blogger Anda memiliki sidebar atau batas lebar yang mempersempit tampilan aplikasi, tambahkan CSS berikut di paling atas konten HTML halaman Blogger Anda:
```html
<style>
  /* Sembunyikan sidebar & header Blogger khusus pada halaman ini */
  .sidebar-wrapper, .sidebar, #sidebar, .blog-pager, .post-footer, #comments {
    display: none !important;
  }
  .main-wrapper, .main, #main, .content {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }
</style>
```
