# Panduan Beli Domain .com — Langkah per Langkah (B2)

> Target: punya 1 domain `.com` aktif, semurah mungkin, tanpa jebakan.
> Biaya wajar: ~$10–15 (sekitar Rp 160.000–240.000) per tahun.
> Waktu: 15–30 menit.

---

## Langkah 0 — Siapkan dulu (sebelum mulai)
- [ ] Kartu yang bisa transaksi internasional (Honest/Visa/Mastercard/debit intl).
- [ ] Daftar 3–5 nama domain cadangan (kalau pilihan pertama sudah dipakai orang).

**Tips pilih nama:**
- Pakai nama startup/produkmu. Singkat, mudah dieja, mudah diingat.
- Hindari angka & tanda hubung (`-`) kalau bisa — sering bikin bingung.
- Utamakan `.com`. Ini paling dipercaya reviewer AWS & paling profesional.
- Nama ini nanti jadi email kamu juga: `you@namadomain.com`.

---

## Langkah 1 — Pilih tempat beli (registrar)

Rekomendasi, urut dari termurah jangka panjang:

| Registrar | Harga .com/thn | Kelebihan | Kekurangan |
|---|---|---|---|
| **Cloudflare** | ~$10 (harga modal, tanpa markup) | Termurah, renewal tetap murah, WHOIS privacy gratis | Perlu setup sedikit teknis |
| **Namecheap** | ~$10–13 thn 1 | Paling mudah untuk pemula, UI simpel | Renewal naik sedikit (~$14) |
| **Porkbun** | ~$10 | Murah, WHOIS privacy gratis | Kurang populer |

**Saran:** kalau baru pertama kali → **Namecheap** (paling mudah).
Kalau mau termurah jangka panjang → **Cloudflare**.

---

## Langkah 2 — Cek ketersediaan nama
- [ ] Buka situs registrar (mis. namecheap.com).
- [ ] Ketik nama domain incaranmu di kolom search + `.com`.
- [ ] Kalau "available" → lanjut. Kalau "taken" → coba nama cadangan.

---

## Langkah 3 — Masukkan ke keranjang & CEK HARGA RENEWAL
> INI BAGIAN PALING PENTING — tempat orang sering kejebak.

- [ ] Tambah domain `.com` ke cart.
- [ ] **Lihat harga tahun ke-2 (renewal), bukan cuma tahun pertama.**
  - Jebakan: ada domain $1 tahun pertama, tapi renewal $30+. HINDARI.
  - Yang wajar: thn 1 dan renewal sama-sama ~$10–14.

---

## Langkah 4 — TOLAK add-on yang tidak perlu
Saat checkout, registrar sering menawarkan tambahan berbayar. Untuk sekarang:

| Add-on | Perlu? | Alasan |
|---|---|---|
| WHOIS / Domain Privacy | ✅ Ambil KALAU gratis | Namecheap/Cloudflare gratis. Jangan bayar ekstra untuk ini. |
| Email hosting berbayar | ❌ Tolak | Kita pakai Zoho GRATIS nanti. |
| Web hosting berbayar | ❌ Tolak | Kita deploy GRATIS di Netlify/Vercel. |
| SSL certificate berbayar | ❌ Tolak | Hosting (Netlify/Cloudflare) kasih SSL gratis. |
| "Premium DNS" | ❌ Tolak | DNS gratis bawaan sudah cukup. |

**Intinya: bayar HANYA domain-nya. Sisanya tolak semua.**

---

## Langkah 5 — Bikin akun & bayar
- [ ] Buat akun di registrar (email + password).
- [ ] Isi data (nama, alamat — boleh alamat Indonesia asli).
- [ ] Bayar pakai kartu (di sinilah kartu Honest bisa dites juga).
- [ ] Simpan email konfirmasi pembelian.

---

## Langkah 6 — Verifikasi email domain (WAJIB)
- [ ] Registrar kirim email verifikasi ke email pendaftaranmu.
- [ ] Klik link verifikasi. **Kalau tidak diverifikasi dalam 15 hari, domain
      bisa di-suspend.** Jangan lupa langkah ini.

---

## Langkah 7 — Konfirmasi domain sudah kamu miliki
- [ ] Masuk dashboard registrar → pastikan domainmu muncul di "My Domains".
- [ ] Selesai untuk tahap ini. Domain belum menampilkan apa-apa — itu normal,
      website menyusul di tahap deploy (B6-B9).

---

## SETELAH SELESAI
Update `STATUS.md`:
- [x] B2. Beli domain .com
- [x] B3. Verifikasi domain aktif

Lalu kabari saya nama domainmu → saya lanjut pandu **email Zoho gratis (B4)**
dan **deploy website (B6-B9)**.

---

## Catatan biaya jujur
- Domain adalah SATU-SATUNYA biaya wajib di seluruh jalur ini (~$10–15/thn).
- Semua langkah lain (email, hosting, AWS account, apply Activate) = $0.
- Jangan beli paket mahal apa pun. Kalau ragu suatu add-on, tolak dulu —
  hampir semua bisa ditambah gratis belakangan.
