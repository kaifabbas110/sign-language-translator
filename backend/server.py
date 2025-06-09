from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np

app = Flask(__name__)
CORS(app)

model = joblib.load("gesture_classifier.pkl")
labels = joblib.load("gesture_labels.pkl")

CONFIDENCE_THRESHOLD = 0.80

from flask import send_from_directory
import os

@app.route("/type-font/<path:filename>")
def serve_font(filename):
    font_dir = os.path.join(app.root_path, 'static', 'type-font')
    return send_from_directory(font_dir, filename)


@app.route("/")
def home():
    return "Gesture classification API is up and running."

@app.route("/predict", methods=["POST"])
def predict():
    data = request.json
    print("Received data:", data)
    landmarks = data.get("landmarks")
    if not landmarks or len(landmarks) == 0:
        return jsonify({"gesture": "Error", "message": "No landmarks or empty list provided"}), 400
    try:
        wrist = landmarks[0]
        normalized = [[x - wrist[0], y - wrist[1], z - wrist[2]] for x, y, z in landmarks]
        flattened = np.array(normalized).flatten().reshape(1, -1)
        print("Flattened shape:", flattened.shape)
        probs = model.predict_proba(flattened)[0]
        max_prob = np.max(probs)
        predicted_idx = np.argmax(probs)
        if max_prob < CONFIDENCE_THRESHOLD:
            return jsonify({"gesture": "Unknown", "confidence": float(max_prob)})
        predicted_label = labels[predicted_idx]
        return jsonify({"gesture": predicted_label, "confidence": float(max_prob)})
    except Exception as e:
        print("Prediction error:", str(e))
        return jsonify({"gesture": "Error", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
