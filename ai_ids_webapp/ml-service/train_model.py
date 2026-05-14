import json
from pathlib import Path
import joblib
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    matthews_corrcoef,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import LinearSVC


ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "dataset" / "kdd_test.csv"
OUTPUT_DIR = Path(__file__).resolve().parent
MODELS_DIR = OUTPUT_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)


def compute_binary_metrics(y_true, y_pred, y_score=None):
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
    metrics = {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
        "fpr": round(float(fp / (fp + tn)) if (fp + tn) else 0.0, 4),
        "mcc": round(float(matthews_corrcoef(y_true, y_pred)), 4),
        "confusion_matrix": {
            "tn": int(tn),
            "fp": int(fp),
            "fn": int(fn),
            "tp": int(tp),
        },
    }
    if y_score is not None:
        metrics["roc_auc"] = round(float(roc_auc_score(y_true, y_score)), 4)
    return metrics


def main():
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found at {DATA_PATH}. Please place kdd_test.csv in the dataset folder."
        )

    df = pd.read_csv(DATA_PATH)

    if "labels" not in df.columns:
        raise ValueError("Dataset must contain a 'labels' column.")

    df["labels"] = (df["labels"].astype(str).str.lower() != "normal").astype(int)

    X = df.drop(columns=["labels"])
    y = df["labels"]

    expected_cat = ["protocol_type", "service", "flag"]
    missing = [c for c in expected_cat if c not in X.columns]
    if missing:
        raise ValueError(f"Missing required categorical columns: {missing}")

    cat_cols = expected_cat
    num_cols = [c for c in X.columns if c not in cat_cols]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        stratify=y,
        random_state=42,
    )

    linear_preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols),
            ("num", StandardScaler(), num_cols),
        ]
    )

    tree_preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols),
            ("num", "passthrough", num_cols),
        ]
    )

    models = {
        "logistic_regression": Pipeline(
            steps=[
                ("preprocessor", linear_preprocessor),
                ("model", LogisticRegression(max_iter=2000, class_weight="balanced")),
            ]
        ),
        "linear_svm": Pipeline(
            steps=[
                ("preprocessor", linear_preprocessor),
                ("model", LinearSVC(C=1.0, class_weight="balanced")),
            ]
        ),
        "random_forest": Pipeline(
            steps=[
                ("preprocessor", tree_preprocessor),
                (
                    "model",
                    RandomForestClassifier(
                        n_estimators=200,
                        class_weight="balanced_subsample",
                        n_jobs=-1,
                        random_state=42,
                    ),
                ),
            ]
        ),
    }

    all_metrics = {}

    for name, pipeline in models.items():
        print(f"Training {name}...")
        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)

        y_score = None
        model = pipeline.named_steps["model"]
        if hasattr(model, "predict_proba"):
            y_score = pipeline.predict_proba(X_test)[:, 1]
        elif hasattr(model, "decision_function"):
            y_score = pipeline.decision_function(X_test)

        metrics = compute_binary_metrics(y_test, y_pred, y_score)
        all_metrics[name] = metrics

        out_path = MODELS_DIR / f"{name}.pkl"
        joblib.dump(pipeline, out_path)
        print(f"Saved {name} to {out_path}")

    best_model_name = max(all_metrics, key=lambda k: all_metrics[k]["f1"])
    best_model_path = MODELS_DIR / f"{best_model_name}.pkl"

    metadata = {
        "dataset_path": str(DATA_PATH),
        "best_model": best_model_name,
        "metrics": all_metrics,
        "target_mapping": {"normal": 0, "attack": 1},
        "required_columns": list(X.columns),
    }

    with open(OUTPUT_DIR / "model_metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    with open(OUTPUT_DIR / "best_model.txt", "w", encoding="utf-8") as f:
        f.write(best_model_name)

    print("\nTraining complete.")
    print(json.dumps(metadata, indent=2))
    print(f"\nBest model selected: {best_model_name} ({best_model_path.name})")


if __name__ == "__main__":
    main()
