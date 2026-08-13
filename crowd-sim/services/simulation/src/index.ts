/**
 * Simulation service — runs INSIDE one ECS container.
 * One running instance = one "partition" (e.g. partition-A).
 *
 * Implements the four-step atomic migration protocol from
 * dissertation section 2.2.4:
 *   1. Payload Serialization — source pushes agent state to target's queue.
 *   2. Target Ingestion — target polls, deserializes, validates, ingests.
 *   3. Transactional Confirmation — target writes an ACK receipt.
 *   4. Source Purge — source reads the ACK, only THEN removes local state.
 *
 * This ordering is what guarantees zero lost or duplicated agents
 * (E_consistency = 0, Hypothesis Set 3).
 */

import { createClient } from "redis";

// ---- Types -----------------------------------------------------------

interface Vec2 {
    x: number;
    y: number;
}

interface Agent {
    agentId: string;
    position: Vec2;
    velocity: Vec2;
    targetExit: string;
    goalCoordinates: Vec2;
    radius: number;
}

interface PartitionBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

// ---- Config ------------------------------------------------------------

const PARTITION_ID = process.env.PARTITION_ID ?? "partition-A";
const REDIS_URL = process.env.REDIS_URL;


if (!REDIS_URL) {
    throw new Error("REDIS_URL environment variable is required");
}


const TICK_MS = 100; // measured variable — Hypothesis Set 1 (tick rate)
const BOUNDARY_MARGIN = 20;
const ACK_TIMEOUT_MS = 2000; // how long the source waits for a target ACK

// Mutable — the orchestrator can shrink/grow this during a rebalance (Objective iii)
let myBounds: PartitionBounds = { minX: 0, maxX: 300, minY: 0, maxY: 600 };

const myAgents: Map<string, Agent> = new Map();

// Agents whose migration payload has been pushed but not yet ACK'd.
// Kept in local memory (NOT deleted from myAgents) until ACK confirms —
// this is what step 4 checks before purging.
const pendingMigrations: Map<string, { targetPartitionId: string; sentAt: number }> = new Map();

// ---- Redis setup ---------------------------------------------------------

const redis = createClient({ url: REDIS_URL });
redis.on("error", (err: any) => console.error(`[${PARTITION_ID}] Redis error:`, err));
await redis.connect();

// ---- The tick loop -------------------------------------------------------

async function tick() {
    // 0. Ingest any agents handed off to us by neighbors THIS tick (Step 2)
    await ingestIncomingAgents();

    // 1. Move every agent (simplified — replace with Social Force Model, Eq. 2.1)
    for (const agent of myAgents.values()) {
        agent.position.x += agent.velocity.x;
        agent.position.y += agent.velocity.y;
    }

    // 2. Emit boundary state — only agents close to an edge, not everyone
    await emitBoundaryAgents();

    // 3. Read neighbors' boundary state for collision/avoidance checks
    const neighborAgents = await readNeighborBoundaryAgents();
    void neighborAgents; // wire into avoidance calculations once steering model is built

    // 4. Start migration for agents that have left my bounds (Step 1)
    await initiateMigrationsForLeavingAgents();

    // 5. Check for ACKs on migrations we've already sent (Steps 3 → 4)
    await confirmMigrationsAndPurge();
}

// ---- Boundary sync (unchanged pattern) ------------------------------------

function isNearBoundary(agent: Agent): boolean {
    const { position } = agent;
    return (
        position.x - myBounds.minX < BOUNDARY_MARGIN ||
        myBounds.maxX - position.x < BOUNDARY_MARGIN ||
        position.y - myBounds.minY < BOUNDARY_MARGIN ||
        myBounds.maxY - position.y < BOUNDARY_MARGIN
    );
}

async function emitBoundaryAgents() {
    const boundaryAgents = [...myAgents.values()].filter(isNearBoundary);
    await redis.set(
        `partition:${PARTITION_ID}:boundary-agents`,
        JSON.stringify(boundaryAgents),
        { EX: 5 }
    );
}

async function readNeighborBoundaryAgents(): Promise<Agent[]> {

    const neighborIds = await getCurrentNeighborPartitionIds(PARTITION_ID);
    const results: Agent[] = [];

    for (const neighborId of neighborIds) {

        const raw = await redis.get(`partition:${neighborId}:boundary-agents`);

        if (raw) {
            results.push(...JSON.parse(raw));
        }
    }
    return results;
}

// ---- Step 1: Payload Serialization ----------------------------------------

async function initiateMigrationsForLeavingAgents() {
    for (const agent of myAgents.values()) {
        // Skip agents already mid-migration — don't re-send every tick while waiting on an ACK
        if (pendingMigrations.has(agent.agentId)) continue;
        if (isInBounds(agent.position, myBounds)) continue;

        const targetPartitionId = await resolvePartitionForPosition(agent.position);

        await redis.rPush(
            `partition:${targetPartitionId}:incoming-agents`,
            JSON.stringify(agent)
        );

        pendingMigrations.set(agent.agentId, { targetPartitionId, sentAt: Date.now() });
        // NOTE: agent stays in myAgents — still simulated by this partition
        // until the ACK confirms the target has taken ownership. This is what
        // prevents Agent State Loss (dropped agents) if the network fails mid-transfer.
    }
}

// ---- Step 2: Target Ingestion ----------------------------------------------

async function ingestIncomingAgents() {
    const queueKey = `partition:${PARTITION_ID}:incoming-agents`;

    // Drain the whole queue this tick
    while (true) {
        const raw = await redis.lPop(queueKey);
        if (!raw) break;

        const agent: Agent = JSON.parse(raw);

        // Validate before ingesting — reject malformed payloads rather than
        // silently corrupting local state
        if (!agent.agentId || !agent.position) {
            console.error(`[${PARTITION_ID}] Rejected malformed migration payload`, raw);
            continue;
        }

        myAgents.set(agent.agentId, agent);

        // Step 3: Transactional Confirmation — write the ACK back immediately
        await redis.set(
            `migration-ack:${agent.agentId}`,
            PARTITION_ID,
            { EX: 10 } // short TTL — the source only needs to see this once
        );
    }
}

// ---- Step 4: Source Purge (only after reading the ACK) --------------------

async function confirmMigrationsAndPurge() {
    for (const [agentId, migration] of pendingMigrations.entries()) {
        const ack = await redis.get(`migration-ack:${agentId}`);

        if (ack === migration.targetPartitionId) {
            // Confirmed: target has ownership. Safe to purge locally now.
            myAgents.delete(agentId);
            pendingMigrations.delete(agentId);
            await redis.del(`migration-ack:${agentId}`);
            continue;
        }

        // No ACK yet — check for timeout so a lost target doesn't leave this
        // agent stuck in limbo forever. On timeout, re-send (agent stays local
        // and simulated in the meantime, so nothing is lost either way).
        if (Date.now() - migration.sentAt > ACK_TIMEOUT_MS) {
            console.warn(
                `[${PARTITION_ID}] Migration ACK timeout for agent ${agentId} -> ${migration.targetPartitionId}, retrying`
            );
            pendingMigrations.delete(agentId); // will be re-initiated next tick
        }
    }
}

function isInBounds(pos: Vec2, bounds: PartitionBounds): boolean {
    return (
        pos.x >= bounds.minX &&
        pos.x <= bounds.maxX &&
        pos.y >= bounds.minY &&
        pos.y <= bounds.maxY
    );
}

// Stubs — wire these to the orchestrator's live state once Objective (ii) is built
async function getCurrentNeighborPartitionIds(_p: string): Promise<string[]> {
    return [];
}
async function resolvePartitionForPosition(_pos: Vec2): Promise<string> {
    return PARTITION_ID;
}

// ---- Run the loop --------------------------------------------------------

console.log(`[${PARTITION_ID}] Starting simulation service, tick=${TICK_MS}ms`);
setInterval(() => {
    tick().catch((err) => console.error(`[${PARTITION_ID}] Tick error:`, err));
}, TICK_MS);