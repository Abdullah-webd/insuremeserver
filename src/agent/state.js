export const StateGraphChannels = {
  messages: {
    value: (x, y) => x.concat(y),
    default: () => [],
  },
  language: {
    value: (x, y) => y ?? x,
    default: () => "English",
  },
  original_message: {
     value: (x, y) => y ?? x,
     default: () => null,
  },
  workflow_id: {
    // To clear the workflow, pass "__CLEAR__"
    value: (x, y) => {
        if (y === "__CLEAR__") return null;
        return y ?? x;
    },
    default: () => null,
  },
  collected_fields: {
    // To clear fields, pass "__CLEAR__"
    value: (x, y) => {
        if (y === "__CLEAR__") return {};
        if (!y) return x;
        return { ...x, ...y };
    },
    default: () => ({}),
  },
  active_policies: {
    value: (x, y) => y ?? x,
    default: () => [],
  },
  user_submissions: {
    value: (x, y) => y ?? x,
    default: () => [],
  },
  userId: {
      value: (x,y) => y ?? x,
      default: () => null
  },
  ai_function_call: {
      value: (x, y) => {
          if (y === "__CLEAR__") return null;
          return y ?? x;
      },
      default: () => null
  },
  failed_verifications: {
      value: (x, y) => y ?? x,
      default: () => null
  },
  verification_results: {
      value: (x, y) => {
          if (y === "__CLEAR__") return {};
          if (!y) return x;
          return { ...x, ...y };
      },
      default: () => ({})
  }
};


