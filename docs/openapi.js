const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "InsureMe API",
    version: "1.0.0",
    description: "Swagger UI for InsureMe server endpoints."
  },
  servers: [
    { url: "/" }
  ],
  paths: {
    "/admin/media/upload": {
      post: {
        summary: "Upload media to Cloudinary (admin helper)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  dataUrl: { type: "string", description: "Base64 data URL" },
                  url: { type: "string", description: "Remote URL" },
                  folder: { type: "string", description: "Optional Cloudinary folder" }
                }
              },
              example: {
                dataUrl: "data:image/png;base64,iVBORw0KGgo...",
                folder: "insureme/admin_uploads"
              }
            }
          }
        },
        responses: {
          "200": { description: "Uploaded", content: { "application/json": { schema: { type: "object", properties: { url: { type: "string" } } } } } },
          "400": { description: "Validation error" },
          "500": { description: "Upload failed" }
        }
      }
    },
    "/chat": {
      post: {
        summary: "Send a chat message",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChatRequest" },
              example: { userId: "user_123", message: "I want car insurance" }
            }
          }
        },
        responses: {
          "200": {
            description: "AI response",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ChatResponse" }
              }
            }
          },
          "400": { description: "Validation error" },
          "500": { description: "Server error" }
        }
      }
    },
    "/admin/submissions": {
      get: {
        summary: "List submissions",
        parameters: [
          { in: "query", name: "userId", schema: { type: "string" } },
          { in: "query", name: "type", schema: { type: "string" } },
          { in: "query", name: "limit", schema: { type: "integer", default: 20 } },
          { in: "query", name: "skip", schema: { type: "integer", default: 0 } }
        ],
        responses: {
          "200": { description: "Submission list" },
          "503": { description: "MongoDB not connected" }
        }
      }
    },
    "/admin/submissions/{id}": {
      get: {
        summary: "Get a submission by id",
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": { description: "Submission found" },
          "404": { description: "Submission not found" },
          "503": { description: "MongoDB not connected" }
        }
      }
    },
    "/admin/submissions/{id}/verify-field": {
      post: {
        summary: "Verify a submission field (format-only MVP)",
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  field: { type: "string", enum: ["plate_number"] },
                  value: { type: "string", description: "Optional override value to verify" }
                },
                required: ["field"]
              },
              example: { field: "plate_number" }
            }
          }
        },
        responses: {
          "200": { description: "Verification stored on submission" },
          "400": { description: "Validation error" },
          "404": { description: "Submission not found" },
          "503": { description: "MongoDB not connected" }
        }
      }
    },
    "/admin/users/{userId}": {
      get: {
        summary: "Get user by userId",
        parameters: [
          { in: "path", name: "userId", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": { description: "User found" },
          "404": { description: "User not found" },
          "503": { description: "MongoDB not connected" }
        }
      }
    },
    "/admin/users": {
      get: {
        summary: "List users",
        parameters: [
          { in: "query", name: "limit", schema: { type: "integer", default: 50 } },
          { in: "query", name: "skip", schema: { type: "integer", default: 0 } }
        ],
        responses: {
          "200": { description: "User list" },
          "503": { description: "MongoDB not connected" }
        }
      }
    },
    "/admin/users/{userId}/profile": {
      patch: {
        summary: "Update user workflow collected_fields (admin correction)",
        parameters: [
          { in: "path", name: "userId", required: true, schema: { type: "string" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  user: {
                    type: "object",
                    properties: {
                      workflow: {
                        type: "object",
                        properties: {
                          collected_fields: {
                            type: "object",
                            additionalProperties: true
                          }
                        }
                      }
                    }
                  },
                  collected_fields: {
                    type: "object",
                    additionalProperties: true
                  },
                  submissionId: {
                    type: "string",
                    description: "Optional specific submission id to update"
                  },
                  submission_updates: {
                    type: "object",
                    properties: {
                      riskScoreFinal: { type: "number" },
                      premiumFinal: { type: "object", additionalProperties: true },
                      adminNotes: { type: "object", additionalProperties: true },
                      status: { type: "string" }
                    }
                  },
                  url_replacements: {
                    type: "object",
                    properties: {
                      items: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            from: { type: "string" },
                            to: { type: "string" }
                          },
                          required: ["from", "to"]
                        }
                      }
                    }
                  },
                  require_cloudinary: {
                    type: "boolean",
                    description: "Require all stored media URLs to be Cloudinary URLs"
                  }
                }
              },
              example: {
                submissionId: "69d979be481623e0a67ed17b",
                user: {
                  workflow: {
                    collected_fields: {
                      car_make: "Toyota",
                      car_model: "Corolla",
                      plate_number: "ABC-123"
                    }
                  }
                },
                submission_updates: {
                  riskScoreFinal: 55,
                  premiumFinal: { amount: 52000, currency: "NGN", period: "year" }
                },
                url_replacements: {
                  items: [
                    {
                      from: "https://old-url.example/image.png",
                      to: "https://new-url.example/image.png"
                    }
                  ]
                },
                require_cloudinary: true
              }
            }
          }
        },
        responses: {
          "200": { description: "User workflow updated" },
          "400": { description: "Validation error" },
          "404": { description: "User not found" },
          "503": { description: "MongoDB not connected" }
        }
      }
    },
    "/admin/submissions/{id}/approve": {
      post: {
        summary: "Approve a submission and initialize payment",
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } }
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: {
                    type: "string",
                    description: "Optional override email. If omitted, backend uses stored user/submission email."
                  },
                  premiumFinal: {
                    type: "object",
                    properties: {
                      amount: { type: "number" },
                      currency: { type: "string" },
                      period: { type: "string" }
                    }
                  }
                }
              },
              example: {
                email: "user@example.com",
                premiumFinal: { amount: 49000, currency: "NGN", period: "year" }
              }
            }
          }
        },
        responses: {
          "200": { description: "Approved" },
          "400": { description: "Validation error" },
          "404": { description: "Submission not found" },
          "503": { description: "MongoDB not connected" }
        }
      }
    },
    "/admin/submissions/{id}/reject": {
      post: {
        summary: "Reject a submission",
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": { description: "Rejected" },
          "404": { description: "Submission not found" },
          "503": { description: "MongoDB not connected" }
        }
      }
    },
    "/admin/submissions/{id}/verify-payment": {
      post: {
        summary: "Manually verify a Paystack payment",
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": { description: "Payment verified (if successful)" },
          "400": { description: "No payment reference" },
          "404": { description: "Submission not found" },
          "503": { description: "MongoDB not connected" }
        }
      }
    },
    "/admin/email": {
      post: {
        summary: "Send an email",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  userId: { type: "string" },
                  to: { type: "string" },
                  subject: { type: "string" },
                  html: { type: "string" },
                  text: { type: "string" }
                }
              },
              example: {
                to: "user@example.com",
                subject: "Your policy",
                text: "Hello from InsureMe"
              }
            }
          }
        },
        responses: {
          "200": { description: "Email sent" },
          "400": { description: "Validation error" },
          "503": { description: "MongoDB not connected" }
        }
      }
    },
    "/admin/users/{userId}/clear-workflow": {
      post: {
        summary: "Clear user workflow (and in-memory cache)",
        parameters: [
          { in: "path", name: "userId", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": { description: "Workflow cleared" },
          "404": { description: "User not found" },
          "503": { description: "MongoDB not connected" }
        }
      }
    },
    "/webhooks/paystack": {
      post: {
        summary: "Paystack webhook (raw body)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", additionalProperties: true }
            }
          }
        },
        responses: {
          "200": { description: "Webhook processed" },
          "400": { description: "Invalid signature" },
          "503": { description: "MongoDB not connected" }
        }
      }
    }
  },
  components: {
    schemas: {
      ChatRequest: {
        type: "object",
        required: ["userId", "message"],
        properties: {
          userId: { type: "string" },
          message: { type: "string" }
        }
      },
      ChatResponse: {
        type: "object",
        properties: {
          reply: { type: "string" },
          workflow: { type: "object", additionalProperties: true },
          function_to_call: { type: ["object", "null"], additionalProperties: true }
        }
      },
      SubmissionUpdate: {
        type: "object",
        properties: {
          riskScoreFinal: { type: "number" },
          premiumFinal: { type: "object", additionalProperties: true },
          adminNotes: { type: "string" },
          status: { type: "string" }
        }
      }
    }
  }
};

export default openapiSpec;
