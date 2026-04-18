from flask import Flask, jsonify
from flask_cors import CORS
import json

from transfer_logic import parse_inventory_json

app = Flask(__name__)
CORS(app)

DATA_PATH = "../backend/live_inventory.json"

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "yuh"})

@app.route("/recommendations", methods=["GET"])
def get_recommendations():
    with open(DATA_PATH, "r") as f:
        data = json.load(f)
    
    recommendations = parse_inventory_json(data)
    return jsonify(recommendations)

if __name__ == "__main__":
    app.run(debug=True)