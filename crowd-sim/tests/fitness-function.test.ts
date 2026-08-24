import { fitnessH } from "../services/orchestrator/src/fitness-function.js";
import type { PartitionLoad } from "../services/orchestrator/src/load-monitor.js";

function load(partitionId: string, agentCount: number): PartitionLoad {
  return {
    partitionId,
    agentCount,
    bounds: { minX: 0, maxX: 300, minY: 0, maxY: 600 },
    updatedAt: Date.now(),
  };
}

const balanced = [
  load("partition-A", 50),
  load("partition-B", 50),
  load("partition-C", 50),
  load("partition-D", 50),
];

const skewed = [
  load("partition-A", 200),
  load("partition-B", 0),
  load("partition-C", 0),
  load("partition-D", 0),
];

const hBalanced = fitnessH(balanced);
const hSkewed = fitnessH(skewed);

if (!(hSkewed > hBalanced)) {
  throw new Error(`Expected skewed H (${hSkewed}) > balanced H (${hBalanced})`);
}

console.log("fitness-function.test.ts OK", { hBalanced, hSkewed });
