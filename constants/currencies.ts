export interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
  flag: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "PHP", symbol: "₱", label: "Philippine Peso", flag: "🇵🇭" },
  { code: "USD", symbol: "$", label: "US Dollar", flag: "🇺🇸" },
  { code: "EUR", symbol: "€", label: "Euro", flag: "🇪🇺" },
  { code: "GBP", symbol: "£", label: "British Pound", flag: "🇬🇧" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen", flag: "🇯🇵" },
  { code: "CAD", symbol: "$", label: "Canadian Dollar", flag: "🇨🇦" },
  { code: "AUD", symbol: "$", label: "Australian Dollar", flag: "🇦🇺" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar", flag: "🇸🇬" },
  { code: "MYR", symbol: "RM", label: "Malaysian Ringgit", flag: "🇲🇾" },
  { code: "IDR", symbol: "Rp", label: "Indonesian Rupiah", flag: "🇮🇩" },
  { code: "THB", symbol: "฿", label: "Thai Baht", flag: "🇹🇭" },
  { code: "VND", symbol: "₫", label: "Vietnamese Dong", flag: "🇻🇳" },
  { code: "INR", symbol: "₹", label: "Indian Rupee", flag: "🇮🇳" },
  { code: "KRW", symbol: "₩", label: "South Korean Won", flag: "🇰🇷" },
  { code: "CNY", symbol: "¥", label: "Chinese Yuan", flag: "🇨🇳" },
  { code: "HKD", symbol: "HK$", label: "Hong Kong Dollar", flag: "🇭🇰" },
  { code: "NZD", symbol: "$", label: "New Zealand Dollar", flag: "🇳🇿" },
  { code: "BRL", symbol: "R$", label: "Brazilian Real", flag: "🇧🇷" },
  { code: "MXN", symbol: "$", label: "Mexican Peso", flag: "🇲🇽" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham", flag: "🇦🇪" },
];

export const DEFAULT_CURRENCY: CurrencyOption = CURRENCIES[0]; // PHP
