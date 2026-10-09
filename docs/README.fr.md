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

> **Vous venez de Casemove ?** Sa dernière version date de décembre 2024. Caskit couvre le même usage des unités de stockage et ajoute les chances et floats des contrats, les autocollants, la boutique CS2, les échanges et le Marché, un Steam Guard intégré et plusieurs comptes avec leur propre proxy — et il est activement maintenu.

## Fonctionnalités

**Unités de stockage**
- Rangez et retirez des objets en masse. La vitesse s’adapte seule aux limites de Steam (en général 8 à 13 objets/s) et les objets bloqués sont renvoyés automatiquement.
- **Règles de transfert** : « toutes les caisses → Cases 01, Cases 02… », « autocollants → Stickers ». En un clic ou dès la connexion.
- Renommez les unités, masquez les pleines, exportez tout en JSON/CSV.

**Contrats d’échange**
- Contrats depuis l’inventaire *et* les unités de stockage (les objets sont sortis automatiquement).
- Tous les résultats possibles avec leur **chance**, le float de chaque objet et le **float prévu** du résultat sur une barre d’usure.
- Les objets refusés par le jeu (qualité maximale de leur collection) sont signalés à l’avance. Les souvenirs sont pris en charge.
- Après le contrat : **Inspecter en jeu** et **Voir sur le Marché de la communauté**.

**Autocollants**
- Appliquez, grattez et retirez des autocollants — y compris le placement libre de CS2.
- Float de l’arme avec barre d’usure, usure des autocollants, liens d’inspection et lien vers l’objet dans l’inventaire Steam.

**Boutique CS2 et Armory**
- Panier, favoris, solde du porte-monnaie et solde après achat. Chaque paiement est confirmé par vous.
- Armory : échangez des étoiles contre des récompenses.
- Les noms et icônes des articles se mettent à jour seuls depuis les fichiers du jeu.

**Échanges, Marché et Steam Guard**
- Offres reçues et envoyées, accepter/refuser, acceptation automatique des cadeaux.
- Annonces, ordres d’achat, historique avec recherche, vente avec les frais calculés.
- Un mini **SDA** intégré : codes Steam Guard pour tous les comptes avec maFile, confirmations d’échanges et d’annonces, surveillance des proxys.

**Comptes et confidentialité**
- Plusieurs comptes à la fois, chacun avec son proxy SOCKS5/HTTP.
- Connexion par **QR code** (affiché immédiatement), identifiant et mot de passe ou **maFile**.
- 10 langues, mises à jour automatiques (version avec installateur).

## Captures d’écran

| | |
|---|---|
| <img src="screenshots/tradeup.png" alt="trade-up"> | <img src="screenshots/craft.png" alt="result"> |
| **Contrat** : résultats, chances, floats | **Résultat** : inspecter en jeu ou ouvrir sur le marché |
| <img src="screenshots/stickers.png" alt="stickers"> | <img src="screenshots/store.png" alt="store"> |
| **Autocollants** : appliquer, gratter, retirer | **Boutique CS2** : panier et porte-monnaie |
| <img src="screenshots/overview.png" alt="overview"> | <img src="screenshots/guard.png" alt="Steam Guard"> |
| **Aperçu** d’un ou de tous les comptes | **Steam Guard** : codes et confirmations |

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

**Où sont mes données ?** Uniquement sur votre ordinateur : `%APPDATA%\Caskit` (Windows), `~/Library/Application Support/Caskit` (macOS), `~/.config/Caskit` (Linux).

## Soutenir le projet

Caskit est gratuit et le restera. S’il vous fait gagner du temps :

- ☕ [Ko-fi](https://ko-fi.com/mikidjus) — carte ou PayPal
- 🎁 [Offrir un skin](https://steamcommunity.com/tradeoffer/new/?partner=146040317&token=Q_pa1oMK) — n’importe quelle caisse ou skin en trop
- 💎 Crypto (Binance Pay / USDT) — adresses dans l’app : bouton ♥
- ⭐ Une étoile au dépôt

## Compiler depuis les sources

Nécessite Node.js 22+.

```bash
npm ci
npm start              # lancer
npm run build:win      # installateur + portable → dist/
npm run build:linux    # AppImage + deb
npm run build:mac      # dmg + zip (macOS uniquement)
```

**Publication** : augmentez `version` dans `package.json`, puis `git tag vX.Y.Z && git push --tags`. GitHub Actions compile les trois systèmes et les publie dans Releases ; les copies installées se mettent à jour seules.

## Politique de signature du code

Les versions Windows sont compilées depuis ce dépôt par GitHub Actions et signées via SignPath (gratuit pour l’open source, certificat de SignPath Foundation). Détails : [Code signing policy](../README.md#code-signing-policy) (en anglais).

## Licence

[MIT](../LICENSE)

Caskit est un projet open source indépendant, ni affilié ni approuvé par Valve Corporation. Counter-Strike, CS2 et Steam sont des marques de Valve Corporation.
