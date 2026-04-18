const refusalRegex =
  /(\bno\b|\bnah\b|\bnope\b|\bi\s*do\s*not\b|\bi\s*don't\b|\bdont\b|\bwon't\b|\bwill\s*not\b|\bcan't\b|\bcannot\b|\brefuse\b|\bnot\s+giving\b|\bclear\b|\bdiscard\b)/i;
const confirmCancelRegex =
  /(\byes\b|\bok\b|\bokay\b|\bconfirm\b|\bcancel\b|\bterminate\b|\bstop\b|\byes\s+cancel\b|\byes\s+clear\b)/i;
const rejectCancelRegex =
  /(\bno\b|\bcontinue\b|\bkeep\b|\bgo\s+on\b|\bproceed\b|\bdont\s+cancel\b)/i;

function getCurrentStep(workflow) {
  if (!workflow?.steps || typeof workflow.current_step !== "number")
    return null;
  return workflow.steps[workflow.current_step] || null;
}

export function handleRefusal({ message, workflow, userId }) {
  if (!workflow || !message) return null;
  const normalized = String(message || "")
    .toLowerCase()
    .replace(/[’'`]/g, "'");

  // If we are waiting on cancel confirmation
  if (workflow.status === "pending_cancel") {
    if (confirmCancelRegex.test(normalized)) {
      // User confirmed cancellation. Return null workflow to indicate state should be cleared.
      return {
        reply:
          "Understood — I have cancelled this submission and discarded the information. If you want to start again later, just tell me.",
        workflow: null,
      };
    }

    if (rejectCancelRegex.test(normalized)) {
      const step = getCurrentStep(workflow);
      return {
        reply:
          step?.prompt ||
          "Okay, let’s continue. Please provide the required information.",
        workflow: {
          ...workflow,
          status: "in_progress",
        },
      };
    }
  }

  const step = getCurrentStep(workflow);
  if (!step || !step.required) return null;

  if (refusalRegex.test(normalized)) {
    return {
      reply:
        "That detail is required to proceed. If you don’t want to provide it, I can cancel this submission. Do you want to cancel?",
      workflow: {
        ...workflow,
        status: "pending_cancel",
      },
    };
  }

  return null;
}
