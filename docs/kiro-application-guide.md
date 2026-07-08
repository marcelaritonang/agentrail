# Panduan Mendaftar Kiro Startup Program

> Disusun dari halaman resmi kiro.dev/startups dan kiro.dev/startups/terms
> (dicek Juli 2026). Selalu verifikasi ulang di halaman resmi sebelum submit,
> karena syarat bisa berubah.

## 1. Apa program ini sebenarnya
Kiro Startup Program memberikan **kredit setara ~1 tahun Kiro Pro+** untuk
startup. Ini BUKAN lomba project. Yang dinilai adalah **status perusahaan**,
bukan demo aplikasi. Project (repo ini) berguna sebagai bukti kredibilitas dan
sebagai tempat memakai kredit setelah diterima — bukan syarat masuk.

## 1.5. PILIH JALUR DULU (paling penting)
Kiro Startup Program **langsung** mewajibkan **VC-backed**. Kalau startup kamu
belum didanai VC (bootstrap/mandiri), jalur langsung berisiko tinggi ditolak.
Tapi ada jalur sah tanpa VC: **AWS Activate**, dan kredit AWS Activate boleh
dipakai untuk Kiro.

| Jalur | Butuh VC? | Dapat apa | Untuk siapa |
|---|---|---|---|
| Kiro Startup Program (langsung) | **Ya** | ~1 thn Kiro Pro+ | sudah ada VC |
| **AWS Activate Founders** | **Tidak** | $1.000–$5.000 kredit AWS → dipakai untuk Kiro | **bootstrap / belum VC** |
| AWS Activate Portfolio | Ya (VC/accelerator) | s/d $200.000 kredit | punya investor Activate Provider |

**Keputusan kamu (belum ada VC): tempuh AWS Activate Founders.**
Syarat umum Activate: pre-Series B, perusahaan berdiri <10 tahun, akun AWS di
paid tier. Tidak butuh investor. Apply di aws.amazon.com/startups/credits.
Catatan: kalau nanti dapat investor VC/accelerator, baru naik ke Portfolio
(s/d $200.000) atau apply Kiro langsung.

## 2. Syarat kelayakan (eligibility) — jalur Kiro langsung
- Startup tahap **early stage sampai Series A**, **didanai VC**.
- Punya **AWS Account ID**.
- Punya **email bisnis yang domainnya sama dengan website startup** (bukan Gmail).
  Email ini jadi email akun AWS utama.
- **Tidak sedang** memegang kredit AWS Activate aktif.
- Pemohon berusia **18+**.
- Window aplikasi: **7 April 2026 – 31 Juli 2026**.

## 3. PENGHALANG UTAMA — daftar negara yang dikecualikan
**Indonesia termasuk yang DIKECUALIKAN.** Juga: Argentina, Australia, Brazil,
Prancis, Jerman, Hong Kong & Greater China, Italia, Malaysia, Meksiko, Polandia,
Filipina, Rusia, Spanyol, Thailand, Vietnam, **Singapura**, plus region embargo
(Kuba, Iran, Korea Utara, Suriah, Belarus, Crimea, UAE).

**Konsekuensi:** apply atas nama PT Indonesia berisiko tinggi ditolak karena
lokasi, bukan kualitas. Rencana yang dipilih: pakai **entitas di negara yang
eligible**.

## 4. Rekomendasi entitas: US C-Corp (Delaware)
- US tidak ada di daftar exclude dan diakui VC global.
- Bisa dibentuk via Stripe Atlas / Clerky / Firstbase.
- Setelah entitas ada: siapkan **domain + email bisnis** dan **akun AWS**
  yang terikat ke entitas tersebut (bukan ke PT Indonesia).
- Catatan: Singapura TIDAK bisa dipakai (masuk daftar exclude).

## 5. Yang didapat kalau diterima
- Kredit ~1 tahun Kiro Pro+ (waktu terbatas).
- Tiga tier berdasarkan jumlah user:
  - **Starter** — sampai 2 user Kiro
  - **Growth** — sampai 10 user
  - **Scale** — sampai 30 user
- Kredit di level perusahaan, bisa dibagi ke user resmi.
- Kredit **kedaluwarsa 1 tahun** sejak diterbitkan ke akun AWS.

## 6. Langkah pendaftaran (urut)
1. Bentuk/siapkan entitas eligible (mis. Delaware C-Corp) + domain + email bisnis.
2. Buat / siapkan **AWS Account**; catat **AWS Account ID**; email akun = email domain.
3. Set up **AWS IAM Identity Center** (Kiro Enterprise). WAJIB — kredit TIDAK
   tersedia bila login pakai AWS Builder ID atau social login (GitHub/Google).
4. Pastikan **tidak** sedang pakai kredit AWS Activate aktif.
5. Submit lewat "Apply for startup credits" → aws.amazon.com/startups/credits/kiro.
6. Review dilakukan **rolling**; hasil diberitahu lewat email.
7. Jika disetujui, kredit otomatis ditambahkan ke akun AWS dan aktif saat
   provisioning (tidak bisa ditunda).
8. Redeem: login Kiro pakai kredensial IAM Identity Center. Pantau pemakaian di
   akun AWS. Saat kredit habis, otomatis pindah ke billing Kiro Pro+ standar.

## 7. Aturan penting lain
- Satu subscription per startup; kredit hanya bisa diterima **sekali**.
- Jika pernah ditolak dan status berubah, boleh **re-apply**.
- Kredit tidak bisa di-refund, di-transfer, atau dijual.
- Melanggar syarat = penawaran gugur. AWS berhak mengubah/membatalkan penawaran.

## 8. Checklist sebelum submit — jalur Kiro langsung (butuh VC)
- [ ] Entitas di negara eligible (bukan Indonesia/Singapura)
- [ ] Domain + email bisnis cocok
- [ ] AWS Account ID siap
- [ ] IAM Identity Center aktif
- [ ] Tidak ada kredit AWS Activate aktif
- [ ] Bukti tahap startup / pendanaan VC siap
- [ ] Submit sebelum 31 Juli 2026

## 9. LANGKAH KAMU — AWS Activate Founders (tanpa VC), urut
Tempuh ini karena belum ada VC. Urutan mengikuti ketergantungan: yang di bawah
butuh yang di atas sudah jadi.

**Tahap A — Fondasi legal**
- [ ] 1. Bentuk entitas eligible (rekomendasi: **Delaware C-Corp** via Stripe
      Atlas / Clerky / Firstbase). Jangan PT Indonesia / Singapura.

**Tahap B — Identitas online (SEBELUM AWS)**
- [ ] 2. Beli **domain** atas nama startup.
- [ ] 3. Set up **email bisnis** di domain itu (Google Workspace/Zoho, bukan Gmail).
- [ ] 4. **Deploy website** (`website/` di repo ini) ke domain tsb — ganti dulu
      `docintel.example` dan email placeholder-nya. Reviewer cek domain nyata.

**Tahap C — AWS**
- [ ] 5. Buat **AWS Account** pakai email domain (langkah 3), bukan email pribadi.
- [ ] 6. Naikkan akun ke **paid tier** (syarat Activate) + catat **AWS Account ID**.
- [ ] 7. Set up **IAM Identity Center** (dibutuhkan saat redeem kredit di Kiro).

**Tahap D — Aplikasi**
- [ ] 8. Apply **AWS Activate Founders** di aws.amazon.com/startups/credits
      (mulai $1.000, bisa s/d $5.000). Tanpa investor.
- [ ] 9. Setelah kredit masuk → login **Kiro pakai IAM Identity Center** →
      kredit AWS dipakai untuk Kiro.

**Nanti (kalau sudah ada VC):** naik ke Activate Portfolio (s/d $200.000) atau
apply Kiro Startup Program langsung.
