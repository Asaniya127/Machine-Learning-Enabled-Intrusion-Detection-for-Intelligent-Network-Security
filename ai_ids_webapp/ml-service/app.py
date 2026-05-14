import json
from pathlib import Path

import joblib
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

APP_DIR = Path(__file__).resolve().parent
MODELS_DIR = APP_DIR / "models"
METADATA_PATH = APP_DIR / "model_metadata.json"

app = Flask(__name__)
CORS(app)

if not METADATA_PATH.exists():
    raise FileNotFoundError(
        "model_metadata.json not found. Run train_model.py before starting the ML service."
    )

with open(METADATA_PATH, "r", encoding="utf-8") as f:
    metadata = json.load(f)

loaded_models = {}
for model_name in metadata["metrics"].keys():
    model_path = MODELS_DIR / f"{model_name}.pkl"
    if model_path.exists():
        loaded_models[model_name] = joblib.load(model_path)

if not loaded_models:
    raise FileNotFoundError("No trained models found. Run train_model.py first.")

DEFAULT_MODEL = metadata["best_model"]
REQUIRED_COLUMNS = metadata["required_columns"]


def prepare_dataframe(payload):
    if isinstance(payload, dict):
        df = pd.DataFrame([payload])
    elif isinstance(payload, list):
        df = pd.DataFrame(payload)
    else:
        raise ValueError("Payload must be a JSON object or array of objects.")

    missing = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    df = df[REQUIRED_COLUMNS].copy()
    return df


@app.route("/health", methods=["GET"])
def health():
    return jsonify(
        {
            "status": "ok",
            "loaded_models": list(loaded_models.keys()),
            "default_model": DEFAULT_MODEL,
        }
    )


@app.route("/metrics", methods=["GET"])
def metrics():
    return jsonify(metadata)


@app.route("/predict", methods=["POST"])
def predict():
    try:
        body = request.get_json(force=True)
        model_name = body.get("model", DEFAULT_MODEL)
        samples = body.get("data", body)

        if model_name not in loaded_models:
            return jsonify({"success": False, "error": f"Unknown model: {model_name}"}), 400

        df = prepare_dataframe(samples)
        model = loaded_models[model_name]

        predictions = model.predict(df)

        result = []
        for pred in predictions:
            label = "Attack" if int(pred) == 1 else "Normal"
            result.append({"prediction": label, "prediction_code": int(pred)})

        return jsonify(
            {
                "success": True,
                "model": model_name,
                "count": len(result),
                "results": result,
            }
        )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/predict-csv", methods=["POST"])
def predict_csv():
    try:
        model_name = request.form.get("model", DEFAULT_MODEL)
        if model_name not in loaded_models:
            return jsonify({"success": False, "error": f"Unknown model: {model_name}"}), 400

        if "file" not in request.files:
            return jsonify({"success": False, "error": "No file uploaded."}), 400

        file = request.files["file"]
        df = pd.read_csv(file)
        df = prepare_dataframe(df.to_dict(orient="records"))

        predictions = loaded_models[model_name].predict(df)
        labeled = ["Attack" if int(p) == 1 else "Normal" for p in predictions]

        output = df.copy()
        output["prediction"] = labeled

        return jsonify(
            {
                "success": True,
                "model": model_name,
                "rows": len(output),
                "preview": output.head(20).to_dict(orient="records"),
            }
        )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
