# Bluechip — Crypto Market Watch

**Creator:** AmanU
**Created:** November 10, 2026
**Project:** Bluechip — Crypto Market Watch

Bluechip is a small, responsive cryptocurrency price dashboard. It shows live prices and 24-hour changes for five major assets, supports USD, EUR, GBP, and KZT display currencies, and includes a selectable price chart.

## How it works

The site is a static HTML, CSS, and JavaScript application. It requests public spot-market data from Binance's market-data-only REST API. No account, API key, server, or build step is required.

- The market list uses Binance's 24-hour ticker endpoint for BTC, ETH, BNB, SOL, and XRP trading pairs against USDT. If the preferred public endpoint is unreachable, the app tries two official Binance REST alternatives.
- The chart uses Binance candlestick data for the selected asset. The 1H, 24H, and 7D controls change the candle interval and number of points.
- Prices are converted from USDT to the selected display currency. USD reference rates come from ExchangeRate-API's free open endpoint and are cached in the browser for 24 hours. Reference rates update daily, so converted values are approximate.
- Refresh requests are single-flight and have a 1.5-second cooldown. The button shows an updating state, refreshes the selected chart after successful market data, and reports connection and rate-limit errors.
- API and network failures are shown in the interface; existing prices stay visible if a later refresh fails.
- Currency selection is remembered in local browser storage. No account or personal information is required.

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

Binance public Spot market data: [REST API documentation](https://developers.binance.com/en/docs/products/spot/rest-api). The app uses [Binance's market-data-only endpoint](https://developers.binance.me/en/docs/products/spot/faqs/market_data_only) first, followed by official REST alternatives. Prices represent Binance USDT spot pairs; USDT is designed to track the US dollar, but can differ slightly.

Currency conversion uses [ExchangeRate-API's free open endpoint](https://www.exchangerate-api.com/docs/free). Rates are reference rates that update once per day, require no key, and are cached locally for 24 hours.

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
