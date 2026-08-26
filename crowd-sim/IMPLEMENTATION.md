# Implementation Guide — Crowd Simulation System

This document explains the **crowd-sim** project end-to-end: goals, repository layout, infrastructure, application code, protocols/rules, live viewer frontend, experiment methodology, tools, and how everything fits together.

---

## 1. Purpose

The system is a **spatially partitioned crowd simulation** for stadium-style evacuation:

- The world is split into **four vertical partitions** (A–D).
- Each partition runs as its own **ECS Fargate container**.
- Agents move using a **Social Force Model**.
- When an agent crosses a partition edge, ownership is handed off over **Redis** using a write-to-target-first + ACK migration protocol.
- An **orchestrator** monitors per-partition load and may **shift boundaries** to reduce imbalance (fitness \(H(P)\)).
- A **web viewer** visualises agents and live boundary shifts.
- An **experiment harness** compares **static** vs **dynamic** partitioning for dissertation evaluation.

**AWS account / region used in this deployment:** `841666121059` / `us-east-1`.

---

## 2. High-level architecture

```text
                         Internet
                            │
                            ▼
                    Application Load Balancer (:80)
                            │
                            ▼
                    Viewer service (:8080)  ──reads──►  Redis
                                                         ▲
         ┌───────────────┬───────────────┬───────────────┤
         │               │               │               │
   Partition-A     Partition-B     Partition-C     Partition-D
   (Fargate)       (Fargate)       (Fargate)       (Fargate)
         │               │               │               │
         └───────────────┴───────┬───────┴───────────────┘
                                 │
                          Orchestrator
                          (Fargate)
                                 │
                                 ▼
                              Redis
                     (ElastiCache, private)

Laptop ──SSM port-forward──► Bastion (EC2) ──► Redis
        (experiments only)
```

**Mental model**

| Component | Role |
|-----------|------|
| Partition containers | Own agents in a rectangle; tick; migrate; publish load/viewer poses |
| Redis | Shared mailbox / state store (not the “brain”) |
| Orchestrator | Decides when/how to move boundaries |
| Viewer | HTTP + SSE UI aggregating Redis snapshots |
| Bastion | SSM jump host so a laptop can reach private Redis |
| Experiments | Control Redis flags, reseed, sample metrics, analyse |

---

## 3. Repository layout (monorepo)

Yarn workspaces root: `crowd-sim/package.json`.

```text
crowd-sim/
├── package.json                 # workspaces: packages/*, services/*, experiments
├── packages/
│   └── shared/                  # @crowd-sim/shared — types, Redis keys, H(P)
├── services/
│   ├── simulation/              # partition container
│   ├── orchestrator/            # rebalancing service
│   └── viewer/                  # live web UI + API
├── infra/                       # AWS CDK (TypeScript)
│   ├── bin/infra.ts
│   └── lib/
│       ├── network-stack.ts
│       ├── redis-stack.ts
│       ├── ecs-stack.ts
│       └── bastion-stack.ts
├── experiments/
│   ├── scenarios/stadium-evacuation.json
│   ├── run-experiment.ts
│   ├── analyze-results.py
│   └── results/                 # run-*.json + summary.*
├── tests/
└── IMPLEMENTATION.md            # this file
```

**Why a monorepo?** One repo holds deployable services plus a shared library. Yarn links `@crowd-sim/shared` into each service without publishing to npm.

---

## 4. Shared package (`@crowd-sim/shared`)

### 4.1 Types (`packages/shared/src/types.ts`)

- **`Vec2`** — 2D vector `{ x, y }` (position, velocity, goals).
- **`Agent`** — `agentId`, `position`, `velocity`, `targetExit`, `goalCoordinates`, `radius`.
- **`PartitionBounds`** — axis-aligned rectangle `{ minX, maxX, minY, maxY }` (not a line).
- **World** — `1200 × 600` abstract units.
- **Default strips**
  - A: `0–300`
  - B: `300–600`
  - C: `600–900`
  - D: `900–1200`
- **Neighbor map** — A↔B, B↔C, C↔D.
- **Viewer snapshot types** — compact poses for the UI.

### 4.2 Redis key conventions (`redis-keys.ts`)

| Key helper | Purpose |
|------------|---------|
| `boundaryAgents(id)` | Near-edge ghost agents for avoidance |
| `incomingAgents(id)` | Migration queue into a partition |
| `migrationAck(agentId)` | ACK receipt for migration protocol |
| `partitionBounds(id)` | Current owned rectangle |
| `partitionLoad(id)` | Agent count + bounds for orchestrator |
| `neighborMap()` | Adjacency list |
| `viewerAgents(id)` | Compact poses for the live viewer |
| `rebalanceEnabled()` | `"true"` / `"false"` (static vs dynamic experiments) |
| `experimentCommand()` | Reset/reseed command from experiment runner |
| `experimentApplied(id)` | Idempotency nonce per partition |

### 4.3 Fitness \(H(P)\) (`fitness.ts`)

Lower is better:

\[
H(P) = \underbrace{\frac{\sigma}{\max(\mu,1)}}_{\text{load imbalance}} + 0.25 \times \underbrace{\frac{\#\text{empty}}{n}}_{\text{empty penalty}}
\]

where \(\mu,\sigma\) are mean and stddev of per-partition agent counts.

Used by the orchestrator and by experiment analysis.

---

## 5. Simulation service (partition container)

**Path:** `services/simulation/`  
**One ECS task = one partition** (`PARTITION_ID=partition-A` … `D`).

### 5.1 Main modules

| File | Responsibility |
|------|----------------|
| `index.ts` | Connect Redis, sync bounds, seed (A only), tick loop, status logs |
| `tick-loop.ts` | One simulation step |
| `agent.ts` | In-memory `myAgents`, `myBounds`, `setBounds`, `isInBounds` |
| `steering.ts` | Social Force Model (`updateAgentPosition`) |
| `boundary-sync.ts` | Publish/read near-edge agents |
| `migration.ts` | Four-step migration protocol |
| `partition-state.ts` | Bounds sync, owner lookup, load + viewer publish |
| `experiment-control.ts` | Apply reset/reseed commands from Redis |
| `seed.ts` | Spawn agents toward east exit |
| `redis-client.ts` | `RedisConnection` type |

### 5.2 Tick loop (every 100 ms)

1. Apply experiment command if present (reset/reseed).
2. Sync `myBounds` from Redis (orchestrator may have shifted them).
3. **Ingest** agents from this partition’s incoming Redis queue.
4. Read **neighbor ghost** agents for avoidance.
5. **Steer** each owned agent (Social Force + nearby locals/ghosts).
6. **Emit** near-boundary agents to Redis.
7. **Migrate** agents that left `myBounds` (push to target queue).
8. **Confirm ACKs** and purge locally only after ACK.
9. Publish **load** + **viewer** snapshot.

### 5.3 Social Force steering (rules)

In `steering.ts` (Helbing-style):

1. **Desired force** toward `goalCoordinates`.
2. **Repulsive force** from neighbors within interaction radius.
3. Integrate acceleration → velocity (clamped) → position with `dt = 0.1` s.
4. If distance to goal &lt; agent radius → **arrive and damp** (agents stop near the east exit on D).

Default goal: east gate near `x ≈ 1190` (inside partition D). That is why crowds often **settle on D** after walking A→B→C→D.

### 5.4 Migration protocol (rules)

Guarantees intended for consistency (zero loss/duplication under the design):

1. **Payload serialization** — source `RPUSH`es agent JSON to `partition:<target>:incoming-agents`.
2. **Target ingestion** — target `LPOP`s, validates, inserts into `myAgents`.
3. **ACK** — target sets `migration-ack:<agentId>` = target partition id (TTL).
4. **Source purge** — source deletes local agent **only after** seeing matching ACK.

`resolvePartitionForPosition` uses the live Redis bounds map so the target is the partition that currently owns that `(x,y)`.

**Boundary sync ≠ migration.** Near-edge publishing is for collision/avoidance ghosts only; migration transfers ownership.

### 5.5 Bounds control

- `setBounds(bounds)` updates local ownership rectangle.
- Orchestrator writes new bounds to Redis; each tick, partitions call `syncBoundsFromRedis` and apply via `setBounds`.

### 5.6 Docker

Multi-stage build from **repo root** context (`services/simulation/Dockerfile`):

- Install workspaces, build `@crowd-sim/shared` + simulation.
- Run `node dist/index.js` with production deps.

CDK: `ContainerImage.fromAsset('..', { file: 'services/simulation/Dockerfile' })`.

---

## 6. Orchestrator service

**Path:** `services/orchestrator/`

### 6.1 Loop (default every 2 s)

1. Read all partition loads from Redis.
2. Compute \(H(P)\).
3. If `orchestrator:rebalance-enabled` is true (or env `REBALANCE_ENABLED`), run **boundary-shift** search.
4. Write improved bounds back to Redis when a better \(H(P)\) is found.

### 6.2 Rebalancer rules

- Vertical strips only; shifts internal boundaries by a fixed step (e.g. 40 units).
- Rejects shifts that shrink a strip below a minimum width.
- Uses a cheap width-proportional load estimate when scoring candidates.
- Does **not** run when all partitions are empty.

### 6.3 Static vs dynamic

| Mode | Redis `rebalance-enabled` | Behaviour |
|------|---------------------------|-----------|
| Static | `false` | Bounds stay at scenario defaults |
| Dynamic | `true` | Orchestrator may shift strips |

---

## 7. Viewer (frontend + API)

**Path:** `services/viewer/`

### 7.1 Backend (`src/index.ts`)

HTTP server on **port 8080**:

| Route | Purpose |
|-------|---------|
| `GET /` | Static canvas UI |
| `GET /api/health` | ALB health check |
| `GET /api/snapshot` | One-shot JSON world snapshot |
| `GET /api/stream` | **SSE** stream (~every 200 ms) |

Snapshot assembly (`snapshot.ts`): for each partition, read `viewer-agents` (fallback to bounds + empty agents).

**Realtime note:** Redis is updated every tick (~100 ms); the viewer **polls Redis** on an interval and pushes SSE. Feels live (~100–300 ms lag), not Redis Pub/Sub push.

### 7.2 Frontend (`public/`)

- `index.html` — layout
- `styles.css` — dark UI
- `app.js` — Canvas 2D:
  - coloured rectangles = partition bounds (update when rebalanced)
  - coloured dots = agents
  - legend = counts + x-ranges
  - white bar = east exit marker
  - `EventSource('/api/stream')` for live updates

### 7.3 ALB wiring

- Public ALB listens on **:80**
- Forwards to viewer tasks on **:8080**
- Health check path: `/api/health`
- Viewer has its **own security group** (not the shared Redis client SG) to avoid CDK stack cycles when ALB opens inbound 8080.
- Viewer → Redis allowed by importing Redis SG id into EcsStack (`mutable: true`).

**ALB targets only the viewer** (`desiredCount: 1`). It does **not** load-balance partitions A–D; those remain private workers.

---

## 8. Infrastructure (AWS CDK)

**Path:** `infra/`  
**Entry:** `bin/infra.ts`

### 8.1 Stacks

| Stack | Name | Contents |
|-------|------|----------|
| `NetworkStack` | Crowd-Sim-Network-Stack | VPC `10.0.0.0/16`, 2 AZs, public + private subnets, 1 NAT |
| `RedisStack` | Crowd-Sim-Redis-Stack | ElastiCache Redis 7, Redis SG + **client SG** (ECS may connect :6379) |
| `EcsStack` | Crowd-Sim-Ecs-Stack | Cluster; 4 partition services; orchestrator; viewer; ALB |
| `BastionStack` | Crowd-Sim-Bastion-Stack | SSM-only EC2 in private subnet (experiments from laptop) |

Dependency direction (no cycles):

```text
NetworkStack ← RedisStack ← EcsStack
                ↑
            BastionStack
```

### 8.2 ECS services (EcsStack)

- **Partitions A–D:** same simulation image; env `REDIS_URL`, `PARTITION_ID`; ARM64 Fargate; private subnets; Redis client SG; CloudWatch logs with stream prefix `partition-*`.
- **Orchestrator:** env `REDIS_URL`, `ORCHESTRATOR_INTERVAL_MS`, `REBALANCE_ENABLED`.
- **Viewer:** env `REDIS_URL`, `VIEWER_STREAM_MS`, `PORT=8080`; port mapping 8080; ALB listener 80 → target 8080.

### 8.3 Security group rules (summary)

| From | To | Port | Why |
|------|----|------|-----|
| Redis client SG (partitions/orchestrator/bastion) | Redis SG | 6379 | App → Redis |
| Viewer service SG | Redis SG (imported) | 6379 | Viewer → Redis |
| Anyone | ALB SG | 80 | Public HTTP |
| ALB SG | Viewer SG | 8080 | ALB → container |

Security groups are **stateful**: ECS initiates outbound to Redis; return traffic is allowed automatically. Redis needs **inbound** 6379; clients need **outbound**.

### 8.4 Bastion (experiments access)

ElastiCache is **private**. A laptop cannot reach it directly.

1. Deploy `BastionStack`.
2. Install AWS Session Manager plugin locally.
3. Port-forward:

```bash
aws ssm start-session \
  --target <BastionInstanceId> \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["crowd-sim-redis-cluster....amazonaws.com"],"portNumber":["6379"],"localPortNumber":["6379"]}'
```

4. Use `REDIS_URL=redis://127.0.0.1:6379` for experiments.

### 8.5 Deploy commands

```bash
cd crowd-sim/infra
npm install
npx cdk bootstrap aws://841666121059/us-east-1   # once
npx cdk deploy NetworkStack RedisStack EcsStack BastionStack
# or: npx cdk deploy --all
```

Useful outputs: partition service names, `ViewerUrl`, bastion instance id, Redis port-forward command.

Tear down when idle (NAT + Redis + Fargate cost money):

```bash
npx cdk destroy --all
```

---

## 9. Experiments (Objective iv)

**Path:** `experiments/`

### 9.1 Research question

Does **dynamic** boundary rebalancing improve load balance (\(H(P)\), load stddev) versus **static** fixed strips on the same evacuation scenario?

### 9.2 Scenario (`scenarios/stadium-evacuation.json`)

- World 1200×600  
- 200 agents seeded on partition-A  
- Tick 100 ms  
- Run duration 90 s per trial  
- Sample every 1 s  
- East exit near (1190, 300)  
- Initial equal vertical strips  

### 9.3 Independent / dependent / controlled variables

| Role | Variable |
|------|----------|
| IV | Partitioning policy: `static` vs `dynamic` |
| DV | `meanH`, `maxH`, `finalH`, `meanLoadStd` |
| Controlled | Scenario JSON, agent count, tick, initial bounds, duration |

### 9.4 Runner (`run-experiment.ts`)

For each repetition and mode:

1. Set `orchestrator:rebalance-enabled` true/false.
2. Reset partition bounds to scenario defaults; clear queues.
3. Publish Redis `experiment:command` (`reset-and-seed` + nonce).
4. Partitions clear local agents; A reseeds.
5. Sample loads / \(H(P)\) for `durationMs`.
6. Write `results/run-<mode>-repNNN-*.json`.

```bash
export REDIS_URL='redis://127.0.0.1:6379'   # via SSM tunnel
yarn workspace crowd-sim-experiments experiment --mode=both --reps=30
```

`--mode=both --reps=30` ⇒ **30 static + 30 dynamic = 60 runs** (~90 s each ≈ 1.5+ hours). Keep the SSM session open.

### 9.5 Analysis (`analyze-results.py`)

- Loads all `run-*.json`.
- Pairs static/dynamic by `rep`.
- Shapiro–Wilk on paired diffs; if non-normal → **Wilcoxon signed-rank**, else paired t-test.
- Writes `results/summary.md` and `results/summary.json`.

Python deps live in `experiments/.venv` (Homebrew blocks global pip):

```bash
cd experiments && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
yarn workspace crowd-sim-experiments analyze
```

### 9.6 Results obtained (30 paired reps)

| Metric | Static mean | Dynamic mean | p-value (Wilcoxon) | Interpretation |
|--------|-------------|--------------|--------------------|----------------|
| **meanH** | 1.443 | **1.250** | **3.2×10⁻⁶** | Dynamic better |
| **meanLoadStd** | 65.8 | **56.1** | **3.2×10⁻⁶** | Dynamic more even |
| maxH | 1.920 | 1.862 | 0.068 | Not significant |
| finalH | 1.164 | 1.176 | 0.125 | Not significant |

**Conclusion for documentation:** Dynamic rebalancing significantly reduced **average** fitness \(H(P)\) and load stddev over the trial window. Peak and end-of-run H did not differ significantly. Diffs were non-normal (Shapiro p ≪ 0.05), so Wilcoxon was appropriate.

**Caveats:** A few reps had unusually few samples (possible brief tunnel/Redis glitches). Smoke-test files may also sit in `results/` (62 files total including earlier pairs); pairing uses `rep` ids.

---

## 10. Tools and technologies

| Layer | Tools |
|-------|--------|
| Language | TypeScript (Node 20), Python 3 (analysis) |
| Package mgmt | Yarn workspaces (JS), pip + venv (Python) |
| Infra as code | AWS CDK (TypeScript), CloudFormation |
| Compute | Amazon ECS Fargate (ARM64) |
| Cache / bus | Amazon ElastiCache Redis 7 |
| Networking | VPC, public/private subnets, NAT, ALB, security groups |
| Logs | CloudWatch Logs (`partition-*`, `orchestrator`, `viewer`) |
| Access for experiments | EC2 bastion + AWS SSM Session Manager port-forward |
| Containers | Docker multi-stage builds from monorepo root |
| Live UI | Canvas 2D + Server-Sent Events |
| Stats | SciPy (Shapiro–Wilk, Wilcoxon / paired t) |

---

## 11. Operational playbook

### Watch the simulation

1. Open ALB `ViewerUrl` in a browser (agents + coloured bounds).
2. Or CloudWatch → log groups for `Crowd-Sim-Ecs-Stack-*`  
   - Partitions log `agents=N bounds=…` every ~5 s  
   - Orchestrator logs `H(P)=… rebalance=… | partition-A:…`

### Typical agent lifecycle (visual)

1. Seed on A (~200 agents).  
2. Walk east under Social Force.  
3. Migrate A→B→C→D via Redis.  
4. Stop near east exit on D (goal reached).  
5. Under dynamic mode, strip widths may shift while load is uneven.

### Experiment checklist

1. ECS stack healthy; viewer shows motion.  
2. Bastion Online in SSM Fleet Manager.  
3. Session Manager plugin installed; port-forward running.  
4. `REDIS_URL=redis://127.0.0.1:6379`.  
5. Run experiments; then analyze.  
6. Cite `summary.md` / `summary.json` in the dissertation.

### Cost hygiene

Stop or destroy stacks when not testing (NAT gateway, Redis, multiple Fargate tasks, bastion, ALB all incur cost).

---

## 12. Design rules / invariants (summary)

1. **One partition process owns an agent** at a time (migration ACK before purge).  
2. **Redis is transport/state**, not decision-maker for boundaries.  
3. **Orchestrator decides** boundary shifts; partitions apply via `setBounds`.  
4. **Shared types/keys** live in `@crowd-sim/shared` so services stay consistent.  
5. **Viewer ALB must not mutate RedisStack’s client SG** (stack cycle); viewer uses a dedicated SG.  
6. **ElastiCache stays private**; experiments enter via SSM bastion, not a public Redis.  
7. **Experiments toggle policy via Redis flags**, not by redeploying for each mode.  
8. **Lower \(H(P)\) is better**; dynamic mode aims to reduce it under uneven load.

---

## 13. Known limitations / future work

- No wall/obstacle forces in steering yet.  
- Agents are not despawned at the exit (they accumulate on D).  
- Rebalancer load estimate after a shift is width-proportional (proxy).  
- Viewer uses Redis polling/SSE, not Pub/Sub.  
- Experiment runner requires a live path to Redis (bastion).  
- Some long-batch reps showed sparse sampling under network hiccups.

---

## 14. Quick command reference

```bash
# Deploy
cd crowd-sim/infra && npx cdk deploy --all

# Local install (JS)
cd crowd-sim && yarn install && yarn workspace @crowd-sim/shared build

# SSM → Redis
aws ssm start-session --target <bastion-id> \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["<redis-host>"],"portNumber":["6379"],"localPortNumber":["6379"]}'

# Experiments
export REDIS_URL='redis://127.0.0.1:6379'
yarn workspace crowd-sim-experiments experiment --mode=both --reps=30
yarn workspace crowd-sim-experiments analyze
```

---

*This document reflects the implemented crowd-sim system as of the stadium-evacuation comparative study (static vs dynamic partitioning) described in §9.*
