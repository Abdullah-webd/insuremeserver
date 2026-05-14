import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { loadContext } from "../../../utils/contextLoader.js";

export async function responderNode(state) {
    const { messages, workflow_id, collected_fields, active_policies, user_submissions, ai_function_call, failed_verifications } = state;
    
    const context = loadContext();
    const workflow = workflow_id ? context.workflows.find(w => w.data.workflow_id === workflow_id)?.data : null;

    const llm = new ChatOpenAI({ 
        modelName: process.env.OPENAI_MODEL || "gpt-5", 
        apiKey: process.env.OPENAI_API_KEY
    });

    let systemPrompt = `You are a helpful, professional customer service agent for Heirs Insurance.
Respond to the user's latest message based on the current context. Be polite, clear, and direct.

CORE DIRECTIVES:
1. ONLY follow the active workflow. Do not suggest or offer ANYTHING not explicitly defined in the workflow steps.
2. NEVER suggest scheduling an "inspection". We do not offer inspections via this chat.
3. NEVER ask for more information than what is requested in the workflow steps.
4. If a user has provided information (like photos), acknowledge it and move to the next step. Do not keep asking for the same thing.
5. Do not offer "quotes", "registration", or any other services not listed here.
6. STICK TO THE PLAN. Do not be creative or offer "alternatives" if a user is slow to respond or has difficulty. Just politely restate what is needed.

CLAIM SPECIFIC RULES:
- If the workflow is "file_claim":
    - Check the user's "active_policies". If they ONLY HAVE ONE active policy (e.g., just "house"), do NOT ask them "Which policy are you filing a claim for?". Automatically assume it's for that active policy and move to the next step.
    - ALWAYS ask for NEW photos of the damage. NEVER reuse or mention photos from the registration/buying stage. A claim requires photos of the CURRENT damage.

POLICY LINK RULES:
- When providing a policy link (LINK: /policy/...), ALWAYS ensure there is a space BEFORE and AFTER the entire "LINK: /..." command.
- NEVER wrap the policy link in parentheses, e.g., do NOT do (LINK: /policy/car).
- The "LINK: /..." command must be on its own line if possible, or clearly separated from text.

ANTI-HALLUCINATION RULES:
1. NEVER claim a submission was successful unless you see the "SUCCESS: The application was just successfully submitted!" block in this prompt.
2. If you see "WORKFLOW ACTIVE" and there are "missingFields", you MUST ask for them. DO NOT assume the user is done unless the state says so.
3. If the user asks "have you submitted it?" and the "SUCCESS" block is NOT present, you must explain that you are still waiting for information or that they need to confirm they are ready.

LANGUAGE RULES:
- Respond in the SAME language the user is using. If they speak English, respond in English. If they speak Pidgin, respond in Pidgin.
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

CRITICAL DIRECTIVES:
1. You MUST ask for ALL missing information in a SINGLE message. NEVER ask for them one by one.
2. If the "policy_understood" field is missing, you MUST include the policy link (LINK: /policy/...) at the very beginning of your response.
3. Use a clear, bulleted list for the information you need.
4. DO NOT skip any required fields.`;
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
- NEVER ask for specific details (like address, name, or vehicle info) in this General Chat state. If the user wants to buy insurance, simply acknowledge it and wait for the workflow to be activated by the system.

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
