import { scoreByType } from "./riskScore.js";
import { estimatePremium } from "./premium.js";
import { buildAdminSummary as buildNotes } from "./adminSummary.js";

export function normalizeSubmissionData(data) {
  if (!data || typeof data !== "object") return data || {};
  // If AI passed the entire workflow object or collected_fields nested
  if (data.collected_fields && typeof data.collected_fields === "object") {
    return { ...data.collected_fields };
  }
  // If AI passed an object where the only key is 'data' or 'collected_fields'
  if (Object.keys(data).length === 1) {
    if (data.data && typeof data.data === "object") return normalizeSubmissionData(data.data);
  }
  return data;
}

export function buildAdminPackage({ type, data, verification }) {
  const normalizedData = normalizeSubmissionData(data);
  
  // New: scoreByType and estimatePremium now return rationales
  const { score: risk_score, rationale: riskRationale } = scoreByType(type, normalizedData);
  const premiumResult = estimatePremium({ type, riskScore: risk_score, data: normalizedData });
  
  const admin_notes = buildNotes({ type, data: normalizedData, verification });

  // Combine rationales
  const combinedRationale = `${riskRationale}\n\n${premiumResult.rationale}`;

  return {
    risk_score,
    premium_estimate: {
      amount: premiumResult.amount,
      currency: premiumResult.currency,
      period: premiumResult.period
    },
    risk_rationale: combinedRationale,
    admin_notes
  };
}
