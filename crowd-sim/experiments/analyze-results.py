#!/usr/bin/env python3
"""
Analyze paired static vs dynamic experiment runs (Objective iv).

Usage:
  python3 experiments/analyze-results.py
  python3 experiments/analyze-results.py --results-dir experiments/results

Writes:
  experiments/results/summary.json
  experiments/results/summary.md
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
from pathlib import Path
from typing import Any


def load_runs(results_dir: Path) -> list[dict[str, Any]]:
    runs = []
    for path in sorted(results_dir.glob("run-*.json")):
        with path.open() as f:
            runs.append(json.load(f))
    return runs


def paired_values(runs: list[dict[str, Any]], key: str) -> tuple[list[float], list[float]]:
    static = {}
    dynamic = {}
    for r in runs:
        rep = r.get("rep")
        mode = r.get("mode")
        val = r.get("summary", {}).get(key)
        if rep is None or val is None:
            continue
        if mode == "static":
            static[rep] = float(val)
        elif mode == "dynamic":
            dynamic[rep] = float(val)

    reps = sorted(set(static) & set(dynamic))
    return [static[r] for r in reps], [dynamic[r] for r in reps]


def shapiro_wilk(xs: list[float]) -> tuple[float, float] | None:
    """Return (W, p) via scipy if available."""
    try:
        from scipy import stats  # type: ignore

        if len(xs) < 3:
            return None
        w, p = stats.shapiro(xs)
        return float(w), float(p)
    except Exception:
        return None


def paired_test(static: list[float], dynamic: list[float]) -> dict[str, Any]:
    diffs = [s - d for s, d in zip(static, dynamic)]
    out: dict[str, Any] = {
        "n": len(diffs),
        "static_mean": statistics.fmean(static) if static else None,
        "dynamic_mean": statistics.fmean(dynamic) if dynamic else None,
        "mean_diff_static_minus_dynamic": statistics.fmean(diffs) if diffs else None,
    }

    normality = shapiro_wilk(diffs)
    if normality:
        out["shapiro_W"], out["shapiro_p"] = normality
        normal = normality[1] >= 0.05
    else:
        out["shapiro_W"] = None
        out["shapiro_p"] = None
        normal = False
        out["note"] = "Install scipy for Shapiro-Wilk / exact tests (pip install scipy)."

    try:
        from scipy import stats  # type: ignore

        if len(diffs) >= 2 and normal:
            t, p = stats.ttest_rel(static, dynamic)
            out["test"] = "paired_t"
            out["statistic"] = float(t)
            out["p_value"] = float(p)
        elif len(diffs) >= 1:
            try:
                stat, p = stats.wilcoxon(static, dynamic)
            except ValueError:
                # all diffs zero
                stat, p = 0.0, 1.0
            out["test"] = "wilcoxon"
            out["statistic"] = float(stat)
            out["p_value"] = float(p)
    except Exception:
        # Manual paired t fallback
        if len(diffs) >= 2:
            m = statistics.fmean(diffs)
            sd = statistics.stdev(diffs)
            t = m / (sd / math.sqrt(len(diffs))) if sd > 0 else 0.0
            out["test"] = "paired_t_approx_no_scipy"
            out["statistic"] = t
            out["p_value"] = None
        else:
            out["test"] = "none"
            out["statistic"] = None
            out["p_value"] = None

    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze crowd-sim experiment results")
    parser.add_argument(
        "--results-dir",
        default=str(Path(__file__).resolve().parent / "results"),
        help="Directory containing run-*.json files",
    )
    args = parser.parse_args()
    results_dir = Path(args.results_dir)
    results_dir.mkdir(parents=True, exist_ok=True)

    runs = load_runs(results_dir)
    if not runs:
        print(f"No run-*.json files in {results_dir}")
        return

    metrics = ["meanH", "maxH", "finalH", "meanLoadStd"]
    analysis = {
        "runs": len(runs),
        "metrics": {},
    }

    lines = [
        "# Experiment analysis",
        "",
        f"Runs loaded: **{len(runs)}**",
        "",
    ]

    for metric in metrics:
        static, dynamic = paired_values(runs, metric)
        result = paired_test(static, dynamic)
        analysis["metrics"][metric] = result
        lines.append(f"## {metric}")
        lines.append("")
        lines.append(f"- n (paired reps): {result['n']}")
        lines.append(f"- static mean: {result['static_mean']}")
        lines.append(f"- dynamic mean: {result['dynamic_mean']}")
        lines.append(
            f"- mean diff (static - dynamic): {result['mean_diff_static_minus_dynamic']}"
        )
        lines.append(f"- normality (Shapiro p): {result.get('shapiro_p')}")
        lines.append(f"- test: {result.get('test')}")
        lines.append(f"- statistic: {result.get('statistic')}")
        lines.append(f"- p-value: {result.get('p_value')}")
        lines.append("")

    summary_json = results_dir / "summary.json"
    summary_md = results_dir / "summary.md"
    summary_json.write_text(json.dumps(analysis, indent=2))
    summary_md.write_text("\n".join(lines) + "\n")
    print(f"Wrote {summary_json}")
    print(f"Wrote {summary_md}")


if __name__ == "__main__":
    main()
