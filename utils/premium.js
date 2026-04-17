function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

const basePremiums = {
  car: 50000,
  house: 80000,
  health: 60000,
  life: 70000
};

export function estimatePremium({ type, riskScore }) {
  const base = basePremiums[type] || 50000;
  const multiplier = clamp(1 + (riskScore - 50) / 100, 0.7, 2.0);
  const amount = Math.round(base * multiplier);
  return {
    amount,
    currency: "NGN",
    period: "year"
  };
}
