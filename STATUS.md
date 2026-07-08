# STATUS TRACKER — Jalur Mendapatkan Kredit Kiro (Termurah)

> Update file ini setiap selesai satu langkah. Ganti `[ ]` jadi `[x]`.
> Terakhir diperbarui: 2026-07-06

## Strategi yang dipilih: AWS Activate (program AWS SENDIRI, bukan Kiro)

**Kenapa:** Kiro Startup Program langsung = Indonesia DI-EXCLUDE + wajib VC = buntu.
AWS Activate = program AWS terpisah, kredit AWS umum (bisa dipakai untuk Kiro juga).

**FAKTA TERVERIFIKASI (dari aws.amazon.com/startups/credits):**
- Tier **Founders**: mulai $1.000, s/d $5.000. **UNTUK BOOTSTRAP, TANPA VC.** ✅
  (Tembok "wajib VC" TIDAK berlaku di sini — beda dari Kiro langsung.)
- Tier Portfolio ($200k) butuh Org ID dari VC/accelerator — abaikan dulu.
- Syarat umum: pre-Series B, berdiri <10 thn, punya AWS Account.
- Apply: buat AWS Builder ID (email profesional) → pilih Founders → isi detail
  startup → sambung AWS account → submit → balasan 5–10 hari kerja.

**MASIH BELUM PASTI:** daftar negara. Halaman AWS tidak menyebut apakah Indonesia
eligible. Konfirmasi lewat langkah B1a (tanya AWS) SEBELUM keluar uang.

**Total biaya wajib jalur ini: ~$10–15/tahun (cuma domain). Sisanya $0.**

---

## RINGKASAN BIAYA

| Item | Biaya | Wajib? |
|---|---|---|
| Domain .com | ~$10–15 / tahun | ✅ Wajib |
| Email bisnis (Zoho free) | $0 | ✅ Wajib |
| Hosting website (Netlify/Vercel/Cloudflare) | $0 | ✅ Wajib |
| Akun AWS | $0 (bayar hanya jika pakai layanan berbayar) | ✅ Wajib |
| Entitas US (Delaware) | ~$500 + $225/thn | ❌ TIDAK perlu (pakai PT) |
| Investor VC | - | ❌ TIDAK perlu (jalur Activate) |

---

## BAGIAN A — SUDAH SELESAI (dikerjakan di project ini)

- [x] A1. Scaffold project + folder `.kiro/` (steering + specs)
- [x] A2. Kode produk AI (Document Intelligence API) — 9/9 test lulus
- [x] A3. Website landing page dibuat (`website/index.html` + `styles.css`)
- [x] A4. Website diuji jalan lokal (HTTP 200 di localhost:8080)
- [x] A5. Panduan aplikasi ditulis (`docs/kiro-application-guide.md`)

---

## BAGIAN B — BELUM SELESAI (langkah dunia nyata, urut)

### KEPUTUSAN TERKUNCI (2026-07-06)
Status VC: **BELUM ADA VC.** → Jalur Kiro langsung MUSTAHIL (butuh VC + Indonesia
di-exclude). Entitas US/Kanada TIDAK menyelesaikan syarat VC. **Jalur final =
AWS Activate**, pakai PT Indonesia, $0 entitas, tanpa VC. Kredit tetap dipakai
di Kiro. Berhenti mempertimbangkan jalur Kiro langsung.

### Tahap 1 — Badan usaha
- [x] B1. Keputusan: pakai **PT Indonesia** (atau daftar sebagai founder). $0.
      Tidak perlu entitas luar negeri.

### MODE: LANGSUNG SIAPKAN & APPLY (dipilih 2026-07-06)
T&C kredit AWS tidak melarang negara + apply = $0 risiko. Jadi tidak menunggu
jawaban AWS. Verifikasi eligibility (B1a) jalan PARALEL, bukan penghalang.

### Tahap 1.5 — Verifikasi eligibility (opsional, paralel)
> Panduan: `docs/02-tanya-aws-eligibility.md`.
- [ ] B1a. (Opsional) Kirim pertanyaan ke AWS sambil menyiapkan yang lain.

### Tahap 2 — Domain
- [ ] B2. Beli domain `.com` (~$10–15/thn). Lihat bagian "Panduan Domain" di bawah.
- [ ] B3. Verifikasi domain aktif (buka di browser, tidak error).

### Tahap 3 — Email bisnis (GRATIS)
- [ ] B4. Daftar **Zoho Mail free** (zoho.com/mail) → buat email di domainmu,
      mis. `you@namadomain.com`. Bukan Gmail.
- [ ] B5. Verifikasi bisa kirim & terima email dari alamat domain itu.

### Tahap 4 — Deploy website ONLINE (GRATIS)
- [ ] B6. Ganti placeholder di `website/index.html`:
      `docintel.example` → domain asli, email → email domainmu.
- [ ] B7. Deploy folder `website/` ke Netlify / Vercel / Cloudflare Pages ($0).
- [ ] B8. Sambungkan domain (`namadomain.com`) ke hosting.
- [ ] B9. Verifikasi website live di `https://namadomain.com` (bukan localhost).

### Tahap 5 — AWS
- [ ] B10. Buat **AWS Account** pakai email domain (langkah B4), bukan email pribadi.
- [ ] B11. Verifikasi identitas + tambah metode bayar (kartu; tidak ditagih kalau
      tidak pakai layanan berbayar).
  - Kartu: Visa/Mastercard/Amex, WAJIB aktif transaksi internasional.
  - AWS charge verifikasi ~$1 USD (hold sementara, dikembalikan).
  - Kredit lebih andal drpd debit. Prepaid/virtual card sering DITOLAK.
  - **Kartu Honest (Visa):** kemungkinan bisa, TAPI belum terverifikasi.
    Cara pasti = coba langsung (risiko cuma ~$1). Pastikan intl transaction ON
    + saldo/limit cukup dulu.
- [ ] B12. Catat **AWS Account ID** (12 digit).
- [ ] B13. Set up **IAM Identity Center** (dibutuhkan untuk redeem kredit di Kiro).

### Tahap 6 — Apply AWS Activate
- [ ] B14. Buka aws.amazon.com/startups/credits → apply **Activate Founders**.
- [ ] B15. Isi: nama startup, website (domainmu), email domain, deskripsi produk.
- [ ] B16. Submit & tunggu email hasil (review rolling).

### Tahap 7 — Pakai kredit untuk Kiro
- [ ] B17. Setelah kredit AWS masuk → install Kiro → login via **IAM Identity Center**.
- [ ] B18. Verifikasi kredit terpakai di Kiro. SELESAI.

---

## PANDUAN DOMAIN (jawaban: ya, .com sudah cukup)

**Ya, `.com` sudah cukup dan justru paling direkomendasikan** — paling dipercaya
reviewer dan paling profesional.

**Tempat beli murah & aman:**
| Registrar | Harga .com/tahun | Catatan |
|---|---|---|
| **Cloudflare** | ~$10 (harga modal, tanpa markup) | Termurah jangka panjang |
| **Namecheap** | ~$10–13 thn pertama | Populer, mudah |
| **Porkbun** | ~$10 | Murah, reputasi baik |

**HINDARI jebakan:**
- Domain super murah thn pertama ($1) tapi perpanjangan mahal ($30+). Cek harga
  RENEWAL, bukan cuma tahun pertama.
- TLD aneh (.xyz, .online) untuk startup serius — pakai `.com`.
- Jangan beli "add-on" mahal yang ditawarkan saat checkout (kebanyakan tidak perlu;
  WHOIS privacy biasanya sudah gratis di Cloudflare/Namecheap).

**Nama domain:** pakai nama startup/produkmu, singkat, mudah dieja. Contoh pola:
`namaproduk.com`. Email bisnis nanti = `you@namaproduk.com`.

---

## CATATAN KEJUJURAN
- Saya belum bisa verifikasi 100% baris T&C geografis AWS Activate (halaman error
  saat dicek). AWS Activate secara umum tersedia luas termasuk Indonesia, tapi
  konfirmasi final ada di "AWS Promotional Credit Terms" saat kamu apply.
- Kalau Activate ternyata menolak PT Indonesia, barulah pertimbangkan entitas US
  (mahal). Jangan keluarkan uang entitas SEBELUM tahu hasil Activate.
- Jumlah kredit Activate Founders: mulai $1.000, sebagian bisa s/d $5.000.
