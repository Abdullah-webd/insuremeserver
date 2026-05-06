function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

const basePremiums = {
  car: 50000,
  house: 80000,
  health: 60000,
  life: 70000
};

export function estimatePremium({ type, riskScore, data = {} }) {
  let base = 50000;
  
  if (type === "car") {
    const value = Number(data.car_value ?? data.property_value ?? 0);
    const amount = value > 0 ? Math.round(value * 0.025) : 50000;
    return { amount, currency: "NGN", period: "year" };
  } 
  
  if (type === "house") {
    const value = Number(data.property_value || 0);
    const amount = value > 0 ? Math.round(value * 0.003) : 80000;
    return { amount, currency: "NGN", period: "year" };
  }

  if (type === "health") {
    base = 60000;
  } else if (type === "life") {
    base = 100000;
  }

  const multiplier = clamp(1 + (riskScore - 40) / 100, 0.8, 2.5);
  const amount = Math.round(base * multiplier);
  
  return {
    amount,
    currency: "NGN",
    period: "year"
  };
}
