import { PARTITION_IDS, redisKeys } from "@crowd-sim/shared";
export async function readPartitionLoads(redis) {
    const loads = [];
    for (const partitionId of PARTITION_IDS) {
        const raw = await redis.get(redisKeys.partitionLoad(partitionId));
        if (!raw) {
            loads.push({
                partitionId,
                agentCount: 0,
                bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
                updatedAt: 0,
            });
            continue;
        }
        const parsed = JSON.parse(raw);
        loads.push({
            partitionId,
            agentCount: parsed.agentCount,
            bounds: parsed.bounds,
            updatedAt: parsed.updatedAt,
        });
    }
    return loads;
}
