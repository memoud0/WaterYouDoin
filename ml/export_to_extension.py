# ml/export_to_extension.py
from __future__ import annotations

import json
import os
from typing import Any, Dict, List

import joblib
import numpy as np

# Where train.py saved the artifact
ART_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
MODEL_PATH = os.path.join(ART_DIR, "model.joblib")

# Where the extension expects the weights
EXT_OUT = os.path.join(os.path.dirname(__file__), "..", "extension", "data", "model_weights.json")

DEFAULT_FEATURE_ORDER = [
    "lenTokens",
    "startsWithWh",
    "hasDefine",
    "hasDatePattern",
    "hasCodeTokens",
    "hasErrorWords",
    "hasCompareWords",
    "hasBuildVerbs",
    "hasLookupPhrase",
    "isStrongLookupStart",
]


def ensure_dir(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)


def to_list(x) -> List[float]:
    return [float(v) for v in np.asarray(x).reshape(-1)]


def main():
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Missing {MODEL_PATH}. Run: python3 ml/train.py first.")

    blob = joblib.load(MODEL_PATH)
    clf = blob["model"]
    labels = blob.get("labels") or ["FACTUAL", "LOW_VALUE", "REASONING"]
    feature_order = blob.get("feature_order") or DEFAULT_FEATURE_ORDER

    # sklearn stores:
    # - coef_: (n_classes, n_features) for multinomial/ovr (usually)
    # - intercept_: (n_classes,)
    if not hasattr(clf, "coef_") or not hasattr(clf, "intercept_"):
        raise TypeError("Model does not have coef_/intercept_. Did you train LogisticRegression?")

    W = np.asarray(clf.coef_, dtype=np.float64)
    b = np.asarray(clf.intercept_, dtype=np.float64)

    # Sanity checks
    if W.ndim != 2:
        raise ValueError(f"Unexpected coef_ shape: {W.shape}")
    if b.ndim != 1:
        b = b.reshape(-1)

    if W.shape[0] != len(labels):
        raise ValueError(f"coef_ rows ({W.shape[0]}) != num labels ({len(labels)})")

    if W.shape[1] != len(feature_order):
        raise ValueError(
            f"coef_ cols ({W.shape[1]}) != num features ({len(feature_order)})"
        )

    if b.shape[0] != len(labels):
        raise ValueError(f"intercept_ len ({b.shape[0]}) != num labels ({len(labels)})")

    # Export schema designed to be easy for TS inference
    out: Dict[str, Any] = {
        "kind": "logreg",
        "labels": labels,
        "feature_order": feature_order,
        "weights": [to_list(row) for row in W],  # 2D list
        "bias": to_list(b),
        "meta": {
            "trained_with": "sklearn.LogisticRegression",
            "coef_shape": list(W.shape),
            "note": "Inference: logits = W@x + b, probs = softmax(logits)",
        },
    }

    ensure_dir(EXT_OUT)
    with open(EXT_OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)

    print(f"✅ Exported model weights to: {EXT_OUT}")
    print(f"labels: {labels}")
    print(f"features: {len(feature_order)} -> {feature_order}")
    print(f"W shape: {W.shape}, b shape: {b.shape}")


if __name__ == "__main__":
    main()
