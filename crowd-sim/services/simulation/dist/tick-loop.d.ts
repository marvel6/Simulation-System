import type { RedisConnection } from "./redis-client.js";
export declare function tick(redis: RedisConnection, partitionId: string): Promise<void>;
