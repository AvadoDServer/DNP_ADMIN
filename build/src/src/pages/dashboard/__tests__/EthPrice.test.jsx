import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EthPrice, { parsePrice, formatPrice, PRICE_URL } from "pages/dashboard/components/EthPrice";

const PRICE = { ethereum: { usd: 2431.5, usd_24h_change: 1.234, eur: 2210.2, eur_24h_change: -0.56 } };

function mockFetch(impl) {
  global.fetch = vi.fn(impl);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  delete global.fetch;
});

describe("parsePrice", () => {
  it("accepts a CoinGecko response and rejects malformed ones", () => {
    expect(parsePrice(PRICE)).toEqual(PRICE.ethereum);
    expect(parsePrice({})).toBeNull();
    expect(parsePrice({ ethereum: { usd: "1" } })).toBeNull();
    expect(parsePrice(null)).toBeNull();
  });
});

describe("formatPrice", () => {
  it("drops cents above 100", () => {
    expect(formatPrice(2431.5, "usd")).not.toMatch(/\.5/);
    expect(formatPrice(12.34, "usd")).toMatch(/12\.34/);
  });
});

describe("EthPrice", () => {
  it("shows the USD price and 24 h change from CoinGecko", async () => {
    mockFetch(async () => ({ ok: true, json: async () => PRICE }));
    render(<EthPrice />);
    expect(await screen.findByText(formatPrice(2431.5, "usd"))).toBeInTheDocument();
    expect(screen.getByText("▲ 1.2% today")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(PRICE_URL);
  });

  it("switches to EUR and remembers the choice", async () => {
    mockFetch(async () => ({ ok: true, json: async () => PRICE }));
    render(<EthPrice />);
    fireEvent.click(await screen.findByRole("button", { name: "EUR" }));
    expect(screen.getByText(formatPrice(2210.2, "eur"))).toBeInTheDocument();
    expect(screen.getByText("▼ 0.6% today")).toBeInTheDocument();
    expect(localStorage.getItem("avado.ethPriceCurrency")).toBe("eur");
  });

  it("renders nothing when the price can't be fetched", async () => {
    mockFetch(async () => {
      throw new Error("offline");
    });
    const { container } = render(<EthPrice />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
