"""
Helper script: given a JSON array of prompts on stdin, outputs
[
  { "prompt": str, "normalized": str, "vector": [float, ...] },
  ...
]
Used by TS parity tests to ensure Python + TS feature extraction stay in sync.
"""

from __future__ import annotations

import json
import sys
from typing import Any, Dict, List

from featurize import extract_features


def main():
    raw = sys.stdin.read()
    try:
        prompts: List[str] = json.loads(raw)
    except Exception as e:
        print(json.dumps({"error": f"invalid JSON input: {e}"}))
        sys.exit(1)

    out: List[Dict[str, Any]] = []
    for p in prompts:
        norm, feats = extract_features(p)
        out.append(
            {
                "prompt": p,
                "normalized": norm,
                "vector": feats.to_vector(),
            }
        )

    sys.stdout.write(json.dumps(out))


if __name__ == "__main__":
    main()
