import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { loadContext } from "../../../utils/contextLoader.js";

export async function supervisorNode(state) {
    const { messages, active_policies, user_submissions } = state;
    const context = loadContext();
    
    const llm = new ChatOpenAI({ 
        modelName: process.env.OPENAI_MODEL || "gpt-5", 
        apiKey: process.env.OPENAI_API_KEY
    });

    const systemPrompt = `You are a routing supervisor for Heirs Insurance.
Your job is to read the conversation history and determine if the user wants to start a specific insurance workflow or just chat.

Available workflows:
${context.workflows.map(w => `- ${w.data.workflow_id}: ${w.data.description}`).filter(w => !w.includes('registration')).join('\n')}

Active policies the user has: ${active_policies.join(", ") || "None"}
Previous submissions:
${user_submissions.map(s => `- Type: ${s.type}, Status: ${s.status}, Payment: ${s.paymentStatus || 'N/A'}${s.rejectionReason ? `, Rejected Reason: ${s.rejectionReason}` : ''}`).join("\n") || "None"}

Rules:
- NEVER route to a "registration" workflow. 
- NEVER try to provide "quotes". We don't do quotes.
- A user CANNOT start a claim for a policy type they do not have active. 
- If they ask to start a claim but don't have the policy, output {"action": "chat"}.
- If they want to start a workflow, output {"action": "start_workflow", "workflow_id": "the_id_here"}.
- If they are just chatting or asking a general question, output {"action": "chat"}.

Output ONLY JSON. No markdown formatting.`;

    const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        ...messages
    ]);

    try {
        const parsed = JSON.parse(response.content.replace(/```json|```/g, '').trim());
        if (parsed.action === "start_workflow" && parsed.workflow_id) {
            return { workflow_id: parsed.workflow_id };
        }
    } catch (e) {
        console.error("Supervisor parsing error:", e);
    }
    
    return {};
}
