import { myAgents, myBounds } from "./agent.js";
import { updateAgentPosition } from "./steering.js";
import { emitBoundaryAgents, readNeighborBoundaryAgents } from "./boundary-sync.js";
import { publishLoad, publishViewerSnapshot, syncBoundsFromRedis } from "./partition-state.js";
import { maybeApplyExperimentCommand } from "./experiment-control.js";
import { initiateMigrationsForLeavingAgents, ingestIncomingAgents, confirmMigrationsAndPurge, } from "./migration.js";
const AOI = 40;
function nearbyFor(agent, locals, ghosts) {
    const pool = [...locals, ...ghosts];
    return pool.filter((other) => {
        if (other.agentId === agent.agentId)
            return false;
        const dx = agent.position.x - other.position.x;
        const dy = agent.position.y - other.position.y;
        return Math.hypot(dx, dy) <= AOI;
    });
}
export async function tick(redis, partitionId) {
    await maybeApplyExperimentCommand(redis, partitionId);
    await syncBoundsFromRedis(redis, partitionId);
    // 0. Ingest migrations from neighbors
    await ingestIncomingAgents(redis, partitionId, myAgents);
    // 1. Read neighbor ghost agents before moving (for avoidance)
    const neighborAgents = await readNeighborBoundaryAgents(redis, partitionId);
    // 2. Social Force step for every owned agent
    const allAgents = [...myAgents.values()];
    for (const agent of allAgents) {
        updateAgentPosition(agent, nearbyFor(agent, allAgents, neighborAgents));
    }
    // 3. Publish near-edge agents for neighbors
    await emitBoundaryAgents(redis, partitionId, allAgents, myBounds);
    // 4–5. Migration protocol for agents that left our bounds
    await initiateMigrationsForLeavingAgents(redis, partitionId, myAgents, myBounds);
    await confirmMigrationsAndPurge(redis, partitionId, myAgents);
    // 6. Report load for the orchestrator fitness function
    await publishLoad(redis, partitionId, myAgents.size);
    // 7. Compact poses for the live viewer
    await publishViewerSnapshot(redis, partitionId, allAgents);
}
