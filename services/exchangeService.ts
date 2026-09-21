import AsyncStorage from "@react-native-async-storage/async-storage";

const RATES_STORAGE_KEY = "@pocket_currency_rates_v1";
const RATES_TIMESTAMP_KEY = "@pocket_currency_rates_updated";
const CONVERSION_ENABLED_KEY = "@pocket_currency_conversion_enabled";

// Open Exchange Rates API - free, public, CORS enabled, no API key required
const RATES_API_URL = "https://open.er-api.com/v6/latest/USD";

// Fallback rates relative to USD in case device is completely offline on first launch
const FALLBACK_RATES: Record<string, number> = {
  USD: 1.0,
  PHP: 56.5,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 153.0,
  CAD: 1.37,
  AUD: 1.53,
  SGD: 1.34,
  MYR: 4.42,
  IDR: 15800.0,
  THB: 35.5,
  VND: 24800.0,
  INR: 83.5,
  KRW: 1350.0,
  CNY: 7.23,
  HKD: 7.82,
  NZD: 1.66,
  BRL: 5.45,
  MXN: 18.2,
  AED: 3.67,
};

export interface RatesData {
  base: string;
  rates: Record<string, number>;
  lastUpdated: number; // timestamp
}

let memoryRates: Record<string, number> | null = null;
let lastFetchTime = 0;

/**
 * Loads cached rates from AsyncStorage or fallback
 */
export async function getCachedRates(): Promise<Record<string, number>> {
  if (memoryRates) return memoryRates;

  try {
    const raw = await AsyncStorage.getItem(RATES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryRates = parsed;
      return parsed;
    }
  } catch (err) {
    console.warn("[ExchangeService] Error loading cached rates:", err);
  }

  memoryRates = FALLBACK_RATES;
  return FALLBACK_RATES;
}

/**
 * Fetches latest exchange rates from Open Exchange Rates API.
 * Automatically throttles to at most once every 6 hours.
 */
export async function refreshExchangeRates(force = false): Promise<Record<string, number>> {
  const now = Date.now();
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  if (!force && lastFetchTime && now - lastFetchTime < SIX_HOURS) {
    return getCachedRates();
  }

  try {
    // Check stored timestamp
    const storedTimeStr = await AsyncStorage.getItem(RATES_TIMESTAMP_KEY);
    const storedTime = storedTimeStr ? parseInt(storedTimeStr, 10) : 0;

    if (!force && storedTime && now - storedTime < SIX_HOURS) {
      lastFetchTime = storedTime;
      return getCachedRates();
    }

    const res = await fetch(RATES_API_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (data && data.rates) {
      const newRates = { ...FALLBACK_RATES, ...data.rates };
      memoryRates = newRates;
      lastFetchTime = now;

      await AsyncStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(newRates));
      await AsyncStorage.setItem(RATES_TIMESTAMP_KEY, String(now));
      return newRates;
    }
  } catch (err) {
    console.warn("[ExchangeService] Failed to fetch live rates, using cached:", err);
  }

  return getCachedRates();
}

/**
 * Converts an amount from source currency to target currency using base USD rates.
 * Formula: Target = Source * (Rate[Target] / Rate[Source])
 */
export function convertAmount(
  amount: number,
  fromCode: string,
  toCode: string,
  rates: Record<string, number>
): number {
  if (!fromCode || !toCode || fromCode === toCode || !amount) {
    return amount;
  }

  const rateFrom = rates[fromCode] ?? FALLBACK_RATES[fromCode] ?? 1;
  const rateTo = rates[toCode] ?? FALLBACK_RATES[toCode] ?? 1;

  if (rateFrom <= 0) return amount;

  // Convert from Source -> USD -> Target
  const inUSD = amount / rateFrom;
  const inTarget = inUSD * rateTo;

  return Math.round(inTarget * 100) / 100;
}

/**
 * Check if Live Currency Conversion is turned on
 */
export async function loadConversionEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CONVERSION_ENABLED_KEY);
    // Default to true so switching currency automatically converts!
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
}

/**
 * Save Live Currency Conversion toggle state
 */
export async function saveConversionEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(CONVERSION_ENABLED_KEY, enabled ? "true" : "false");
  } catch (err) {
    console.warn("[ExchangeService] Error saving conversion toggle:", err);
  }
}
