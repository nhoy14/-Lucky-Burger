import os
import json
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

app = Flask(__name__)
DB_FILE = os.path.join(os.path.dirname(__file__), 'db.json')

# CORS support middleware
@app.before_request
def handle_options_preflight():
    if request.method == 'OPTIONS':
        response = app.response_class()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Client-Time')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

@app.after_request
def add_cors_headers(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Client-Time')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Helper to read/write DB
def read_db():
    if not os.path.exists(DB_FILE):
        default_data = {
            "items": [
                { "id": 1, "name": "Iceberg", "unit": "kg" },
                { "id": 2, "name": "Tomato", "unit": "kg" },
                { "id": 3, "name": "Onion", "unit": "kg" },
                { "id": 4, "name": "Rice", "unit": "kg" },
                { "id": 5, "name": "Chicken", "unit": "kg" }
            ],
            "history": []
        }
        write_db(default_data)
        return default_data
    
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading database: {e}")
        return {"items": [], "history": []}

def write_db(data):
    try:
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error writing database: {e}")

# API Routes - Items CRUD
@app.route('/api/items', methods=['GET', 'OPTIONS'])
def get_items():
    db = read_db()
    return jsonify(db.get('items', []))

@app.route('/api/items', methods=['POST', 'OPTIONS'])
def add_item():
    db = read_db()
    data = request.json
    if not data or not data.get('name'):
        return jsonify({"error": "Item name is required"}), 400
    
    items = db.get('items', [])
    new_id = max([item['id'] for item in items], default=0) + 1
    new_item = {
        "id": new_id,
        "name": data['name'].strip(),
        "unit": data.get('unit', 'kg').strip() or 'kg'
    }
    items.append(new_item)
    db['items'] = items
    write_db(db)
    return jsonify(new_item), 201

@app.route('/api/items/<int:item_id>', methods=['PUT', 'OPTIONS'])
def update_item(item_id):
    db = read_db()
    data = request.json
    if not data or not data.get('name'):
        return jsonify({"error": "Item name is required"}), 400
    
    items = db.get('items', [])
    for item in items:
        if item['id'] == item_id:
            item['name'] = data['name'].strip()
            item['unit'] = data.get('unit', 'kg').strip() or 'kg'
            db['items'] = items
            write_db(db)
            return jsonify(item)
            
    return jsonify({"error": "Item not found"}), 404

@app.route('/api/items/<int:item_id>', methods=['DELETE', 'OPTIONS'])
def delete_item(item_id):
    db = read_db()
    items = db.get('items', [])
    updated_items = [item for item in items if item['id'] != item_id]
    
    if len(items) == len(updated_items):
        return jsonify({"error": "Item not found"}), 404
        
    db['items'] = updated_items
    write_db(db)
    return jsonify({"success": True, "message": f"Item {item_id} deleted"})

# API Routes - History logs
@app.route('/api/history', methods=['GET', 'OPTIONS'])
def get_history():
    db = read_db()
    history = db.get('history', [])
    # Return reverse chronological order (newest reports first)
    return jsonify(history[::-1])

@app.route('/api/history', methods=['POST', 'OPTIONS'])
def add_history():
    db = read_db()
    data = request.json
    if not data or not data.get('branch') or not data.get('date') or 'items' not in data:
        return jsonify({"error": "Branch, Date, and Items list are required"}), 400
        
    history = db.get('history', [])
    new_id = max([log['id'] for log in history], default=0) + 1
    new_log = {
        "id": new_id,
        "branch": data['branch'].strip().upper(),
        "date": data['date'],
        "items": data['items'],
        "total_weight": float(data.get('total_weight', 0)),
        "created_at": request.headers.get('X-Client-Time', '')
    }
    history.append(new_log)
    db['history'] = history
    write_db(db)
    return jsonify(new_log), 201

@app.route('/api/history/<int:log_id>', methods=['DELETE', 'OPTIONS'])
def delete_history(log_id):
    db = read_db()
    history = db.get('history', [])
    updated_history = [log for log in history if log['id'] != log_id]
    
    if len(history) == len(updated_history):
        return jsonify({"error": "Log record not found"}), 404
        
    db['history'] = updated_history
    write_db(db)
    return jsonify({"success": True, "message": f"Log {log_id} deleted"})

if __name__ == '__main__':
    # Bind to all interfaces for easy testing, port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
