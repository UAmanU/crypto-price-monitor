"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const FIAT_RATES = { USD: 1, EUR: 0.9, GBP: 0.8, KZT: 500 };
const CRYPTO_PRICES = { BTCUSDT: 50000, ETHUSDT: 2500, BNBUSDT: 600, SOLUSDT: 100, XRPUSDT: 0.5 };

function create_element() {
    const listeners = {};
    const class_names = new Set();
    return {
        innerHTML: "",
        textContent: "",
        value: "",
        disabled: false,
        dataset: {},
        listeners,
        classList: {
            add: (...names) => names.forEach((name) => class_names.add(name)),
            remove: (...names) => names.forEach((name) => class_names.delete(name)),
            toggle: (name, force) => force ? class_names.add(name) : class_names.delete(name),
            contains: (name) => class_names.has(name)
        },
        addEventListener: (name, callback) => { listeners[name] = callback; },
        setAttribute: () => {},
        removeAttribute: () => {},
        click: async () => listeners.click?.({ preventDefault() {} }),
        change: async () => listeners.change?.({ preventDefault() {} }),
        input: async () => listeners.input?.({ preventDefault() {} })
    };
}

function response(data) {
    return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function start_converter(direction, { fail_fx = false } = {}) {
    const ids = ["converter-form", "crypto-currency", "fiat-currency", "amount", "conversion-result", "result-note", "refresh-quote", "refresh-label"];
    const elements = Object.fromEntries(ids.map((id) => [id, create_element()]));
    elements.amount.value = direction === "fiat-to-crypto" ? "100" : "1";
    const calls = [];
    const fetch_mock = async (url) => {
        calls.push(url);
        if (url.includes("open.er-api.com")) {
            if (fail_fx) throw new TypeError("offline");
            return response({ result: "success", rates: FIAT_RATES });
        }
        const pair = new URL(url).searchParams.get("symbol");
        return response({ symbol: pair, price: String(CRYPTO_PRICES[pair]) });
    };
    const storage = new Map();
    const context = {
        document: {
            body: { dataset: { direction } },
            getElementById: (id) => elements[id]
        },
        fetch: fetch_mock,
        localStorage: {
            getItem: (key) => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value)
        },
        AbortSignal,
        Response,
        Intl,
        Date,
        URLSearchParams,
        setTimeout,
        clearTimeout
    };

    vm.runInNewContext(fs.readFileSync(path.join(ROOT, "script", "converter.js"), "utf8"), context);
    await new Promise((resolve) => setTimeout(resolve, 30));
    return { elements, calls };
}

test("home page links to all three tools and every page has fixed navigation", () => {
    const pages = ["index.html", "prices.html", "fiat-to-crypto.html", "crypto-to-fiat.html"];
    const home = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    for (const page of pages.slice(1)) assert.ok(home.includes(`href="${page}"`));
    for (const page of pages) {
        const markup = fs.readFileSync(path.join(ROOT, page), "utf8");
        assert.match(markup, /href="#page-start"/);
        if (page !== "index.html") assert.match(markup, /href="index.html"/);
    }
});

test("money-to-crypto converter applies the selected fiat currency", async () => {
    const converter = await start_converter("fiat-to-crypto");
    assert.equal(converter.elements["conversion-result"].textContent, "0.002 BTC");

    converter.elements["fiat-currency"].value = "KZT";
    await converter.elements["fiat-currency"].change();
    assert.equal(converter.elements["conversion-result"].textContent, "0.000004 BTC");
});

test("crypto-to-money converter updates when the selected coin changes", async () => {
    const converter = await start_converter("crypto-to-fiat");
    assert.equal(converter.elements["conversion-result"].textContent, "$50,000.00");

    converter.elements["crypto-currency"].value = "ETH";
    await converter.elements["crypto-currency"].change();
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(converter.elements["conversion-result"].textContent, "$2,500.00");

    converter.elements["fiat-currency"].value = "KZT";
    await converter.elements["fiat-currency"].change();
    assert.equal(converter.elements["conversion-result"].textContent, "KZT 1,250,000.00");
});

test("converter stays usable in USD if reference currency rates are unavailable", async () => {
    const converter = await start_converter("crypto-to-fiat", { fail_fx: true });
    assert.equal(converter.elements["fiat-currency"].value, "USD");
    assert.equal(converter.elements["fiat-currency"].disabled, true);
    assert.equal(converter.elements["conversion-result"].textContent, "$50,000.00");
    assert.match(converter.elements["result-note"].textContent, /USD only/);
});
