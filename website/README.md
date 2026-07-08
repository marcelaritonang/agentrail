# Website — DocIntel landing page

Static one-page site untuk domain startup. Fungsinya: memberi domain kamu isi
nyata sehingga reviewer AWS/Kiro melihat startup yang benar-benar ada.

## Preview lokal
```bash
cd website
python -m http.server 8080
# buka http://localhost:8080
```

## Deploy (pilih salah satu, semua gratis)
- **Netlify / Vercel:** drag-drop folder `website/`, atau connect repo.
- **Cloudflare Pages:** connect repo, build command kosong, output dir = `website`.
- **GitHub Pages:** push ke repo, aktifkan Pages dari folder.

## Yang harus diganti sebelum live
- `docintel.example` → domain asli kamu.
- `founders@docintel.example` → email bisnis di domain kamu.
- Nama produk `DocIntel` → nama startup kamu (opsional).

> PENTING: email di website harus **domain yang sama** dengan email akun AWS.
> Ini syarat program.
