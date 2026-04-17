export function buildAdminSummary({ type, data, verification }) {
  const userName = data?.full_name || "Unknown";
  const phone = data?.phone || "Unknown";

  const verificationSummary = verification || {};

  const convoSignals = [];
  if (data?.policy_understood === true) {
    convoSignals.push("User confirmed understanding of policy terms.");
  }

  if (type === "car") {
    convoSignals.push(
      `Car: ${data?.car_make || "?"} ${data?.car_model || "?"} (${data?.car_year || "?"}), plate ${data?.plate_number || "?"}.`
    );
  }

  if (type === "house") {
    convoSignals.push(
      `Property: ${data?.property_type || "?"}, ${data?.property_address || "?"}, value ${data?.property_value || "?"}.`
    );
  }

  if (type === "health") {
    convoSignals.push(
      `DOB: ${data?.date_of_birth || "?"}, pre-existing: ${data?.pre_existing_conditions || "?"}.`
    );
  }

  if (type === "life") {
    convoSignals.push(
      `Occupation: ${data?.occupation || "?"}, beneficiary: ${data?.beneficiary_name || "?"} (${data?.beneficiary_relationship || "?"}).`
    );
  }

  const extraChecks = [];
  extraChecks.push("Call the user to confirm key details and intent.");
  extraChecks.push("Confirm BVN/NIN matches the user’s name on record.");

  if (type === "car") {
    extraChecks.push("Confirm vehicle ownership and plate number with supporting docs.");
    extraChecks.push("Inspect uploaded car photos for consistency with declared make/model/year.");
  }

  if (type === "house") {
    extraChecks.push("Confirm property address and ownership (utility bill or deed)." );
    extraChecks.push("Review property images against declared address and type.");
  }

  if (type === "health") {
    extraChecks.push("Confirm any pre‑existing conditions with medical records if required.");
  }

  if (type === "life") {
    extraChecks.push("Confirm beneficiary details and relationship.");
  }

  const admin_notes = {
    user_summary: {
      name: userName,
      phone
    },
    conversation_summary: convoSignals.length
      ? convoSignals
      : ["User provided required details for submission."],
    extra_verification: extraChecks,
    verification_results: verificationSummary
  };

  return admin_notes;
}
