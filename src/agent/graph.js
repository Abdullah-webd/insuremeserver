import { StateGraph, END, START } from "@langchain/langgraph";
import { StateGraphChannels } from "./state.js";
import { supervisorNode } from "./nodes/supervisor.js";
import { extractorNode } from "./nodes/extractor.js";
import { validatorNode } from "./nodes/validator.js";
import { submitterNode } from "./nodes/submitter.js";
import { responderNode } from "./nodes/responder.js";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoClient } from "mongodb";

function routeFromSupervisor(state) {
    if (state.workflow_id) {
        return "extractor";
    }
    return "responder";
}

export async function createGraph() {
    const workflow = new StateGraph({ channels: StateGraphChannels })
        .addNode("supervisor", supervisorNode)
        .addNode("extractor", extractorNode)
        .addNode("validator", validatorNode)
        .addNode("submitter", submitterNode)
        .addNode("responder", responderNode)
        
        .addEdge(START, "supervisor")
        .addConditionalEdges("supervisor", routeFromSupervisor)
        .addEdge("extractor", "validator")
        .addEdge("validator", "submitter")
        .addEdge("submitter", "responder")
        .addEdge("responder", END);

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    // Using a specific collection for checkpoints
    const checkpointer = new MongoDBSaver({ client, dbName: client.options.dbName || "test" });

    return workflow.compile({ checkpointer });
}
