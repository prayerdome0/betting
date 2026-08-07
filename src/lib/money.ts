export const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export function toNumber(value: string | number): number {
  const n = typeof value === "string" ? Number(value.replace(/[^0-9.]/g, "")) : value;
  return Number.isFinite(n) ? n : 0;
}

export function clampMoney(value: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}
