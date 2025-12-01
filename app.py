from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import requests
import json
import base64
import os

app = Flask(__name__, template_folder='templates', static_folder='static')

# กัน Cache
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///lab.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- Model ---
class AccessLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    std_id = db.Column(db.String(20), nullable=False)
    faculty = db.Column(db.String(100))
    year = db.Column(db.String(10))
    user_type = db.Column(db.String(20)) 
    desk = db.Column(db.String(10))
    purpose = db.Column(db.String(50))
    check_in = db.Column(db.DateTime, default=datetime.now)
    check_out = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default='active')

with app.app_context():
    db.create_all()

# --- Routes ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin():
    return render_template('admin.html')

# --- API Endpoints ---

# 🌟 API ตัวกลางสำหรับดึงข้อมูล UBU
@app.route('/api/student-info/<string:std_id>', methods=['GET'])
def get_student_info(std_id):
    url = "https://esapi.ubu.ac.th/api/v1/student/reg-data"
    
    try:
        # Logic การเข้ารหัสตามที่คุณให้มา
        encoded_id = base64.b64encode(std_id.encode()).decode()
        payload = json.dumps({ "loginName": encoded_id })
        headers = { 'Content-Type': 'application/json' }
        
        # ยิงไปที่ UBU API (ตั้ง timeout 5 วินาที เผื่อ VPN ช้า)
        response = requests.post(url, headers=headers, data=payload, timeout=5)
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            print(f"UBU API Error: {response.status_code}")
            return jsonify({'error': 'Student not found or API Error'}), 404
            
    except requests.exceptions.ConnectionError:
        print("Error: Connect to UBU API failed. (Check VPN?)")
        return jsonify({'error': 'Connection Failed (Check VPN)'}), 500
    except Exception as e:
        print(f"Server Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/logs', methods=['GET'])
def get_logs():
    logs = AccessLog.query.order_by(AccessLog.check_in.desc()).all()
    output = []
    for log in logs:
        output.append({
            'id': log.id,
            'name': log.name,
            'stdId': log.std_id,
            'faculty': log.faculty,
            'year': log.year,
            'type': log.user_type,
            'desk': log.desk,
            'checkIn': log.check_in.strftime('%H:%M'),
            'checkOut': log.check_out.strftime('%H:%M') if log.check_out else '-',
            'status': log.status,
            'date': log.check_in.strftime('%Y-%m-%d'),
            'purpose': log.purpose
        })
    return jsonify(output)

@app.route('/api/checkin', methods=['POST'])
def checkin():
    data = request.json
    new_log = AccessLog(
        name=data['name'],
        std_id=data['stdId'],
        faculty=data['faculty'],
        year=data['year'],
        user_type=data['type'],
        desk=data['desk'],
        purpose=data['purpose']
    )
    db.session.add(new_log)
    db.session.commit()
    return jsonify({'message': 'Check-in Success', 'time': new_log.check_in.strftime('%H:%M')})

@app.route('/api/checkout/<int:id>', methods=['POST'])
def checkout(id):
    log = AccessLog.query.get(id)
    if log:
        log.status = 'completed'
        log.check_out = datetime.now()
        db.session.commit()
        return jsonify({'message': 'Check-out Success'})
    return jsonify({'message': 'Error'}), 404

# ป้องกัน Cache
@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    return response

if __name__ == '__main__':
    app.run(debug=True)