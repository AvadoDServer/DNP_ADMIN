import React, { useEffect, useState } from "react";
import { cn } from "components/ui/cn";

// Public CoinGecko endpoint — no API key. Fetched straight from the browser,
// so a box with no execution client still gets a price.
export const PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd,eur&include_24hr_change=true";
const POLL_MS = 60 * 1000;
const STORAGE_KEY = "avado.ethPriceCurrency";
const CURRENCIES = ["usd", "eur"];

function readCurrency() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (CURRENCIES.includes(stored)) return stored;
  } catch (e) {
    /* localStorage may be unavailable (private mode) or blocked */
  }
  return "usd";
}

function writeCurrency(currency) {
  try {
    localStorage.setItem(STORAGE_KEY, currency);
  } catch (e) {
    /* not persisted — the toggle still works for this visit */
  }
}

/** { usd, usd_24h_change, eur, eur_24h_change } from CoinGecko's response, or null if it's malformed. */
export function parsePrice(json) {
  const eth = json && json.ethereum;
  if (!eth || typeof eth.usd !== "number" || typeof eth.eur !== "number") return null;
  return eth;
}

export function formatPrice(value, currency) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

/**
 * EthPrice — live ETH price on Home with a USD/EUR switch (remembered per
 * browser). Polls every minute while the tab is visible. Renders nothing
 * until the first price arrives, and nothing if CoinGecko can't be reached,
 * so an offline box never shows a stale or broken number.
 */
export default function EthPrice() {
  const [price, setPrice] = useState(null);
  const [currency, setCurrency] = useState(readCurrency);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch(PRICE_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const parsed = parsePrice(await res.json());
        if (!cancelled && parsed) setPrice(parsed);
      } catch (e) {
        // Keep the last good price; with none yet, the component stays hidden.
      }
    }
    load();
    const interval = setInterval(load, POLL_MS);
    const onVisible = () => !document.hidden && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!price) return null;

  const value = price[currency];
  const change = price[`${currency}_24h_change`];
  const hasChange = typeof change === "number";
  const up = hasChange && change >= 0;

  const choose = next => {
    setCurrency(next);
    writeCurrency(next);
  };

  return (
    <section aria-label="Ether price" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="text-fg-muted">ETH</span>
      <span className="font-display text-lg font-bold tabular-nums text-fg">{formatPrice(value, currency)}</span>
      {hasChange && (
        <span className={cn("tabular-nums", up ? "text-success-text" : "text-danger-text")}>
          {`${up ? "▲" : "▼"} ${Math.abs(change).toFixed(1)}% today`}
        </span>
      )}
      <span role="group" aria-label="Currency" className="ml-auto flex overflow-hidden rounded-full border border-border text-xs font-semibold">
        {CURRENCIES.map(c => (
          <button
            key={c}
            type="button"
            aria-pressed={currency === c}
            onClick={() => choose(c)}
            className={cn("px-2.5 py-0.5", currency === c ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg")}
          >
            {c.toUpperCase()}
          </button>
        ))}
      </span>
    </section>
  );
}
