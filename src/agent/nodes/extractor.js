import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { loadContext } from "../../../utils/contextLoader.js";

export async function extractorNode(state) {
    const { messages, workflow_id, collected_fields } = state;
    if (!workflow_id) return {};

    const context = loadContext();
    const workflow = context.workflows.find(w => w.data.workflow_id === workflow_id)?.data;
    if (!workflow) return {};

    const llm = new ChatOpenAI({ 
        modelName: process.env.OPENAI_MODEL || "gpt-5", 
        apiKey: process.env.OPENAI_API_KEY
    });

    const allFields = workflow.steps.map(f => ({ field: f.field, type: f.type, prompt: f.prompt }));

    const systemPrompt = `You are a data extraction assistant for Heirs Insurance.
The user is currently filling out the "${workflow.name}" application.
Here is the schema of the fields we can collect:
${JSON.stringify(allFields, null, 2)}

Currently collected data:
${JSON.stringify(collected_fields, null, 2)}

User's Active Policies:
${JSON.stringify(state.active_policies || [], null, 2)}

Your job is to read the recent conversation and extract any NEWLY provided information.
- Pay special attention to uploaded files. Treat any URL provided as a potential document or image.
- For array fields like 'property_images' or 'evidence', DO NOT overwrite existing data; ONLY output the newly provided items as an array.
- If the user explicitly asks to cancel or stop the process, output {"cancel": true}.

SMART DEDUCTIONS:
- If you can deduce missing fields from the conversation or previous context, do so! 
- CLAIM SPECIAL: If the user is filing a claim (file_claim) and they ONLY HAVE ONE active policy, automatically set "policy_type" to that policy.
- NEVER reuse old photos for a claim.
- For Pidgin/Non-English: Focus strictly on the DATA being shared. Do not get distracted by the language style.

Output a JSON object with the fields you extracted or deduced. ONLY output JSON. No markdown formatting.`;

    const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        ...messages.slice(-5) // Only look at recent context to avoid re-extracting old data
    ]);

    try {
        const parsed = JSON.parse(response.content.replace(/```json|```/g, '').trim());
        if (parsed.cancel === true) {
            return { workflow_id: "__CLEAR__", collected_fields: "__CLEAR__" };
        }
        delete parsed.cancel;
        
        // Ensure array fields are formatted properly for merging
        const updates = {};
        for (const key of Object.keys(parsed)) {
            const step = workflow.steps.find(s => s.field === key);
            if (step && step.type === "array") {
                const currentArray = Array.isArray(collected_fields[key]) ? collected_fields[key] : [];
                const newItems = Array.isArray(parsed[key]) ? parsed[key] : [parsed[key]];
                updates[key] = [...currentArray, ...newItems].filter(Boolean);
            } else {
                updates[key] = parsed[key];
            }
        }

        if (Object.keys(updates).length > 0) {
            return { collected_fields: updates };
        }
    } catch (e) {
        console.error("Extractor parsing error:", e);
    }
    
    return {};
}
