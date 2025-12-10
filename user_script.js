// --- 1. CONFIG & MOCK DATA (ต้องเหมือน Admin เพื่อใช้ DB เดียวกัน) ---
const DEFAULT_CONFIG = { labName: "CKLab", announcement: "Welcome" };

// ข้อมูลจำลอง API (อัปเดตชื่อคณะให้ตรงกับ Dropdown ใน Admin)
const MOCK_USERS_API = {
    "66123456": { 
        name: "นายสมชาย ใจดี", 
        faculty: "คณะวิศวกรรมศาสตร์", 
        year: "3", 
        level: "ปริญญาตรี" 
    },
    "66987654": { 
        name: "น.ส.สมหญิง รักเรียน", 
        faculty: "คณะวิทยาศาสตร์", 
        year: "2", 
        level: "ปริญญาตรี" 
    },
    "68114540353": { 
        name: "นายปภังกร นิชรัตน์", 
        faculty: "คณะวิทยาศาสตร์", 
        year: "1", 
        level: "ปริญญาตรี" 
    },
};

const DEFAULT_COMPUTERS = [
    { id: 1, name: "PC-01", status: "available", software: [1, 2, 4] },
    { id: 2, name: "PC-02", status: "available", software: [1] },
    { id: 3, name: "PC-03", status: "maintenance", software: [] }, 
    { id: 4, name: "PC-04", status: "in_use", software: [1, 3], currentUser: "นายสมชาย (Demo)", startTime: Date.now() - 3600000 }
];

// --- 2. DATABASE (LocalStorage Shared with Admin) ---
const DB = {
    getData: (key, def) => JSON.parse(localStorage.getItem(key)) || def,
    setData: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
    getPCs: () => DB.getData('ck_pcs', DEFAULT_COMPUTERS),
    savePCs: (data) => DB.setData('ck_pcs', data),
    getLogs: () => DB.getData('ck_logs', []),
    saveLog: (log) => {
        let logs = DB.getLogs();
        logs.push({ ...log, timestamp: new Date().toISOString() });
        DB.setData('ck_logs', logs);
    },
    getConfig: () => DB.getData('ck_config', DEFAULT_CONFIG),
    getSession: () => JSON.parse(localStorage.getItem('ck_session')),
    setSession: (data) => localStorage.setItem('ck_session', JSON.stringify(data)),
    clearSession: () => localStorage.removeItem('ck_session')
};

// --- 3. HELPER FUNCTIONS ---
function updatePCStatus(pcId, status, user = null) {
    let pcs = DB.getPCs();
    let pc = pcs.find(p => p.id == pcId);
    if (pc) {
        pc.status = status;
        pc.currentUser = user;
        pc.startTime = (status === 'in_use') ? Date.now() : null;
        DB.savePCs(pcs);
    }
}

function mockApiCheck(id) { 
    return MOCK_USERS_API[id] || null; 
}

// --- 4. USER UI LOGIC (ควบคุมหน้า user.html) ---

let tempUser = null;
let currentRate = 5;

document.addEventListener('DOMContentLoaded', () => {
    // โหลดรายชื่อเครื่องใส่ Simulation Bar
    const pcs = DB.getPCs();
    const simSelect = document.getElementById('simPC');
    if (simSelect) {
        pcs.forEach(pc => {
            simSelect.innerHTML += `<option value="${pc.id}">${pc.name} (${pc.status})</option>`;
        });
    }

    // ตรวจสอบว่ามี Session ค้างหรือไม่ (เช่น กด Refresh ตอนใช้งานอยู่)
    const session = DB.getSession();
    if(session) {
        // ถ้ามี Session ค้าง ให้ข้ามไปหน้า Timer เลย
        goToStep(3);
        startTimer(session.startTime);
        
        // อัปเดตชื่อเครื่องที่หน้าจอ
        const currentPC = pcs.find(p => p.id == session.pcId);
        if(currentPC) document.getElementById('currentPCDisplay').innerText = currentPC.name;
        
        // ล็อค Simulation Bar ให้ตรงกับเครื่องที่นั่ง
        if(simSelect) {
            simSelect.value = session.pcId;
            simSelect.disabled = true;
        }
    }
});

// ฟังก์ชันสลับหน้า (Step 1 -> 2 -> 3 -> 4)
function goToStep(step) {
    document.querySelectorAll('.step-section').forEach(el => el.classList.remove('active'));
    document.getElementById('step' + step).classList.add('active');
}

// ฟังก์ชันสลับแท็บ ผู้ใช้ภายใน/ภายนอก
function switchTab(type) {
    document.getElementById('formInternal').style.display = (type === 'internal') ? 'block' : 'none';
    document.getElementById('formExternal').style.display = (type === 'external') ? 'block' : 'none';
    document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

// ตรวจสอบสิทธิ์ (ผู้ใช้ภายใน)
function checkInternal() {
    const id = document.getElementById('intId').value;
    const user = mockApiCheck(id); // เรียก API จำลอง
    
    if(user) {
        // แสดงผลข้อมูลตาม Flow
        document.getElementById('apiName').innerText = user.name;
        document.getElementById('apiFac').innerText = user.faculty;
        document.getElementById('apiYear').innerText = user.year;
        document.getElementById('apiLevel').innerText = user.level;
        
        document.getElementById('apiResult').style.display = 'block';
        tempUser = { type: 'internal', ...user };
    } else {
        alert('ไม่พบข้อมูล (Hint: ลองใช้รหัส 66123456)');
        document.getElementById('apiResult').style.display = 'none';
    }
}

// ตรวจสอบสิทธิ์ (ผู้ใช้ภายนอก)
function checkExternal() {
    const card = document.getElementById('extCard').value;
    const name = document.getElementById('extName').value;
    const org = document.getElementById('extOrg').value;
    
    if(card && name && org) {
        tempUser = { type: 'external', name: name, faculty: org, level: 'Guest', year: '-' };
        goToStep(2); // ไปหน้า Input Data
        document.getElementById('showUserName').innerText = name;
    } else {
        alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    }
}

// ยืนยันการ Check-in
function confirmCheckIn() {
    const pcId = document.getElementById('simPC').value; // เอา ID จาก Simulation Bar
    const targetPC = DB.getPCs().find(p => p.id == pcId);
    
    // ตรวจสอบว่าเครื่องว่างไหม
    if(targetPC.status !== 'available') {
        return alert('เครื่องนี้ไม่ว่าง (กรุณาเลือกเครื่องอื่นในแถบ Simulation ด้านบน)');
    }

    // 1. เปลี่ยนสถานะเครื่องเป็น In-use
    updatePCStatus(pcId, 'in_use', tempUser.name);

    // 2. สร้าง Session การใช้งาน
    const bookingType = document.getElementById('bookingType').value;
    const newSession = {
        ...tempUser,
        pcId: pcId,
        bookingType: bookingType, // เก็บค่า Walk-in หรือ Booking
        startTime: Date.now()
    };
    DB.setSession(newSession);

    // 3. บันทึก Log
    DB.saveLog({ 
        action: 'Check-in', 
        user: tempUser.name, 
        faculty: tempUser.faculty, 
        pcId: pcId,
        bookingType: bookingType
    });

    // ไปหน้า Timer
    document.getElementById('currentPCDisplay').innerText = targetPC.name;
    document.getElementById('simPC').disabled = true; // ล็อคเครื่องไม่ให้เปลี่ยนตอนใช้
    startTimer(newSession.startTime);
    goToStep(3);
}

// ตัวนับเวลา
function startTimer(startTime) {
    setInterval(() => {
        const diff = Date.now() - startTime;
        const h = Math.floor(diff / 3600000).toString().padStart(2,'0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2,'0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2,'0');
        const timerEl = document.getElementById('timer');
        if(timerEl) timerEl.innerText = `${h}:${m}:${s}`;
    }, 1000);
}

// จัดการ Feedback
function setRate(r) { 
    currentRate = r; 
    document.getElementById('rateDisplay').innerText = r; 
}

function submitFeedback() {
    const s = DB.getSession();
    if(s) {
        // 1. เปลี่ยนสถานะเครื่องกลับเป็น Available
        updatePCStatus(s.pcId, 'available');
        
        // 2. บันทึก Log Check-out
        DB.saveLog({ 
            action: 'Check-out', 
            user: s.name, 
            faculty: s.faculty, 
            pcId: s.pcId, 
            rating: currentRate 
        });
        
        // 3. ล้าง Session
        DB.clearSession();
    }
    alert('ขอบคุณที่ใช้บริการ');
    location.reload(); // รีเฟรชกลับไปหน้าแรก
}