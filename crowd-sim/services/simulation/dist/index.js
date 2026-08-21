import { createClient } from "redis";
import { tick } from "./tick-loop.js";
const PARTITION_ID = process.env.PARTITION_ID ?? "partition-A";
const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL)
    throw new Error("REDIS_URL environment variable is required");
const TICK_MS = 100; // measured variable — Hypothesis Set 1 (tick rate)
const redis = createClient({ url: REDIS_URL });
redis.on("error", (err) => console.error(`[${PARTITION_ID}] Redis error:`, err));
await redis.connect();
console.log(`[${PARTITION_ID}] Starting simulation service, tick=${TICK_MS}ms`);
setInterval(() => {
    tick(redis, PARTITION_ID).catch((err) => console.error(`[${PARTITION_ID}] Tick error:`, err));
}, TICK_MS);
