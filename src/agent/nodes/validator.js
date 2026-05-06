import { runVerifications } from "../../../utils/verification/index.js";
import { loadContext } from "../../../utils/contextLoader.js";

export async function validatorNode(state) {
    const { workflow_id, collected_fields, verification_results } = state;
    if (!workflow_id) return { failed_verifications: null };

    const context = loadContext();
    const workflowDef = context.workflows.find(w => w.data.workflow_id === workflow_id)?.data;
    if (!workflowDef) return { failed_verifications: null };

    // Merge previous verification results into the current run so we don't re-verify things
    // Deep clone to avoid mutating the original definition
    const currentVerificationState = JSON.parse(JSON.stringify(workflowDef.verification || {}));
    for (const [key, meta] of Object.entries(verification_results || {})) {
        if (currentVerificationState[key]) {
             currentVerificationState[key] = { ...currentVerificationState[key], ...meta };
        } else {
             currentVerificationState[key] = meta;
        }
    }

    const tempWorkflow = {
        workflow_id,
        collected_fields: { ...collected_fields },
        verification: currentVerificationState
    };

    const verifiedWorkflow = await runVerifications(tempWorkflow);
    
    const failedVerifications = Object.entries(verifiedWorkflow.verification)
        .filter(([_, meta]) => meta.status === "failed")
        .map(([key, meta]) => ({ key, reason: meta.result?.reason || meta.error || "Validation failed" }));

    // If a field failed verification, we clear it from collected_fields so the user has to provide it again.
    const updatedFields = { ...verifiedWorkflow.collected_fields };
    failedVerifications.forEach(fv => {
        delete updatedFields[fv.key];
        // Reset its verification status so it can be retried
        if (verifiedWorkflow.verification[fv.key]) {
             verifiedWorkflow.verification[fv.key].status = "pending";
             delete verifiedWorkflow.verification[fv.key].result;
             delete verifiedWorkflow.verification[fv.key].error;
        }
    });

    return { 
        collected_fields: updatedFields,
        verification_results: verifiedWorkflow.verification,
        failed_verifications: failedVerifications.length > 0 ? failedVerifications : null
    };
}
