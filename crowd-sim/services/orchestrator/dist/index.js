import { DEFAULT_NEIGHBOR_MAP, DEFAULT_PARTITION_BOUNDS, PARTITION_IDS, redisKeys, } from "@crowd-sim/shared";
import { createClient } from "./redis-client.js";
import { readPartitionLoads } from "./load-monitor.js";
import { fitnessH } from "./fitness-function.js";
import { maybeRebalance } from "./rebalancer.js";
const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL)
    throw new Error("REDIS_URL environment variable is required");
const LOOP_MS = Number(process.env.ORCHESTRATOR_INTERVAL_MS ?? 2000);
const redis = createClient({ url: REDIS_URL });
redis.on("error", (err) => console.error("[orchestrator] Redis error:", err));
await redis.connect();
// Ensure baseline partition map exists
await redis.set(redisKeys.neighborMap(), JSON.stringify(DEFAULT_NEIGHBOR_MAP));
for (const id of PARTITION_IDS) {
    const existing = await redis.get(redisKeys.partitionBounds(id));
    if (!existing) {
        await redis.set(redisKeys.partitionBounds(id), JSON.stringify(DEFAULT_PARTITION_BOUNDS[id]));
    }
}
console.log(`[orchestrator] Started, interval=${LOOP_MS}ms`);
setInterval(() => {
    (async () => {
        const loads = await readPartitionLoads(redis);
        const h = fitnessH(loads);
        const summary = loads.map((l) => `${l.partitionId}:${l.agentCount}`).join(" ");
        console.log(`[orchestrator] H(P)=${h.toFixed(3)} | ${summary}`);
        await maybeRebalance(redis, loads);
    })().catch((err) => console.error("[orchestrator] loop error:", err));
}, LOOP_MS);
