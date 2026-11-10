"use strict";

const API_BASES = [
    "https://data-api.binance.vision/api/v3",
    "https://api-gcp.binance.com/api/v3",
    "https://api.binance.com/api/v3"
];
const FX_API_URL = "https://open.er-api.com/v6/latest/USD";
const RATE_CACHE_KEY = "bluechip.currency-rates.v1";
const RATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 7000;
const REFRESH_COOLDOWN_MS = 1500;
const CURRENCIES = ["USD", "EUR", "GBP", "KZT"];
const COINS = [
    { id: "bitcoin", name: "Bitcoin", symbol: "BTC", pair: "BTCUSDT", mark: "₿", colors: ["#f7931a", "#402a15", "#ffbf67"] },
    { id: "ethereum", name: "Ethereum", symbol: "ETH", pair: "ETHUSDT", mark: "◆", colors: ["#9aa9ff", "#202845", "#bec8ff"] },
    { id: "bnb", name: "BNB", symbol: "BNB", pair: "BNBUSDT", mark: "B", colors: ["#f0b90b", "#423713", "#ffdc5d"] },
    { id: "solana", name: "Solana", symbol: "SOL", pair: "SOLUSDT", mark: "≋", colors: ["#b39cff", "#30264a", "#cbbcff"] },
    { id: "ripple", name: "XRP", symbol: "XRP", pair: "XRPUSDT", mark: "✕", colors: ["#b8c8dc", "#273747", "#e3efff"] }
];
const PERIODS = {
    "1h": { interval: "1m", limit: 60, label: "1H" },
    "24h": { interval: "15m", limit: 96, label: "24H" },
    "7d": { interval: "4h", limit: 42, label: "7D" }
};
const savedCurrency = readSavedCurrency();
const state = { selected: COINS[0], period: "1h", currency: "USD", currencyRates: { USD: 1 }, marketData: [], chartPoints: [], chartCandles: [], isRefreshing: false, lastRefreshAt: 0, chartRequestId: 0, toastTimer: null };
const elements = {
    coinList: document.getElementById("coin-list"),
    updatedLabel: document.getElementById("updated-label"),
    refreshButton: document.getElementById("refresh-button"),
    refreshLabel: document.getElementById("refresh-label"),
    coinPicker: document.getElementById("coin-picker"),
    coinSelect: document.getElementById("coin-select"),
    currencySelect: document.getElementById("currency-select"),
    chartFooterLabel: document.getElementById("chart-footer-label"),
    chartTitle: document.getElementById("chart-title"),
    chartPrice: document.getElementById("chart-price"),
    chartChange: document.getElementById("chart-change"),
    chartSvg: document.getElementById("price-chart"),
    chartLoading: document.getElementById("chart-loading"),
    chartHighLow: document.getElementById("chart-high-low"),
    axisStart: document.getElementById("axis-start"),
    axisMiddle: document.getElementById("axis-middle"),
    axisEnd: document.getElementById("axis-end"),
    toast: document.getElementById("toast")
};

function formatPrice(value) {
    if (!Number.isFinite(value)) return "—";
    const converted = value * (state.currencyRates[state.currency] ?? 1);
    const digits = converted >= 1 ? 2 : converted >= 0.01 ? 4 : 6;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: state.currency, minimumFractionDigits: 2, maximumFractionDigits: digits }).format(converted);
}

function readSavedCurrency() {
    try {
        const currency = localStorage.getItem("bluechip.display-currency");
        return CURRENCIES.includes(currency) ? currency : "USD";
    } catch {
        return "USD";
    }
}

function readRateCache() {
    try {
        const cached = JSON.parse(localStorage.getItem(RATE_CACHE_KEY) ?? "null");
        if (cached?.rates && Number.isFinite(cached.savedAt)) return cached;
    } catch {
        // Storage may be disabled; rates can still be fetched for this session.
    }
    return null;
}

function setChangeStyle(element, change) {
    element.classList.remove("positive", "negative", "neutral");
    element.classList.add(change > 0 ? "positive" : change < 0 ? "negative" : "neutral");
}

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 3600);
}

async function fetchJson(url, signal) {
    let response;
    try {
        response = await fetch(url, { signal: signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { Accept: "application/json" } });
    } catch (error) {
        if (error.name === "TimeoutError" || error.name === "AbortError") throw new Error("The request timed out. Please try again.");
        throw new Error("Could not connect to the data service. Check your connection and try again.");
    }
    if (!response.ok) {
        const detail = response.status === 429 ? "The data service is rate-limiting requests. Wait a moment and try again." : `Data request failed (${response.status}).`;
        const error = new Error(detail);
        error.status = response.status;
        throw error;
    }
    return response.json();
}

async function fetchBinanceJson(path) {
    let lastError;
    for (const base of API_BASES) {
        try {
            return await fetchJson(`${base}${path}`);
        } catch (error) {
            if (error.status === 429) throw error;
            lastError = error;
        }
    }
    throw new Error(`${lastError?.message ?? "Could not reach Binance."} Tried the available public Binance endpoints.`);
}

async function loadCurrencyRates() {
    const cached = readRateCache();
    if (cached?.rates?.USD === 1 && Date.now() - cached.savedAt < RATE_CACHE_TTL_MS) {
        state.currencyRates = cached.rates;
        applySavedCurrency();
        return true;
    }

    try {
        const data = await fetchJson(FX_API_URL);
        if (data.result !== "success" || !data.rates || !CURRENCIES.every((currency) => Number.isFinite(data.rates[currency]))) {
            throw new Error("Currency conversion rates are incomplete.");
        }
        state.currencyRates = { ...data.rates, USD: 1 };
        try {
            localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rates: state.currencyRates, savedAt: Date.now() }));
        } catch {
            // Continue without a persistent cache when browser storage is unavailable.
        }
        applySavedCurrency();
        return true;
    } catch (error) {
        if (cached?.rates?.USD === 1) {
            state.currencyRates = cached.rates;
            applySavedCurrency();
            return true;
        }
        elements.currencySelect.disabled = true;
        elements.currencySelect.value = "USD";
        showToast(`${error.message} Prices will remain in USD until rates are available.`);
        return false;
    }
}

function applySavedCurrency() {
    state.currency = Number.isFinite(state.currencyRates[savedCurrency]) ? savedCurrency : "USD";
    elements.currencySelect.value = state.currency;
    elements.currencySelect.disabled = false;
    updateCurrencyDisplay();
}

function updateCurrencyDisplay() {
    elements.chartFooterLabel.textContent = `PRICE (${state.currency})`;
    if (state.marketData.length > 0) renderCoinList();
    updateSelectedCoinSummary();
    if (state.chartPoints.length > 1) renderChart(state.chartPoints, state.chartCandles);
}

function buildMarketPath() {
    const pairs = COINS.map((coin) => coin.pair);
    const symbols = encodeURIComponent(JSON.stringify(pairs));
    return `/ticker/24hr?symbols=${symbols}`;
}

async function loadMarketData({ quiet = false } = {}) {
    if (state.isRefreshing) return false;
    const waitMs = REFRESH_COOLDOWN_MS - (Date.now() - state.lastRefreshAt);
    if (waitMs > 0) {
        if (!quiet) showToast(`Please wait ${Math.ceil(waitMs / 1000)}s before refreshing again.`);
        return false;
    }

    state.isRefreshing = true;
    state.lastRefreshAt = Date.now();
    elements.refreshButton.disabled = true;
    elements.refreshButton.classList.add("is-loading");
    elements.refreshLabel.textContent = "Updating…";
    elements.refreshButton.setAttribute("aria-busy", "true");

    try {
        const rows = await fetchBinanceJson(buildMarketPath());
        const bySymbol = new Map(rows.map((row) => [row.symbol, row]));
        state.marketData = COINS.map((coin) => {
            const row = bySymbol.get(coin.pair);
            if (!row) throw new Error(`No market data is available for ${coin.symbol}.`);
            return { ...coin, price: Number(row.lastPrice), change: Number(row.priceChangePercent), high: Number(row.highPrice), low: Number(row.lowPrice) };
        });
        renderCoinList();
        updateSelectedCoinSummary();
        elements.updatedLabel.textContent = `Updated ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
        if (!quiet) showToast("Prices updated successfully.");
        return true;
    } catch (error) {
        if (error.name !== "AbortError") {
            if (state.marketData.length === 0) {
                elements.coinList.innerHTML = `<div class="error-row">${escapeHtml(error.message)}<br>Check your connection and refresh to try again.</div>`;
            }
            if (!quiet) showToast(error.message);
        }
        return false;
    } finally {
        state.isRefreshing = false;
        elements.refreshButton.disabled = false;
        elements.refreshButton.classList.remove("is-loading");
        elements.refreshLabel.textContent = "Refresh";
        elements.refreshButton.removeAttribute("aria-busy");
    }
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function renderCoinList() {
    elements.coinList.innerHTML = state.marketData.map((coin) => {
        const changeClass = coin.change > 0 ? "positive" : coin.change < 0 ? "negative" : "neutral";
        const sign = coin.change > 0 ? "+" : "";
        const colors = coin.colors;
        return `<article class="coin-row" aria-label="${escapeHtml(coin.name)} price ${escapeHtml(formatPrice(coin.price))}, 24 hour change ${sign}${coin.change.toFixed(2)} percent">
            <div class="coin-identity">
                <span class="coin-icon" style="--icon-color:${colors[2]};--icon-bg:${colors[1]};--icon-border:${colors[0]}55" aria-hidden="true">${escapeHtml(coin.mark)}</span>
                <div><div class="coin-name">${escapeHtml(coin.name)}</div><div class="coin-symbol">${escapeHtml(coin.symbol)}</div></div>
            </div>
            <div class="coin-price">${escapeHtml(formatPrice(coin.price))}</div>
            <div class="coin-change ${changeClass}">${sign}${coin.change.toFixed(2)}%</div>
        </article>`;
    }).join("");
}

function updateSelectedCoinSummary() {
    const marketCoin = state.marketData.find((coin) => coin.id === state.selected.id);
    elements.chartTitle.innerHTML = `${escapeHtml(state.selected.name)} <span class="chart-symbol">${escapeHtml(state.selected.symbol)}</span>`;
    if (marketCoin) {
        elements.chartPrice.textContent = formatPrice(marketCoin.price);
        elements.chartChange.textContent = `${marketCoin.change > 0 ? "+" : ""}${marketCoin.change.toFixed(2)}% 24H`;
        setChangeStyle(elements.chartChange, marketCoin.change);
    }
}

function buildChartPath(coin, period) {
    const options = PERIODS[period];
    const params = new URLSearchParams({ symbol: coin.pair, interval: options.interval, limit: String(options.limit) });
    return `/klines?${params.toString()}`;
}

async function loadChart() {
    const requestId = ++state.chartRequestId;
    elements.chartLoading.textContent = "Loading price history…";
    elements.chartLoading.classList.remove("hidden");
    try {
        const candles = await fetchBinanceJson(buildChartPath(state.selected, state.period));
        if (requestId !== state.chartRequestId) return;
        const points = candles.map((candle) => ({ time: Number(candle[0]), price: Number(candle[4]) })).filter((point) => Number.isFinite(point.price));
        if (points.length < 2) throw new Error("Not enough price history is available yet.");
        state.chartPoints = points;
        state.chartCandles = candles;
        renderChart(points, candles);
        elements.chartLoading.classList.add("hidden");
    } catch (error) {
        if (requestId !== state.chartRequestId) return;
        elements.chartLoading.textContent = error.message;
    }
}

function renderChart(points, candles) {
    const width = 640;
    const height = 250;
    const inset = { left: 4, right: 8, top: 12, bottom: 14 };
    const prices = points.map((point) => point.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const spread = max - min || Math.max(max * 0.005, 1);
    const low = min - spread * 0.12;
    const high = max + spread * 0.12;
    const plotWidth = width - inset.left - inset.right;
    const plotHeight = height - inset.top - inset.bottom;
    const coords = points.map((point, index) => ({
        x: inset.left + index / (points.length - 1) * plotWidth,
        y: inset.top + (high - point.price) / (high - low) * plotHeight
    }));
    const line = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
    const area = `${line} L${coords.at(-1).x.toFixed(2)},${(height - inset.bottom).toFixed(2)} L${coords[0].x.toFixed(2)},${(height - inset.bottom).toFixed(2)} Z`;
    const end = coords.at(-1);
    elements.chartSvg.innerHTML = `<defs><linearGradient id="chart-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#4f9cff" stop-opacity=".23"/><stop offset="100%" stop-color="#4f9cff" stop-opacity="0"/></linearGradient></defs><path class="chart-area" d="${area}"/><path class="chart-line" d="${line}"/><circle class="chart-end" cx="${end.x}" cy="${end.y}" r="4"/>`;
    elements.chartSvg.setAttribute("aria-label", `${state.selected.name} price chart for ${PERIODS[state.period].label}`);
    const candlePrices = candles.map((candle) => ({ high: Number(candle[2]), low: Number(candle[3]) }));
    const chartHigh = Math.max(...candlePrices.map((candle) => candle.high));
    const chartLow = Math.min(...candlePrices.map((candle) => candle.low));
    elements.chartHighLow.textContent = `HIGH ${formatPrice(chartHigh)}   LOW ${formatPrice(chartLow)}`;
    const startTime = new Date(points[0].time);
    const midTime = new Date(points[Math.floor(points.length / 2)].time);
    elements.axisStart.textContent = formatAxisTime(startTime);
    elements.axisMiddle.textContent = formatAxisTime(midTime);
    elements.axisEnd.textContent = "NOW";
}

function formatAxisTime(date) {
    if (state.period === "7d") return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function initializeCoinPicker() {
    elements.coinSelect.innerHTML = COINS.map((coin) => `<option value="${coin.id}">${coin.symbol}</option>`).join("");
    elements.coinPicker.addEventListener("submit", (event) => event.preventDefault());
    elements.coinSelect.addEventListener("change", () => {
        state.selected = COINS.find((coin) => coin.id === elements.coinSelect.value) ?? COINS[0];
        updateSelectedCoinSummary();
        loadChart();
    });
}

function initializeCurrencyPicker() {
    elements.currencySelect.disabled = true;
    elements.currencySelect.value = "USD";
    elements.currencySelect.addEventListener("change", () => {
        if (!Number.isFinite(state.currencyRates[elements.currencySelect.value])) return;
        state.currency = elements.currencySelect.value;
        try {
            localStorage.setItem("bluechip.display-currency", state.currency);
        } catch {
            // The selection still applies for the current session.
        }
        updateCurrencyDisplay();
    });
}

function initializePeriodButtons() {
    document.querySelectorAll(".period-button").forEach((button) => {
        button.addEventListener("click", () => {
            if (button.dataset.period === state.period) return;
            state.period = button.dataset.period;
            document.querySelectorAll(".period-button").forEach((item) => item.classList.toggle("active", item === button));
            loadChart();
        });
    });
}

function initialize() {
    initializeCoinPicker();
    initializeCurrencyPicker();
    initializePeriodButtons();
    elements.refreshButton.addEventListener("click", async () => {
        const updated = await loadMarketData();
        if (updated) await loadChart();
    });
    loadCurrencyRates();
    loadMarketData({ quiet: true }).then(loadChart);
}

initialize();
