# Arazi Takip Sistemi

Ziraat mühendisinin çiftçi tarlası ziyaretlerini takip etmek için basit web uygulaması.
Next.js 16 + PostgreSQL (Neon). Telefonda kart, bilgisayarda tablo görünümü.

## Özellikler

- Çiftçi (ad soyad, telefon) → Tarla (adres, ürün) → Ziyaret (tarih, not)
- Aynı telefonla yeni tarla girilirse mevcut çiftçiye eklenir
- Liste üç bölüm: **Hiç gidilmeyenler** (kırmızı) → **3 haftayı geçenler** (kırmızı, en eskisi üstte) → **Gidilen ve süresi gelmeyenler**
- Kırmızı bölümlerde tek dokunuşla **"Bugün gidildi"**; tarla 3 hafta boyunca alt bölüme iner
- ☆ ile çiftçi **öncelikli** yapılır; her bölümde yıldızlılar en üstte (çiftçinin tüm tarlaları)
- Bölge ve ürün filtresi; arama sadece isim ve telefonda
- **Silinenler:** silinen tarla/ziyaret/reçete 30 gün boyunca geri alınabilir, sonra kalıcı silinir
- **Yedekler:** her gün otomatik yedek (son 30 gün, veritabanında) + istendiğinde tam yedek Excel'i
- Detayda geçmiş tarihli ziyaret + not ekleme, ziyaret silme, düzenleme
- Telefona dokununca arama açılır
- **Reçete:** sulama ve yapraktan aynı reçetede — her haftada 💧 Sulama ve 🍃 Yapraktan bölümleri,
  her satırda ürün + miktar (dönüme) + birim + açıklama.
  Haftaların arasına isteğe bağlı **ara sulama** eklenebilir (1–2 ve 2–3. hafta arası; içinde sulama ve yapraktan seçilir,
  toplamlara dahildir, PDF'te mavi başlıkla görünür).
  Tarlanın **dönüm** bilgisi kayıtlıdır; toplamlar dönümle çarpılır (aynı ürün iki bölümde varsa toplamda birleşir).
  - Sulama: toplam = dönüme miktar × dönüm (örn. Cloud 2+2+3 L × 4 dönüm = 28 Litre)
  - Yapraktan: miktar yine **dönüme** girilir; mühendis dönüme kaç litre su verileceğini yazar (boşsa 150 L).
    Toplam ürün = dönüme miktar × dönüm, toplam su = dönüme su × dönüm
  - Toplamlar ekranda ve PDF'in en altında gösterilir.
- **Ürün listesi (GTS):** reçetede ürün yazarken arama listesi çıkar (içinde geçen harflerle, "clo" → Bayokim Cloud);
  seçilen ürünün birimi kendiliğinden gelir; toplamda **kaç paket** alınacağı yazar (en az artanı veren birleşim,
  örn. 12 kg Tracer → 1 × 8 kg + 1 × 4 kg kova)
- **Reçeteler bölümü** (üst bardaki 📋 Reçeteler): isimli **reçete şablonları** oluştur/düzenle/sil ve son yazılan reçeteler.
  Yeni reçetede en üstteki **"Şablondan başla"** ile şablon yüklenir; bir reçete de "Şablon olarak kaydet" ile şablona çevrilir.
- Yeni reçete kaydedilince o tarihte ziyaret yoksa **ziyaret otomatik eklenir** ("Reçete No … yazıldı")
- **Ziyarette fotoğraf:** telefonda küçültülüp (~200 KB) veritabanına kaydedilir; ziyaret geçmişinde küçük resim, dokununca büyük hali.
  Fotoğraflar günlük yedeğe dahil değildir.
- **Yeni kayıtta çiftçi önerisi:** isim yazarken kayıtlı benzer çiftçiler (telefon, tarla sayısı) listelenir; aynı kişiyse seçilir ve
  tarla ona eklenir, değilse yazmaya devam edilir (engellemez). Tarla sayfasında **"+ Bu çiftçiye tarla ekle"**.
- **İnternetsiz kullanım:**
  - Reçete, şablon ve ziyaret formları yazarken telefonda **taslak** olarak saklanır; internet yokken Kaydet'e basılırsa
    uyarı verilir, bağlantı gelince tekrar basılır. Başarılı kayıttan sonra taslak silinir.
  - Service worker (`public/sw.js`): açılan sayfalar ve uygulama dosyaları telefonda saklanır; ana sayfa açılınca tüm tarla
    ve reçete ekranları arka planda hazırlanır (6 saatte bir). İnternet yokken liste, tarla sayfaları ve reçete ekranı açılır,
    altta "İnternet yok" bandı görünür. PDF/WhatsApp ve kayıt için internet gerekir.
- Reçete PDF'i (Bayırlıoğlu logolu, Zir. Müh. D.Ali Bulut başlıklı) iPhone paylaşım menüsünden WhatsApp ile gönderilir
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
  silinenler/              Silinen kayıtlar ve geri alma
  yedekler/                Otomatik yedekler, tam yedek indirme
  api/yedek/               Yedek Excel'i
  receteler/               Reçete şablonları ve son reçeteler
  api/foto/                Fotoğraf yükleme ve gösterme
  tarla/[id]/recete/yeni/  Yeni reçete
  recete/[id]/             Reçete görüntüleme, PDF paylaşma, düzenleme
  api/recete/[id]/         Reçete PDF'i
  actions.ts               Tüm kayıt/silme işlemleri
components/                Liste, formlar, butonlar
lib/db.ts                  Veritabanı bağlantısı, şema, sorgular
lib/format.ts              Tarih, telefon, metin yardımcıları
lib/backup.ts              Günlük yedek ve yedek Excel'i
lib/catalog.ts             Ürün listesi araması ve paket hesabı (lib/urunler.json)
lib/recipe.ts              Reçete türleri, toplam hesabı, ürün önerileri
lib/pdf/recete.tsx         PDF tasarımı (başlık, adres, telefon burada)
public/brand/              Logo (beyaz / siyah)
fonts/                     PDF yazı tipi (Inter, OFL lisanslı)
```

## Ayarlar

- Hatırlatma süresi: `lib/format.ts` → `REVISIT_DAYS` (varsayılan 21 gün)
- Ürün listesini güncellemek: GTS'den stok Excel'i alın, `python scripts/gts-urun-listesi.py GTS.xlsx`
  çalıştırın → `lib/urunler.json` yenilenir
- PDF'teki mühendis adı ve alt bilgi: `lib/pdf/recete.tsx` → `PDF_BRAND`
- Başlangıç ürün önerileri: `lib/recipe.ts` → `DEFAULT_PRODUCTS` (yazılan ürünler otomatik eklenir)

## Ürün listesi

Varsayılan öneriler `lib/format.ts` içindeki `DEFAULT_CROPS` listesindedir.
Listede olmayan bir ürün yazılırsa sonraki kayıtlarda öneri olarak çıkar.
