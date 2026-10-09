<p align="center"><img src="../build/icon.png" width="120" alt="Caskit"></p>

<h1 align="center">Caskit</h1>

<p align="center"><b>Ücretsiz ve açık kaynaklı CS2 depo (Storage Unit) ve envanter yöneticisi.</b><br>
Hızlı aktarım, kontrat şansları, çıkartmalar, mağaza, pazar ve Steam Guard — aynı anda birden çok hesap için.<br>
Abonelik ve üçüncü taraf sunucu yok: her şey bilgisayarınızda çalışır ve doğrudan Steam ile konuşur.</p>

<p align="center">
<a href="https://github.com/pythonMaster2002/cs2-storage-manager/releases/latest"><img src="https://img.shields.io/github/v/release/pythonMaster2002/cs2-storage-manager?label=indir&color=2d73ff" alt="release"></a>
<a href="https://github.com/pythonMaster2002/cs2-storage-manager/releases"><img src="https://img.shields.io/github/downloads/pythonMaster2002/cs2-storage-manager/total?color=06bfff" alt="downloads"></a>
<img src="https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-informational" alt="platforms">
<img src="https://img.shields.io/badge/license-MIT-green" alt="MIT">
<a href="https://ko-fi.com/mikidjus"><img src="https://img.shields.io/badge/Ko--fi-support-ff5e5b?logo=ko-fi&logoColor=white" alt="Ko-fi"></a>
</p>

<p align="center">
<a href="../README.md">English</a> ·
<a href="README.ru.md">Русский</a> ·
<a href="README.uk.md">Українська</a> ·
<a href="README.de.md">Deutsch</a> ·
<a href="README.es.md">Español</a> ·
<a href="README.pt.md">Português</a> ·
<a href="README.fr.md">Français</a> ·
<a href="README.pl.md">Polski</a> ·
<b>Türkçe</b> ·
<a href="README.zh.md">简体中文</a>
</p>

<p align="center"><img src="screenshots/demo.gif" alt="Caskit" width="900"></p>

> **Casemove’dan mı geliyorsunuz?** Yazarı onu Skinledger lehine bıraktı — «Casemove 2.0» adlı ücretli bir hizmet: ücretsiz sürüm yalnızca eşya taşır; hızlı aktarım, mağaza alımları, kontratlar, Armory, daha fazla hesap, takaslar ve pazar ayda 9,99–24,99 $ abonelik ister ([Skinledger SSS](https://skinledger.com/#frequently-asked-questions), [fiyatlar](https://skinledger.com/en/pricing-compare), Ekim 2026). Caskit bunların hepsini **ücretsiz**, başka sitelerde hesap açmadan ve açık kaynak olarak yapar.

## Özellikler

**Depolar (Storage Unit)**
- Eşyaları depolara toplu koyup çıkarın. Hız Steam sınırlarına kendini ayarlar (genelde 8–13 eşya/sn), takılan eşyalar otomatik yeniden gönderilir.
- **Aktarma kuralları**: «tüm kasalar → Cases 01, Cases 02…», «çıkartmalar → Stickers». Tek tıkla ya da girişten hemen sonra.
- Depoları yeniden adlandırın, dolu olanları gizleyin, her şeyi JSON/CSV olarak dışa aktarın.

**Takas kontratları**
- Envanterden *ve* depolardan kontrat (eşyalar otomatik çıkarılır).
- Tüm olası sonuçlar **şanslarıyla**, her girdinin float değeri ve sonucun **tahmini float** değeri aşınma çubuğunda.
- Oyunun kabul etmeyeceği eşyalar (koleksiyonunun en üst kalitesi) önceden işaretlenir. Hatıra (souvenir) eşyalar desteklenir.
- Kontrattan sonra: **Oyunda incele** ve **Topluluk Pazarı’nda gör**.

**Çıkartmalar**
- Çıkartma yapıştırın, kazıyın ve kaldırın — CS2 serbest yerleşimli çıkartmalar dahil.
- Aşınma çubuğuyla silah float değeri, çıkartma aşınması, inceleme bağlantıları ve Steam envanterindeki eşyaya bağlantı.

**CS2 Mağazası ve Armory**
- Sepet, favoriler, cüzdan bakiyesi ve satın alma sonrası bakiye. Her ödemeyi siz onaylarsınız.
- Armory: yıldızları ödüllerle takas edin.
- Ürün adları ve görselleri oyun dosyalarından kendiliğinden güncellenir.

**Takaslar, Pazar ve Steam Guard**
- Gelen ve giden teklifler, kabul/ret, hediyeleri otomatik kabul.
- İlanlar, alım emirleri, aranabilir geçmiş, komisyonu hesaplanmış satış.
- Dahili mini **SDA**: maFile’ı olan tüm hesaplar için Steam Guard kodları, takas ve ilan onayları, proxy takibi.

**Hesaplar ve gizlilik**
- Aynı anda birden çok hesap, her birinin kendi SOCKS5/HTTP proxy’si.
- **QR kod** (hemen görünür), kullanıcı adı ve şifre ya da **maFile** ile giriş.
- 10 dil, otomatik güncellemeler (kurulum sürümü).

## Ekran görüntüleri

| | |
|---|---|
| <img src="screenshots/tradeup.png" alt="trade-up"> | <img src="screenshots/craft.png" alt="result"> |
| **Kontrat**: sonuçlar, şanslar, float | **Sonuç**: oyunda incele veya pazarda aç |
| <img src="screenshots/stickers.png" alt="stickers"> | <img src="screenshots/store.png" alt="store"> |
| **Çıkartmalar**: yapıştır, kazı, kaldır | **CS2 Mağazası**: sepet ve cüzdan |
| <img src="screenshots/overview.png" alt="overview"> | <img src="screenshots/guard.png" alt="Steam Guard"> |
| Bir veya tüm hesapların **genel bakışı** | **Steam Guard**: kodlar ve onaylar |

## İndir

En son sürüm **[Releases](https://github.com/pythonMaster2002/cs2-storage-manager/releases/latest)** sayfasında.

| Sistem | Dosya | |
|---|---|---|
| Windows | `Caskit-Setup-x.y.z.exe` | **önerilir** — saniyeler içinde kurulur, yönetici izni gerekmez, kendini günceller |
| Windows | `Caskit-x.y.z-portable.exe` | kurulumsuz (daha yavaş açılır, elle güncellenir) |
| macOS | `Caskit-x.y.z-arm64.dmg` (Apple Silicon) / `Caskit-x.y.z-x64.dmg` (Intel) | |
| Linux | `Caskit-x.y.z-x86_64.AppImage` veya `Caskit-x.y.z-amd64.deb` | |

**İlk açılış.** Sürümler henüz dijital olarak imzalı değil, bu yüzden sistem bir kez uyarabilir:

- **Windows** («Windows bilgisayarınızı korudu»): **Ek bilgi → Yine de çalıştır**.
- **macOS** («uygulama hasarlı» / «doğrulanamıyor»): uygulamaya sağ tıklayın → **Aç** ya da Terminal’de `xattr -cr "/Applications/Caskit.app"`.
- **Linux AppImage**: `chmod +x Caskit-*.AppImage`, ardından çalıştırın.

### Kaldırma

- **Windows (kurulum)**: Ayarlar → Uygulamalar → **Caskit** → Kaldır. **Portable**: `.exe` dosyasını silmeniz yeterli.
- **macOS**: **Caskit**’i Uygulamalar’dan Çöp Sepeti’ne sürükleyin.
- **Linux**: AppImage’i silin ya da `.deb` için `sudo apt remove caskit`.

Kayıtlı girişler ve ayarlar veri klasöründe kalır (SSS’ye bakın) — her şeyi silmek için onu da silin.

## Güvenlik ve gizlilik

- Caskit yalnızca Steam (ve CS2 Game Coordinator) ile konuşur. Şifreniz asla kaydedilmez; refresh token ve maFile sırları diskinizde sistem tarafından **şifrelenmiş** olarak tutulur (Windows DPAPI / macOS Anahtar Zinciri / Linux’ta libsecret).
- Bir hesabın proxy’si varsa, hesabın *tüm* trafiği ondan geçer — web istekleri, QR kod, avatar. Proxy çalışmıyorsa giriş doğrudan bağlanmak yerine durur.
- Yerel API yalnızca `127.0.0.1` üzerinde dinler ve sadece uygulama penceresinin bildiği rastgele bir token ister.
- Eşya adları ve simgeleri günde bir kez oyun dosyalarının herkese açık kopyalarından güncellenir ([GameTracking-CS2](https://github.com/SteamDatabase/GameTracking-CS2), [counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker)) — hesap verisi gönderilmez.
- Analitik ve telemetri yok. Tüm ağ bağlantılarının listesi **[gizlilik politikasında](../PRIVACY.md)** (İngilizce).

## SSS

**VAC yasağı alabilir miyim?** Caskit oyuna, dosyalarına veya belleğine dokunmaz ve CS2’yi başlatmaz. Steam istemcisi olarak giriş yapar ve CS2 Game Coordinator ile oyunun kendi envanteri gibi konuşur; VAC devreye girmez. Yine de resmi olmayan bir araçtır, kullanım riski size aittir.

**Caskit açıkken oynayabilir miyim?** Aynı hesapta CS2’yi başlatırsanız Steam iki oturumdan yalnızca birini tutar. Önce o hesaptan Caskit’te çıkış yapın.

**Verilerim nerede?** Yalnızca bilgisayarınızda: `%APPDATA%\Caskit` (Windows), `~/Library/Application Support/Caskit` (macOS), `~/.config/Caskit` (Linux).

## Projeyi destekleyin

Caskit ücretsizdir ve öyle kalacak. Size zaman kazandırıyorsa:

- ☕ [Ko-fi](https://ko-fi.com/mikidjus) — kart veya PayPal
- 🎁 [Kaplama hediye edin](https://steamcommunity.com/tradeoffer/new/?partner=146040317&token=Q_pa1oMK) — fazla herhangi bir kasa veya kaplama
- 💎 Kripto (Binance Pay / USDT) — adresler uygulamada: ♥ düğmesi
- ⭐ Depoya bir yıldız

## Kaynaktan derleme

Node.js 22+ gerekir.

```bash
npm ci
npm start              # çalıştır
npm run build:win      # kurulum + portable → dist/
npm run build:linux    # AppImage + deb
npm run build:mac      # dmg + zip (yalnızca macOS’ta)
```

**Sürüm yayınlama**: `package.json` içindeki `version` değerini artırın, ardından `git tag vX.Y.Z && git push --tags`. GitHub Actions üç sistemi derleyip Releases’a yükler; kurulu kopyalar kendini günceller.

## Kod imzalama politikası

Windows sürümleri bu depodan GitHub Actions ile derlenir ve SignPath üzerinden imzalanır (açık kaynak için ücretsiz, sertifika SignPath Foundation’a ait). Ayrıntılar: [Code signing policy](../README.md#code-signing-policy) (İngilizce).

## Lisans

[MIT](../LICENSE)

Caskit, Valve Corporation ile bağlantısı olmayan ve onun tarafından onaylanmamış bağımsız bir açık kaynak projesidir. Counter-Strike, CS2 ve Steam, Valve Corporation’ın ticari markalarıdır.
