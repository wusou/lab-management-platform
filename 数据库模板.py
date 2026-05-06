from flask import Flask, request, jsonify
import sqlite3
from datetime import datetime
 
app = Flask(__name__)
DATABASE = 'lab.db'

# 数据库连接
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

# 初始化表
def init_db():
    conn = get_db()
    c = conn.cursor()

    # 用户
    c.execute('''CREATE TABLE IF NOT EXISTS user
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                 username TEXT UNIQUE, password TEXT, real_name TEXT, role TEXT)''')

    # 项目
    c.execute('''CREATE TABLE IF NOT EXISTS project
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                 name TEXT, leader_id INTEGER, status TEXT)''')

    # 实验记录
    c.execute('''CREATE TABLE IF NOT EXISTS experiment
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                 project_id INTEGER, title TEXT, content TEXT, experimenter_id INTEGER, create_time TEXT)''')

    # 设备
    c.execute('''CREATE TABLE IF NOT EXISTS equipment
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                 name TEXT, model TEXT, status TEXT, manager_id INTEGER)''')

    # 预约
    c.execute('''CREATE TABLE IF NOT EXISTS reserve
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                 equipment_id INTEGER, user_id INTEGER, start_time TEXT, end_time TEXT, reason TEXT, status TEXT)''')

    # 耗材
    c.execute('''CREATE TABLE IF NOT EXISTS material
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                 name TEXT, spec TEXT, stock INTEGER, warn_stock INTEGER, unit TEXT)''')

    conn.commit()
    conn.close()

# ====================== 用户接口 ======================
@app.route('/user/add', methods=['POST'])
def add_user():
    data = request.json
    conn = get_db()
    conn.execute('INSERT INTO user (username,password,real_name,role) VALUES (?,?,?,?)',
                 (data['username'], data['password'], data['real_name'], data['role']))
    conn.commit()
    conn.close()
    return jsonify({"msg": "ok"})

@app.route('/user/list')
def list_user():
    conn = get_db()
    users = conn.execute('SELECT * FROM user').fetchall()
    conn.close()
    return jsonify([dict(u) for u in users])

# ====================== 项目接口 ======================
@app.route('/project/add', methods=['POST'])
def add_project():
    data = request.json
    conn = get_db()
    conn.execute('INSERT INTO project (name, leader_id, status) VALUES (?,?,?)',
                 (data['name'], data['leader_id'], 'doing'))
    conn.commit()
    conn.close()
    return jsonify({"msg":"ok"})

@app.route('/project/list')
def list_project():
    conn = get_db()
    projects = conn.execute('SELECT * FROM project').fetchall()
    conn.close()
    return jsonify([dict(p) for p in projects])

# ====================== 实验记录 ======================
@app.route('/exp/add', methods=['POST'])
def add_exp():
    data = request.json
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    conn = get_db()
    conn.execute('INSERT INTO experiment (project_id, title, content, experimenter_id, create_time) VALUES (?,?,?,?,?)',
                 (data['project_id'], data['title'], data['content'], data['experimenter_id'], now))
    conn.commit()
    conn.close()
    return jsonify({"msg":"ok"})

@app.route('/exp/list')
def list_exp():
    conn = get_db()
    exps = conn.execute('SELECT * FROM experiment').fetchall()
    conn.close()
    return jsonify([dict(e) for e in exps])

# ====================== 设备 ======================
@app.route('/equipment/add', methods=['POST'])
def add_equipment():
    data = request.json
    conn = get_db()
    conn.execute('INSERT INTO equipment (name, model, status, manager_id) VALUES (?,?,?,?)',
                 (data['name'], data['model'], 'idle', data['manager_id']))
    conn.commit()
    conn.close()
    return jsonify({"msg":"ok"})

@app.route('/equipment/list')
def list_equipment():
    conn = get_db()
    eq = conn.execute('SELECT * FROM equipment').fetchall()
    conn.close()
    return jsonify([dict(e) for e in eq])

# ====================== 预约 ======================
@app.route('/reserve/add', methods=['POST'])
def add_reserve():
    data = request.json
    conn = get_db()
    conn.execute('INSERT INTO reserve (equipment_id, user_id, start_time, end_time, reason, status) VALUES (?,?,?,?,?,?)',
                 (data['equipment_id'], data['user_id'], data['start_time'], data['end_time'], data['reason'], 'pending'))
    conn.commit()
    conn.close()
    return jsonify({"msg":"ok"})

@app.route('/reserve/list')
def list_reserve():
    conn = get_db()
    rs = conn.execute('SELECT * FROM reserve').fetchall()
    conn.close()
    return jsonify([dict(r) for r in rs])

# ====================== 耗材 ======================
@app.route('/material/add', methods=['POST'])
def add_material():
    data = request.json
    conn = get_db()
    conn.execute('INSERT INTO material (name, spec, stock, warn_stock, unit) VALUES (?,?,?,?,?)',
                 (data['name'], data['spec'], data['stock'], data['warn_stock'], data['unit']))
    conn.commit()
    conn.close()
    return jsonify({"msg":"ok"})

@app.route('/material/list')
def list_material():
    conn = get_db()
    ms = conn.execute('SELECT * FROM material').fetchall()
    conn.close()
    return jsonify([dict(m) for m in ms])

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=9966, debug=True)
