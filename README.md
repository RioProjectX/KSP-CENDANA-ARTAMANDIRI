# Koperasi Simpan Pinjam Cendana Artha Mandiri

Aplikasi web manajemen keuangan, pembukuan kas, dan pemantauan simpan pinjam untuk **Koperasi Simpan Pinjam (KSP) Cendana Artha Mandiri**. Dirancang responsif untuk penggunaan nyaman di browser desktop, tablet, serta smartphone Android maupun iPhone/Safari dengan antarmuka berbahasa Indonesia, format mata uang **Rupiah (`Rp`)**, dan format tanggal **`DD/MM/YYYY`**.

---

## Fitur Utama

### 1. Login PIN, Keamanan Sesi, & Manajemen Akun Pengurus
- **Akses Langsung via PIN (Tanpa Login Google):** Saat aplikasi dibuka, pengguna langsung diarahkan ke layar Login PIN dengan papan angka sentuh (*numeric keypad*) serta dukungan input keyboard fisik.
- **PIN Default Awal:** `1234` untuk akun `Administrator Utama` (segera ubah setelah login pertama).
- **Keamanan Backend:**
  - PIN di-hash menggunakan `scrypt` + *salt* acak (tidak disimpan dalam teks polos).
  - Seluruh endpoint API (`/api/*`) dilindungi oleh token sesi bertanda tangan **HMAC-SHA256** (`Authorization: Bearer <token>`) dan pembatasan percobaan login (*rate limiting*).
  - Validasi peran (**Admin** vs **Staf**) ditegakkan langsung di sisi server.
- **Manajemen Akun & Keamanan PIN:** Pengurus dapat mengubah PIN pribadi kapan saja. Akun **Admin** dapat menambah, mengubah, mereset PIN, mengaktifkan/menonaktifkan, maupun menghapus akun **Admin** atau **Staf** lainnya.

### 2. Dashboard Utama (Perhitungan Real-Time)
Seluruh metrik dihitung otomatis langsung dari data transaksi nyata (tanpa data dummy permanen):
- **7 Kartu Ringkasan Keuangan:**
  1. Total Seluruh Dana (`Saldo Kas Tersedia + Total Dana Sedang Dipinjam`)
  2. Saldo Kas Tersedia
  3. Total Dana Sedang Dipinjam
  4. Total Dana Sudah Kembali
  5. Total Uang Masuk
  6. Total Uang Keluar
  7. Jumlah Transaksi Aktif
- **Pengingat Jatuh Tempo Prioritas:** Menampilkan daftar pinjaman yang sudah melewati jatuh tempo maupun mendekati H-7, H-3, dan H-1.
- **4 Grafik Visual Interaktif:**
  1. Pemasukan vs Pengeluaran Bulanan
  2. Dana Dipinjam per Bulan
  3. Pengembalian Dana Bulanan
  4. Perkembangan Saldo Kas

### 3. Uang Masuk & Uang Keluar
- Nomor transaksi dibuat otomatis (`KM-YYYYMMDD-001` untuk kas masuk, `KK-YYYYMMDD-001` untuk kas keluar).
- Input kategori transaksi, metode pembayaran (**Tunai** / **Transfer Bank**), nama penyetor/penerima, nominal Rupiah, dan uraian transaksi.
- Mendukung **lampiran bukti Foto (JPG/PNG/WebP — otomatis dikompresi) atau dokumen PDF (maks. 650 KB)** beserta pratinjau langsung di dalam aplikasi.
- Fitur pencarian, filter kategori, filter rentang tanggal, ubah data, serta hapus dengan dialog konfirmasi dan pembaruan saldo kas otomatis.

### 4. Dana Sedang Dipinjam
- Pencatatan pencairan pinjaman dengan nomor otomatis (`PJ-YYYYMMDD-001`), data peminjam, ID/NIK anggota, nomor HP/WhatsApp, tanggal pinjam, jatuh tempo, pokok pinjaman, jasa/admin, dan lampiran dokumen akad/identitas (Foto/PDF).
- **Status Warna Otomatis:**
  - `DIPINJAM` (Biru)
  - `DIBAYAR SEBAGIAN` (Kuning)
  - `LUNAS` (Hijau)
  - `TERLAMBAT` (Merah)
- **Pengingat Jatuh Tempo:** Otomatis mendeteksi **H-7**, **H-3**, **H-1**, dan **Terlambat** beserta tombol filter cepat.
- Klik baris pinjaman mana saja untuk membuka panel detail lengkap, progres pelunasan, dokumen lampiran, dan riwayat cicilan.

### 5. Pengembalian Dana
- Memilih nomor transaksi pinjaman aktif langsung memunculkan data peminjam, pokok pinjaman, total tagihan, riwayat cicilan sebelumnya, dan sisa tagihan secara otomatis.
- Mendukung **cicilan bertahap** maupun pelunasan penuh (`Bayar Sisa Penuh`).
- Nomor transaksi pengembalian otomatis (`PB-YYYYMMDD-001`) dengan opsi lampiran bukti pembayaran.
- Secara otomatis mengubah status pinjaman menjadi **`LUNAS`** saat sisa mencapai `Rp 0` dan menambah **Saldo Kas Tersedia**.

### 6. Laporan Keuangan, Database Terpadu & Backup
- **Filter Fleksibel:** Harian, Bulanan, Tahunan, Rentang Tanggal, dan Jenis Mutasi pada Buku Kas Terpadu.
- **Ekspor & Cetak:**
  - Ekspor **Excel (`.csv`)** dengan format UTF-8 BOM.
  - Ekspor **PDF (`.pdf`)** ber-kop resmi KSP Cendana Artha Mandiri.
  - **Cetak Langsung** melalui dialog cetak browser dengan tata letak kertas A4 dan blok tanda tangan pengurus.
- **Backup & Restore JSON:** Unduh seluruh database (transaksi, pinjaman, pengembalian, lampiran, dan akun) dalam satu file `.json` serta pulihkan kembali dengan validasi dan konfirmasi.

---

## Teknologi & Database Cloud

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide React
- **Backend & Keamanan:** Node.js, Express, `crypto` (PIN hashing `scrypt` & token sesi `HMAC-SHA256`)
- **Database Utama:** **Firebase Cloud Firestore** (`firebase-applet-config.json` & aturan keamanan `firestore.rules`), sehingga seluruh data tersimpan persisten di cloud dan langsung tersinkronisasi lintas perangkat (desktop, tablet, maupun HP).
- **Adapter Cadangan Opsional:** Mendukung PostgreSQL (`DATABASE_URL`) atau JSON lokal jika konfigurasi Firebase tidak digunakan.
- **Ekspor Dokumen:** jsPDF & jspdf-autotable
- **Build & Serverless:** Vite, `tsx`, Vercel Serverless Functions (`api/index.ts` & `vercel.json`)

---

## Cara Menjalankan di Lokal

1. **Instalasi dependensi:**
   ```bash
   npm install
   ```

2. **Menjalankan mode pengembangan (Frontend + Backend Server):**
   ```bash
   npm run dev
   ```

3. **Build produksi & menjalankan server produksi:**
   ```bash
   npm run build
   npm start
   ```

4. **Verifikasi tipe TypeScript & aturan keamanan Firestore:**
   ```bash
   npm run lint
   npx eslint firestore.rules
   ```

---

## Panduan Deploy ke Vercel

Karena database telah terhubung ke **Firebase Cloud Firestore** (`firebase-applet-config.json`), aplikasi sudah siap di-deploy ke Vercel **tanpa perlu mengisi `DATABASE_URL` atau konfigurasi database tambahan**:

1. **Import proyek ke Vercel** dari repositori GitHub Anda (pastikan file `firebase-applet-config.json` ikut ada di repositori).
2. **Langsung klik Deploy:** Vercel akan membangun frontend (`dist`) dan mengarahkan rute `/api/*` ke `api/index.ts`. Variabel `SESSION_SECRET` dan `FIREBASE_WORKSPACE_KEY` sudah ditangani otomatis oleh sistem (opsional jika ingin diisi manual di Environment Variables Vercel).
3. **Segera ubah PIN default `1234`** setelah login pertama melalui menu **Akun & Ubah PIN**.

---

## Struktur Direktori Utama

```text
├── api/
│   └── index.ts                       # Entry point Vercel Serverless Function untuk /api/*
├── server/
│   ├── app.ts                         # Aplikasi Express, route API terproteksi, & RBAC
│   ├── auth.ts                        # Hashing PIN (scrypt), token sesi HMAC, & rate limiter
│   └── storage.ts                     # StorageAdapter (Firebase Firestore, PostgreSQL, & JSON lokal)
├── server.ts                          # Server Node/Express lokal & integrasi Vite
├── firebase-applet-config.json        # Konfigurasi proyek Firebase & Firestore database
├── firebase-blueprint.json            # Skema entitas & koleksi Firestore
├── firestore.rules                    # Aturan keamanan Firestore tervalidasi ESLint
├── vercel.json                        # Konfigurasi routing build & serverless Vercel
├── .env.example                       # Template variabel lingkungan
├── index.html                         # Entri HTML & konfigurasi font
├── src/
│   ├── App.tsx                        # Root aplikasi, manajemen token sesi, & routing menu
│   ├── firebase.ts                    # Inisialisasi Firebase SDK & uji koneksi boot
│   ├── types.ts                       # Definisi tipe data transaksi, pinjaman, cicilan, & akun
│   ├── index.css                      # Konfigurasi Tailwind CSS v4 & gaya cetak (@media print)
│   ├── utils/
│   │   ├── format.ts                  # Format Rupiah, DD/MM/YYYY, penomoran otomatis, & kalkulasi real-time
│   │   └── export.ts                  # Utilitas ekspor Excel (.csv), PDF, & Backup JSON
│   └── components/
│       ├── BrandLogo.tsx              # Logo vektor KSP Cendana Artha Mandiri
│       ├── PinLoginScreen.tsx         # Halaman Login PIN dengan papan angka interaktif
│       ├── Sidebar.tsx                # Sidebar desktop & menu lipat responsif untuk mobile
│       ├── DashboardView.tsx          # 7 kartu ringkasan, pengingat jatuh tempo, & 4 grafik visual
│       ├── CashTransactionsView.tsx   # Modul Uang Masuk & Uang Keluar
│       ├── LoansView.tsx              # Modul Dana Sedang Dipinjam & detail pinjaman
│       ├── RepaymentsView.tsx         # Modul Pengembalian Dana & cicilan bertahap
│       ├── ReportsBackupView.tsx      # Laporan keuangan, buku kas terpadu, ekspor, & backup/restore
│       ├── AccountsPinView.tsx        # Ubah PIN pribadi & manajemen akun Admin/Staf
│       ├── AttachmentField.tsx        # Unggah & kompresi bukti Foto/PDF
│       ├── AttachmentViewerModal.tsx  # Pratinjau lampiran Foto/PDF
│       └── ConfirmModal.tsx           # Dialog konfirmasi aksi sensitif
```

---

## Profil Pengembang

**RioProjectX**

Aplikasi **Koperasi Simpan Pinjam Cendana Artha Mandiri** ini dirancang dan dikembangkan oleh **RioProjectX** sebagai solusi digitalisasi tata kelola keuangan koperasi yang bersih, aman, akurat, transparan, dan tersinkronisasi di cloud untuk berbagai perangkat.

- **Pengembang:** RioProjectX
- **Fokus Pengembangan:** Sistem Informasi Keuangan, Integrasi Cloud Database, Aplikasi Web Responsif, & Keamanan Data Real-Time
