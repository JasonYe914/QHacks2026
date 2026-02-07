"""
Flask REST API: roadmap creation (AI), fetch, proof upload, mark complete.
Serves frontend and stores proof files in backend/uploads.
"""

import os
import json
import uuid
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from models import (
    init_db,
    create_roadmap,
    get_roadmap,
    get_proofs_for_node,
    add_proof,
    get_all_proofs_ordered,
    UPLOADS_DIR,
)

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

# Optional: Gemini for roadmap generation
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


def generate_roadmap_with_ai(goal: str) -> list:
    """
    Call Gemini to produce a dependency-based roadmap.
    Returns list of nodes: { id, title, description, prerequisites[], tasks[], proof_type }.
    """
    if not GEMINI_API_KEY:
        # Fallback: return a minimal hardcoded roadmap for demo without API key
        return _fallback_roadmap(goal)

    try:
        from google import genai

        client = genai.Client(api_key=GEMINI_API_KEY)
        prompt = f"""You are a learning-path expert. Given this long-term goal: "{goal}"

Create a dependency-based learning roadmap. Return ONLY a valid JSON array of nodes. No markdown, no explanation.

Each node must have:
- "id": string, unique (e.g. "n1", "n2", "n3")
- "title": string, short skill/milestone name
- "description": string, 1-2 sentences
- "prerequisites": array of node ids that must be completed first (empty [] for foundational nodes)
- "tasks": array of 3 to 5 concrete actions (strings)
- "proof_type": one of "photo", "file", "link", "reflection"

Rules:
- Progress from fundamentals → intermediate → advanced.
- Foundational nodes have prerequisites: []
- Later nodes list earlier node ids in prerequisites.
- Typically 6–12 nodes total.
- proof_type should vary (e.g. first: reflection, then link, then file/photo where it makes sense).

Example shape:
[
  {{"id": "n1", "title": "Basics", "description": "...", "prerequisites": [], "tasks": ["...", "..."], "proof_type": "reflection"}},
  {{"id": "n2", "title": "Next", "description": "...", "prerequisites": ["n1"], "tasks": ["..."], "proof_type": "link"}}
]
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        text = (response.text or "").strip()
        # Remove markdown code fence if present
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        nodes = json.loads(text)
        if not isinstance(nodes, list):
            return _fallback_roadmap(goal)
        # Validate and normalize
        for n in nodes:
            n.setdefault("prerequisites", [])
            n.setdefault("tasks", [])
            n.setdefault("proof_type", "reflection")
        return nodes
    except Exception as e:
        print("Gemini error:", e)
        return _fallback_roadmap(goal)


def _fallback_roadmap(goal: str) -> list:
    """Demo roadmap when Gemini is not configured or fails."""
    return [
        {
            "id": "n1",
            "title": "Fundamentals",
            "description": "Build a solid foundation in core concepts.",
            "prerequisites": [],
            "tasks": ["Study basics", "Take notes", "Practice daily", "Review weekly"],
            "proof_type": "reflection",
        },
        {
            "id": "n2",
            "title": "Core Skills",
            "description": "Develop the main skills required for your goal.",
            "prerequisites": ["n1"],
            "tasks": ["Complete project A", "Read documentation", "Build small project", "Get feedback"],
            "proof_type": "link",
        },
        {
            "id": "n3",
            "title": "Intermediate",
            "description": "Apply skills in real-world scenarios.",
            "prerequisites": ["n2"],
            "tasks": ["Build portfolio piece", "Document learnings", "Share with community"],
            "proof_type": "file",
        },
        {
            "id": "n4",
            "title": "Advanced",
            "description": "Reach the level of your stated goal.",
            "prerequisites": ["n3"],
            "tasks": ["Final project", "Write case study", "Present outcomes"],
            "proof_type": "photo",
        },
    ]


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/roadmap/generate", methods=["POST"])
def api_generate_roadmap():
    """Body: { "user_id": "...", "goal": "..." }. Returns { "roadmap_id": number }."""
    try:
        data = request.get_json() or {}
        user_id = data.get("user_id") or "default-user"
        goal = data.get("goal") or "Become a software engineer"
        nodes = generate_roadmap_with_ai(goal)
        roadmap_id = create_roadmap(user_id, goal, nodes)
        return jsonify({"roadmap_id": roadmap_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/roadmap/<int:roadmap_id>", methods=["GET"])
def api_get_roadmap(roadmap_id):
    r = get_roadmap(roadmap_id)
    if not r:
        return jsonify({"error": "Not found"}), 404
    return jsonify(r)


@app.route("/api/roadmap/<int:roadmap_id>/nodes/<node_id>/proof", methods=["POST"])
def api_submit_proof(roadmap_id, node_id):
    """
    Submit proof for a node. Form or JSON.
    proof_type: photo | file | link | reflection
    value: text (link url, reflection text, or filename after upload)
    file: optional multipart file for photo/file
    """
    proof_type = request.form.get("proof_type") or (request.get_json() or {}).get("proof_type")
    value = request.form.get("value") or (request.get_json() or {}).get("value") or ""

    if not proof_type or proof_type not in ("photo", "file", "link", "reflection"):
        return jsonify({"error": "Invalid proof_type"}), 400

    file_path = None
    if "file" in request.files:
        f = request.files["file"]
        if f.filename:
            ext = Path(f.filename).suffix or ".bin"
            filename = f"{node_id}_{uuid.uuid4().hex}{ext}"
            file_path = os.path.join(UPLOADS_DIR, filename)
            f.save(file_path)
            value = value or f.filename
            file_path = filename  # store basename for serving

    add_proof(node_id, proof_type, value, file_path)
    return jsonify({"ok": True})


@app.route("/api/roadmap/<int:roadmap_id>/nodes/<node_id>/proofs", methods=["GET"])
def api_get_proofs(roadmap_id, node_id):
    proofs = get_proofs_for_node(node_id)
    return jsonify(proofs)


@app.route("/api/roadmap/<int:roadmap_id>/journey", methods=["GET"])
def api_journey(roadmap_id):
    """All proofs in order for the journey slideshow."""
    proofs = get_all_proofs_ordered(roadmap_id)
    return jsonify(proofs)


@app.route("/api/uploads/<path:filename>", methods=["GET"])
def serve_upload(filename):
    """Serve stored proof files (e.g. images)."""
    safe_name = os.path.basename(filename)
    path = os.path.join(UPLOADS_DIR, safe_name)
    if not os.path.isfile(path):
        return "", 404
    from flask import send_file
    return send_file(path, as_attachment=False)


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=True)
