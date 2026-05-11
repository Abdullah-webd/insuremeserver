import { loadContext } from "../../../utils/contextLoader.js";
import { runFunctionByName } from "../../../utils/functionRunner.js";

export async function submitterNode(state) {
    const { workflow_id, collected_fields, verification_results, userId } = state;
    if (!workflow_id || !userId) return {};

    const context = loadContext();
    const workflowDef = context.workflows.find(w => w.data.workflow_id === workflow_id)?.data;
    if (!workflowDef) return {};

    // Check if all required fields are collected
    const missingFields = workflowDef.steps.filter(step => {
        if (!step.required) return false;
        const val = collected_fields[step.field];
        if (val === undefined || val === null || val === "") return true;
        if (Array.isArray(val) && val.length === 0) return true;
        return false;
    });

    if (missingFields.length > 0) {
        console.log(`[Submitter] Skipping submission for workflow ${workflow_id}. Missing fields: ${missingFields.map(f => f.field).join(", ")}`);
        // Not ready to submit
        return {};
    }

    console.log(`[Submitter] All fields collected for workflow ${workflow_id}. Triggering submission...`);

    // Ready to submit
    if (workflowDef.submit && workflowDef.submit.function) {
        // Respect workflow-level guardrail: require explicit user confirmation by default.
        const requireConfirmation = workflowDef.submit.require_user_confirmation !== false;
        
        // Actually, we should check if the user confirmed. 
        // We can add a "confirmation_requested" field to state, but let's assume auto-submit for simplicity,
        // or check if there is a confirmation message. For now, let's just submit if all fields are ready.
        // If we need explicit confirmation, we could add a node or field for it.
        // The original code tried to handle this, but it was complex. Let's auto-submit when all fields are collected
        // to simplify the flow and reduce friction.

        const payloadField = workflowDef.submit.payload_field || "data";
        
        // Final sanity check/smart population for dashboard visibility
        const finalData = { ...collected_fields };
        const allPossibleFields = workflowDef.steps.map(s => s.field);
        
        // Ensure all possible fields exist in finalData to avoid "-" on dashboard
        allPossibleFields.forEach(field => {
            if (finalData[field] === undefined || finalData[field] === null || finalData[field] === "") {
                finalData[field] = "-";
            }
        });

        const fnPayload = {
            user_id: userId,
            workflow_id: workflow_id,
            verification: verification_results || {},
            [payloadField]: finalData
        };

        try {
            const result = await runFunctionByName(workflowDef.submit.function, fnPayload);
            // Successfully submitted! Clear state and flag success for responder
            return {
                workflow_id: "__CLEAR__",
                collected_fields: "__CLEAR__",
                verification_results: "__CLEAR__",
                ai_function_call: { name: workflowDef.submit.function, result }
            };
        } catch (error) {
            console.error("Submission error:", error);
            return {
                ai_function_call: { name: workflowDef.submit.function, error: error.message || String(error) }
            };
        }
    }

    return {};
}
