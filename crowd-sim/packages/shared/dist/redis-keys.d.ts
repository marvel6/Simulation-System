export declare const redisKeys: {
    boundaryAgents: (partitionId: string) => string;
    incomingAgents: (partitionId: string) => string;
    migrationAck: (agentId: string) => string;
    partitionBounds: (partitionId: string) => string;
    partitionLoad: (partitionId: string) => string;
    neighborMap: () => string;
    /** Lightweight agent positions for the live viewer UI */
    viewerAgents: (partitionId: string) => string;
    /** "true" | "false" — experiment runner toggles static vs dynamic */
    rebalanceEnabled: () => string;
    /** Latest experiment command JSON for partitions to apply */
    experimentCommand: () => string;
    experimentApplied: (partitionId: string) => string;
};
