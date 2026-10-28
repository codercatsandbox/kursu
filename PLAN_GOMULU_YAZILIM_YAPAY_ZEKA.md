# Gömülü Yazılım ve Yapay Zeka Mezuniyet Planı

Bu plan, transkriptteki mevcut durum ve 2026-2027 Güz dönemi projeksiyonuna göre hazırlandı.

## Mevcut Durum

- Mevcut kümülatif: yaklaşık **3,35 / 4,00**
- GNO'ya giren mevcut AKTS: **164**
- Mezuniyet şartı: **en az 240 AKTS**
- Mevcut Güz dönemi dahil mezuniyete kalan temel yük: **76 AKTS**
- Hedef mezuniyet GNO'su: **3,51**
- Mevcut dönem projeksiyonu doğru gerçekleşirse, kalan 76 AKTS için gereken ortalama: yaklaşık **3,85**

> 240 AKTS bir üst sınır değil, minimum mezuniyet şartıdır. Ek dersler ve not yükseltmeleri bu toplamın üzerine çıkabilir.

## En Mantıklı Not Yükseltme Sırası

### 1. MATH201: DD -> AA veya BA

En yüksek öncelik budur.

- DD -> AA: yaklaşık **+18 puan**
- DD -> BA: yaklaşık **+15 puan**
- AA senaryosunda kalan temel derslerde gereken ortalama yaklaşık **3,62** olur.
- BA senaryosunda gereken ortalama yaklaşık **3,66** olur.

Önce üniversitenin tekrar dersinde eski notu tamamen değiştirip değiştirmediğini doğrula. Bu plan, son notun eski notun yerine geçtiği varsayımıyla hesaplanmıştır.

### 2. ENGR202: CC -> AA veya BA

- CC -> AA: yaklaşık **+12 puan**
- CC -> BA: yaklaşık **+9 puan**
- MATH201 ile birlikte AA yapılırsa kalan temel derslerde gereken ortalama yaklaşık **3,46** seviyesine iner.

### 3. CENG203: CB -> AA veya BA

- CB -> AA: yaklaşık **+7,5 puan**
- CB -> BA: yaklaşık **+5 puan**
- MATH201, ENGR202 ve CENG203 üçü de AA olursa gereken ortalama yaklaşık **3,36** olur.

### Öncelik Kararı

Zaman ve ders tekrarı hakkı sınırlıysa:

1. **MATH201**
2. **ENGR202**
3. **CENG203**
4. Diğer düşük dersler veya 240 AKTS üstü ek dersler

CENG113 zaten CB'den BA'ya yükseltilmiş görünüyor; tekrar önceliği olmamalı.

## 2026-2027 Bahar Dönemi

Kesin ders kodları için bölümün güncel müfredatı ve açılan ders listesi kontrol edilmeli. Transkriptte bulunmayan kodları varsaymıyorum.

### Ders yükü

- Normal hedef: **28-32 yeni AKTS**
- MATH201 tekrar alınırsa, tekrarın AKTS'si yeni mezuniyet AKTS'sine ikinci kez eklenmemeli.
- Toplam iş yükünü, MATH201 tekrarıyla birlikte yaklaşık **30-35 AKTS** civarında tut.
- Aynı dönemde çok sayıda zorunlu ders ve tekrar dersi alıp not kalitesini düşürme.

### Ders seçim sırası

1. MATH201 tekrar dersi
2. Bölümün 3. sınıf bahar zorunlu dersleri
3. Gömülü sistemler veya mikrodenetleyicilerle ilgili seçmeli
4. Yapay zeka için matematik/istatistik veya makine öğrenmesi dersi
5. Ancak ön koşullar sağlanıyorsa ek seçmeli ders

### Dönem hedefi

- Minimum: **3,50 dönem ortalaması**
- İyi hedef: **3,70+**
- MATH201 tekrarında hedef: **BA minimum, AA ideal**

## 4. Sınıf Güz Dönemi

### Öncelikli ders profili

- Gömülü sistemler
- Mikroişlemciler veya mikrodenetleyiciler
- Gerçek zamanlı işletim sistemleri
- Gömülü Linux
- Bilgisayar mimarisi veya donanım-yazılım arayüzleri
- Makine öğrenmesine giriş veya derin öğrenme
- Bölüm projesi için ön koşul olan dersler

### Önerilen proje yönü

**TinyML tabanlı akıllı cihaz** projesi seçilebilir:

- Mikrodenetleyici üzerinde sensör verisi toplama
- C/C++ ile gerçek zamanlı veri işleme
- Python ile veri hazırlama ve model eğitimi
- Küçük bir sınıflandırma modelini cihaza aktarma
- Bellek, gecikme ve enerji ölçümü
- UART, SPI, I2C veya MQTT ile haberleşme

Bu proje hem gömülü yazılım hem yapay zeka hedefini aynı portföyde gösterir.

## 4. Sınıf Bahar Dönemi

### Öncelikli ders profili

- Bitirme projesi
- Kalan zorunlu dersler
- Yapay zeka, bilgisayarlı görü veya derin öğrenme seçmelisi
- Gömülü sistemler, robotik veya IoT seçmelisi
- Mezuniyet için eksik AKTS'yi tamamlayan dersler

### Proje çıktıları

Mezuniyete kadar şu çıktıları üret:

1. GitHub'da temiz bir gömülü sistem projesi
2. Eğitilmiş model ve veri hazırlama kodu
3. Mikrodenetleyici üzerinde çalışan model veya çıkarım demosu
4. Ölçüm tablosu: doğruluk, gecikme, RAM/Flash kullanımı ve enerji
5. Kısa teknik rapor ve kurulum talimatı
6. Mümkünse bir sensör kartı veya gerçek cihaz demosu

## Teknik Öğrenme Sırası

### İlk aşama: temel

- C ve modern C++
- Pointer, bellek, struct, bit işlemleri
- Git ve Linux komut satırı
- Python, NumPy ve temel veri görselleştirme
- Lineer cebir, olasılık ve istatistik tekrarı

### İkinci aşama: gömülü sistemler

- GPIO, timer, interrupt ve PWM
- UART, SPI ve I2C
- FreeRTOS veya başka bir RTOS
- CMake, cross-compilation ve debugging
- Gömülü Linux ve Linux cihaz sürücüleri

### Üçüncü aşama: yapay zeka

- scikit-learn ile klasik makine öğrenmesi
- PyTorch ile sinir ağları
- CNN ve zaman serisi modelleri
- Model değerlendirme ve veri sızıntısı
- Quantization, pruning ve model küçültme

### Dördüncü aşama: kesişim alanı

- TensorFlow Lite Micro veya ONNX Runtime
- TinyML
- Edge AI
- Sensör füzyonu
- Gerçek zamanlı çıkarım
- Model doğruluğu ile donanım maliyeti arasındaki denge

## Haftalık Uygulama Düzeni

- Ders ve not yükseltme: haftada **18-22 saat**
- Gömülü yazılım: haftada **5-6 saat**
- Yapay zeka: haftada **5-6 saat**
- Proje ve GitHub dokümantasyonu: haftada **3-4 saat**

Sınav haftalarında proje çalışmasını azalt, fakat tamamen bırakma. Küçük ve ölçülebilir ilerleme daha sürdürülebilirdir.

## Karar Kuralları

- Bir dersin tekrarı resmi olarak eski notu değiştirmiyorsa, o dersi yalnızca GNO için alma.
- Ek dersi, ancak hedef GNO'yu düşürmeye veya mezuniyet planını güvenceye almaya yarıyorsa al.
- Yeni derste düşük not alma riski yüksekse ek dersin teorik faydası pratikte zarara dönüşebilir.
- Her dönem sonunda gerçek notlarla GNO projeksiyonunu yeniden hesapla.
- Önce MATH201, sonra ENGR202, sonra CENG203 için bölüm yönetmeliğindeki tekrar şartlarını doğrula.

## Kısa Hedef

En dengeli yol:

- MATH201'i en az BA, mümkünse AA ile tekrar etmek
- ENGR202 ve CENG203'ü yalnızca düzenli çalışmayla yüksek not alınabilecek dönemde tekrar etmek
- Kalan yeni derslerde yaklaşık **3,50-3,70** bandını korumak
- Bir TinyML/Edge AI bitirme projesiyle mezun olmak

Bu yaklaşım, yalnızca 3,51 GNO hedefine değil, gömülü yazılım ve yapay zeka alanında iş başvurularında gösterilebilir bir portföye de hizmet eder.
