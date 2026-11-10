# Bluechip — Crypto Market Watch

**Creator:** AmanU
**Created:** November 10, 2026
**Project:** Bluechip — Crypto Market Watch

Bluechip is a small, responsive cryptocurrency price dashboard. It shows live USD prices and 24-hour changes for five major assets, plus a selectable price chart.

## How it works

The site is a static HTML, CSS, and JavaScript application. It requests public spot-market data from Binance's market-data-only REST API. No account, API key, server, or build step is required.

- The market list uses the 24-hour ticker endpoint for BTC, ETH, BNB, SOL, and XRP trading pairs against USDT.
- The chart uses Binance candlestick data for the selected asset. The 1H, 24H, and 7D controls change the candle interval and number of points.
- Refresh requests are single-flight and have a five-second cooldown. Rapid repeated clicks cannot start overlapping market requests.
- API and network failures are shown in the interface; existing prices stay visible if a later refresh fails.

## File structure

```text
crypto-price-monitor/
├── index.html       # Page structure and accessible controls
├── css/
│   └── styles.css   # Dark theme, layout, and responsive rules
├── script/
│   └── app.js       # API requests, refresh guard, and chart rendering
├── .gitignore
└── README.md
```

## Ownership and architecture

The project is owned by AmanU. `index.html` contains the page and semantic controls, `css/styles.css` owns presentation, and `script/app.js` owns market state, API access, formatting, and SVG chart rendering. It is deliberately dependency-free and has no backend, so it does not store personal data or API credentials.

## Data source

Binance public Spot market data: [REST API documentation](https://developers.binance.com/en/docs/products/spot/rest-api). The app uses `https://data-api.binance.vision`, Binance's market-data-only endpoint. Prices represent Binance USDT spot pairs converted to an approximate USD display; USDT is designed to track the US dollar, but can differ slightly.

## Run locally

Open `index.html` in a modern browser. If the browser restricts network requests from local files, serve this folder with any static HTTP server, for example:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`. No dependencies or build command are required.

## Limitations

- Data is from Binance Spot and can differ from other exchanges.
- Public API availability, regional access, and request limits are controlled by Binance.
- Chart periods show recent candles at 1-minute, 15-minute, and 4-hour intervals.
- This dashboard is informational and is not financial advice.
