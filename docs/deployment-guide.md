# Panduan Lengkap Deployment Aplikasi

Ikuti urutan langkah berikut untuk memasang aplikasi dari repositori ini.

---

## 1. Setup Spreadsheet Database
1. Buat Spreadsheet baru di Google Sheets.
2. Salin **Spreadsheet ID** dari URL browser:
   `https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID_INI]/edit`

## 2. Setup Google Apps Script (Backend)
1. Buka [script.google.com](https://script.google.com) dan buat project baru.
2. Buka menu **Project Settings** (ikon roda gigi di kiri).
3. Gulir ke bagian **Script Properties**, klik **Add script property**:
   - Property: `SPREADSHEET_ID`
   - Value: `[Spreadsheet ID yang tadi disalin]`
4. Buka file `Code.gs` di editor Apps Script, hapus seluruh isi bawaan, lalu tempelkan kode dari `templates/Kode.gs`.
5. Pilih fungsi **SETUPDATABASE** pada toolbar atas, lalu klik **Run**.
6. Setujui izin akun Google (*Review permissions* > *Advanced* > *Go to (unsafe)*).
7. Periksa Spreadsheet Anda: Sheet `Users`, `Sessions`, dan `Items` akan terbentuk secara otomatis beserta akun admin awal (`admin` / `admin123`).

## 3. Deployment Web App API
1. Klik tombol **Deploy** di kanan atas > **New deployment**.
2. Klik ikon roda gigi di sebelah kanan *Select type*, pilih **Web app**.
3. Atur parameter konfigurasi:
   - **Description**: `Production v1`
   - **Execute as**: `Me (email Anda)`
   - **Who has access**: `Anyone` *(Wajib Anyone agar frontend Blogger dapat mengakses API via fetch)*.
4. Klik **Deploy**, lalu salin **Web app URL** yang berakhiran `/exec`.

## 4. Setup Blogger (Frontend)
1. Buka file `templates/Index.html` pada teks editor.
2. Cari konstanta `API_URL` di Bagian 10:
   ```javascript
   const API_URL = 'https://script.google.com/macros/s/.../exec';
   ```
   Ganti nilai string tersebut dengan URL `/exec` yang baru Anda dapatkan.
3. Masuk ke dashboard Blogger Anda > menu Pages (Halaman) di sidebar kiri > klik + New Page (+ Halaman Baru).
4. Beri judul halaman (misalnya: Katalog Data).
5. Klik ikon pensil di bawah judul > alihkan ke mode HTML view (Tampilan HTML).
6. Hapus seluruh tag bawaan, lalu tempel seluruh isi file `templates/Index.html` ke editor Blogger tersebut.
7. Klik tombol Publish (Publikasikan).
8. Klik ikon mata (View) pada halaman tersebut untuk mulai menggunakan aplikasi secara langsung.
