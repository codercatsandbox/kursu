# Kürsü

Ali Haydar Sucu için lokal ders, eğitim ve GNO takip paneli. Rota'dan ayrı bir uygulamadır; YKS tarafına dokunmaz.

## Ne yapar?

- **Bugün:** ders ve eğitim bazında dakika, konu/milestone ve aktivite kaydı; ruh hali, enerji ve gün notu.
- **Dersler:** 2026-2027 Güz dersleri, haftalık konular, değerlendirme ağırlıkları, hedef/final notu ve projeksiyon.
- **Takvim:** sınavlar, ödev/teslimler, TÜBİTAK gibi başvurular ve eğitim milestone'ları tek listede.
- **Eğitimler:** FPGA Akademisi, Gemstone Anadolu ve TÜBİTAK başvurusu gibi dış programlar; milestone ilerlemesi.
- **Notlar:** AYBÜ harf notu ölçeği, AKTS ağırlıklı dönem/kümülatif GNO, 3.51 hedefi için gereken ortalama.
- **Özet:** günlük/haftalık özet, 30/90 günlük grafik, ders dağılımı ve 24 haftalık ısı haritası. Rapor dosyası üretmez.
- **Ayarlar:** hedefler, GNO varsayımları, CSV dışa/içe aktarma ve AYBÜZEM (Moodle) bağlantısı.

## Gereksinim

- Node.js **24** veya üzeri (`node:sqlite` yerleşik modülü kullanılır).
- npm bağımlılığı yoktur.

## Çalıştırma

```bash
cd "/home/ali/Projeler/kursu"
npm start
```

Panel: <http://127.0.0.1:5174>

Farklı port:

```bash
PORT=5175 npm start
```

Geliştirme sırasında otomatik yeniden başlatma:

```bash
npm run dev
```

Testler:

```bash
npm test
```

Testler geçici bir SQLite dosyası kullanır; `data/kursu.db` dosyasına dokunmaz.

## Bildirimler

Yeni AYBÜZEM materyalleri ve yaklaşan sınav/teslim tarihleri masaüstü bildirimi olarak gösterilir. Kontrol, her 30 dakikalık AYBÜZEM senkronundan sonra çalışır; 08:30'daki systemd timer'ı senkron çalışmadığında emniyet ağı olarak aynı kontrolü yapar. Linux'ta `notify-send` (libnotify) gerekir.

```bash
node scripts/bildirim.js --materials --dry-run
node scripts/bildirim.js --deadlines --dry-run
```

## Veri

- SQLite veritabanı: `data/kursu.db`
- AYBÜZEM ayarları: `data/aybuzem.json` (`chmod 600`, `.gitignore` içinde)
- Veritabanı ve AYBÜZEM dosyası repoya girmez.
- Yedek: sunucu kapalıyken `data/kursu.db` dosyasını kopyala.

## 2026-2027 Güz seed verisi

Dersler: CENG300, CENG301, CENG303, CENG305, CENG327, CENG441, EE424, ENGR251, MATH101.

Toplam 45 AKTS. CENG300 staj/geçti-kaldı olduğu için GNO'ya girmez. MATH101 tekrar dersidir; final notu girildiğinde son deneme esas alınır.

GNO varsayılanları:

- Önceki GNO: 3.12
- Önceki AKTS: 129
- Mezuniyet AKTS: 240 (minimum; ek dersler ve not yükseltmeleri ayrıca planlanabilir)
- Hedef GNO: 3.51
- Ölçek: AA 4.00, BA 3.50, BB 3.00, CB 2.50, CC 2.00, DC 1.50, DD 1.00, FD 0.50, FF 0.00

Bu varsayımlar Ayarlar sekmesinden değiştirilebilir. Tekrar derslerinde eski notun AKTS/puan katkısı çıkarılır ve son deneme esas alınır. Hedef 4.00 üstü bir ortalama gerektiriyorsa panel, minimum 240 AKTS üzerine 4.00'lük ek ders ihtiyacını ayrıca gösterir. Notlar sekmesinde MATH101 için **DD → AA** senaryosu ayrıca gösterilir.

Syllabus verisi:

- CENG301, CENG303, CENG305, CENG327, EE424 ve MATH101 dosyalarından çıkarıldı.
- CENG441 için syllabus bulunmadığından değerlendirmeler 40/60 yer tutucu olarak işaretlendi.
- ENGR251 için yalnızca ders slaytı olduğundan değerlendirmeler 40/60 yer tutucu olarak işaretlendi.
- Sınav tarihleri ve bazı haftalık konular syllabus dışından yorumlandı; ders detayından düzeltilebilir.

## AYBÜZEM / Moodle

Faz 4 entegrasyonu `integrations/aybuzem.js` içinde hazır:

1. Ayarlar → AYBÜZEM bölümüne adres, kullanıcı adı ve şifre gir.
2. Şifre diske yazılmaz; yalnızca sunucu sürecinde token almak için kullanılır. Token `data/aybuzem.json` içinde 600 izniyle saklanır. Token yoksa veya süresi dolduysa şifreyi yeniden girmen gerekir.
3. “Şimdi senkronize et” dersleri, ödevleri ve takvim etkinliklerini salt okunur çeker.
4. AYBÜZEM'den gelen ödevler `source = 'aybuzem'` etiketiyle görevlere eklenir; manuel görevler ezilmez.
5. Moodle mobil web servisi kapalıysa bağlantı hata verir; CSV/HTML içe aktarma ve manuel giriş çalışmaya devam eder.
6. Sunucu açıldığında yapılandırılmış AYBÜZEM hesabıyla otomatik senkron başlar ve 30 dakikada bir tekrarlanır. Ders içerikleri `~/Masaüstü/CENG 3rd Fall` (veya `~/Desktop/CENG 3rd Fall`) altında ders klasörlerine indirilir; Moodle bölümleri eksik konu olarak uygulamaya eklenir.

Moodle uçları:

- `POST /login/token.php` (`service=moodle_mobile_app`)
- `POST /webservice/rest/server.php`

## Materyaller ve “kaldığım yer”

AYBÜZEM senkronunun indirdiği dosyalar `materials` tablosuna yansıtılır. Ders detayında **Materyaller** bölümü, her dosya için bir çalışma görünümü bağlantısı ve **Kaldığım yerden devam** düğmesi gösterir.

Çalışma görünümü (`/study.html?material=...&page=...`):

- PDF/PPTX/DOCX dosyalarını tarayıcıda açar; `#page=N` ile istenen sayfaya gider.
- Açılışta bir `study_sessions` kaydı oluşturur.
- **Burada kaldım** sayfayı `material_progress` ve oturumun `end_page` alanına yazar.
- **Konuyu bitir** ilgili konuyu `bitti` yapar.
- Sayfa takibi, tarayıcı PDF görüntüleyicisinin sayfa değişimini okuyamadığı için ilk sürümde kullanıcı tarafından girilir. PDF.js tabanlı otomatik takip sonraki fazdır.

`GET /api/study/resume?course=CENG301` şu sırayı izler:

0. `course` verilmezse son çalışma oturumu, son günlük kayıt veya materyali
   olan ilk ders seçilir.
1. Son çalışma oturumu (`study_sessions`).
2. Son günlük kayıt (`logs`).
3. Durumu `devam` olan ilk konu.
4. Son `bitti` konudan sonraki konu.
5. İlk konu.

Kayıt yoksa `state: "fresh"` döner ve asistan uydurmaz; “henüz çalışma kaydı yok” der. Materyal eşleşmesi AYBÜZEM bölüm adı ile konu başlığı üzerinden yapılır; eşleşme yoksa dersin ilk PDF’i seçilir.

Web servisi kapalıysa Ayarlar → Veri bölümünden dışa aktarılmış CSV dosyası veya Moodle tablosunu içeren HTML dosyası içe aktarılabilir. Günlük kayıtlar mevcut günle birleştirilir; değerlendirme ve görevler başlık/tarih eşleşmesiyle güncellenir. Bu akış Playwright veya tarayıcı otomasyonu kullanmaz.

## Syllabus çıkarma promptu

İndirilen ders belgelerinden yeni eklenen bir ders için syllabus bilgilerini çıkarmak üzere Copilot, Codex veya Claude Code'a aşağıdaki prompt verilebilir:

```text
Bu repository'de AYBÜZEM'den indirilen ders içeriklerini inceleyip yeni eklenmiş ders için güvenilir bir syllabus özeti oluştur.

Amaç:
- İstenen ders klasörünü ve ilgili contents.json dosyasını bul.
- PDF, DOCX, HTML, TXT, Markdown ve ZIP içindeki okunabilir belgeleri tara.
- Syllabus, grading, assessment, course outline, weekly schedule ve exam bilgilerini önceliklendir.
- İçerikleri uygulamanın mevcut veri modeline uygun şekilde hazırlayıp import edilebilir bir çıktı üret.

Çalışma kuralları:
1. Önce repository yapısını, db.js şemasını, integrations/aybuzem.js senkronunu ve mevcut assessment/topic kayıtlarını oku.
2. Ders kodunu CENG303 gibi klasör adından, contents.json içindeki course alanından ve Moodle metadata'sından doğrula. Kod uyuşmuyorsa tahmin etme; belirsizliği raporla.
3. Belgelerde yazmayan sınav tarihi, quiz sıklığı, ağırlık, hafta konusu veya not kuralını uydurma.
4. Bir bilgi birden fazla belgede geçiyorsa syllabus/grading belgesini önceliklendir; çelişki varsa iki kaynağı ve seçtiğin sonucu açıkça belirt.
5. PDF/DOCX okunamıyorsa dosyayı yok sayma. Dosya adı, boyutu, türü ve okunamama nedenini rapora ekle.
6. URL modülü gerçek belge yerine HTML görüntüleyici döndürüyorsa bunu gerçek PDF/ZIP gibi yorumlama. HTML içindeki görünen hedef bağlantıyı ayrıca raporla.
7. Aynı dersi veya aynı assessment/topic kaydını ikinci kez oluşturma. İşlem idempotent olmalı; mevcut kayıtları yalnızca kaynak daha güvenilir ve yeni bilgi sağlıyorsa güncelle.
8. Kullanıcının manuel notlarını, puanlarını, kişisel GPA ayarlarını, günlük kayıtlarını ve mevcut ders hedeflerini silme veya sıfırlama.
9. Değişiklik yapmadan önce planı ve etkilenecek kayıtları listele. Yazma işlemlerinden sonra değişen kayıtları ve atlanan belgeleri raporla.
10. Uygulama Windows, macOS ve Linux'ta çalışmalıdır. Dosya yollarında path.join/path.resolve/os.homedir kullan; Linux'a özel '/', '~', chmod veya sabit kullanıcı dizini kullanma. AYBUZEM_CONTENT_DIR varsa onu kullan.

Çıktıyı önce şu JSON yapısında üret:
{
  "course": { "code": "CENG303", "name": "...", "instructor": "...", "ects": null },
  "topics": [
    { "week": 1, "title": "...", "source": "dosya.pdf#sayfa 2", "confidence": "high" }
  ],
  "assessments": [
    { "type": "vize|final|quiz|odev|proje|lab|pratik|sunum", "title": "...", "date": null, "weight": null, "source": "...", "confidence": "high" }
  ],
  "grading": { "scale": "...", "rules": ["..."], "source": "..." },
  "unknowns": ["Belgesi bulunamayan veya çelişkili bilgiler"],
  "files_scanned": [],
  "files_skipped": []
}

JSON çıktısından sonra:
- Bulduğun bilgileri mevcut db.js şeması ve API sözleşmesiyle karşılaştır.
- Uygulamaya yazma yapacaksan hangi endpoint veya kontrollü migration'ı kullanacağını söyle.
- assessment ağırlıklarının toplamını kontrol et; toplam %100 değilse bunu hata olarak işaretle, otomatik düzeltme yapma.
- Tarih yoksa date alanını null bırak. Tahmini tarihi gerçek tarih gibi kaydetme.
- Son olarak kısa bir değişiklik özeti, güven seviyesi ve insan onayı gerektiren maddeler listesi ver.
```

Bu prompt, syllabus bilgisini doğrudan körlemesine veritabanına yazmak yerine kaynak, güven seviyesi ve belirsizlikleri korur. İnsan onayı gerektiren tarih/ağırlık kararları ayrıca gösterilir.

## Platform desteği

Uygulama macOS, Windows ve Linux için aynı davranışı hedefler:

- Node.js **24+** ve `node:sqlite` gerekir.
- Dosya yolları `os.homedir()` ve `path` API'leriyle oluşturulur.
- İçerik klasörü işletim sistemine göre `Masaüstü` veya `Desktop` altında bulunur.
- Sabit kullanıcı dizini veya Linux'a özel dosya yolu kullanılmaz.
- Özel içerik konumu için `AYBUZEM_CONTENT_DIR` ortam değişkeni kullanılabilir.
- Windows'ta `npm start`, macOS/Linux'ta `npm start` ile aynı şekilde çalışır.
- Şifre dosyaya yazılmaz; token ve yerel veritabanı kullanıcı bilgisayarında kalır.

## API

| Metot | Yol | Açıklama |
| --- | --- | --- |
| GET | `/api/bootstrap` | Ayar, dönem, ders, eğitim, konu, milestone, değerlendirme ve görevler |
| GET | `/api/summary?date=` | Günlük özet, yaklaşanlar, riskler ve GNO |
| GET | `/api/stats?days=` | Seri, dağılım, haftalık toplamlar |
| GET/PUT | `/api/days/:date` | Günü oku / günü ve logları kaydet |
| GET | `/api/courses` · `/api/courses/:id` | Ders listesi / detay |
| POST/PUT/DELETE | `/api/courses` · `/api/courses/:id` | Ders CRUD |
| GET/POST | `/api/courses/:id/topics` | Konu listesi / ekle |
| GET | `/api/courses/:id/materials` | Dersin indirilmiş materyalleri ve sayfa ilerlemesi |
| GET | `/api/materials/:id` | Materyal detayı |
| GET | `/api/materials/:id/file` | Materyal dosyası (Range destekli) |
| PUT | `/api/materials/:id/progress` | Materyal sayfası/ilerlemesi kaydet |
| GET | `/api/study/resume?course=` | “Kaldığım yer” özeti; `course` yoksa son çalışılan ders |
| GET | `/api/study/today?date=` | Günlük çalışma oturumları ve dakikalar |
| POST | `/api/study/sessions` | Çalışma oturumu başlat |
| GET/PATCH | `/api/study/sessions/:id` | Oturum oku / güncelle |
| POST | `/api/study/sessions/:id/close` | Oturumu bitir (sayfa ve dakika) |
| PUT/DELETE | `/api/topics/:id` | Konu güncelle / sil |
| GET/POST | `/api/assessments` | Değerlendirme listesi / ekle |
| PUT/DELETE | `/api/assessments/:id` | Değerlendirme güncelle / sil |
| GET/POST | `/api/tasks` | Görev listesi / ekle |
| PUT/DELETE | `/api/tasks/:id` | Görev güncelle / sil |
| GET/POST | `/api/trainings` | Eğitim listesi / ekle |
| GET/PUT/DELETE | `/api/trainings/:id` | Eğitim detay / güncelle / sil |
| POST | `/api/trainings/:id/milestones` | Milestone ekle |
| PUT/DELETE | `/api/milestones/:id` | Milestone güncelle / sil |
| GET | `/api/gno` | GNO projeksiyonu |
| GET | `/api/export.csv?kind=logs\|assessments\|tasks` | CSV dışa aktarma |
| POST | `/api/import` | CSV veya HTML tablo içe aktarma (`{ kind, text }`) |
| GET | `/api/aybuzem/status` | AYBÜZEM durumu |
| POST | `/api/aybuzem/config` | AYBÜZEM ayarlarını kaydet |
| POST | `/api/aybuzem/sync` | AYBÜZEM senkronizasyonu |

## Notlar

- Arayüz tamamen Türkçe ve bağımlılıksızdır.
- Tarihler yerel saatle `YYYY-MM-DD` olarak tutulur; görev/milestone saatleri `YYYY-MM-DDTHH:MM` olabilir.
- `data/kursu.db` silinirse uygulama ilk açılışta seed verisini yeniden oluşturur.
