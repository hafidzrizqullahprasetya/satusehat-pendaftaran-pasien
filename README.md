# SATUSEHAT Pendaftaran Pasien

Backend sederhana untuk mensimulasikan proses pendaftaran kunjungan pasien sesuai tugas:

1. Mengambil Access Token OAuth2 SATUSEHAT.
2. Mencari IHS Number pasien berdasarkan NIK.
3. Mencari IHS Number dokter/practitioner berdasarkan NIK.
4. Membuat resource `Location`.
5. Membuat resource `Encounter` dengan status `arrived`, class `AMB`, dan timestamp ISO 8601.

## Struktur Folder

```text
.
├── README.md
├── .env.example
├── package.json
├── src/
│   ├── config.js
│   ├── satusehatClient.js
│   └── server.js
├── postman/
└── screenshots/
```

## Cara Menjalankan

Salin `.env.example` menjadi `.env`, lalu isi kredensial Sandbox SATUSEHAT.

```bash
npm install
npm start
```

Server berjalan di:

```text
http://localhost:3000
```

## Endpoint

### 1. Token OAuth2

```http
GET /auth/token
```

### 2. Cari IHS Number Pasien

```http
GET /master/patient/1000000000000001
```

### 3. Cari IHS Number Dokter

```http
GET /master/practitioner/7209061211900001
```

### 4. Buat Location

```http
POST /locations
Content-Type: application/json

{
  "name": "Ruang Poli Umum"
}
```

### 5. Buat Encounter Langsung

```http
POST /encounters
Content-Type: application/json

{
  "patient_id": "isi_id_pasien",
  "practitioner_id": "isi_id_dokter",
  "location_id": "isi_id_location"
}
```

### 6. Jalankan Alur Lengkap

Endpoint ini menjalankan langkah 1 sampai 5 secara berurutan.

```http
POST /registration-flow
Content-Type: application/json

{
  "patientNik": "1000000000000001",
  "practitionerNik": "7209061211900001",
  "locationName": "Ruang Poli Umum"
}
```

Response sukses akan berisi:

```json
{
  "mode": "real",
  "patient_id": "...",
  "practitioner_id": "...",
  "location_id": "...",
  "service_provider_id": "...",
  "encounter_id": "...",
  "timestamp": "..."
}
```

Screenshot response `201 Created` dari endpoint ini dapat disimpan di folder `screenshots/`.

## Error Handling

Backend sudah menangani error dasar:

- `401`: token tidak valid atau kedaluwarsa.
- `404`: pasien/dokter berdasarkan NIK tidak ditemukan.
- `500`: error lain dari server atau SATUSEHAT.

## Deliverables Tugas

- Source code: folder proyek ini.
- Dokumentasi API: export Postman/Bruno/Insomnia collection dari endpoint di atas.
- Screenshot bukti berhasil: response `201 Created` yang menampilkan `encounter_id`.

## Catatan Data Dummy dan Sandbox

NIK dokter `1000000000000002` dari slide tidak ditemukan di Sandbox SATUSEHAT saat diuji. Untuk request real, proyek ini memakai NIK dokter dummy resmi SATUSEHAT `7209061211900001`.

Field `Location.identifier` sengaja tidak dikirim karena Sandbox menolak namespace `http://sys-ids.kemkes.go.id/location/10000004` dengan error `RuleNumber: 10447`. Tanpa field tersebut, SATUSEHAT tetap membuat resource `Location` dan mengembalikan `Location_ID`.

Jika POST `Encounter` mengembalikan error `wrong organization ID provided by serviceProvider`, isi `SATUSEHAT_SERVICE_PROVIDER_ID` di `.env` dengan Organization ID yang benar dari portal SATUSEHAT untuk pasangan `client_id` dan `client_secret` yang digunakan.
