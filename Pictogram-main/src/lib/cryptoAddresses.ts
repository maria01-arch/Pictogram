import type { CryptoCurrency } from "@/types/database";

// Real receiving addresses. Any entry still starting with "REPLACE_WITH_"
// is treated as not-yet-configured and automatically hidden from the
// picker in VerificationForm — never shown or copyable to a user.
export const CRYPTO_ADDRESSES: Record<CryptoCurrency, { label: string; network: string; address: string }> = {
  BTC: { label: "Bitcoin", network: "Bitcoin", address: "18Vx8CzA42TeVNfe6xEkwPokL3VUqqLkmD" },
  USDT_TRC20: { label: "USDT (TRC-20)", network: "Tron", address: "TThq3zSfu8RAxH7vaVx1MrDWo58tHr7F4c" },
  ETH: { label: "Ethereum", network: "Ethereum", address: "0x4ab660c2de6edb9610930407912c5104311f0bf9" },
  USDT_ERC20: { label: "USDT (ERC-20)", network: "Ethereum", address: "0x4ab660c2de6edb9610930407912c5104311f0bf9" },
  XRP: { label: "XRP", network: "XRP Ledger", address: "REPLACE_WITH_YOUR_XRP_ADDRESS" },
};

export function isCryptoConfigured(currency: CryptoCurrency): boolean {
  return !CRYPTO_ADDRESSES[currency].address.startsWith("REPLACE_WITH_");
}
