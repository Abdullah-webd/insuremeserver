function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function parseYear(value) {
  const year = Number(value);
  if (!Number.isFinite(year)) return null;
  return year;
}

function parseDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function calcAge(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function hasPreExisting(value) {
  if (!value) return false;
  const s = String(value).trim().toLowerCase();
  return s !== "none" && s !== "no" && s !== "nil";
}

function occupationRisk(value) {
  if (!value) return { score: 0, reason: "No occupation provided." };
  const s = String(value).toLowerCase();
  const risky = ["driver", "pilot", "miner", "construction", "security", "soldier", "military"];
  const isRisky = risky.some((k) => s.includes(k));
  return isRisky 
    ? { score: 10, reason: `Occupation '${value}' is considered high-risk.` }
    : { score: 0, reason: `Occupation '${value}' is considered low-risk.` };
}

export function scoreCar(data) {
  const ownershipAge = Number(data.ownership_age || 0);
  const condition = String(data.condition || "").toLowerCase();
  
  let conditionMultiplier = 20; 
  let conditionText = "Default condition (Unknown)";
  if (condition.includes("poor")) {
    conditionMultiplier = 40;
    conditionText = "Poor condition (+40)";
  } else if (condition.includes("fair")) {
    conditionMultiplier = 25;
    conditionText = "Fair condition (+25)";
  } else if (condition.includes("good")) {
    conditionMultiplier = 15;
    conditionText = "Good condition (+15)";
  } else if (condition.includes("excellent")) {
    conditionMultiplier = 5;
    conditionText = "Excellent condition (+5)";
  }

  const ownershipPenalty = ownershipAge * 0.1;
  const score = ownershipPenalty + conditionMultiplier;
  const rationale = `Car Risk: Base score from condition (${conditionText}). Ownership duration of ${ownershipAge} years added a penalty of ${ownershipPenalty.toFixed(2)}.`;
  
  return { score: clamp(score, 1, 100), rationale };
}

export function scoreHouse(data) {
  const ownershipAge = Number(data.ownership_age || 0);
  const condition = String(data.condition || "").toLowerCase();
  
  let conditionMultiplier = 15;
  let conditionText = "Default condition (Unknown)";
  if (condition.includes("poor")) {
    conditionMultiplier = 35;
    conditionText = "Poor condition (+35)";
  } else if (condition.includes("fair")) {
    conditionMultiplier = 20;
    conditionText = "Fair condition (+20)";
  } else if (condition.includes("good")) {
    conditionMultiplier = 10;
    conditionText = "Good condition (+10)";
  } else if (condition.includes("excellent")) {
    conditionMultiplier = 0;
    conditionText = "Excellent condition (+0)";
  }

  const ownershipPenalty = ownershipAge * 0.05;
  const score = ownershipPenalty + conditionMultiplier;
  const rationale = `House Risk: Base score from condition (${conditionText}). Ownership duration of ${ownershipAge} years added a penalty of ${ownershipPenalty.toFixed(2)}.`;

  return { score: clamp(score, 1, 100), rationale };
}

export function scoreHealth(data) {
  let score = 45;
  let reasons = ["Base health risk score: 45."];
  
  const age = calcAge(data.date_of_birth);
  if (age !== null) {
    if (age >= 50) {
      score += 15;
      reasons.push(`Age is ${age} (>= 50), added 15 to risk.`);
    } else if (age >= 35) {
      score += 8;
      reasons.push(`Age is ${age} (>= 35), added 8 to risk.`);
    } else {
      reasons.push(`Age is ${age} (young), no age penalty.`);
    }
  }

  if (hasPreExisting(data.pre_existing_conditions)) {
    score += 20;
    reasons.push(`Pre-existing conditions reported: '${data.pre_existing_conditions}', added 20 to risk.`);
  } else {
    reasons.push("No pre-existing conditions reported.");
  }

  return { score: clamp(score, 0, 100), rationale: reasons.join(" ") };
}

export function scoreLife(data) {
  let score = 40;
  let reasons = ["Base life risk score: 40."];
  
  const age = calcAge(data.date_of_birth);
  if (age !== null) {
    if (age >= 50) {
      score += 20;
      reasons.push(`Age is ${age} (>= 50), added 20 to risk.`);
    } else if (age >= 35) {
      score += 10;
      reasons.push(`Age is ${age} (>= 35), added 10 to risk.`);
    } else {
      reasons.push(`Age is ${age} (young), no age penalty.`);
    }
  }

  const occ = occupationRisk(data.occupation);
  score += occ.score;
  reasons.push(occ.reason);

  return { score: clamp(score, 0, 100), rationale: reasons.join(" ") };
}

export function scoreByType(type, data) {
  switch (type) {
    case "car":
      return scoreCar(data);
    case "house":
      return scoreHouse(data);
    case "health":
      return scoreHealth(data);
    case "life":
      return scoreLife(data);
    default:
      return { score: 50, rationale: "Default risk score for unknown insurance type." };
  }
}
