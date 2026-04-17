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
  if (!value) return 0;
  const s = String(value).toLowerCase();
  const risky = ["driver", "pilot", "miner", "construction", "security", "soldier", "military"];
  return risky.some((k) => s.includes(k)) ? 10 : 0;
}

export function scoreCar(data) {
  let score = 40;
  const year = parseYear(data.car_year);
  if (year) {
    const age = new Date().getFullYear() - year;
    if (age >= 10) score += 15;
    else if (age >= 5) score += 8;
  }
  return clamp(score, 0, 100);
}

export function scoreHouse(data) {
  let score = 35;
  const value = Number(data.property_value);
  if (Number.isFinite(value)) {
    if (value >= 50000000) score += 10;
    else if (value >= 20000000) score += 5;
  }
  return clamp(score, 0, 100);
}

export function scoreHealth(data) {
  let score = 45;
  const age = calcAge(data.date_of_birth);
  if (age !== null) {
    if (age >= 50) score += 15;
    else if (age >= 35) score += 8;
  }
  if (hasPreExisting(data.pre_existing_conditions)) score += 20;
  return clamp(score, 0, 100);
}

export function scoreLife(data) {
  let score = 40;
  const age = calcAge(data.date_of_birth);
  if (age !== null) {
    if (age >= 50) score += 20;
    else if (age >= 35) score += 10;
  }
  score += occupationRisk(data.occupation);
  return clamp(score, 0, 100);
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
      return 50;
  }
}
