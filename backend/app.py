import os
import json
import sqlite3
import subprocess
import sys

# Auto-install Flask if not present
try:
    from flask import Flask, jsonify, request
except ImportError:
    print("Flask not found. Installing Flask...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "flask"])
        from flask import Flask, jsonify, request
    except Exception as e:
        print(f"Failed to install Flask automatically: {e}")
        sys.exit(1)

frontend_folder = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend')
app = Flask(__name__, static_folder=frontend_folder, static_url_path='')
DB_FILE = os.path.join(os.path.dirname(__file__), 'db.sqlite')
JSON_DB_FILE = os.path.join(os.path.dirname(__file__), 'db.json')

# CORS support middleware
@app.before_request
def handle_options_preflight():
    if request.method == 'OPTIONS':
        return app.response_class()

@app.after_request
def add_cors_headers(response):
    if 'Access-Control-Allow-Origin' not in response.headers:
        response.headers.add('Access-Control-Allow-Origin', '*')
    if 'Access-Control-Allow-Headers' not in response.headers:
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Client-Time')
    if 'Access-Control-Allow-Methods' not in response.headers:
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# SQLite Connection helper
def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

# Database Initialization & Auto-Migration
def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
    );
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        branch TEXT NOT NULL,
        date TEXT NOT NULL,
        total_weight REAL NOT NULL,
        created_at TEXT NOT NULL
    );
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS history_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        history_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        weight REAL NOT NULL,
        unit TEXT NOT NULL,
        FOREIGN KEY(history_id) REFERENCES history(id) ON DELETE CASCADE
    );
    """)
    conn.commit()

    # Check if items table is empty
    cursor.execute("SELECT COUNT(*) FROM items")
    if cursor.fetchone()[0] == 0:
        # Check if db.json exists for data migration
        if os.path.exists(JSON_DB_FILE):
            print("Found old db.json. Performing migration to SQLite...")
            try:
                with open(JSON_DB_FILE, 'r', encoding='utf-8') as f:
                    old_data = json.load(f)
                
                # Migrate items
                items_list = old_data.get('items', [])
                for item in items_list:
                    active_val = 0 if item.get('active') is False else 1
                    cursor.execute(
                        "INSERT INTO items (id, name, unit, active) VALUES (?, ?, ?, ?)",
                        (item['id'], item['name'], item.get('unit', 'kg'), active_val)
                    )
                
                # Migrate history logs
                history_list = old_data.get('history', [])
                for log in history_list:
                    cursor.execute(
                        "INSERT INTO history (id, branch, date, total_weight, created_at) VALUES (?, ?, ?, ?, ?)",
                        (log['id'], log['branch'], log['date'], float(log.get('total_weight', 0)), log.get('created_at', ''))
                    )
                    log_id = log['id']
                    
                    # Migrate items inside this history log
                    for h_item in log.get('items', []):
                        cursor.execute(
                            "INSERT INTO history_items (history_id, item_id, name, weight, unit) VALUES (?, ?, ?, ?, ?)",
                            (log_id, h_item['item_id'], h_item['name'], float(h_item['weight']), h_item.get('unit', 'kg'))
                        )
                
                conn.commit()
                print("Migration complete!")
                
                # Rename db.json to prevent re-migration
                bak_file = JSON_DB_FILE + '.bak'
                if os.path.exists(bak_file):
                    os.remove(bak_file)
                os.rename(JSON_DB_FILE, bak_file)
                print(f"Renamed db.json to {bak_file}")
                
            except Exception as e:
                print(f"Error during SQLite migration: {e}")
                conn.rollback()
        else:
            # Seed default items if no migration source
            print("Seeding default items database...")
            default_items = [
                ("Iceberg", "kg", 1),
                ("Tomato", "kg", 1),
                ("Onion", "kg", 1),
                ("Rice", "kg", 1),
                ("Chicken", "kg", 1)
            ]
            cursor.executemany("INSERT INTO items (name, unit, active) VALUES (?, ?, ?)", default_items)
            conn.commit()
            
    conn.close()

# Initialize tables & migrate data on import/startup
init_db()

# API Routes - Items CRUD
@app.route('/api/items', methods=['GET', 'OPTIONS'])
def get_items():
    conn = get_db_connection()
    rows = conn.execute("SELECT id, name, unit, active FROM items").fetchall()
    conn.close()
    
    items = []
    for r in rows:
        items.append({
            "id": r["id"],
            "name": r["name"],
            "unit": r["unit"],
            "active": bool(r["active"])
        })
    return jsonify(items)

@app.route('/api/items', methods=['POST', 'OPTIONS'])
def add_item():
    data = request.json
    if not data or not data.get('name'):
        return jsonify({"error": "Item name is required"}), 400
    
    name = data['name'].strip()
    unit = data.get('unit', 'kg').strip() or 'kg'
    active = 1 if data.get('active', True) else 0
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO items (name, unit, active) VALUES (?, ?, ?)", (name, unit, active))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({
        "id": new_id,
        "name": name,
        "unit": unit,
        "active": bool(active)
    }), 201

@app.route('/api/items/<int:item_id>', methods=['PUT', 'OPTIONS'])
def update_item(item_id):
    data = request.json
    if not data:
        return jsonify({"error": "Request body is required"}), 400
        
    conn = get_db_connection()
    item = conn.execute("SELECT id, name, unit, active FROM items WHERE id = ?", (item_id,)).fetchone()
    if not item:
        conn.close()
        return jsonify({"error": "Item not found"}), 404
        
    name = data.get('name', item['name']).strip()
    unit = data.get('unit', item['unit']).strip()
    
    if 'active' in data:
        active = 1 if data['active'] else 0
    else:
        active = item['active']
        
    conn.execute("UPDATE items SET name = ?, unit = ?, active = ? WHERE id = ?", (name, unit, active, item_id))
    conn.commit()
    
    updated_item = conn.execute("SELECT id, name, unit, active FROM items WHERE id = ?", (item_id,)).fetchone()
    conn.close()
    
    return jsonify({
        "id": updated_item["id"],
        "name": updated_item["name"],
        "unit": updated_item["unit"],
        "active": bool(updated_item["active"])
    })

@app.route('/api/items/<int:item_id>', methods=['DELETE', 'OPTIONS'])
def delete_item(item_id):
    conn = get_db_connection()
    item = conn.execute("SELECT id FROM items WHERE id = ?", (item_id,)).fetchone()
    if not item:
        conn.close()
        return jsonify({"error": "Item not found"}), 404
        
    conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()
    
    return jsonify({"success": True, "message": f"Item {item_id} deleted"})

# API Routes - History logs
@app.route('/api/history', methods=['GET', 'OPTIONS'])
def get_history():
    conn = get_db_connection()
    logs_rows = conn.execute("SELECT id, branch, date, total_weight, created_at FROM history ORDER BY id DESC").fetchall()
    
    history = []
    for log_row in logs_rows:
        log_id = log_row["id"]
        item_rows = conn.execute("SELECT item_id, name, weight, unit FROM history_items WHERE history_id = ?", (log_id,)).fetchall()
        items_list = []
        for ir in item_rows:
            items_list.append({
                "item_id": ir["item_id"],
                "name": ir["name"],
                "weight": ir["weight"],
                "unit": ir["unit"]
            })
        history.append({
            "id": log_id,
            "branch": log_row["branch"],
            "date": log_row["date"],
            "total_weight": log_row["total_weight"],
            "created_at": log_row["created_at"],
            "items": items_list
        })
    conn.close()
    return jsonify(history)

@app.route('/api/history', methods=['POST', 'OPTIONS'])
def add_history():
    data = request.json
    if not data or not data.get('branch') or not data.get('date') or 'items' not in data:
        return jsonify({"error": "Branch, Date, and Items list are required"}), 400
        
    branch = data['branch'].strip().upper()
    date_val = data['date']
    total_weight = float(data.get('total_weight', 0))
    created_at = request.headers.get('X-Client-Time', '')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO history (branch, date, total_weight, created_at) VALUES (?, ?, ?, ?)",
                   (branch, date_val, total_weight, created_at))
    log_id = cursor.lastrowid
    
    for item in data['items']:
        cursor.execute("INSERT INTO history_items (history_id, item_id, name, weight, unit) VALUES (?, ?, ?, ?, ?)",
                       (log_id, item['item_id'], item['name'], float(item['weight']), item['unit']))
                       
    conn.commit()
    conn.close()
    
    return jsonify({
        "id": log_id,
        "branch": branch,
        "date": date_val,
        "items": data['items'],
        "total_weight": total_weight,
        "created_at": created_at
    }), 201

@app.route('/api/history/<int:log_id>', methods=['DELETE', 'OPTIONS'])
def delete_history(log_id):
    conn = get_db_connection()
    log = conn.execute("SELECT id FROM history WHERE id = ?", (log_id,)).fetchone()
    if not log:
        conn.close()
        return jsonify({"error": "Log record not found"}), 404
        
    conn.execute("DELETE FROM history WHERE id = ?", (log_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": f"Log {log_id} deleted"})

# Serve frontend static entrypoints
@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

@app.route('/admin')
def serve_admin():
    return app.send_static_file('admin.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
