import type { RedisConnection } from "./redis-client.js";
import type { PartitionLoad } from "./load-monitor.js";
/**
 * When the world is empty, snap strips back to the default equal layout
 * so a finished dynamic run does not leave a skewed viewer forever.
 */
export declare function maybeResetBoundsWhenEmpty(redis: RedisConnection, loads: PartitionLoad[]): Promise<boolean>;
/**
 * Boundary-shift rebalancer for vertical strips.
 * Tries shifting each internal boundary left/right and keeps the move
 * that most improves H(P) without collapsing a strip below MIN_WIDTH.
 */
export declare function maybeRebalance(redis: RedisConnection, loads: PartitionLoad[]): Promise<boolean>;
