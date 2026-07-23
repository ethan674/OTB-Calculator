/** Market -> its currency. Selecting a market auto-sets the store's currency. */
export const MARKET_CURRENCY: Record<string, string> = {
  Taiwan: "TWD",
  Vietnam: "VND",
  Singapore: "SGD",
  Malaysia: "MYR",
  "Hong Kong": "HKD",
};

export const MARKETS = Object.keys(MARKET_CURRENCY);
