import { createClient } from "redis";
export type RedisConnection = ReturnType<typeof createClient>;
export { createClient };
