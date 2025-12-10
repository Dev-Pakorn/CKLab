// --- 1. CONFIG & MOCK DATA ---
const DEFAULT_SOFTWARE = [
    { id: 1, name: "Microsoft Office", version: "2021" },
    { id: 2, name: "Python", version: "3.11" },
    { id: 3, name: "Adobe Photoshop", version: "2024" },
    { id: 4, name: "Visual Studio Code", version: "Latest" }
];

const DEFAULT_COMPUTERS = [
    { id: 1, name: "PC-01", status: "available", software: [1, 2, 4] },
    { id: 2, name: "PC-02", status: "available", software: [1] },
    { id: 3, name: "PC-03", status: "maintenance", software: [] }, 
    { id: 4, name: "PC-04", status: "in_use", software: [1, 3], currentUser: "นายสมชาย (Demo)", startTime: Date.now() - 3600000 }
];

const DEFAULT_CONFIG = {
    labName: "ห้องปฏิบัติการคอมพิวเตอร์ CKLab",
    announcement: "ยินดีต้อนรับสู่ CKLab เปิดให้บริการ จันทร์-ศุกร์ 08.00 - 20.00 น."
};

// --- 2. DATABASE (LocalStorage) ---
const DB = {
    getData: (key, def) => JSON.parse(localStorage.getItem(key)) || def,
    setData: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
    getPCs: () => DB.getData('ck_pcs', DEFAULT_COMPUTERS),
    savePCs: (data) => DB.setData('ck_pcs', data),
    getSoft: () => DB.getData('ck_soft', DEFAULT_SOFTWARE),
    saveSoft: (data) => DB.setData('ck_soft', data),
    getLogs: () => DB.getData('ck_logs', []),
    saveLog: (log) => {
        let logs = DB.getLogs();
        logs.push({ ...log, timestamp: new Date().toISOString() });
        DB.setData('ck_logs', logs);
    },
    getConfig: () => DB.getData('ck_config', DEFAULT_CONFIG),
    saveConfig: (data) => DB.setData('ck_config', data)
};

// Helper Update Status
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

// --- ADMIN UI LOGIC ---

// Login
function checkLogin() {
    if(document.getElementById('loginUser').value === 'admin' && document.getElementById('loginPass').value === '1234') {
        document.getElementById('loginOverlay').style.display = 'none';
        renderMonitor();
        setInterval(renderMonitor, 2000);
    } else alert('รหัสผิด (admin/1234)');
}

// Monitor
function renderMonitor() {
    const grid = document.getElementById('monitorGrid');
    if(!grid) return;
    grid.innerHTML = '';
    const pcs = DB.getPCs().sort((a,b) => a.id - b.id);
    
    pcs.forEach(p => {
        let color = p.status === 'in_use' ? 'in_use' : (p.status==='maintenance'?'maintenance':(p.status==='reserved'?'reserved':'available'));
        let userText = p.currentUser ? `<small class="d-block mt-1 bg-dark bg-opacity-25 px-2 rounded">${p.currentUser}</small>` : '';
        let btn = p.status === 'in_use' ? `<button onclick="forceOut(${p.id})" class="btn btn-sm btn-light text-danger fw-bold mt-2 py-0">Force Out</button>` : '';
        let action = p.status === 'available' ? `onclick="adminCheckIn(${p.id})"` : '';
        
        grid.innerHTML += `
        <div class="col-md-3">
            <div class="pc-box ${color}" ${action}>
                <h4 class="m-0">${p.name}</h4>
                <span class="badge bg-white text-dark mt-1">${p.status}</span>
                ${userText} ${btn}
            </div>
        </div>`;
    });
}
function forceOut(id) { if(confirm('Force Checkout?')) { updatePCStatus(id, 'available'); renderMonitor(); } }
function adminCheckIn(id) { 
    let stdId = prompt("Admin Check-in: กรอกรหัสนักศึกษา");
    if(stdId) { updatePCStatus(id, 'in_use', `Admin for ${stdId}`); renderMonitor(); }
}

// Manage PC
let modalPC;
document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('modalPC')) modalPC = new bootstrap.Modal(document.getElementById('modalPC'));
    if(document.getElementById('modalSoft')) modalSoft = new bootstrap.Modal(document.getElementById('modalSoft'));
});

function renderPCList() {
    const softs = DB.getSoft();
    const tb = document.getElementById('pcTable'); tb.innerHTML = '';
    const pcs = DB.getPCs().sort((a,b) => a.id - b.id);

    pcs.forEach(p => {
        let sNames = p.software.map(sid => softs.find(x=>x.id==sid)?.name).filter(Boolean).join(', ');
        let statusBadge = p.status == 'available' ? 'success' : (p.status == 'in_use' ? 'danger' : 'secondary');
        
        tb.innerHTML += `<tr>
            <td>${p.id}</td><td><b>${p.name}</b></td>
            <td><span class="badge bg-${statusBadge}">${p.status}</span></td>
            <td><small class="text-muted">${sNames}</small></td>
            <td>
                <button onclick="openPCModal(${p.id})" class="btn btn-sm btn-warning">แก้ไข</button>
                <button onclick="delPC(${p.id})" class="btn btn-sm btn-outline-danger">ลบ</button>
            </td>
        </tr>`;
    });
}

function openPCModal(id = null) {
    document.getElementById('editPcId').value = id || '';
    document.getElementById('pcModalTitle').innerText = id ? 'แก้ไขเครื่อง' : 'เพิ่มเครื่องใหม่';
    
    const pc = id ? DB.getPCs().find(p => p.id == id) : null;
    document.getElementById('inpPcName').value = pc ? pc.name : '';
    document.getElementById('inpPcStatus').value = pc ? pc.status : 'available';

    const list = document.getElementById('pcSoftList'); list.innerHTML = '';
    DB.getSoft().forEach(s => {
        let checked = (pc && pc.software.includes(s.id)) ? 'checked' : '';
        list.innerHTML += `<div class="form-check"><input class="form-check-input pc-soft-chk" type="checkbox" value="${s.id}" ${checked}> <label class="form-check-label">${s.name}</label></div>`;
    });
    modalPC.show();
}

function savePC() {
    const id = document.getElementById('editPcId').value;
    const name = document.getElementById('inpPcName').value;
    const status = document.getElementById('inpPcStatus').value;
    const softs = Array.from(document.querySelectorAll('.pc-soft-chk:checked')).map(c => parseInt(c.value));
    
    let pcs = DB.getPCs();
    if(id) { 
        let p = pcs.find(x => x.id == id);
        if(p) { p.name = name; p.status = status; p.software = softs; }
    } else { 
        const maxId = pcs.length > 0 ? Math.max(...pcs.map(p => p.id)) : 0;
        pcs.push({ id: maxId + 1, name, status: status, software: softs });
    }
    DB.savePCs(pcs); modalPC.hide(); renderPCList(); renderMonitor();
}

function delPC(id) { if(confirm('ยืนยันการลบ?')) { DB.savePCs(DB.getPCs().filter(x=>x.id!=id)); renderPCList(); renderMonitor(); } }

// Manage Software
let modalSoft;
function renderSoftList() {
    const tb = document.getElementById('softTable'); tb.innerHTML = '';
    DB.getSoft().forEach(s => {
        tb.innerHTML += `<tr><td>${s.id}</td><td>${s.name}</td><td>${s.version}</td>
        <td><button onclick="openSoftModal(${s.id})" class="btn btn-sm btn-warning">แก้ไข</button> <button onclick="delSoft(${s.id})" class="btn btn-sm btn-outline-danger">ลบ</button></td></tr>`;
    });
}
function openSoftModal(id = null) {
    document.getElementById('editSoftId').value = id || '';
    document.getElementById('softModalTitle').innerText = id ? 'แก้ไขซอฟต์แวร์' : 'เพิ่มซอฟต์แวร์';
    const s = id ? DB.getSoft().find(x => x.id == id) : null;
    document.getElementById('inpSoftName').value = s ? s.name : '';
    document.getElementById('inpSoftVer').value = s ? s.version : '';
    modalSoft.show();
}
function saveSoft() {
    const id = document.getElementById('editSoftId').value;
    const name = document.getElementById('inpSoftName').value;
    const ver = document.getElementById('inpSoftVer').value;
    let list = DB.getSoft();
    if(id) { let s = list.find(x => x.id == id); if(s) { s.name = name; s.version = ver; } }
    else { 
         const maxId = list.length > 0 ? Math.max(...list.map(s => s.id)) : 0;
         list.push({ id: maxId + 1, name, version: ver }); 
    }
    DB.saveSoft(list); modalSoft.hide(); renderSoftList();
}
function delSoft(id) { if(confirm('ยืนยันลบ?')) { DB.saveSoft(DB.getSoft().filter(x=>x.id!=id)); renderSoftList(); } }

// --- 4. REPORT & CSV (แก้ไขกราฟให้ตรง Flow: แยกตามคณะ) ---
let chartInstance;
function renderReport() {
    const logs = DB.getLogs();
    const start = document.getElementById('dStart').value;
    const end = document.getElementById('dEnd').value;
    const fac = document.getElementById('filterFac').value;
    const type = document.getElementById('filterType').value;
    const year = document.getElementById('filterYear').value;

    // 1. กรองข้อมูล (Filter)
    const filtered = logs.filter(l => {
        const d = l.timestamp.split('T')[0];
        if(start && d < start) return false;
        if(end && d > end) return false;
        if(fac && l.faculty !== fac) return false;
        if(type && l.type !== type && (!l.type && type === 'internal')) return false;
        if(year && l.year !== year) return false;
        return true;
    });

    // 2. จัดกลุ่มข้อมูลเพื่อทำกราฟ (Group by Faculty)
    const facultyCounts = {};
    filtered.forEach(log => {
        // นับเฉพาะการ Check-in (เข้าใช้งาน)
        if(log.action === 'Check-in') {
            const key = log.faculty || 'ไม่ระบุ';
            facultyCounts[key] = (facultyCounts[key] || 0) + 1;
        }
    });

    // 3. วาด Chart (จำนวนผู้ใช้ แยกตามคณะ)
    const ctx = document.getElementById('chart');
    if(chartInstance) chartInstance.destroy();
    
    // ถ้าไม่มีข้อมูล ให้สร้าง Mock กราฟว่างๆ หรือแจ้งเตือน
    const labels = Object.keys(facultyCounts);
    const data = Object.values(facultyCounts);

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length > 0 ? labels : ['ไม่มีข้อมูล'],
            datasets: [{ 
                label: 'จำนวนผู้ใช้งาน (แยกตามคณะ)', 
                data: data.length > 0 ? data : [0], 
                backgroundColor: '#0d6efd',
                borderColor: '#0a58ca',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });

    // 4. แสดงข้อมูลในตาราง (Log Table)
    const tbody = document.getElementById('logTableBody');
    if(tbody) {
        tbody.innerHTML = '';
        filtered.slice().reverse().slice(0, 50).forEach(log => {
            const timeStr = new Date(log.timestamp).toLocaleString('th-TH');
            const pcName = DB.getPCs().find(p=>p.id==log.pcId)?.name || log.pcId;
            const actionBadge = log.action === 'Check-in' ? '<span class="badge bg-primary">เข้า</span>' : '<span class="badge bg-success">ออก</span>';
            
            tbody.innerHTML += `
                <tr>
                    <td class="text-center"><small>${timeStr}</small></td>
                    <td>${log.user || '-'}</td>
                    <td class="text-center">${actionBadge}</td>
                    <td class="text-center">${pcName}</td>
                    <td><small>${log.faculty || '-'}</small></td>
                </tr>
            `;
        });
    }
}

// Export CSV (รองรับภาษาไทย)
function realExportCSV() {
    const logs = DB.getLogs();
    if(logs.length === 0) return alert('ไม่มีข้อมูลให้ Export');
    let csvContent = "Timestamp,Action,User,Faculty,Type,Year,PC,Rating\n";
    logs.forEach(row => {
        const clean = (text) => text ? `"${text.toString().replace(/"/g, '""')}"` : "";
        csvContent += `${row.timestamp},${row.action},${clean(row.user)},${clean(row.faculty)},${clean(row.type)},${clean(row.year)},${row.pcId||''},${row.rating||''}\n`;
    });
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "cklab_report.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Config
function loadConfig() {
    const c = DB.getConfig();
    document.getElementById('confName').value = c.labName;
    document.getElementById('confAnnounce').value = c.announcement;
}
function saveConfig() {
    DB.saveConfig({ labName: document.getElementById('confName').value, announcement: document.getElementById('confAnnounce').value });
    alert('บันทึกการตั้งค่าแล้ว');
}