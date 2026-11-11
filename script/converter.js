"use strict";

const BINANCE_BASES = [
    "https://data-api.binance.vision/api/v3",
    "https://api-gcp.binance.com/api/v3",
    "https://api.binance.com/api/v3"
];
const FX_API_URL = "https://open.er-api.com/v6/latest/USD";
const RATE_CACHE_KEY = "bluechip.currency-rates.v1";
const RATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 7000;
const FIAT_CURRENCIES = [
    { code: "USD", label: "USD · US Dollar" },
    { code: "EUR", label: "EUR · Euro" },
    { code: "GBP", label: "GBP · British Pound" },
    { code: "KZT", label: "KZT · Kazakhstani Tenge" }
];
const CRYPTOCURRENCIES = [
    { symbol: "BTC", name: "Bitcoin", pair: "BTCUSDT" },
    { symbol: "ETH", name: "Ethereum", pair: "ETHUSDT" },
    { symbol: "BNB", name: "BNB", pair: "BNBUSDT" },
    { symbol: "SOL", name: "Solana", pair: "SOLUSDT" },
    { symbol: "XRP", name: "XRP", pair: "XRPUSDT" }
];
const state = {
    direction: document.body.dataset.direction,
    fiat_rates: { USD: 1 },
    fx_available: true,
    crypto_price_usd: null,
    quote_updated_at: null,
    is_loading: false,
    request_id: 0
};
const elements = {
    form: document.getElementById("converter-form"),
    crypto_select: document.getElementById("crypto-currency"),
    fiat_select: document.getElementById("fiat-currency"),
    amount: document.getElementById("amount"),
    result: document.getElementById("conversion-result"),
    note: document.getElementById("result-note"),
    refresh_button: document.getElementById("refresh-quote"),
    refresh_label: document.getElementById("refresh-label")
};

function read_rate_cache() {
    try {
        const cached = JSON.parse(localStorage.getItem(RATE_CACHE_KEY) ?? "null");
        if (cached?.rates?.USD === 1 && Number.isFinite(cached.saved_at)) return cached;
    } catch {
        // The converter can work without persistent browser storage.
    }
    return null;
}

function populate_select(select, options) {
    select.innerHTML = options.map((option) => `<option value="${option.value}">${option.label}</option>`).join("");
}

async function fetch_json(url) {
    let response;
    try {
        response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { Accept: "application/json" } });
    } catch (error) {
        if (error.name === "TimeoutError" || error.name === "AbortError") throw new Error("The request timed out. Please refresh the rate.");
        throw new Error("Could not connect to the data service. Check your connection and try again.");
    }
    if (!response.ok) {
        if (response.status === 429) throw new Error("The data service is rate-limiting requests. Wait a moment and try again.");
        throw new Error(`The data service returned an error (${response.status}).`);
    }
    return response.json();
}

async function get_crypto_price(pair) {
    let last_error;
    for (const base of BINANCE_BASES) {
        try {
            const data = await fetch_json(`${base}/ticker/price?symbol=${pair}`);
            const price = Number(data.price);
            if (Number.isFinite(price) && price > 0) return price;
            throw new Error("The market returned an invalid price.");
        } catch (error) {
            if (error.message.includes("rate-limiting")) throw error;
            last_error = error;
        }
    }
    throw new Error(`${last_error?.message ?? "Could not reach the market data service."} Tried the available Binance endpoints.`);
}

async function get_fiat_rates() {
    const cached = read_rate_cache();
    if (cached && Date.now() - cached.saved_at < RATE_CACHE_TTL_MS) return cached.rates;

    try {
        const data = await fetch_json(FX_API_URL);
        if (data.result !== "success" || !data.rates || !FIAT_CURRENCIES.every(({ code }) => Number.isFinite(data.rates[code]))) {
            throw new Error("Currency reference rates are incomplete.");
        }
        const rates = { ...data.rates, USD: 1 };
        try {
            localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rates, saved_at: Date.now() }));
        } catch {
            // Use the fetched rates for this visit if storage is blocked.
        }
        return rates;
    } catch (error) {
        if (cached) return cached.rates;
        throw error;
    }
}

function format_money(value, currency) {
    const digits = value >= 1 ? 2 : value >= 0.01 ? 4 : 6;
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: digits
    }).format(value);
}

function format_crypto(value) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(value);
}

function get_selected_crypto() {
    return CRYPTOCURRENCIES.find((coin) => coin.symbol === elements.crypto_select.value) ?? CRYPTOCURRENCIES[0];
}

function update_conversion() {
    const amount = Number(elements.amount.value);
    const coin = get_selected_crypto();
    const currency = elements.fiat_select.value;
    const rate = state.fiat_rates[currency];

    if (!Number.isFinite(amount) || amount <= 0) {
        elements.result.textContent = "Enter an amount greater than zero";
        return;
    }
    if (!Number.isFinite(state.crypto_price_usd) || !Number.isFinite(rate)) {
        elements.result.textContent = "Waiting for market data…";
        return;
    }

    const coin_price_in_fiat = state.crypto_price_usd * rate;
    if (state.direction === "fiat-to-crypto") {
        elements.result.textContent = `${format_crypto(amount / coin_price_in_fiat)} ${coin.symbol}`;
    } else {
        elements.result.textContent = format_money(amount * coin_price_in_fiat, currency);
    }
    elements.note.textContent = `1 ${coin.symbol} ≈ ${format_money(coin_price_in_fiat, currency)} · Binance Spot`;
}

async function refresh_quote() {
    if (state.is_loading) return;
    state.is_loading = true;
    const request_id = ++state.request_id;
    const coin = get_selected_crypto();
    elements.refresh_button.disabled = true;
    elements.refresh_button.classList.add("is-loading");
    elements.refresh_label.textContent = "Updating…";
    elements.note.textContent = "Loading current market rate…";

    try {
        const [price_result, rates_result] = await Promise.allSettled([get_crypto_price(coin.pair), get_fiat_rates()]);
        if (request_id !== state.request_id) return;
        if (price_result.status === "rejected") throw price_result.reason;
        state.crypto_price_usd = price_result.value;
        state.fx_available = rates_result.status === "fulfilled";
        state.fiat_rates = state.fx_available ? rates_result.value : { USD: 1 };
        if (!state.fx_available) {
            elements.fiat_select.value = "USD";
            elements.fiat_select.disabled = true;
        } else {
            elements.fiat_select.disabled = false;
        }
        state.quote_updated_at = new Date();
        update_conversion();
        elements.note.textContent += state.fx_available
            ? ` · Updated ${state.quote_updated_at.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
            : " · Currency rates unavailable; showing USD only.";
    } catch (error) {
        if (request_id === state.request_id) {
            elements.result.textContent = "Rate unavailable";
            elements.note.textContent = error.message;
        }
    } finally {
        if (request_id === state.request_id) {
            state.is_loading = false;
            elements.refresh_button.disabled = false;
            elements.refresh_button.classList.remove("is-loading");
            elements.refresh_label.textContent = "Refresh rate";
        }
    }
}

function initialize() {
    elements.form.addEventListener("submit", (event) => event.preventDefault());
    populate_select(elements.crypto_select, CRYPTOCURRENCIES.map((coin) => ({ value: coin.symbol, label: `${coin.symbol} · ${coin.name}` })));
    populate_select(elements.fiat_select, FIAT_CURRENCIES.map((currency) => ({ value: currency.code, label: currency.label })));
    elements.amount.addEventListener("input", update_conversion);
    elements.crypto_select.addEventListener("change", () => {
        state.request_id += 1;
        state.is_loading = false;
        refresh_quote();
    });
    elements.fiat_select.addEventListener("change", update_conversion);
    elements.refresh_button.addEventListener("click", refresh_quote);
    elements.crypto_select.value = "BTC";
    elements.fiat_select.value = "USD";
    refresh_quote();
}

initialize();
