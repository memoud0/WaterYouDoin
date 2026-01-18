# ml/evaluate.py
from __future__ import annotations

import os
import csv
from typing import List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix

from featurize import extract_features

LABELS = ["FACTUAL", "LOW_VALUE", "REASONING"]

ART_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
DATA_PATH = os.path.join(os.path.dirname(__file__), "dataset", "prompts.csv")


def load_artifact():
    model_path = os.path.join(ART_DIR, "model.joblib")
    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Missing {model_path}. Run: python ml/train.py first."
        )
    blob = joblib.load(model_path)
    return blob["model"], blob.get("labels", LABELS), blob.get("feature_order")


def featurize_df(df: pd.DataFrame, labels: List[str]) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    X_list: List[List[float]] = []
    y_list: List[int] = []
    norms: List[str] = []

    for p, label in zip(df["prompt"].tolist(), df["label"].tolist()):
        norm, feats = extract_features(p)
        norms.append(norm)
        X_list.append(feats.to_vector())
        y_list.append(labels.index(label))

    return np.asarray(X_list, dtype=np.float32), np.asarray(y_list, dtype=np.int64), norms


def pretty_confusion(cm: np.ndarray, labels: List[str]) -> str:
    # A readable text table
    col_w = max(max(len(l) for l in labels), 8)
    header = " " * (col_w + 2) + " ".join(l.rjust(col_w) for l in labels)
    rows = [header]
    for i, lab in enumerate(labels):
        row = [lab.rjust(col_w)]
        for j in range(len(labels)):
            row.append(str(int(cm[i, j])).rjust(col_w))
        rows.append("  " + " ".join(row))
    return "\n".join(rows)


def main():
    # Load dataset
    df = pd.read_csv(DATA_PATH)
    df["prompt"] = df["prompt"].astype(str)
    df["label"] = df["label"].astype(str).str.upper()

    # Drop accidental header rows if any snuck in
    df = df[df["label"] != "LABEL"].copy()

    # Validate labels
    bad = df[~df["label"].isin(LABELS)]
    if len(bad) > 0:
        raise ValueError(f"Invalid labels in dataset: {bad['label'].unique().tolist()}")

    # Load model artifact
    clf, labels, feature_order = load_artifact()
    if labels != LABELS:
        print("WARNING: artifact label order differs from default LABELS.")
        print("artifact labels:", labels)

    # Featurize
    X, y_true, norms = featurize_df(df, labels)

    # Predict
    y_pred = clf.predict(X)

    # Metrics
    print("=== Classification report (FULL DATASET) ===")
    print(classification_report(y_true, y_pred, target_names=labels, digits=4))

    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(labels))))
    print("\n=== Confusion matrix (rows=true, cols=pred) ===")
    print(pretty_confusion(cm, labels))

    # Top failure buckets
    print("\n=== Biggest confusions ===")
    pairs = []
    for i in range(len(labels)):
        for j in range(len(labels)):
            if i == j:
                continue
            pairs.append(((labels[i], labels[j]), int(cm[i, j])))
    pairs.sort(key=lambda x: x[1], reverse=True)
    for (a, b), n in pairs[:6]:
        if n > 0:
            print(f"{a} -> {b}: {n}")

    # Dump misclassifications for inspection
    out_path = os.path.join(ART_DIR, "misclassified.csv")
    probs = clf.predict_proba(X) if hasattr(clf, "predict_proba") else None

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["prompt", "normalized", "true", "pred", "confidence"])
        for prompt, norm, yt, yp, idx in zip(df["prompt"], norms, y_true, y_pred, range(len(y_true))):
            if yt == yp:
                continue
            conf = ""
            if probs is not None:
                conf = float(np.max(probs[idx]))
            w.writerow([prompt, norm, labels[int(yt)], labels[int(yp)], conf])

    print(f"\nSaved misclassifications to: {out_path}")

    # Optional: print a few examples from each confusion pair
    print("\n=== Sample misclassifications (up to 5) ===")
    shown = 0
    for prompt, norm, yt, yp, idx in zip(df["prompt"], norms, y_true, y_pred, range(len(y_true))):
        if yt != yp:
            print(f"- true={labels[int(yt)]} pred={labels[int(yp)]} conf={float(np.max(probs[idx])) if probs is not None else ''}")
            print(f"  prompt: {prompt}")
            print(f"  norm  : {norm}")
            shown += 1
            if shown >= 5:
                break


if __name__ == "__main__":
    main()
