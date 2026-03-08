/**
 * Indian number formatting — groups of 2 after last 3 digits.
 * Example: 1234567.89 → ₹12,34,567.89
 */
export function formatINR(amount: number): string {
  const isNeg = amount < 0;
  const abs = Math.abs(amount);

  const intPart = Math.floor(abs);
  const dec = (abs - intPart).toFixed(2).slice(1); // ".XX"
  const str = intPart.toString();

  if (str.length <= 3) {
    return `${isNeg ? '-' : ''}₹${str}${dec}`;
  }

  const lastThree = str.slice(-3);
  const rest = str.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');

  return `${isNeg ? '-' : ''}₹${grouped},${lastThree}${dec}`;
}

/** Compact format: ₹1.23 Cr, ₹4.56 L, ₹7.8K */
export function formatINRCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(2)}`;
}
