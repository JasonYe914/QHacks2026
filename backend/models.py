"""
SQLite schema and DB helpers for roadmaps, nodes, and proof uploads.
No auth: users are identified by a simple client-generated id (or session).
"""

import sqlite3
import os
import json
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "roadmap.db")
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create tables: users (minimal), roadmaps, nodes, proofs."""
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    with db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS roadmaps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                goal TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                roadmap_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                prerequisites TEXT,
                tasks TEXT,
                proof_type TEXT NOT NULL,
                position_x REAL DEFAULT 0,
                position_y REAL DEFAULT 0,
                completed_at TEXT,
                FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id)
            );

            CREATE TABLE IF NOT EXISTS proofs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                node_id TEXT NOT NULL,
                proof_type TEXT NOT NULL,
                value TEXT NOT NULL,
                file_path TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (node_id) REFERENCES nodes(id)
            );
        """)


def ensure_user(user_id: str):
    with db() as conn:
        conn.execute("INSERT OR IGNORE INTO users (id) VALUES (?)", (user_id,))


def create_roadmap(user_id: str, goal: str, nodes_data: list) -> int:
    """Create roadmap and its nodes. Prepends a start node with the goal. AI nodes branch from start.
    Node ids are prefixed with roadmap_id to ensure uniqueness."""
    ensure_user(user_id)
    with db() as conn:
        cur = conn.execute("INSERT INTO roadmaps (user_id, goal) VALUES (?, ?)", (user_id, goal))
        roadmap_id = cur.lastrowid
        prefix = f"{roadmap_id}-"
        start_id = f"{prefix}start"
        conn.execute(
            """INSERT INTO nodes (id, roadmap_id, title, description, prerequisites, tasks, proof_type, position_x, position_y, completed_at)
               VALUES (?, ?, ?, ?, '[]', '[]', 'goal', 0, 0, datetime('now'))""",
            (start_id, roadmap_id, goal, "Your goal"),
        )
        for i, n in enumerate(nodes_data):
            raw_id = str(n["id"])
            node_id = f"{prefix}{raw_id}"
            raw_prereqs = n.get("prerequisites") or []
            prereqs_prefixed = [f"{prefix}{p}" for p in raw_prereqs]
            if not prereqs_prefixed:
                prereqs_prefixed = [start_id]
            prereq = json.dumps(prereqs_prefixed)
            tasks = json.dumps(n.get("tasks") or [])
            x, y = (i % 4) * 220, (i // 4) * 180
            conn.execute(
                """INSERT INTO nodes (id, roadmap_id, title, description, prerequisites, tasks, proof_type, position_x, position_y)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    node_id,
                    roadmap_id,
                    n["title"],
                    n.get("description") or "",
                    prereq,
                    tasks,
                    n.get("proof_type") or "reflection",
                    n.get("position_x", x),
                    n.get("position_y", y),
                ),
            )
        return roadmap_id


def get_roadmap(roadmap_id: int):
    with db() as conn:
        row = conn.execute("SELECT * FROM roadmaps WHERE id = ?", (roadmap_id,)).fetchone()
        if not row:
            return None
        roadmap = dict(row)
        nodes = []
        for r in conn.execute("SELECT * FROM nodes WHERE roadmap_id = ? ORDER BY id", (roadmap_id,)):
            n = dict(r)
            n["prerequisites"] = json.loads(n["prerequisites"] or "[]")
            n["tasks"] = json.loads(n["tasks"] or "[]")
            n["completed"] = n["completed_at"] is not None
            nodes.append(n)
        roadmap["nodes"] = nodes
        return roadmap


def get_proofs_for_node(node_id: str):
    with db() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM proofs WHERE node_id = ? ORDER BY created_at", (node_id,))]


def _node_has_photo_proof(conn, node_id: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM proofs WHERE node_id = ? AND proof_type = 'photo' LIMIT 1",
        (node_id,),
    ).fetchone()
    return row is not None


def add_proof(node_id: str, proof_type: str, value: str, file_path: str = None):
    """Add proof. Node is marked complete only when it has at least one photo proof."""
    with db() as conn:
        conn.execute(
            "INSERT INTO proofs (node_id, proof_type, value, file_path) VALUES (?, ?, ?, ?)",
            (node_id, proof_type, value, file_path or ""),
        )
        if _node_has_photo_proof(conn, node_id):
            conn.execute("UPDATE nodes SET completed_at = datetime('now') WHERE id = ?", (node_id,))


def get_all_proofs_ordered(roadmap_id: int):
    """Return proofs for journey slideshow: by node order then by created_at."""
    with db() as conn:
        nodes = list(conn.execute("SELECT id FROM nodes WHERE roadmap_id = ? ORDER BY id", (roadmap_id,)))
        out = []
        for (node_id,) in nodes:
            for r in conn.execute("SELECT * FROM proofs WHERE node_id = ? ORDER BY created_at", (node_id,)):
                out.append(dict(r))
        return out
