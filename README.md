# Arazi Takip Sistemi

Ziraat mühendisinin çiftçi tarlası ziyaretlerini takip etmek için basit web uygulaması.
Next.js 16 + PostgreSQL (Neon). Telefonda kart, bilgisayarda tablo görünümü.

## Özellikler

- Çiftçi (ad soyad, telefon) → Tarla (adres, ürün) → Ziyaret (tarih, not)
- Aynı telefonla yeni tarla girilirse mevcut çiftçiye eklenir
- Liste üç bölüm: **Hiç gidilmeyenler** (kırmızı) → **3 haftayı geçenler** (kırmızı, en eskisi üstte) → **Gidilen ve süresi gelmeyenler**
- Kırmızı bölümlerde tek dokunuşla **"Bugün gidildi"**; tarla 3 hafta boyunca alt bölüme iner
- Ürün filtresi ve arama
- Detayda geçmiş tarihli ziyaret + not ekleme, ziyaret silme, düzenleme
- Telefona dokununca arama açılır
- Excel'e aktar (.xlsx), bilgisayar görünümünde
- Şirket içi kullanım için girişsiz; arama motorlarında listelenmez
- iPhone'da Safari → Paylaş → **Ana Ekrana Ekle** ile uygulama gibi açılır

## Vercel'e kurulum

1. Bu klasörü bir GitHub deposuna yükleyin.
2. Vercel → **Add New → Project** → depoyu seçin → **Deploy**.
   (İlk deploy veritabanı olmadığı için açılışta hata verebilir, normal.)
3. Proje → **Storage → Create Database → Neon (Postgres)** → projeye bağlayın.
   `DATABASE_URL` otomatik eklenir. Tablolar ilk açılışta kendiliğinden oluşur.
4. **Deployments → Redeploy**.

> Not: Uygulamada giriş yok. Linki bilen herkes kayıtları görebilir, linki sadece ekip içinde paylaşın.

## Yerelde çalıştırma

```bash
npm install
cp .env.example .env.local   # DATABASE_URL'i doldurun
npm run dev
```

## Dosya yapısı

```
app/
  page.tsx                 Ana liste
  yeni/page.tsx            Yeni kayıt
  tarla/[id]/page.tsx      Tarla detayı + ziyaretler
  tarla/[id]/duzenle/      Düzenleme
  api/disa-aktar/route.ts  Excel dışa aktarma
  actions.ts               Tüm kayıt/silme işlemleri
components/                Liste, formlar, butonlar
lib/db.ts                  Veritabanı bağlantısı, şema, sorgular
lib/format.ts              Tarih, telefon, metin yardımcıları
```

## Ayarlar

- Hatırlatma süresi: `lib/format.ts` → `REVISIT_DAYS` (varsayılan 21 gün)

## Ürün listesi

Varsayılan öneriler `lib/format.ts` içindeki `DEFAULT_CROPS` listesindedir.
Listede olmayan bir ürün yazılırsa sonraki kayıtlarda öneri olarak çıkar.
