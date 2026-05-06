import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { loadContext } from "../../../utils/contextLoader.js";

export async function responderNode(state) {
    const { messages, workflow_id, collected_fields, active_policies, user_submissions, ai_function_call, failed_verifications } = state;
    
    const context = loadContext();
    const workflow = workflow_id ? context.workflows.find(w => w.data.workflow_id === workflow_id)?.data : null;

    const llm = new ChatOpenAI({ 
        modelName: process.env.OPENAI_MODEL || "gpt-4", 
        apiKey: process.env.OPENAI_API_KEY
    });

    let systemPrompt = `You are a helpful, professional customer service agent for Heirs Insurance.
Respond to the user's latest message based on the current context. Be polite, clear, and direct.
`;

    if (ai_function_call && ai_function_call.result) {
        systemPrompt += `\nSUCCESS: The application was just successfully submitted!
Function called: ${ai_function_call.name}
Result: ${JSON.stringify(ai_function_call.result)}
Inform the user that their application is under review by admins, and they will receive an email/SMS shortly.
Also tell them if they need changes, they should call our admin on 07077402688.`;
    } else if (ai_function_call && ai_function_call.error) {
        systemPrompt += `\nERROR: There was an error submitting the application: ${ai_function_call.error}. Apologize to the user.`;
    } else if (failed_verifications && failed_verifications.length > 0) {
        systemPrompt += `\nVALIDATION FAILED: The user provided invalid data for some fields:
${JSON.stringify(failed_verifications, null, 2)}
Politely inform the user about the specific errors and ask them to provide the correct information again.`;
    } else if (workflow) {
        const missingFields = workflow.steps.filter(step => {
            if (!step.required) return false;
            const val = collected_fields[step.field];
            if (val === undefined || val === null || val === "") return true;
            if (Array.isArray(val) && val.length === 0) return true;
            return false;
        });
        
        if (missingFields.length > 0) {
            systemPrompt += `\nWORKFLOW ACTIVE: You are helping the user fill out "${workflow.name}".
We still need the following fields:
${JSON.stringify(missingFields.map(f => ({ prompt: f.prompt })), null, 2)}

Please ask the user for ALL of the missing information in a single clear, friendly message. Do not ask one by one. List them out nicely.
Do not ask for information we already have.`;
        } else {
             systemPrompt += `\nWORKFLOW READY: All required fields have been collected. Please review their inputs and ask if they are ready to submit, or if they need to change anything.`;
        }
    } else {
        systemPrompt += `\nGENERAL CHAT: The user is asking a general question or chatting.
You CAN ONLY help the user with two things:
1. Buy Insurance (Car, Health, House, Life).
2. File a Claim (ONLY if they have an active paid policy).

CRITICAL RULES:
- NEVER offer or mention "quotes" or "get a quote". We do not do quotes. You just help them buy policies.
- NEVER offer to "register an account". The AI cannot register accounts for users. Do not mention registration.
- NEVER make up capabilities. If the user asks for something outside of buying insurance or filing a claim, politely explain that you can only help with insurance applications and claims.

Available workflows you can start: ${context.workflows.map(w => w.data.workflow_id).filter(w => w !== 'registration').join(", ")}.

Their active policies: ${active_policies.join(", ") || "None"}
Previous submissions:
${user_submissions.map(s => `- Type: ${s.type}, Status: ${s.status}, Payment: ${s.paymentStatus || 'N/A'}${s.rejectionReason ? `, Rejected Reason: ${s.rejectionReason}` : ''}`).join("\n") || "None"}

If their submission was approved/paid, congratulate them. If it was rejected, inform them of the reason if they ask.`;
    }

    // Force gpt-5 or fallback
    const actualModel = process.env.OPENAI_MODEL || "gpt-5";
    llm.modelName = actualModel;

    const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        ...messages.slice(-5)
    ]);

    return { 
        messages: [response],
        ai_function_call: "__CLEAR__",
        failed_verifications: null
    };
}
