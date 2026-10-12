<p align="center"><img src="../build/icon.png" width="120" alt="Caskit"></p>

<h1 align="center">Caskit</h1>

<p align="center"><b>Gestionnaire gratuit et open source des unités de stockage et de l’inventaire CS2.</b><br>
Transferts rapides, chances des contrats, autocollants, boutique, marché et Steam Guard — pour plusieurs comptes à la fois.<br>
Sans abonnement ni serveur tiers : tout tourne sur votre ordinateur et parle directement à Steam.</p>

<p align="center">
<a href="https://github.com/pythonMaster2002/cs2-storage-manager/releases/latest"><img src="https://img.shields.io/github/v/release/pythonMaster2002/cs2-storage-manager?label=t%C3%A9l%C3%A9charger&color=2d73ff" alt="release"></a>
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
<b>Français</b> ·
<a href="README.pl.md">Polski</a> ·
<a href="README.tr.md">Türkçe</a> ·
<a href="README.zh.md">简体中文</a>
</p>

<p align="center"><img src="screenshots/demo.gif" alt="Caskit" width="900"></p>

> **Vous venez de Casemove ?** Casemove affiche désormais un avis : *«Casemove has been replaced by Skinledger… Prices, images and items will break in Casemove eventually»* ([source](https://github.com/nombersDev/casemove/blob/main/src/renderer/components/content/shared/infoModal.tsx)). Skinledger est payant : la version gratuite ne fait que déplacer les objets ; transferts rapides, achats en boutique, contrats, Armory, comptes supplémentaires, échanges et marché coûtent 9,99–24,99 $ par mois ([FAQ](https://skinledger.com/#frequently-asked-questions), [tarifs](https://skinledger.com/en/pricing-compare), octobre 2026). Caskit fait tout cela **gratuitement**, sans compte sur un site tiers — et en open source.

## Fonctionnalités

**Unités de stockage**
- Rangez et retirez des objets en masse. La vitesse s’adapte seule aux limites de Steam (en général 8 à 13 objets/s) et les objets bloqués sont renvoyés automatiquement.
- **Règles de transfert** : « toutes les caisses → Cases 01, Cases 02… », « autocollants → Stickers ». En un clic ou dès la connexion.
- Renommez les unités, masquez les pleines, exportez tout en JSON/CSV.

**Prix et portefeuille**
- Ce que valent votre inventaire et vos unités de stockage — moyenne Steam sur 7 jours, Buff163 ou Skinport, dans votre devise ; un graphique quotidien de la valeur et les plus fortes hausses et baisses.
- **Portefeuille (P&L)** : importez votre historique du Marché Steam, ajoutez des achats à la main ou par CSV — prix d’achat moyen, plus-value latente et réalisée (FIFO).
- Les prix viennent de listes publiques téléchargées toutes les 12 heures ; votre inventaire n’est envoyé nulle part.

**Contrats d’échange**
- Contrats depuis l’inventaire *et* les unités de stockage (les objets sont sortis automatiquement).
- Chaque résultat possible avec sa **probabilité**, le float de chaque entrée, le **float prévu** du résultat et la **valeur attendue** face au coût des entrées.
- Les objets refusés par le jeu (qualité maximale de leur collection) sont signalés à l’avance. Les souvenirs sont pris en charge.
- Après le contrat : **gain ou perte**, une vue détaillée de l’objet, **Inspecter en jeu** et **Marché de la communauté**.

**Autocollants**
- Appliquez, grattez et retirez des autocollants — y compris le placement libre de CS2.
- Vue de l’objet comme en jeu : float à 10 décimales, graine du motif, compteur StatTrak™, étiquette de nom et usure des autocollants ; liens d’inspection et vers l’objet dans votre inventaire Steam.

**Boutique CS2 et Armory**
- Panier, favoris, solde du porte-monnaie et solde après achat. Chaque paiement est confirmé par vous.
- Armory : échangez des étoiles contre des récompenses.
- Les noms et icônes des articles se mettent à jour seuls depuis les fichiers du jeu.

**Échanges, Marché et Steam Guard**
- Offres reçues et envoyées, accepter/refuser, acceptation automatique des cadeaux.
- Marché : annonces, **ordres d’achat avec le carnet d’ordres en direct et un graphique des prix sur 30 jours**, historique avec recherche, vente avec les frais calculés (y compris directement depuis les unités). Les devises sans centimes (UAH, KZT, JPY…) sont gérées automatiquement.
- Un mini **SDA** intégré : codes Steam Guard pour tous les comptes avec maFile, confirmations d’échanges et d’annonces, surveillance des proxys.

**Comptes et confidentialité**
- Plusieurs comptes à la fois, chacun avec son proxy SOCKS5/HTTP — à régler et vérifier dans les Paramètres ou en collant une liste. Épinglez et réordonnez les comptes.
- Connexion par **QR code** (affiché immédiatement), identifiant et mot de passe ou **maFile**.
- **Mode streamer** (Ctrl+Maj+H) : identifiants et pseudos deviennent « Compte 1, 2… », le solde est masqué, codes Steam Guard, partenaires d’échange et proxys sont floutés — sans risque pour les vidéos et captures.
- 10 langues. Mises à jour uniquement avec votre accord — ou complètement désactivées.

## Captures d’écran

| | |
|---|---|
| <img src="screenshots/overview.png" alt="overview"> | <img src="screenshots/portfolio.png" alt="portfolio"> |
| **Vue d’ensemble** : valeur, graphique, objets les plus chers | **Portefeuille** : gains et pertes (FIFO) |
| <img src="screenshots/tradeup.png" alt="trade-up"> | <img src="screenshots/craft.png" alt="result"> |
| **Contrat** : résultats, probabilités, valeur attendue | **Résultat** : gain ou perte, voir, inspecter, marché |
| <img src="screenshots/item.png" alt="item"> | <img src="screenshots/market.png" alt="buy order"> |
| **Objet** : float, motif, autocollants | **Ordre d’achat** : carnet d’ordres et graphique |
| <img src="screenshots/stickers.png" alt="stickers"> | <img src="screenshots/store.png" alt="store"> |
| **Autocollants** : appliquer, gratter, retirer | **Boutique CS2** : panier et porte-monnaie |
| <img src="screenshots/caskets.png" alt="storage units"> | <img src="screenshots/guard.png" alt="Steam Guard"> |
| **Unités de stockage** : transferts en masse | **Steam Guard** : codes et confirmations |

## Télécharger

La dernière version est sur la page **[Releases](https://github.com/pythonMaster2002/cs2-storage-manager/releases/latest)**.

| Système | Fichier | |
|---|---|---|
| Windows | `Caskit-Setup-x.y.z.exe` | **recommandé** — s’installe en quelques secondes, sans droits administrateur, se met à jour seul |
| Windows | `Caskit-x.y.z-portable.exe` | sans installation (démarre plus lentement, mise à jour manuelle) |
| macOS | `Caskit-x.y.z-arm64.dmg` (Apple Silicon) / `Caskit-x.y.z-x64.dmg` (Intel) | |
| Linux | `Caskit-x.y.z-x86_64.AppImage` ou `Caskit-x.y.z-amd64.deb` | |

**Premier lancement.** Les versions ne sont pas encore signées, le système peut donc vous avertir une fois :

- **Windows** (« Windows a protégé votre ordinateur ») : **Informations complémentaires → Exécuter quand même**.
- **macOS** (« l’app est endommagée » / « impossible de vérifier ») : clic droit sur l’app → **Ouvrir**, ou dans le Terminal `xattr -cr "/Applications/Caskit.app"`.
- **Linux AppImage** : `chmod +x Caskit-*.AppImage`, puis lancez-le.

**VirusTotal** : chaque version est analysée automatiquement — résultats et liens en bas de chaque [page de version](https://github.com/pythonMaster2002/cs2-storage-manager/releases).

### Désinstaller

- **Windows (installateur)** : Paramètres → Applications → **Caskit** → Désinstaller. **Portable** : supprimez simplement le `.exe`.
- **macOS** : glissez **Caskit** des Applications vers la Corbeille.
- **Linux** : supprimez l’AppImage, ou `sudo apt remove caskit` pour le `.deb`.

Les connexions enregistrées et les réglages restent dans le dossier de données (voir FAQ) ; supprimez-le aussi pour tout effacer.

## Sécurité et confidentialité

- Caskit ne parle qu’à Steam (et au Game Coordinator de CS2). Votre mot de passe n’est jamais enregistré ; le refresh token et les secrets maFile sont stockés sur votre disque, **chiffrés** par le système (Windows DPAPI / Trousseau macOS / libsecret sous Linux).
- Si un compte a un proxy, *tout* son trafic passe par lui — requêtes web, QR code, avatar. Si le proxy est en panne, la connexion s’arrête au lieu de passer en direct.
- L’API locale n’écoute que sur `127.0.0.1` et exige un jeton aléatoire connu de la seule fenêtre de l’app.
- Les noms et icônes sont mis à jour une fois par jour depuis des copies publiques des fichiers du jeu ([GameTracking-CS2](https://github.com/SteamDatabase/GameTracking-CS2), [counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker)) — aucune donnée de compte n’est envoyée.
- Pas d’analytique ni de télémétrie. Liste complète des connexions réseau dans la **[politique de confidentialité](../PRIVACY.md)** (en anglais).

## FAQ

**Puis-je être banni par VAC ?** Caskit ne touche ni au jeu, ni à ses fichiers, ni à sa mémoire, et ne lance pas CS2. Il se connecte comme un client Steam et parle au Game Coordinator de CS2 comme l’inventaire du jeu lui-même : VAC n’intervient pas. Cela reste un outil non officiel, à utiliser à vos risques.

**Puis-je jouer avec Caskit ouvert ?** Si vous lancez CS2 sur le même compte, Steam ne garde qu’une des deux sessions. Déconnectez d’abord ce compte dans Caskit.

**Les mises à jour automatiques sont-elles sûres ? Une mise à jour peut-elle m’arnaquer ?** Caskit ne télécharge ni n’installe rien de lui-même. Quand une nouvelle version sort, il demande d’abord — *Mettre à jour*, *Ignorer cette version* ou *Plus tard* — et dans Paramètres → Général → Mises à jour vous pouvez choisir *Ne pas vérifier* pour qu’il ne vérifie même plus. Les mises à jour viennent uniquement des [Releases](https://github.com/pythonMaster2002/cs2-storage-manager/releases) de ce dépôt : elles sont compilées par GitHub Actions à partir du code ouvert ([workflow](../.github/workflows/release.yml)), analysées sur VirusTotal, et l’installateur vérifie le SHA-512 de chaque fichier avant l’installation. La version portable ne se met jamais à jour seule. Si vous ne voulez faire confiance à aucun binaire — compilez Caskit vous-même (ci-dessous).

**Puis-je le compiler moi-même ?** Oui — tout est dans ce dépôt, voir « Compiler depuis les sources » ci-dessous. Les scripts `:noupdate` produisent une version sans mises à jour : elle ne demande même pas à GitHub s’il existe une nouvelle version.

**Où sont mes données ?** Uniquement sur votre ordinateur : `%APPDATA%\Caskit` (Windows), `~/Library/Application Support/Caskit` (macOS), `~/.config/Caskit` (Linux).

## Soutenir le projet

Caskit est gratuit et le restera. S’il vous fait gagner du temps :

- ☕ [Ko-fi](https://ko-fi.com/mikidjus) — carte ou PayPal
- 🎁 [Offrir un skin](https://steamcommunity.com/tradeoffer/new/?partner=146040317&token=Q_pa1oMK) — n’importe quelle caisse ou skin en trop
- 💎 Crypto (Binance Pay / USDT) — adresses dans l’app : bouton ♥
- ⭐ Une étoile au dépôt

## Compiler depuis les sources

Nécessite Node.js 22+ et Git.

```bash
git clone https://github.com/pythonMaster2002/cs2-storage-manager
cd cs2-storage-manager
npm ci
npm start                      # lancer
npm run build:win              # installateur + portable → dist/
npm run build:linux            # AppImage + deb
npm run build:mac              # dmg + zip (macOS uniquement)

# la même chose sans mises à jour : aucune vérification, aucun téléchargement
npm run build:win:noupdate
npm run build:linux:noupdate
npm run build:mac:noupdate
```

**Publication** : augmentez `version` dans `package.json`, puis `git tag vX.Y.Z && git push --tags`. GitHub Actions compile les trois systèmes, les publie dans Releases et analyse les `.exe` sur VirusTotal (secret `VT_API_KEY`) ; les copies installées proposent la mise à jour.

## Politique de signature du code

Les versions Windows sont compilées depuis ce dépôt par GitHub Actions. La signature est prévue via SignPath Foundation (gratuit pour l’open source) ; la première demande n’a pas encore été acceptée, donc les versions ne sont pas signées pour l’instant. Détails : [Code signing policy](../README.md#code-signing-policy) (en anglais).

## Licence

[MIT](../LICENSE)

Caskit est un projet open source indépendant, ni affilié ni approuvé par Valve Corporation. Counter-Strike, CS2 et Steam sont des marques de Valve Corporation.
