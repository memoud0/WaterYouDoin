# ml/train.py
from __future__ import annotations

import json
import os
from dataclasses import asdict
from typing import List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

from featurize import extract_features, Features

LABELS = ["FACTUAL", "LOW_VALUE", "REASONING"]

FEATURE_ORDER = [
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

ART_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
os.makedirs(ART_DIR, exist_ok=True)


def load_dataset(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    assert "prompt" in df.columns and "label" in df.columns, "CSV must have prompt,label columns"
    df["prompt"] = df["prompt"].astype(str)
    df["label"] = df["label"].astype(str).str.upper()

    bad = df[~df["label"].isin(LABELS)]
    if len(bad) > 0:
        raise ValueError(f"Found invalid labels: {bad['label'].unique().tolist()}")

    df = df[df["prompt"].str.strip().astype(bool)].copy()
    df = df.sample(frac=1.0, random_state=42).reset_index(drop=True)  # shuffle deterministically
    return df


def featurize_df(df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    X_list: List[List[float]] = []
    y_list: List[int] = []
    norms: List[str] = []

    for p, label in zip(df["prompt"].tolist(), df["label"].tolist()):
        norm, feats = extract_features(p)
        norms.append(norm)
        X_list.append(feats.to_vector())
        y_list.append(LABELS.index(label))

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.int64)
    return X, y, norms


def main():
    data_path = os.path.join(os.path.dirname(__file__), "dataset", "prompts.csv")
    df = load_dataset(data_path)

    X, y, norms = featurize_df(df)

    # Stratified split keeps class balance in train/test
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=1337, stratify=y
    )

    # Simple, robust baseline model
    clf = LogisticRegression(
        max_iter=2000,
        class_weight="balanced",
        solver="lbfgs",
    )
    clf.fit(X_train, y_train)

    # Quick report (for sanity)
    preds = clf.predict(X_test)
    print("=== Classification report (test) ===")
    print(classification_report(y_test, preds, target_names=LABELS, digits=4))

    # Save full model artifact (for later evaluate.py)
    model_path = os.path.join(ART_DIR, "model.joblib")
    joblib.dump(
        {
            "labels": LABELS,
            "feature_order": FEATURE_ORDER,
            "model": clf,
        },
        model_path,
    )
    print(f"Saved model artifact to: {model_path}")

    # Also save feature order so export step can embed it
    feat_path = os.path.join(ART_DIR, "feature_order.json")
    with open(feat_path, "w", encoding="utf-8") as f:
        json.dump({"feature_order": FEATURE_ORDER}, f, indent=2)
    print(f"Saved feature order to: {feat_path}")


if __name__ == "__main__":
    main()
