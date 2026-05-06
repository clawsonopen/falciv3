import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv()

app = Flask(__name__, static_folder=None)
CORS(app)

GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL") or "gemini-2.5-flash-lite"


@app.get("/gemini-api-key")
def gemini_api_key():
    if not GEMINI_API_KEY:
        return jsonify({"ok": False, "error": "Yorum anahtarı yok."}), 503
    return jsonify({"ok": True, "apiKey": GEMINI_API_KEY, "model": GEMINI_MODEL})


@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "gemini-key-service"})


if __name__ == "__main__":
    port = int(os.getenv("PORT") or "8080")
    app.run(host="0.0.0.0", port=port)
