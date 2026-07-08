# Panduan Profesional — Apply AWS Activate Founders (Mendalam)

> Tier: **Founders** (bootstrap, TANPA VC). Kredit $1.000–$5.000.
> Temuan: T&C resmi kredit AWS TIDAK punya daftar negara terlarang (sinyal positif
> untuk Indonesia), tapi konfirmasi final tetap saat apply.
> Balasan aplikasi: 5–10 hari kerja.

---

## PRINSIP: Kenapa "profesional" penting
Review Activate dilakukan **manusia**. Mereka cek apakah kamu startup nyata, bukan
akun asal-asalan. Yang meyakinkan reviewer: **domain aktif + website jelas + email
domain + deskripsi produk yang konkret.** Semua ini menandakan "ini bisnis serius".
Founders tier lebih longgar dari Portfolio, tapi presentasi tetap menentukan.

---

## FASE 0 — Verifikasi eligibility (gratis, lakukan dulu)
- [ ] Kirim pertanyaan ke AWS (lihat `docs/02-tanya-aws-eligibility.md`).
- [ ] Simpan balasan sebagai bukti.
> Kalau tak mau menunggu: karena T&C tak melarang negara, sebagian founder langsung
> apply dan membiarkan AWS yang memutuskan. Risiko finansial apply = $0. Tapi tetap
> siapkan domain dulu (di bawah) agar aplikasi terlihat profesional.

---

## FASE 1 — Identitas startup (fondasi profesional)

### 1.1 Nama & positioning
- [ ] Tetapkan nama startup yang konsisten (dipakai di domain, email, website, AWS).
- [ ] Tetapkan 1 kalimat "what we do": mis. *"AI API that turns documents into
      structured data."* Ini dipakai di website DAN form aplikasi.

### 1.2 Domain (.com)
- [ ] Beli `.com` sesuai nama startup (~$10/thn). Lihat `docs/01-panduan-beli-domain.md`.
- [ ] Verifikasi domain aktif.

### 1.3 Email bisnis
- [ ] Buat `you@namastartup.com` (Zoho Mail free). BUKAN Gmail.
- [ ] Email inilah yang dipakai untuk **AWS Builder ID** dan form aplikasi.
- [ ] Tes kirim/terima.

---

## FASE 2 — Website profesional (yang dilihat reviewer)

Website tidak perlu mewah, tapi harus **meyakinkan**. Checklist kualitas:

### 2.1 Konten wajib ada
- [ ] **Hero** jelas: nama produk + 1 kalimat value proposition.
- [ ] **What it does**: 3–4 fitur konkret (bukan basa-basi).
- [ ] **How it works**: alur singkat / contoh pemakaian (mis. contoh API call).
- [ ] **About / Company**: 2–3 kalimat siapa kamu, tahap startup (early-stage).
- [ ] **Contact**: email domain kamu (`you@namastartup.com`).
- [ ] **Footer**: `© 2026 [Nama Startup]`.

### 2.2 Sinyal profesional (yang membedakan "serius" vs "asal")
- [ ] Domain sendiri (bukan `.netlify.app` / `.vercel.app` telanjang).
- [ ] HTTPS aktif (otomatis dari Netlify/Vercel/Cloudflare — gratis).
- [ ] Email di website = domain yang sama.
- [ ] Tidak ada teks placeholder tersisa (`docintel.example`, "lorem ipsum").
- [ ] Judul tab (title) & meta description terisi (untuk SEO + tampilan link).
- [ ] Tampilan rapi di HP (responsif — template di `website/` sudah responsif).

### 2.3 Yang HARUS diganti di `website/index.html`
- [ ] `docintel.example` → domain asli kamu (semua kemunculan).
- [ ] `founders@docintel.example` → email domain kamu.
- [ ] `DocIntel` → nama startup kamu (kalau beda).
- [ ] Section "About the company" → ceritakan startup kamu yang sebenarnya.

---

## FASE 3 — Deploy website online (gratis + HTTPS otomatis)

Pilih satu (semua gratis, semua kasih HTTPS):
- **Netlify** — paling mudah: drag-drop folder `website/`.
- **Vercel** — connect repo / upload.
- **Cloudflare Pages** — connect repo, output dir = `website`.

Langkah (contoh Netlify):
- [ ] 3.1 Daftar netlify.com (login GitHub/email).
- [ ] 3.2 "Add new site" → "Deploy manually" → drag folder `website/`.
- [ ] 3.3 Situs live di URL sementara (`namamu.netlify.app`) — cek tampil benar.
- [ ] 3.4 "Domain settings" → "Add custom domain" → masukkan `namastartup.com`.
- [ ] 3.5 Ikuti instruksi DNS (arahkan domain ke Netlify di registrar).
- [ ] 3.6 Tunggu propagasi (menit–jam) → verifikasi `https://namastartup.com` live.

---

## FASE 4 — Siapkan AWS

### 4.1 AWS Builder ID
- [ ] Buat **AWS Builder ID** pakai email domain (`you@namastartup.com`).
      (Ini identitas ringan AWS, terpisah dari akun penuh.)

### 4.2 AWS Account
- [ ] Buat **AWS Account** (aws.amazon.com → Create account) pakai email domain.
- [ ] Verifikasi email + nomor HP.
- [ ] Tambah metode bayar (kartu Visa/MC/Amex, aktif internasional).
  - Charge verifikasi ~$1 (hold, dikembalikan). Kartu Honest bisa dites di sini.
- [ ] Akun di **paid tier** (syarat Activate; bukan berarti ditagih — hanya butuh
      metode bayar terpasang).
- [ ] Catat **AWS Account ID** (12 digit).

---

## FASE 5 — Apply Activate Founders

- [ ] 5.1 Buka **aws.amazon.com/startups/credits** → pilih **Founders**.
- [ ] 5.2 Login pakai AWS Builder ID (email domain).
- [ ] 5.3 Isi form startup — siapkan jawaban ini dulu (draf profesional):
  - **Startup name:** [nama]
  - **Website:** https://namastartup.com
  - **What you're building (1–2 kalimat):** value proposition kamu
  - **Stage:** Early-stage / pre-seed, bootstrapped/self-funded
  - **Funding:** Self-funded (Founders tier tidak butuh VC)
  - **Founded:** [tahun] (harus <10 thn)
- [ ] 5.4 Sambungkan AWS Account ID.
- [ ] 5.5 Submit.
- [ ] 5.6 Tunggu email balasan **5–10 hari kerja**. Simpan konfirmasinya.

---

## FASE 6 — Setelah kredit masuk

- [ ] 6.1 Kredit AWS otomatis muncul di akun (Billing → Credits).
- [ ] 6.2 (Opsional) Pakai untuk Kiro: install Kiro → login via IAM Identity Center.
- [ ] 6.3 Pantau pemakaian kredit di AWS Billing. Kredit expire 1 thn.

---

## TIPS AGAR DITERIMA (dari pola umum program kredit)
1. **Konsistensi identitas.** Nama startup, domain, email, website, form — semua
   sama. Ketidakcocokan = red flag.
2. **Website hidup sebelum apply.** Reviewer klik domainmu. Pastikan sudah live.
3. **Deskripsi konkret.** "AI document extraction API for fintech" > "platform AI
   revolusioner". Spesifik menang.
4. **Jujur soal tahap & funding.** Founders memang untuk self-funded — tidak perlu
   melebih-lebihkan. Kejujuran menghindari pembatalan belakangan.
5. **Email domain, bukan Gmail.** Sinyal profesional paling murah & paling penting.
6. **Jangan pakai VPN/alamat palsu.** Data harus konsisten dengan kartu & HP.

---

## URUTAN RINGKAS (satu tarikan)
0. Tanya AWS (eligibility) → 1. Nama+domain+email → 2. Rapikan website →
3. Deploy online → 4. AWS Builder ID + Account → 5. Apply Founders → 6. Terima kredit.

**Biaya wajib total: domain ~$10/thn. Sisanya $0.**
