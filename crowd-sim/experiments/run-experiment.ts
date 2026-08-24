/**
 * Experiment controller (Objective iv).
 *
 * Usage:
 *   REDIS_URL=redis://... yarn workspace crowd-sim-experiments experiment --mode=static --reps=1
 *   REDIS_URL=redis://... yarn workspace crowd-sim-experiments experiment --mode=dynamic --reps=1
 *   REDIS_URL=redis://... yarn workspace crowd-sim-experiments experiment --mode=both --reps=30
 *
 * Requires network reachability to ElastiCache (VPN/bastion/port-forward), or a local Redis
 * running the same services.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "redis";
import {
  PARTITION_IDS,
  fitnessH,
  redisKeys,
  type PartitionBounds,
} from "@crowd-sim/shared";

type Mode = "static" | "dynamic";

interface Scenario {
  world: { width: number; height: number };
  agentCount: number;
  tickMs: number;
  seedPartition: string;
  durationMs: number;
  sampleIntervalMs: number;
  exitProximity: number;
  exits: { id: string; x: number; y: number }[];
  partitions: Record<string, PartitionBounds>;
}

interface Sample {
  tMs: number;
  H: number;
  loads: Record<string, number>;
  bounds: Record<string, PartitionBounds>;
  totalAgents: number;
}

interface RunResult {
  mode: Mode;
  rep: number;
  scenario: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  summary: {
    meanH: number;
    maxH: number;
    finalH: number;
    meanLoadStd: number;
    finalTotalAgents: number;
    samples: number;
  };
  samples: Sample[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, "results");

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith("--")) {
    return process.argv[idx + 1];
  }
  return fallback;
}

function loadScenario(file: string): Scenario {
  return JSON.parse(fs.readFileSync(file, "utf8")) as Scenario;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stddev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function readLoads(redis: ReturnType<typeof createClient>) {
  const loads: Record<string, number> = {};
  const bounds: Record<string, PartitionBounds> = {};
  const counts: number[] = [];

  for (const id of PARTITION_IDS) {
    const raw = await redis.get(redisKeys.partitionLoad(id));
    if (raw) {
      const parsed = JSON.parse(raw) as {
        agentCount: number;
        bounds: PartitionBounds;
      };
      loads[id] = parsed.agentCount;
      bounds[id] = parsed.bounds;
      counts.push(parsed.agentCount);
    } else {
      loads[id] = 0;
      counts.push(0);
    }
  }

  return {
    loads,
    bounds,
    totalAgents: counts.reduce((a, b) => a + b, 0),
    H: fitnessH(counts),
    loadStd: stddev(counts),
  };
}

async function prepareRun(
  redis: ReturnType<typeof createClient>,
  scenario: Scenario,
  mode: Mode,
  rep: number
) {
  const rebalance = mode === "dynamic";
  await redis.set(redisKeys.rebalanceEnabled(), rebalance ? "true" : "false");

  for (const [id, bounds] of Object.entries(scenario.partitions)) {
    await redis.set(redisKeys.partitionBounds(id), JSON.stringify(bounds));
    await redis.del(redisKeys.incomingAgents(id));
    await redis.del(redisKeys.viewerAgents(id));
    await redis.del(redisKeys.experimentApplied(id));
  }

  const nonce = `${mode}-rep${rep}-${Date.now()}`;
  await redis.set(
    redisKeys.experimentCommand(),
    JSON.stringify({
      op: "reset-and-seed",
      nonce,
      seedPartition: scenario.seedPartition,
      agentCount: scenario.agentCount,
      boundsByPartition: scenario.partitions,
    })
  );

  console.log(`[experiment] Prepared ${mode} rep=${rep} nonce=${nonce} rebalance=${rebalance}`);
  // Give partitions a couple of ticks to apply the command
  await sleep(Math.max(500, scenario.tickMs * 5));
}

async function runOne(
  redis: ReturnType<typeof createClient>,
  scenario: Scenario,
  scenarioName: string,
  mode: Mode,
  rep: number
): Promise<RunResult> {
  await prepareRun(redis, scenario, mode, rep);

  const startedAt = new Date();
  const samples: Sample[] = [];
  const t0 = Date.now();

  while (Date.now() - t0 < scenario.durationMs) {
    const snap = await readLoads(redis);
    samples.push({
      tMs: Date.now() - t0,
      H: snap.H,
      loads: snap.loads,
      bounds: snap.bounds,
      totalAgents: snap.totalAgents,
    });
    await sleep(scenario.sampleIntervalMs);
  }

  const endedAt = new Date();
  const Hs = samples.map((s) => s.H);
  const loadStds = samples.map((s) => stddev(Object.values(s.loads)));
  const last = samples[samples.length - 1];

  const result: RunResult = {
    mode,
    rep,
    scenario: scenarioName,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: scenario.durationMs,
    summary: {
      meanH: mean(Hs),
      maxH: Hs.length ? Math.max(...Hs) : 0,
      finalH: last?.H ?? 0,
      meanLoadStd: mean(loadStds),
      finalTotalAgents: last?.totalAgents ?? 0,
      samples: samples.length,
    },
    samples,
  };

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const out = path.join(
    RESULTS_DIR,
    `run-${mode}-rep${String(rep).padStart(3, "0")}-${startedAt.toISOString().replace(/[:.]/g, "-")}.json`
  );
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(`[experiment] Wrote ${out}`);
  console.log(`[experiment] summary`, result.summary);
  return result;
}

async function main() {
  const REDIS_URL = process.env.REDIS_URL;
  if (!REDIS_URL) {
    throw new Error("REDIS_URL is required (must reach the sim Redis)");
  }

  const modeArg = (arg("mode", "both") ?? "both") as Mode | "both";
  const reps = Number(arg("reps", "1"));
  const scenarioPath =
    arg("scenario") ??
    path.join(__dirname, "scenarios", "stadium-evacuation.json");
  const scenarioName = path.basename(scenarioPath);
  const scenario = loadScenario(scenarioPath);

  const modes: Mode[] =
    modeArg === "both" ? ["static", "dynamic"] : [modeArg as Mode];

  const redis = createClient({ url: REDIS_URL });
  redis.on("error", (err) => console.error("[experiment] Redis error:", err));
  await redis.connect();

  console.log(
    `[experiment] scenario=${scenarioName} modes=${modes.join(",")} reps=${reps}`
  );

  for (let rep = 1; rep <= reps; rep++) {
    for (const mode of modes) {
      await runOne(redis, scenario, scenarioName, mode, rep);
    }
  }

  await redis.quit();
  console.log("[experiment] Done. Run: yarn workspace crowd-sim-experiments analyze");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
