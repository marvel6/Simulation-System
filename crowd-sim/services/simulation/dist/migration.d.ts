import type { RedisConnection } from "./redis-client.js";
import type { Agent, PartitionBounds } from "@crowd-sim/shared";
export declare function resolvePartitionForPosition(_pos: {
    x: number;
    y: number;
}, fallbackPartitionId: string): Promise<string>;
/** Step 1: Payload Serialization */
export declare function initiateMigrationsForLeavingAgents(redis: RedisConnection, partitionId: string, agents: Map<string, Agent>, bounds: PartitionBounds): Promise<void>;
/** Step 2 + 3: Target Ingestion, then Transactional Confirmation (ACK) */
export declare function ingestIncomingAgents(redis: RedisConnection, partitionId: string, agents: Map<string, Agent>): Promise<void>;
/** Step 4: Source Purge — only after reading the ACK */
export declare function confirmMigrationsAndPurge(redis: RedisConnection, partitionId: string, agents: Map<string, Agent>): Promise<void>;
