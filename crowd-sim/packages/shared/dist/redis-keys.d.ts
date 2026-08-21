export declare const redisKeys: {
    boundaryAgents: (partitionId: string) => string;
    incomingAgents: (partitionId: string) => string;
    migrationAck: (agentId: string) => string;
    partitionBounds: (partitionId: string) => string;
    partitionLoad: (partitionId: string) => string;
    neighborMap: () => string;
};
