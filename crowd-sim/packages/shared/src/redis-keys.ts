export const redisKeys = {
    boundaryAgents: (partitionId: string) => `partition:${partitionId}:boundary-agents`,
    incomingAgents: (partitionId: string) => `partition:${partitionId}:incoming-agents`,
    migrationAck: (agentId: string) => `migration-ack:${agentId}`,
    partitionBounds: (partitionId: string) => `partition:${partitionId}:bounds`,
    partitionLoad: (partitionId: string) => `partition:${partitionId}:load`,
    neighborMap: () => `orchestrator:neighbor-map`,
    /** Lightweight agent positions for the live viewer UI */
    viewerAgents: (partitionId: string) => `partition:${partitionId}:viewer-agents`,
    /** "true" | "false" — experiment runner toggles static vs dynamic */
    rebalanceEnabled: () => `orchestrator:rebalance-enabled`,
    /** Latest experiment command JSON for partitions to apply */
    experimentCommand: () => `experiment:command`,
    experimentApplied: (partitionId: string) => `experiment:applied:${partitionId}`,
  };