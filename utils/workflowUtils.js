function isPresent(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function evaluateWorkflowReady(workflow) {
  if (!workflow || !workflow.steps || !workflow.collected_fields) return workflow;

  const requiredSteps = workflow.steps.filter((s) => s.required);
  const missing = requiredSteps.filter(
    (s) => !isPresent(workflow.collected_fields[s.field])
  );

  const verification = workflow.verification || {};
  const unverified = Object.values(verification).some(
    (v) => v?.required && v.status !== "verified"
  );

  const canSubmit = missing.length === 0 && !unverified;
  if (workflow.submit) {
    workflow.submit.ready = canSubmit;
  }

  return workflow;
}
