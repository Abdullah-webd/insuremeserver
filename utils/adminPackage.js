import { scoreByType } from "./riskScore.js";
import { estimatePremium } from "./premium.js";
import { buildAdminSummary as buildNotes } from "./adminSummary.js";

export function buildAdminPackage({ type, data, verification }) {
  const risk_score = scoreByType(type, data || {});
  const premium = estimatePremium({ type, riskScore: risk_score });
  const admin_notes = buildNotes({ type, data, verification });

  return {
    risk_score,
    premium_estimate: premium,
    admin_notes
  };
}
