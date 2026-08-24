export const redisKeys = {
    boundaryAgents: (partitionId) => `partition:${partitionId}:boundary-agents`,
    incomingAgents: (partitionId) => `partition:${partitionId}:incoming-agents`,
    migrationAck: (agentId) => `migration-ack:${agentId}`,
    partitionBounds: (partitionId) => `partition:${partitionId}:bounds`,
    partitionLoad: (partitionId) => `partition:${partitionId}:load`,
    neighborMap: () => `orchestrator:neighbor-map`,
    /** Lightweight agent positions for the live viewer UI */
    viewerAgents: (partitionId) => `partition:${partitionId}:viewer-agents`,
    /** "true" | "false" — experiment runner toggles static vs dynamic */
    rebalanceEnabled: () => `orchestrator:rebalance-enabled`,
    /** Latest experiment command JSON for partitions to apply */
    experimentCommand: () => `experiment:command`,
    experimentApplied: (partitionId) => `experiment:applied:${partitionId}`,
};
