const refusalRegex = /(\bno\b|\bnah\b|\bnope\b|\bi\s*do\s*not\b|\bi\s*don't\b|\bwon't\b|\bwill\s*not\b|\bcan't\b|\bcannot\b|\brefuse\b|\bnot\s+giving\b)/i;
const confirmCancelRegex = /(\byes\b|\bok\b|\bokay\b|\bconfirm\b|\bcancel\b|\bterminate\b|\bstop\b)/i;
const rejectCancelRegex = /(\bno\b|\bcontinue\b|\bkeep\b|\bgo\s+on\b|\bproceed\b)/i;

function getCurrentStep(workflow) {
  if (!workflow?.steps || typeof workflow.current_step !== "number") return null;
  return workflow.steps[workflow.current_step] || null;
}

export function handleRefusal({ message, workflow, userId }) {
  if (!workflow || !message) return null;

  // If we are waiting on cancel confirmation
  if (workflow.status === "pending_cancel") {
    if (confirmCancelRegex.test(message)) {
      return {
        reply:
          "Understood. I will cancel this submission now. If you want to start again later, just tell me.",
        workflow: {
          ...workflow,
          status: "cancelled",
          current_step: 0,
          collected_fields: null
        }
      };
    }

    if (rejectCancelRegex.test(message)) {
      const step = getCurrentStep(workflow);
      return {
        reply: step?.prompt || "Okay, let’s continue. Please provide the required information.",
        workflow: {
          ...workflow,
          status: "in_progress"
        }
      };
    }
  }

  const step = getCurrentStep(workflow);
  if (!step || !step.required) return null;

  if (refusalRegex.test(message)) {
    return {
      reply:
        "That detail is required to proceed. If you don’t want to provide it, I can cancel this submission. Do you want to cancel?",
      workflow: {
        ...workflow,
        status: "pending_cancel"
      }
    };
  }

  return null;
}
