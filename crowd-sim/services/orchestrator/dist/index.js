import { DEFAULT_NEIGHBOR_MAP, DEFAULT_PARTITION_BOUNDS, PARTITION_IDS, redisKeys, } from "@crowd-sim/shared";
import { createClient } from "./redis-client.js";
import { readPartitionLoads } from "./load-monitor.js";
import { fitnessH } from "./fitness-function.js";
import { maybeRebalance, maybeResetBoundsWhenEmpty } from "./rebalancer.js";
const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL)
    throw new Error("REDIS_URL environment variable is required");
const LOOP_MS = Number(process.env.ORCHESTRATOR_INTERVAL_MS ?? 2000);
const ENV_REBALANCE = (process.env.REBALANCE_ENABLED ?? "true").toLowerCase() !== "false";
const redis = createClient({ url: REDIS_URL });
redis.on("error", (err) => console.error("[orchestrator] Redis error:", err));
await redis.connect();
await redis.set(redisKeys.neighborMap(), JSON.stringify(DEFAULT_NEIGHBOR_MAP));
for (const id of PARTITION_IDS) {
    const existing = await redis.get(redisKeys.partitionBounds(id));
    if (!existing) {
        await redis.set(redisKeys.partitionBounds(id), JSON.stringify(DEFAULT_PARTITION_BOUNDS[id]));
    }
}
// Seed Redis flag from env if not already set by an experiment
const existingFlag = await redis.get(redisKeys.rebalanceEnabled());
if (existingFlag == null) {
    await redis.set(redisKeys.rebalanceEnabled(), ENV_REBALANCE ? "true" : "false");
}
console.log(`[orchestrator] Started, interval=${LOOP_MS}ms, rebalance(env default)=${ENV_REBALANCE}`);
async function isRebalanceEnabled() {
    const flag = await redis.get(redisKeys.rebalanceEnabled());
    if (flag == null)
        return ENV_REBALANCE;
    return flag.toLowerCase() !== "false";
}
setInterval(() => {
    (async () => {
        const loads = await readPartitionLoads(redis);
        const h = fitnessH(loads);
        const summary = loads.map((l) => `${l.partitionId}:${l.agentCount}`).join(" ");
        const rebalanceOn = await isRebalanceEnabled();
        console.log(`[orchestrator] H(P)=${h.toFixed(3)} rebalance=${rebalanceOn} | ${summary}`);
        // Always restore equal strips once the crowd has fully exited
        await maybeResetBoundsWhenEmpty(redis, loads);
        if (rebalanceOn) {
            await maybeRebalance(redis, loads);
        }
    })().catch((err) => console.error("[orchestrator] loop error:", err));
}, LOOP_MS);
