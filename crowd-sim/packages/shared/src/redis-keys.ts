export const redisKeys = {
    boundaryAgents: (partitionId: string) => `partition:${partitionId}:boundary-agents`,
    incomingAgents: (partitionId: string) => `partition:${partitionId}:incoming-agents`,
    migrationAck: (agentId: string) => `migration-ack:${agentId}`,
    partitionBounds: (partitionId: string) => `partition:${partitionId}:bounds`,
    partitionLoad: (partitionId: string) => `partition:${partitionId}:load`,
    neighborMap: () => `orchestrator:neighbor-map`,
  };