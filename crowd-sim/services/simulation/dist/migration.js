import { redisKeys } from "@crowd-sim/shared";
import { isInBounds } from "./agent.js";
const ACK_TIMEOUT_MS = 2000; // how long the source waits for a target ACK
// Agents whose migration payload has been pushed but not yet ACK'd.
// Kept in local memory (agent stays in myAgents too) until ACK confirms.
const pendingMigrations = new Map();
// Stub — replace with a lookup against the live partition boundary map (Objective iii)
export async function resolvePartitionForPosition(_pos, fallbackPartitionId) {
    return fallbackPartitionId;
}
/** Step 1: Payload Serialization */
export async function initiateMigrationsForLeavingAgents(redis, partitionId, agents, bounds) {
    for (const agent of agents.values()) {
        if (pendingMigrations.has(agent.agentId))
            continue; // already mid-migration
        if (isInBounds(agent.position, bounds))
            continue;
        const targetPartitionId = await resolvePartitionForPosition(agent.position, partitionId);
        await redis.rPush(redisKeys.incomingAgents(targetPartitionId), JSON.stringify(agent));
        pendingMigrations.set(agent.agentId, { targetPartitionId, sentAt: Date.now() });
        // Agent stays in `agents` — still simulated here until the ACK confirms handoff.
    }
}
/** Step 2 + 3: Target Ingestion, then Transactional Confirmation (ACK) */
export async function ingestIncomingAgents(redis, partitionId, agents) {
    const queueKey = redisKeys.incomingAgents(partitionId);
    while (true) {
        const raw = await redis.lPop(queueKey);
        if (!raw)
            break;
        const agent = JSON.parse(raw);
        if (!agent.agentId || !agent.position) {
            console.error(`[${partitionId}] Rejected malformed migration payload`, raw);
            continue;
        }
        agents.set(agent.agentId, agent);
        await redis.set(redisKeys.migrationAck(agent.agentId), partitionId, { EX: 10 });
    }
}
/** Step 4: Source Purge — only after reading the ACK */
export async function confirmMigrationsAndPurge(redis, partitionId, agents) {
    for (const [agentId, migration] of pendingMigrations.entries()) {
        const ack = await redis.get(redisKeys.migrationAck(agentId));
        if (ack === migration.targetPartitionId) {
            agents.delete(agentId);
            pendingMigrations.delete(agentId);
            await redis.del(redisKeys.migrationAck(agentId));
            continue;
        }
        if (Date.now() - migration.sentAt > ACK_TIMEOUT_MS) {
            console.warn(`[${partitionId}] Migration ACK timeout for agent ${agentId} -> ${migration.targetPartitionId}, retrying`);
            pendingMigrations.delete(agentId); // re-initiated next tick
        }
    }
}
