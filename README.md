# Bluechip — Cryptocurrency Tools

**Creator:** AmanU
**Created:** November 10, 2026
**Project:** Bluechip — Cryptocurrency Tools

Bluechip is a small, responsive website with three crypto tools: a live price tracker, a money-to-crypto converter, and a crypto-to-money converter.

## How it works

The site is a static HTML, CSS, and JavaScript application. It requests public spot-market data from Binance and reference exchange rates from ExchangeRate-API. No account, API key, server, or build step is required.

- The home page links to each tool.
- The price tracker lists BTC, ETH, BNB, SOL, and XRP against USDT and includes a selectable Binance candle chart.
- The two converters use the same five crypto assets and USD, EUR, GBP, or KZT. Entering an amount updates the estimate using the latest loaded crypto price and cached fiat reference rate.
- Currency reference rates are cached in local browser storage for 24 hours. Crypto spot prices are refreshed from Binance when a converter opens or its refresh button is pressed.
- Navigation buttons stay fixed at the top left: all pages have a page-top link, and tool pages also link home.
- API and network failures are shown in the interface. Refresh controls prevent overlapping requests.

## File structure

```text
crypto-price-monitor/
├── index.html           # Home page with links to all tools
├── prices.html          # Crypto prices and selected-coin chart
├── fiat-to-crypto.html  # Money-to-crypto converter
├── crypto-to-fiat.html  # Crypto-to-money converter
├── css/
│   └── styles.css       # Shared dark theme, navigation, and responsive layouts
├── script/
│   ├── app.js           # Price tracker and chart behavior
│   └── converter.js     # Shared conversion logic for both directions
├── test/
│   └── smoke_test.js    # Navigation and converter smoke tests
├── .gitignore
└── README.md
```

## Ownership and architecture

The project is owned by AmanU. Each page has its own HTML file. `css/styles.css` provides shared visual styles, `script/app.js` powers the price tracker, and `script/converter.js` serves both converter directions based on each page's `data-direction`. The project has no backend and does not store personal data or API credentials. Browser storage is used only to cache reference rates.

## Data source

Binance public Spot market data: [REST API documentation](https://developers.binance.com/en/docs/products/spot/rest-api). The app uses public ticker and candle endpoints. Crypto-to-fiat estimates treat USDT as an approximate USD value.

Currency conversion uses [ExchangeRate-API's open endpoint](https://www.exchangerate-api.com/docs/free). Its public reference rates update daily; crypto prices update from Binance Spot.

## Run locally

Open `index.html` in a modern browser. If the browser restricts network requests from local files, serve this folder with any static HTTP server, for example:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`. No dependencies or build command are required.

Run the smoke tests with Node.js:

```bash
node --test test/smoke_test.js
```

## Limitations

- Data is from Binance Spot and can differ from other exchanges.
- Public API availability, regional access, and request limits are controlled by Binance.
- Chart periods show recent candles at 1-minute, 15-minute, and 4-hour intervals.
- This dashboard is informational and is not financial advice.
