import { createClient } from "redis";
import { DEFAULT_NEIGHBOR_MAP, redisKeys } from "@crowd-sim/shared";
import { myAgents, myBounds } from "./agent.js";
import { tick } from "./tick-loop.js";
import { seedAgents } from "./seed.js";
import { syncBoundsFromRedis } from "./partition-state.js";

const PARTITION_ID = process.env.PARTITION_ID ?? "partition-A";
const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) throw new Error("REDIS_URL environment variable is required");

const TICK_MS = 100;
const STATUS_EVERY_MS = 5000;

const redis = createClient({ url: REDIS_URL });
redis.on("error", (err) => console.error(`[${PARTITION_ID}] Redis error:`, err));
await redis.connect();

await syncBoundsFromRedis(redis, PARTITION_ID);
await redis.set(redisKeys.neighborMap(), JSON.stringify(DEFAULT_NEIGHBOR_MAP));
seedAgents(PARTITION_ID, myBounds);

console.log(
  `[${PARTITION_ID}] Starting simulation service, tick=${TICK_MS}ms, bounds=${JSON.stringify(myBounds)}`
);

setInterval(() => {
  tick(redis, PARTITION_ID).catch((err) => console.error(`[${PARTITION_ID}] Tick error:`, err));
}, TICK_MS);

setInterval(() => {
  console.log(`[${PARTITION_ID}] agents=${myAgents.size} bounds=${JSON.stringify(myBounds)}`);
}, STATUS_EVERY_MS);
