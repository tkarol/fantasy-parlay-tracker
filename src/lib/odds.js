export function americanToDecimal(odds) {
    if (odds === undefined || odds === null || odds === "") return 1;
    const n = Number(odds);
    if (!Number.isFinite(n) || n === 0) return 1;
    return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
  }
  export function decimalToAmerican(dec) {
    if (!Number.isFinite(dec) || dec <= 1) return 0;
    const profit = dec - 1;
    return profit >= 1 ? Math.round(profit * 100) : Math.round(-100 / profit);
  }
  export const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
  export const usd = (x) => (x < 0 ? "-" : "") + "$" + Math.abs(r2(x)).toFixed(2);
  