import { type ViewerWorldSnapshot } from "@crowd-sim/shared";
import type { RedisConnection } from "./redis-client.js";
export declare function readWorldSnapshot(redis: RedisConnection): Promise<ViewerWorldSnapshot>;
