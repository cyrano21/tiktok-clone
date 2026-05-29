export type PaymentKind = "momo" | "card" | "cod";

export interface MobileMoneyOperator {
  id: string;
  name: string;
  short: string;
  color: string;
  emoji: string;
  countries: string[];
  dialCode: string; // default country dial code
  ussd: string; // shown during confirmation
}

export const MOMO_OPERATORS: MobileMoneyOperator[] = [
  {
    id: "mtn",
    name: "MTN Mobile Money",
    short: "MTN MoMo",
    color: "#FFCC00",
    emoji: "🟡",
    countries: ["CI", "CM", "GH", "UG", "RW", "BJ"],
    dialCode: "+225",
    ussd: "*126#",
  },
  {
    id: "orange",
    name: "Orange Money",
    short: "Orange Money",
    color: "#FF6600",
    emoji: "🟠",
    countries: ["CI", "SN", "ML", "CM", "CD"],
    dialCode: "+225",
    ussd: "#144#",
  },
  {
    id: "wave",
    name: "Wave",
    short: "Wave",
    color: "#1DC8FF",
    emoji: "🌊",
    countries: ["SN", "CI", "ML"],
    dialCode: "+221",
    ussd: "App Wave",
  },
  {
    id: "mpesa",
    name: "M-Pesa",
    short: "M-Pesa",
    color: "#43B02A",
    emoji: "🟢",
    countries: ["KE", "TZ", "CD", "GH"],
    dialCode: "+254",
    ussd: "*150#",
  },
  {
    id: "moov",
    name: "Moov Money",
    short: "Moov Money",
    color: "#0066B3",
    emoji: "🔵",
    countries: ["CI", "BJ", "TG", "BF"],
    dialCode: "+225",
    ussd: "*155#",
  },
  {
    id: "airtel",
    name: "Airtel Money",
    short: "Airtel Money",
    color: "#ED1C24",
    emoji: "🔴",
    countries: ["NG", "KE", "CD", "TZ", "RW"],
    dialCode: "+243",
    ussd: "*500#",
  },
];

export interface Country {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: "CI", name: "Côte d'Ivoire", dialCode: "+225", flag: "🇨🇮" },
  { code: "SN", name: "Sénégal", dialCode: "+221", flag: "🇸🇳" },
  { code: "CM", name: "Cameroun", dialCode: "+237", flag: "🇨🇲" },
  { code: "CD", name: "RD Congo", dialCode: "+243", flag: "🇨🇩" },
  { code: "ML", name: "Mali", dialCode: "+223", flag: "🇲🇱" },
  { code: "BF", name: "Burkina Faso", dialCode: "+226", flag: "🇧🇫" },
  { code: "BJ", name: "Bénin", dialCode: "+229", flag: "🇧🇯" },
  { code: "TG", name: "Togo", dialCode: "+228", flag: "🇹🇬" },
  { code: "GH", name: "Ghana", dialCode: "+233", flag: "🇬🇭" },
  { code: "NG", name: "Nigeria", dialCode: "+234", flag: "🇳🇬" },
  { code: "KE", name: "Kenya", dialCode: "+254", flag: "🇰🇪" },
  { code: "TZ", name: "Tanzanie", dialCode: "+255", flag: "🇹🇿" },
  { code: "RW", name: "Rwanda", dialCode: "+250", flag: "🇷🇼" },
  { code: "UG", name: "Ouganda", dialCode: "+256", flag: "🇺🇬" },
];

export function operatorById(id: string): MobileMoneyOperator | undefined {
  return MOMO_OPERATORS.find(o => o.id === id);
}

export function countryByCode(code: string): Country | undefined {
  return COUNTRIES.find(c => c.code === code);
}

export function operatorsForCountry(code: string): MobileMoneyOperator[] {
  const list = MOMO_OPERATORS.filter(o => o.countries.includes(code));
  return list.length ? list : MOMO_OPERATORS;
}

// Local phone digits (without dial code): 8 to 12 digits.
export function isValidLocalPhone(digits: string): boolean {
  const clean = digits.replace(/\D/g, "");
  return clean.length >= 8 && clean.length <= 12;
}

export function formatLocalPhone(digits: string): string {
  const clean = digits.replace(/\D/g, "");
  return clean.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

// EUR → estimated local currency for display (demo rates).
const FCFA_PER_EUR = 655.957; // XOF/XAF fixed peg
export function eurToFcfa(eur: number): number {
  return Math.round(eur * FCFA_PER_EUR);
}

export function formatFcfa(value: number): string {
  return `${value.toLocaleString("fr-FR")}\u00A0FCFA`;
}
