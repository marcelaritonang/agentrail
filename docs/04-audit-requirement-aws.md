# Audit Requirement AWS Activate Founders (per baris, mendalam)

> Sumber: aws.amazon.com/startups/credits + Promotional Credit T&C (Des 2024),
> diverifikasi di sesi ini. Tujuan: dapat pendanaan (kredit) AWS.
> Prinsip audit: jujur, bukan yes-man. Tiap requirement dicek dari sisi reviewer.

Legenda status: ✅ terpenuhi · ⬜ belum · ⚠️ belum pasti / perlu konfirmasi

---

## REQUIREMENT RESMI (yang AWS tulis)

### R1. Startup berdiri < 10 tahun
- **Arti:** perusahaan/proyek baru, bukan korporasi lama.
- **Status:** ✅ Otomatis terpenuhi (startup baru).
- **Sisi reviewer:** tidak jadi masalah.
- **Aksi:** — (tidak ada).

### R2. Tahap pre-Series B / self-funded
- **Arti:** belum pendanaan besar. Founders tier justru UNTUK bootstrap/tanpa VC.
- **Status:** ✅ Terpenuhi (kamu bootstrap, tanpa VC).
- **Sisi reviewer:** ini justru cocok — jangan melebih-lebihkan tahap.
- **Aksi:** jawab jujur "self-funded, early-stage" di form.

### R3. Baru pertama menerima Activate Credits
- **Arti:** belum pernah klaim kredit Activate sebelumnya.
- **Status:** ✅ Terpenuhi.
- **Aksi:** — .

### R4. Punya AWS Account di PAID TIER
- **Arti:** akun AWS dengan metode bayar terpasang (bukan berarti ditagih;
  hanya syarat kartu terpasang). Free-tier saja TIDAK cukup.
- **Status:** ⬜ Belum ada akun.
- **Sisi reviewer:** ini syarat teknis mutlak — tanpa ini aplikasi ditolak sistem.
- **Aksi:** buat AWS Account → verifikasi email + HP → pasang kartu (charge hold
  ~$1, balik). Di sinilah kartu Honest diuji apakah diterima AWS.
- **RISIKO:** kartu virtual/Indonesia kadang ditolak AWS. Ini titik gagal #1.

### R5. AWS Builder ID pakai email PROFESIONAL
- **Arti:** identitas login Activate. Email domain sendiri, BUKAN gmail.com.
- **Status:** ⬜ Belum ada (belum ada domain → belum ada email domain).
- **Sisi reviewer:** email @gmail = sinyal "hobi", email @domainmu = "bisnis".
- **Aksi:** butuh domain dulu → bikin email @domain → daftar Builder ID.

### R6. "Startup details" — detail & website startup
- **Arti:** form minta nama startup, website, dan deskripsi apa yang dibangun.
  Reviewer (manusia) MENGKLIK website-mu.
- **Status:** ⬜ Belum ada website live + ⚠️ PRODUK/IDE BELUM FINAL.
- **Sisi reviewer:** INI PENENTU utama diterima/ditolak. Website kosong / ide
  generic ("AI document API") = ditolak karena tidak meyakinkan.
- **Aksi:** (a) kunci IDE yang kuat & spesifik, (b) bangun produk minimal yang
  jalan, (c) website live di domain sendiri yang menjelaskan produk.
- **CATATAN JUJUR:** ini requirement TERBERAT & yang paling belum siap. Semua
  requirement lain teknis/gampang; yang ini butuh substansi nyata.

### R7. Country / geographic eligibility
- **Arti:** apakah negara pendaftar didukung.
- **Status:** ⚠️ BELUM PASTI untuk Indonesia. T&C resmi TIDAK punya daftar negara
  terlarang (sinyal positif), tapi tak ada pernyataan eksplisit "Indonesia boleh".
- **Sisi reviewer:** ditentukan sistem AWS saat submit, bukan negosiasi.
- **Aksi:** apply = $0 risiko → biarkan AWS memutuskan, ATAU tanya dulu
  (docs/02). Tidak bisa diakali (VPN tak berguna — kartu & HP tetap Indonesia).

---

## RINGKAS: mana yang sudah vs gap

| # | Requirement | Status | Berat? |
|---|---|---|---|
| R1 | Umur < 10 thn | ✅ | - |
| R2 | Self-funded | ✅ | - |
| R3 | Baru di Activate | ✅ | - |
| R4 | AWS Account paid tier | ⬜ | sedang (risiko kartu) |
| R5 | Email profesional | ⬜ | ringan (butuh domain) |
| R6 | **Website + PRODUK nyata** | ⬜ | **BERAT — penentu** |
| R7 | Negara eligible | ⚠️ | di luar kendali |

**Kesimpulan audit:** 3 dari 7 sudah otomatis terpenuhi. Yang teknis (R4, R5)
gampang begitu ada domain + kartu. **Satu-satunya requirement berat & penentu
adalah R6: produk + website yang meyakinkan.** Dan R6 tidak bisa diselesaikan
tanpa mengunci IDE yang kuat dulu.

---

## URUTAN EKSEKUSI (dependency-benar)

1. **Kunci IDE produk** (spesifik, lahir dari masalah nyata) ......... [R6 - blocker]
2. Bangun produk minimal yang jalan .................................. [R6]
3. Tentukan nama + beli domain ...................................... [R5, R6]
4. Buat email @domain .............................................. [R5]
5. Rapikan + deploy website yang menjelaskan produk ................. [R6]
6. Buat AWS Account + pasang kartu (uji Honest) ..................... [R4]
7. Buat AWS Builder ID ............................................. [R5]
8. Submit aplikasi Activate Founders ............................... [semua]
9. Tunggu 5–10 hari kerja .......................................... [R7 diputus di sini]

**Blocker paling atas = langkah 1 (ide).** Semua langkah lain menunggu ini.
Biaya wajib: domain ~$10/thn. Sisanya $0.
