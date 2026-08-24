# Experiments (Objective iv)

## What this folder does
Compares **static** vs **dynamic** partitioning on the same scenario.

| Mode | Redis flag `orchestrator:rebalance-enabled` |
|------|-----------------------------------------------|
| static | `false` |
| dynamic | `true` |

## Prerequisites
1. Simulation partitions + orchestrator running (ECS or local) and reachable Redis
2. Redeploy simulation/orchestrator so experiment commands + rebalance flag are live
3. `REDIS_URL` must reach ElastiCache (VPN / bastion / local tunnel)

```bash
cd crowd-sim
yarn install
yarn workspace @crowd-sim/shared build
```

## Run trials
```bash
export REDIS_URL='redis://crowd-sim-redis-cluster....:6379'

# one paired static+dynamic rep
yarn workspace crowd-sim-experiments run -- --mode=both --reps=1

# dissertation-scale
yarn workspace crowd-sim-experiments run -- --mode=both --reps=30

# custom scenario
yarn workspace crowd-sim-experiments run -- --mode=dynamic --reps=5 \
  --scenario=./scenarios/stadium-evacuation.json
```

Outputs: `experiments/results/run-<mode>-repNNN-*.json`

## Analyze
```bash
pip install -r experiments/requirements.txt
yarn workspace crowd-sim-experiments analyze
# or: python3 experiments/analyze-results.py
```

Writes `results/summary.json` and `results/summary.md` (Shapiro-Wilk + paired t / Wilcoxon).

## Documentation mapping
- Independent variable: partitioning policy (static vs dynamic)
- Dependent variables: mean/max/final `H(P)`, mean load stddev
- Controlled: scenario JSON (agent count, tick, world, initial bounds)
