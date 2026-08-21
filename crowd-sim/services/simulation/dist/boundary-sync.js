import { redisKeys } from "@crowd-sim/shared";
const BOUNDARY_MARGIN = 20; // "near the edge" = within 20 units of a border
export function isNearBoundary(agent, bounds) {
    const { position } = agent;
    return (position.x - bounds.minX < BOUNDARY_MARGIN ||
        bounds.maxX - position.x < BOUNDARY_MARGIN ||
        position.y - bounds.minY < BOUNDARY_MARGIN ||
        bounds.maxY - position.y < BOUNDARY_MARGIN);
}
export async function emitBoundaryAgents(redis, partitionId, agents, bounds) {
    const boundaryAgents = agents.filter((a) => isNearBoundary(a, bounds));
    await redis.set(redisKeys.boundaryAgents(partitionId), JSON.stringify(boundaryAgents), {
        EX: 5, // TTL — stale data disappears if a partition dies rather than lingering
    });
}
// Stub — replace with a lookup against the orchestrator's live adjacency map (Objective ii)
export async function getCurrentNeighborPartitionIds(_partitionId) {
    return [];
}
export async function readNeighborBoundaryAgents(redis, partitionId) {
    const neighborIds = await getCurrentNeighborPartitionIds(partitionId);
    const results = [];
    for (const neighborId of neighborIds) {
        const raw = await redis.get(redisKeys.boundaryAgents(neighborId));
        if (raw)
            results.push(...JSON.parse(raw));
    }
    return results;
}
