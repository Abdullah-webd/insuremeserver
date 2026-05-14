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
  let rationale = "";
  
  if (type === "car") {
    const value = Number(data.car_value ?? data.property_value ?? 0);
    if (value > 0) {
      const amount = Math.round(value * 0.025);
      rationale = `Car Premium: Calculated as 2.5% of car value (${value} NGN).`;
      return { amount, currency: "NGN", period: "year", rationale };
    } else {
      rationale = "Car Premium: Used base premium of 50,000 NGN because car value was not provided or invalid.";
      return { amount: 50000, currency: "NGN", period: "year", rationale };
    }
  } 
  
  if (type === "house") {
    const value = Number(data.property_value || 0);
    if (value > 0) {
      const amount = Math.round(value * 0.003);
      rationale = `House Premium: Calculated as 0.3% of property value (${value} NGN).`;
      return { amount, currency: "NGN", period: "year", rationale };
    } else {
      rationale = "House Premium: Used base premium of 80,000 NGN because property value was not provided or invalid.";
      return { amount: 80000, currency: "NGN", period: "year", rationale };
    }
  }

  if (type === "health") {
    base = 60000;
    rationale = "Health Premium: Started with base of 60,000 NGN.";
  } else if (type === "life") {
    base = 100000;
    rationale = "Life Premium: Started with base of 100,000 NGN.";
  }

  const riskMultiplier = clamp(1 + (riskScore - 40) / 100, 0.8, 2.5);
  const amount = Math.round(base * riskMultiplier);
  
  rationale += ` Multiplied by risk factor of ${riskMultiplier.toFixed(2)} based on risk score of ${riskScore}.`;
  
  return {
    amount,
    currency: "NGN",
    period: "year",
    rationale
  };
}
