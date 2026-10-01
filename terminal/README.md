# QUANTA Terminal

Terminal de trading multi-actifs inspiré de Bloomberg : front-end React/TypeScript dense et piloté au clavier, back-end Node.js temps réel (moteur de marché, OMS, risque, news, alertes).

> **Données simulées, trading fictif.** Les prix viennent d'un moteur de simulation multi-facteurs intégré (corrélations réalistes entre actifs). Aucun flux réel, aucun argent réel. L'architecture permet de brancher un vrai fournisseur de données plus tard (voir *Brancher des données réelles*).

## Démarrage rapide

Prérequis : **Node.js ≥ 18.17** (testé avec Node 22).

```bash
cd terminal
npm run setup     # installe les dépendances + build du front
npm start         # http://localhost:8080
```

Ouvrez <http://localhost:8080> et cliquez sur **Launch demo account** (`demo` / `demo1234`), ou créez votre compte.

### Développement (rechargement à chaud)

```bash
npm run dev       # API sur :8080 (node --watch) + Vite sur :5173 (proxy /api et /ws)
```

### Docker

```bash
docker compose up --build    # http://localhost:8080, données persistées dans un volume
```

### Tests

```bash
npm test          # 16 tests back-end (API, OMS, WebSocket, risque) + typecheck front
```

## Fonctionnalités

| Code | Fonction | Description |
|------|----------|-------------|
| `GP` | Graphique | Bougies / Heikin-Ashi / OHLC / ligne / aire, 1m → 1M, SMA20/50/200, EMA, Bollinger, VWAP, sous-panneau Volume/RSI/MACD/ATR, streaming live |
| `DES` | Description | Cotation, valorisation, stats 52 semaines, volatilité, bêta, Sharpe, drawdown, sensibilités cross-asset |
| `FA` | Analyse financière | 8 trimestres (CA, marges, BPA vs estimations), consensus analystes, objectifs de cours, actionnaires |
| `DOM` | Carnet d'ordres | Carnet niveau 2 (profondeur cumulée, déséquilibre, vos ordres), time & sales, **Shift+clic = ordre limite** |
| `TRD` | Ticket d'ordre | Marché, limite, stop, stop-limite · DAY/GTC/IOC/FOK · notionnel, pouvoir d'achat, position |
| `BLTR` | Blotter | Ordres actifs (modification du prix en ligne, annulation), historique, exécutions |
| `PORT` | Portefeuille | NAV, P&L jour/latent/réalisé, levier, courbe de capital, positions valorisées en temps réel |
| `RISK` | Risque | VaR/CVaR historique 95/99 %, 8 stress tests, expositions (classe, secteur, devise, région), contribution au risque, distribution des P&L |
| `MON` | Monitor | Listes de surveillance éditables, flash des prix, sparklines, range du jour |
| `WEI` | Indices mondiaux | Amériques / EMEA / Asie + rendements obligataires |
| `FXC` | Matrice FX | Taux croisés de 10 devises, variations en heatmap, majors avec spreads en pips |
| `CRYP` / `CMDTY` | Crypto / Matières premières | Énergie, métaux, agriculture, actifs numériques 24/7 |
| `GC` | Courbes de taux | US / Bund / Gilt / JGB, comparaison avec la veille, 2s10s, 5s30s, 3m10y |
| `MOST` | Top mouvements | Hausses, baisses, plus gros volumes en $ |
| `HMAP` | Heatmap | Treemap des actions par secteur, pondérée par la capitalisation |
| `EQS` | Screener | Filtres multi-critères et presets (Mega caps, Value, Dividende, Momentum, Low vol, Défensif) |
| `CORR` | Corrélations | Matrice de corrélation (30 à 365 jours), jeux prédéfinis ou personnalisés |
| `N` | News | Fil temps réel filtrable (titre, catégorie, recherche). Les news **font bouger les prix** |
| `ECO` | Calendrier éco | Publications macro avec consensus / précédent / réel, filtres pays et importance |
| `ALRT` | Alertes | Alertes prix, variation ou volume, évaluées côté serveur à chaque tick, notification instantanée |
| `HELP` | Aide | Toutes les fonctions et tous les raccourcis |

**Univers :** 106 instruments : 16 indices, ~50 actions (US, Europe, Japon, Hong Kong), 6 ETF, 10 paires FX, 8 cryptos, 10 contrats à terme sur matières premières, 8 taux souverains.

### Ligne de commande (style Bloomberg)

```
AAPL                    charge le titre dans le panneau actif
NVDA DES                titre + fonction
WEI                     fonction seule
BUY AAPL 100            ordre au marché
SELL MSFT 50 @ 450      ordre limite
SELL TSLA 20 STP 230    ordre stop (ajoutez "@ 229" pour un stop-limite)
BUY EURUSD 1M           quantités 10K / 1M acceptées
LAYOUT 4 · PAGE 2       disposition / page
```

### Raccourcis clavier

`/` ou `Ctrl+K` (ou tapez directement) : ligne de commande · `Tab` : autocomplétion · `Alt+1…5` : pages · `Ctrl+←/→` : panneau actif · double-clic sur l'en-tête : agrandir · `Esc` : restaurer.

### Workspace

- 5 pages préconfigurées (Trading, Markets, Portfolio, Research, Macro), 6 dispositions (1 à 6 panneaux).
- **Liaison par couleur** : les panneaux de la même couleur suivent le même titre. Cliquez sur le carré de couleur dans l'en-tête d'un panneau pour changer son groupe.
- Le layout est sauvegardé en local et sur le serveur (il vous suit d'un navigateur à l'autre).

## Architecture

```
terminal/
├── server/                 Node.js (Express + ws), aucune base externe requise
│   ├── src/market/         engine.js (simulation multi-facteurs, carnet L2, tape), instruments.js,
│   │                       news.js (fil de news qui impacte les prix), reference.js (fondamentaux, courbes, calendrier)
│   ├── src/trading/        oms.js (ordres, exécution sur le carnet, P&L multidevise, marge), alerts.js
│   ├── src/analytics/      risk.js (VaR, CVaR, stress, corrélations, bêtas)
│   ├── src/routes/api.js   API REST
│   ├── src/ws.js           passerelle WebSocket temps réel
│   └── test/               tests node:test
└── client/                 React 18 + TypeScript + Vite + Zustand + Lightweight Charts
    └── src/panels/         une fonction de terminal = un composant (chargé à la demande)
```

**Moteur de marché.** Le rendement de chaque instrument est la somme de ses expositions à des facteurs communs (actions mondiales, régions, secteurs, dollar, pétrole, métaux, taux, crypto, volatilité) et d'un choc idiosyncratique à queues épaisses, avec des régimes de volatilité. Les corrélations sont donc réalistes : les valeurs tech bougent ensemble, le VIX monte quand les actions baissent, le dollar pilote les paires FX. Au démarrage, le moteur génère 750 jours d'historique quotidien et deux jours de barres minute, puis il tique toutes les 500 ms.

**OMS.** Un ordre au marché balaie le carnet L2, donc le slippage dépend de la taille. Un ordre limite au repos s'exécute quand le marché le traverse, à hauteur de la taille affichée (exécutions partielles). Un stop se déclenche sur le meilleur prix. Le P&L est calculé au coût moyen avec retournement long/short, et converti en USD au taux de change en direct. Le contrôle pré-trade porte sur le levier maximal ; un ordre qui réduit le risque est toujours accepté. Les commissions dépendent de la classe d'actif. Les ordres DAY expirent au changement de jour.

**Sécurité.** Mots de passe hachés avec scrypt, sessions JWT HS256, limitation du débit sur l'authentification, en-têtes Helmet et CSP, validation des entrées et écriture atomique des données.

### API (extrait)

Toutes les routes, hors `/api/health` et `/api/auth/*`, exigent `Authorization: Bearer <token>`.

| Méthode | Route | |
|--|--|--|
| POST | `/api/auth/register` · `/api/auth/login` | → `{ token, user }` |
| GET | `/api/quotes?symbols=AAPL,EURUSD` | cotations |
| GET | `/api/history/:symbol?interval=1m\|5m\|15m\|1h\|1D\|1W\|1M` | barres OHLCV |
| GET | `/api/book/:symbol` · `/api/trades/:symbol` | carnet L2 · time & sales |
| GET | `/api/fundamentals/:symbol` · `/api/stats/:symbol` | fondamentaux · statistiques |
| POST | `/api/orders` | `{ symbol, side, type, qty, limitPrice?, stopPrice?, tif? }` |
| PATCH/DELETE | `/api/orders/:id` | modifier / annuler |
| GET | `/api/account` · `/account/positions` · `/account/risk` | compte · positions · risque |
| WS | `/ws?token=…` | `quotes`, `book`, `tape`, `news`, `order`, `fill`, `account`, `alert` |

## Configuration

Copiez `.env.example` en `.env` (chargé automatiquement) ou passez des variables d'environnement. Les principales : `PORT`, `JWT_SECRET`, `DATA_DIR`, `STARTING_CASH`, `MAX_LEVERAGE`, `SIM_SPEED`, `MARKET_SEED`, `DEMO_USER=false` (désactive le compte démo).

En production : définissez `JWT_SECRET`, changez ou désactivez le compte démo, et servez l'application derrière HTTPS (le client passe automatiquement en `wss://`).

## Brancher des données réelles

Toute l'application consomme le moteur via `quote()`, `history()`, `book()`, `tape()` et l'événement `tick`. Pour un flux réel (Polygon, Alpaca, Binance, IEX…), implémentez ces méthodes dans un fournisseur qui alimente `state` à partir du flux, et passez-le à `createApp` à la place de `MarketEngine`. L'OMS, le risque, le WebSocket et l'interface ne changent pas.

---
Graphiques : [TradingView Lightweight Charts™](https://www.tradingview.com/) (Apache 2.0).
