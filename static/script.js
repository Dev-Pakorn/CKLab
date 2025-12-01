// --- script.js (Final Version: Monitor + Report + User + Admin Check-in Purpose) ---

const STORAGE_KEY = 'lab_access_db_v2';
const DESK_CONFIG_KEY = 'lab_desk_config';
const APP_CONFIG_KEY = 'lab_app_config';

// Global Variables
let dbData = [];
let deskConfig = {}; 
// 🌟 Config เริ่มต้น
let appConfig = {
    zones: [{ id: 'A', count: 20 }, { id: 'B', count: 20 }, { id: 'C', count: 20 }],
    softwareList: [
        "ChatGPT+", "Claude Pro", "Perplexity Pro", "Midjourney Basic", 
        "SciSpace Premium", "Grammarly Pro", "Botnoi VOICE", "Gramma Pro", "Canva Pro"
    ]
};
let chartInstance = null;
let aiChartInstance = null;
let currentSortCol = 'checkIn';
let currentSortDir = 'desc';
let currentMonitorView = 'table'; 
let currentEditingDesk = null;

// ============================================
// 1. API CONNECTION & CONFIG LOAD
// ============================================
async function loadAllData() {
    try {
        // 1. โหลด Config (App & Desk) จาก LocalStorage
        const storedApp = localStorage.getItem(APP_CONFIG_KEY);
        if (storedApp) {
            const parsed = JSON.parse(storedApp);
            if (parsed.zones && parsed.zones.length > 0) appConfig.zones = parsed.zones;
            if (parsed.softwareList && parsed.softwareList.length > 0) appConfig.softwareList = parsed.softwareList;
        }
        
        const storedDesk = localStorage.getItem(DESK_CONFIG_KEY);
        if (storedDesk) deskConfig = JSON.parse(storedDesk);

        // 2. โหลด Logs จาก Server
        const response = await fetch(`/api/logs?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Error loading data:', error);
        return [];
    }
}

async function fetchStudentInfo(stdId) {
    try {
        const response = await fetch(`/api/student-info/${stdId}`);
        if (response.ok) return await response.json();
    } catch (error) {}
    return null;
}

async function apiCheckIn(payload) {
    try {
        const response = await fetch('/api/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (error) { return null; }
}

async function apiCheckOut(id) {
    try { await fetch(`/api/checkout/${id}`, { method: 'POST' }); } 
    catch (error) {}
}

// ============================================
// 2. ADMIN INIT
// ============================================
if (document.getElementById('viewMonitor')) {
    document.addEventListener('DOMContentLoaded', async () => {
        console.log("Admin Dashboard Loaded");
        dbData = await loadAllData();
        
        populateDropdowns();
        // renderConfigUI(); // ไม่แสดง Config UI ตามที่ขอ
        renderMonitorData();
        
        if(document.getElementById('statActive')) updateStats();

        const dateInput = document.getElementById('reportDate');
        if(dateInput) dateInput.valueAsDate = new Date();
        
        if (typeof Chart !== 'undefined') {
            initChart();
            initAIChart(); 
            updateReport();
        }

        setInterval(async () => {
            if(!document.getElementById('viewMonitor').classList.contains('hidden')){
                const modal = document.getElementById('deskModal');
                if (!modal || !modal.classList.contains('show')) {
                    const searchVal = document.getElementById('searchInput') ? document.getElementById('searchInput').value : '';
                    if(!searchVal) {
                        dbData = await loadAllData(); 
                        renderMonitorData();
                        updateStats();
                    }
                }
            }
        }, 5000);
    });
}

// ============================================
// 3. ADMIN: TAB & VIEW SWITCHING
// ============================================
function switchAdminTab(tabName) {
    const viewMonitor = document.getElementById('viewMonitor');
    const viewReport = document.getElementById('viewReport');
    const btnMonitor = document.getElementById('tabBtnMonitor');
    const btnReport = document.getElementById('tabBtnReport');

    if (!viewMonitor || !viewReport) return;

    if (tabName === 'monitor') {
        viewMonitor.classList.remove('hidden');
        viewReport.classList.add('hidden');
        btnMonitor.classList.remove('btn-outline'); btnMonitor.classList.add('btn-primary');
        btnReport.classList.remove('btn-primary'); btnReport.classList.add('btn-outline');
        
        loadAllData().then(data => { 
            dbData = data; 
            renderMonitorData(); 
        });
    } else {
        viewMonitor.classList.add('hidden');
        viewReport.classList.remove('hidden');
        btnMonitor.classList.remove('btn-primary'); btnMonitor.classList.add('btn-outline');
        btnReport.classList.remove('btn-outline'); btnReport.classList.add('btn-primary');
        
        loadAllData().then(data => { 
            dbData = data; 
            updateReport(); 
            setTimeout(() => {
                if (chartInstance) chartInstance.resize();
                if (aiChartInstance) aiChartInstance.resize();
            }, 50);
        });
    }
}

function switchMonitorView(view) {
    currentMonitorView = view;
    document.getElementById('btnViewTable').classList.toggle('active', view === 'table');
    document.getElementById('btnViewMap').classList.toggle('active', view === 'map');
    
    const tableWrapper = document.getElementById('monitorTableViewWrapper');
    const mapView = document.getElementById('monitorMapView');

    if (view === 'table') {
        if(tableWrapper) tableWrapper.classList.remove('hidden');
        if(mapView) mapView.classList.add('hidden');
    } else {
        if(tableWrapper) tableWrapper.classList.add('hidden');
        if(mapView) mapView.classList.remove('hidden');
    }
    renderMonitorData();
}

function renderMonitorData() {
    if (currentMonitorView === 'table') {
        renderMonitorTable();
    } else {
        renderDeskMap();
    }
    updateStats();
}

// ============================================
// 4. MAP RENDER & DESK MANAGEMENT
// ============================================
function renderDeskMap() {
    const container = document.getElementById('deskMapContainer');
    if(!container) return;
    container.innerHTML = '';

    const activeUsers = dbData.filter(u => u.status === 'active');
    const zones = (appConfig.zones && appConfig.zones.length > 0) 
                  ? appConfig.zones 
                  : [{ id: 'A', count: 20 }, { id: 'B', count: 20 }, { id: 'C', count: 20 }];

    zones.forEach(zone => {
        const zoneDiv = document.createElement('div');
        zoneDiv.className = 'zone-container';
        zoneDiv.innerHTML = `<div class="zone-title">โซน ${zone.id} <span style="font-size:0.8rem; font-weight:400;">(${zone.count} ที่นั่ง)</span></div>`;
        const grid = document.createElement('div');
        grid.className = 'desk-grid';

        for (let i = 1; i <= zone.count; i++) {
            const deskId = `${zone.id}-${i.toString().padStart(2, '0')}`;
            
            const user = activeUsers.find(u => u.desk === deskId || u.desk === `${zone.id}-${i}`);
            const config = deskConfig[deskId] || {};
            const isMaintenance = config.status === 'maintenance';

            const deskItem = document.createElement('div');
            let statusClass = '', statusText = 'ว่าง', textColor = '#64748b';
            
            if (user) { 
                statusClass = 'active'; statusText = 'ใช้งาน'; textColor = '#166534';
            } else if (isMaintenance) { 
                statusClass = 'maintenance'; statusText = 'ปิดซ่อม'; textColor = '#991b1b';
            }

            deskItem.className = `desk-item ${statusClass}`;
            // โต๊ะว่างหรือซ่อมคลิกได้เพื่อจัดการ / โต๊ะมีคนคลิกเพื่อดูข้อมูลหรือ check-out
            deskItem.onclick = () => openDeskModal(deskId, user, config);

            let innerHTML = `<div class="desk-id" style="color:${textColor}">${deskId}</div><div class="desk-status">${statusText}</div>`;
            
            if (user) {
                innerHTML += `<div class="desk-user">${user.name}</div>`;
                if (user.purpose && user.purpose.startsWith('AI')) {
                    let toolName = user.purpose.split(':')[1]?.trim() || 'AI';
                    innerHTML += `<div class="desk-software-tag" style="background:#f3e8ff; color:#7e22ce; border:1px solid #d8b4fe;">🤖 ${toolName}</div>`;
                }
            } 
            // ลบส่วนแสดง Software Tag ออก เพราะเราเปลี่ยนเป็น Purpose Selector แล้ว

            deskItem.innerHTML = innerHTML;
            grid.appendChild(deskItem);
        }
        zoneDiv.appendChild(grid);
        container.appendChild(zoneDiv);
    });
}

// 🌟 ฟังก์ชันจัดการการแสดงผล Dropdown AI ใน Admin Modal
function toggleAdminAiSelect(isAi) {
    const select = document.getElementById('adminAiTool');
    if (select) {
        if (isAi) select.classList.remove('hidden');
        else select.classList.add('hidden');
    }
}

// 🌟 OPEN MODAL (Updated for Purpose Selection)
function openDeskModal(deskId, user, config) {
    currentEditingDesk = deskId;
    const modal = document.getElementById('deskModal');
    document.getElementById('modalDeskId').innerText = deskId;
    
    const statusSelect = document.getElementById('deskStatusSelect');
    const userInfoSec = document.getElementById('userInfoSection');
    const btnCheckout = document.getElementById('btnForceCheckout');

    // ส่วน Container ที่เคยเป็น Checkbox เดิม
    const container = document.getElementById('modalSoftwareCheckboxes');
    // เปลี่ยน Label (ถ้าทำได้ผ่าน JS หรือแก้ใน HTML ถาวร)
    const containerWrapper = container ? container.closest('.mb-4') : null;

    if (user) {
        // --- กรณีมีผู้ใช้งาน (Occupied) ---
        statusSelect.value = 'occupied';
        statusSelect.disabled = true; 
        
        userInfoSec.classList.remove('hidden');
        userInfoSec.innerHTML = `
            <p class="text-sm text-light">ผู้ใช้งานปัจจุบัน:</p>
            <p class="font-bold" style="color: #166534; font-size: 1.1rem; margin-bottom:5px;">${user.name}</p>
            <p class="text-sm">ID: <span style="font-family:monospace;">${user.stdId}</span></p>
            <p class="text-sm">เวลาเข้า: ${user.checkIn}</p>
            <p class="text-sm" style="color:${user.purpose.startsWith('AI')?'#9333ea':'#0369a1'}">วัตถุประสงค์: ${user.purpose}</p>
            <button onclick="forceCheckoutFromModal(${user.id})" class="btn btn-sm btn-outline" style="width:100%; margin-top:10px; color:var(--danger); border-color:var(--danger);">
                ออกจากระบบ (Check-out)
            </button>
        `;
        
        // ซ่อนส่วนเลือกวัตถุประสงค์ เพราะมีคนนั่งแล้ว
        if (containerWrapper) containerWrapper.classList.add('hidden');

    } else {
        // --- กรณีโต๊ะว่าง (Available/Maintenance) ---
        statusSelect.disabled = false;
        statusSelect.value = config.status === 'maintenance' ? 'maintenance' : 'available';
        
        userInfoSec.classList.remove('hidden');
        // Form Admin Check-in
        userInfoSec.innerHTML = `
            <div style="border-top:1px dashed #ddd; padding-top:10px; margin-top:5px;">
                <p class="font-bold text-sm mb-2" style="color:var(--primary);">Admin Check-in (เพิ่มผู้ใช้)</p>
                <input type="text" id="adminAddName" class="input-field" placeholder="ชื่อ-สกุล" style="width:100%; padding:8px; margin-bottom:5px; font-size:0.9rem;">
                <input type="text" id="adminAddId" class="input-field" placeholder="รหัส/เบอร์โทร" style="width:100%; padding:8px; margin-bottom:5px; font-size:0.9rem;">
                <select id="adminAddType" class="input-field" style="width:100%; padding:8px; font-size:0.9rem;">
                    <option value="student">นักศึกษา</option>
                    <option value="guest">บุคคลทั่วไป</option>
                    <option value="staff">บุคลากร</option>
                </select>
            </div>
        `;

        // 🌟 สร้าง UI เลือกวัตถุประสงค์ (เหมือนหน้า Login)
        if (container && containerWrapper) {
            containerWrapper.classList.remove('hidden');
            // เปลี่ยน Label ชั่วคราว
            const label = containerWrapper.querySelector('label');
            if(label) label.innerText = "วัตถุประสงค์การใช้งาน (สำหรับการเพิ่มผู้ใช้)";

            container.className = ''; // ลบคลาส grid เดิมออก
            container.innerHTML = `
                <div class="radio-group" style="margin-bottom:10px; gap:5px;">
                    <label class="selection-card usage-computer" style="padding:8px; font-size:0.85rem; flex:1;">
                        <input type="radio" name="adminUsageType" value="computer" checked onchange="toggleAdminAiSelect(false)"> 💻 คอมฯ ทั่วไป
                    </label>
                    <label class="selection-card usage-ai" style="padding:8px; font-size:0.85rem; flex:1;">
                        <input type="radio" name="adminUsageType" value="ai" onchange="toggleAdminAiSelect(true)"> 🤖 ใช้งาน AI
                    </label>
                </div>
                <select id="adminAiTool" class="input-field hidden" style="padding:8px; width:100%; font-size:0.9rem; border:1px solid #9333ea;">
                    ${appConfig.softwareList.map(s => `<option value="${s}">${s}</option>`).join('')}
                    <option value="Other">Other</option>
                </select>
            `;
        }
    }

    modal.classList.add('show');
}

// 🌟 SAVE LOGIC (UPDATED)
async function saveDeskDetails() {
    if (!currentEditingDesk) return;
    
    const status = document.getElementById('deskStatusSelect').value;
    
    // Check Admin Check-in Data
    const adminName = document.getElementById('adminAddName')?.value.trim();
    const adminId = document.getElementById('adminAddId')?.value.trim();
    
    if (adminName && adminId) {
        // --- Perform Check-in ---
        const type = document.getElementById('adminAddType').value;
        
        // Get Purpose
        const usageEl = document.querySelector('input[name="adminUsageType"]:checked');
        let purpose = 'Com';
        if (usageEl && usageEl.value === 'ai') {
            const tool = document.getElementById('adminAiTool').value;
            purpose = `AI: ${tool}`;
        }

        const payload = {
            name: adminName,
            stdId: adminId,
            faculty: 'Admin Added',
            year: '-',
            type: type,
            desk: currentEditingDesk,
            purpose: purpose
        };
        await apiCheckIn(payload);
    } else {
        // --- Update Desk Status Only ---
        if (!deskConfig[currentEditingDesk]) deskConfig[currentEditingDesk] = {};
        deskConfig[currentEditingDesk].status = status;
        // ลบส่วนบันทึก Software ออก เพราะเปลี่ยนเป็น Purpose แล้ว
        
        localStorage.setItem(DESK_CONFIG_KEY, JSON.stringify(deskConfig));
    }
    
    dbData = await loadAllData();
    closeDeskModal();
    renderDeskMap(); 
    updateStats();
}

function closeDeskModal() {
    document.getElementById('deskModal').classList.remove('show');
    currentEditingDesk = null;
}

async function forceCheckoutFromModal(userId) {
    if(confirm("ยืนยันการ Check-out ผู้ใช้งานรายนี้?")) {
        await apiCheckOut(userId);
        dbData = await loadAllData(); 
        closeDeskModal();
        renderDeskMap();
        updateStats();
    }
}

// ============================================
// 5. MONITOR TABLE & STATS
// ============================================
function renderMonitorTable() {
    const tableBody = document.getElementById('userTableBody');
    if(!tableBody) return;

    const timeFilter = document.getElementById('timeFilter')?.value || 'today';
    const typeFilter = document.getElementById('typeFilter')?.value || 'all';
    const facultyFilter = document.getElementById('facultyFilter')?.value || 'all';
    const yearFilter = document.getElementById('yearFilter')?.value || 'all';
    const zoneFilter = document.getElementById('zoneFilter')?.value || 'all';
    const statusFilter = document.getElementById('statusFilter')?.value || 'active';
    const searchVal = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const todayStr = new Date().toISOString().split('T')[0];

    let filtered = dbData.filter(u => {
        let matchTime = true;
        if(timeFilter === 'today') matchTime = (u.date === todayStr);

        let matchType = (typeFilter === 'all') || (u.type === typeFilter);
        let matchFaculty = (facultyFilter === 'all') || (u.faculty === facultyFilter);
        let matchYear = true;
        if (yearFilter !== 'all') {
            if (yearFilter === 'other') matchYear = !['1','2','3','4'].includes(u.year); 
            else matchYear = (u.year === yearFilter);
        }
        let matchZone = (zoneFilter === 'all') || (u.desk && u.desk.toUpperCase().startsWith(zoneFilter));
        let matchStatus = (statusFilter === 'all') || (u.status === statusFilter);
        let matchSearch = !searchVal || 
                          (u.name && u.name.toLowerCase().includes(searchVal)) || 
                          (u.stdId && u.stdId.toLowerCase().includes(searchVal));

        return matchTime && matchType && matchFaculty && matchYear && matchZone && matchStatus && matchSearch;
    });

    filtered.sort((a, b) => {
        let valA = a[currentSortCol] || '';
        let valB = b[currentSortCol] || '';
        if (currentSortCol === 'year') return (parseInt(valA)||0) - (parseInt(valB)||0) * (currentSortDir === 'asc' ? 1 : -1);
        if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
        return 0;
    });

    tableBody.innerHTML = '';
    if(filtered.length === 0) {
        document.getElementById('noDataMessage')?.classList.remove('hidden');
    } else {
        document.getElementById('noDataMessage')?.classList.add('hidden');
        filtered.forEach(user => {
            const tr = document.createElement('tr');
            const isChecked = user.status === 'active' ? 'checked' : '';
            const isDisabled = user.status === 'completed' ? 'disabled' : '';
            
            let badgeClass = 'badge-guest';
            let typeLabel = user.type;
            if (user.type === 'student') { badgeClass = 'badge-student'; typeLabel = 'นักศึกษา'; }
            else if (user.type === 'teacher') { badgeClass = 'badge-teacher'; typeLabel = 'อาจารย์'; }
            else if (user.type === 'staff') { badgeClass = 'badge-staff'; typeLabel = 'บุคลากร'; }
            else if (user.type === 'guest') { typeLabel = 'บุคคลทั่วไป'; }

            let displayPurpose = '', purposeColor = '#0369a1';
            if (user.purpose && user.purpose.startsWith('AI')) {
                let tool = user.purpose.split(':')[1] || '';
                displayPurpose = `🤖 ใช้งาน AI ${tool}`; purposeColor = '#9333ea';
            } else { displayPurpose = `💻 คอมฯ ทั่วไป`; }

            tr.innerHTML = `
                <td>${user.checkIn}</td>
                <td>${user.checkOut}</td>
                <td><span style="font-weight:600">${user.name}</span></td>
                <td><span class="badge ${badgeClass}">${typeLabel}</span></td>
                <td style="font-family:monospace">${user.stdId}</td>
                <td>${user.faculty}</td>
                <td style="text-align:center">${user.year}</td>
                <td><span class="col-desk">${user.desk}</span></td>
                <td><span style="font-size:0.85rem; color:${purposeColor}; font-weight:500;">${displayPurpose}</span></td>
                <td style="text-align:center">
                    <label class="switch">
                        <input type="checkbox" ${isChecked} ${isDisabled} onchange="toggleUserStatus(${user.id}, this)">
                        <span class="slider"></span>
                    </label>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }
}

function populateDropdowns() {
    const faculties = ["คณะวิทยาศาสตร์", "คณะเกษตรศาสตร์", "คณะวิศวกรรมศาสตร์", "คณะศิลปศาสตร์", "คณะเภสัชศาสตร์", "คณะบริหารศาสตร์", "คณะพยาบาลศาสตร์", "วิทยาลัยแพทยศาสตร์และการสาธารณสุข", "คณะศิลปประยุกต์และสถาปัตยกรรมศาสตร์", "คณะนิติศาสตร์", "คณะรัฐศาสตร์", "คณะศึกษาศาสตร์", "สำนักคอมพิวเตอร์และเครือข่าย", "สำนักบริหารทรัพย์สินและสิทธิประโยชน์", "สำนักวิทยบริการ", "กองกลาง", "กองแผนงาน", "กองคลัง", "กองบริการการศึกษา", "กองการเจ้าหน้าที่", "สำนักงานส่งเสริมและบริหารงานวิจัย ฯ", "สำนักงานพัฒนานักศึกษา", "สำนักงานบริหารกายภาพและสิ่งแวดล้อม", "สำนักงานวิเทศสัมพันธ์", "สำนักงานกฏหมายและนิติการ", "สำนักงานตรวจสอบภายใน", "สำนักงานรักษาความปลอดภัย", "สภาอาจารย์", "สหกรณ์ออมทรัพย์มหาวิทยาลัยอุบลราชธานี", "อุทยานวิทยาศาสตร์มหาวิทยาลัยอุบลราชธานี", "ศูนย์การจัดการความรู้ (KM)", "ศูนย์การเรียนรู้และพัฒนา \"งา\" เชิงเกษตรอุตสาหกรรมครัวเรือนแบบยั่งยืน", "สถานปฏิบัติการโรงแรมฯ (U-Place)", "ศูนย์วิจัยสังคมอนุภาคลุ่มน้ำโขง ฯ", "ศูนย์เครื่องมือวิทยาศาสตร์", "โรงพิมพ์มหาวิทยาลัยอุบลราชธานี"];
    const facSelect = document.getElementById('facultyFilter');
    if(facSelect) {
        facSelect.innerHTML = '<option value="all">🏢 ทุกคณะ/หน่วยงาน</option>';
        faculties.forEach(f => { const opt = document.createElement('option'); opt.value = f; opt.innerText = f; facSelect.appendChild(opt); });
    }
    const yearSelect = document.getElementById('yearFilter');
    if(yearSelect) {
        yearSelect.innerHTML = '<option value="all">🎓 ทุกชั้นปี</option>';
        ['1','2','3','4'].forEach(y => { const opt = document.createElement('option'); opt.value = y; opt.innerText = `ปี ${y}`; yearSelect.appendChild(opt); });
        const opt = document.createElement('option'); opt.value = 'other'; opt.innerText = 'อื่นๆ / ปี 4 ขึ้นไป'; yearSelect.appendChild(opt);
    }
    const zoneSelect = document.getElementById('zoneFilter');
    if(zoneSelect) zoneSelect.innerHTML = '<option value="all">🪑 ทุกโซน</option><option value="A">โซน A</option><option value="B">โซน B</option><option value="C">โซน C</option>';
}

function resetFilters() {
    ['typeFilter', 'facultyFilter', 'yearFilter', 'zoneFilter'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = 'all'; });
    if(document.getElementById('statusFilter')) document.getElementById('statusFilter').value = 'active'; 
    if(document.getElementById('searchInput')) document.getElementById('searchInput').value = '';
    renderMonitorData();
}

function handleSort(column) {
    if (currentSortCol === column) { currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc'; } 
    else { currentSortCol = column; currentSortDir = 'asc'; }
    document.querySelectorAll('.sort-icon').forEach(icon => icon.innerText = '↕');
    const header = document.querySelector(`th[onclick="handleSort('${column}')"] .sort-icon`);
    if(header) header.innerText = currentSortDir === 'asc' ? '↑' : '↓';
    renderMonitorData();
}

async function toggleUserStatus(id, checkbox) {
    dbData = await loadAllData();
    const idx = dbData.findIndex(u => u.id === id);
    if(idx !== -1) {
        if(!checkbox.checked) {
            if(confirm(`ยืนยัน Check-out: ${dbData[idx].name}?`)) {
                await apiCheckOut(id);
                dbData = await loadAllData();
                renderMonitorData();
                updateStats();
            } else { checkbox.checked = true; }
        } else {
            alert("ไม่สามารถเปิดสถานะได้หลังจาก Check-out แล้ว");
            checkbox.checked = false; 
        }
    }
}

function updateStats() {
    const todayStr = new Date().toISOString().split('T')[0];
    const activeCount = dbData.filter(u => u.status === 'active' && u.date === todayStr).length;
    
    let totalSeats = 0;
    if (appConfig && appConfig.zones) {
        appConfig.zones.forEach(z => totalSeats += z.count);
    } else { totalSeats = 60; }

    const elActive = document.getElementById('statActive');
    if(elActive) {
        elActive.innerText = activeCount;
        document.getElementById('statToday').innerText = dbData.filter(u => u.date === todayStr).length;
        document.getElementById('statSeats').innerText = `${totalSeats - activeCount}/${totalSeats}`;
    }
}

function exportCSV() {
    let csv = "Date,TimeIn,TimeOut,Name,Type,ID,Faculty,Year,Desk,Purpose,Status\n";
    dbData.forEach(row => {
        csv += `${row.date},${row.checkIn},${row.checkOut},${row.name},${row.type},${row.stdId},${row.faculty},${row.year},${row.desk},${row.purpose},${row.status}\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
    link.download = "monitor_export.csv";
    document.body.appendChild(link);
    link.click();
}

// ============================================
// 6. REPORT LOGIC
// ============================================
function initChart() {
    const ctx = document.getElementById('usageChart');
    if(!ctx) return;
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'ผู้ใช้ (คน)', data: [], backgroundColor: '#3b82f6', borderRadius:4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true, grid:{display:false}}, x:{grid:{display:false}}} }
    });
}

function initAIChart() {
    const ctx = document.getElementById('aiChart');
    if(!ctx) return;
    aiChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: [], datasets: [{ data: [], backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'], borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: {size: 11} } } } }
    });
}

function updateReport() {
    if(!chartInstance) return;
    const reportType = document.getElementById('reportType').value;
    const dateInput = document.getElementById('reportDate').value;
    if(!dateInput) return;

    const selectedDate = new Date(dateInput);
    const selYear = selectedDate.getFullYear();
    const selMonth = selectedDate.getMonth() + 1;
    const selDay = selectedDate.getDate();

    let reportData = dbData.filter(u => {
        const d = new Date(u.date);
        if (reportType === 'daily') return d.getFullYear()===selYear && (d.getMonth()+1)===selMonth && d.getDate()===selDay;
        if (reportType === 'monthly') return d.getFullYear()===selYear;
        return d.getFullYear()===selYear;
    });

    let labels = [], counts = [];

    if (reportType === 'daily') {
        labels = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
        counts = labels.map(hour => reportData.filter(u => u.checkIn.startsWith(hour.substring(0,2))).length);
    } else if (reportType === 'monthly') {
        labels = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
        counts = labels.map((_, idx) => reportData.filter(u => new Date(u.date).getMonth() === idx).length);
    } else {
        const currentYear = new Date().getFullYear();
        labels = [currentYear-4, currentYear-3, currentYear-2, currentYear-1, currentYear];
        reportData = dbData.filter(u => {
            const y = new Date(u.date).getFullYear();
            return y >= (currentYear-4) && y <= currentYear;
        });
        counts = labels.map(year => reportData.filter(u => new Date(u.date).getFullYear() === year).length);
    }

    const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
    const bgColors = labels.map((_, i) => palette[i % palette.length]);

    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = counts;
    chartInstance.data.datasets[0].backgroundColor = bgColors;
    chartInstance.update();

    let aiStats = {}, aiCount = 0, maxDuration = 0, maxUser = '-';
    reportData.forEach(u => {
        if (u.purpose && u.purpose.startsWith('AI')) {
            aiCount++;
            let toolName = u.purpose.split(':')[1]?.trim() || 'AI General';
            aiStats[toolName] = (aiStats[toolName] || 0) + 1;
        }
        if (u.checkIn && u.checkOut && u.checkOut !== '-') {
            const t1 = parseTime(u.checkIn), t2 = parseTime(u.checkOut);
            const diff = t2 - t1;
            if (diff > maxDuration) { maxDuration = diff; maxUser = u.name; }
        }
    });

    if (aiChartInstance) {
        const sortedAI = Object.entries(aiStats).sort((a,b) => b[1] - a[1]);
        aiChartInstance.data.labels = sortedAI.map(x => x[0]);
        aiChartInstance.data.datasets[0].data = sortedAI.map(x => x[1]);
        aiChartInstance.update();
    }

    const hrs = Math.floor(maxDuration / 60);
    const mins = maxDuration % 60;
    const durationText = maxDuration > 0 ? `${hrs} ชม. ${mins} น.` : '-';

    const elTotal = document.getElementById('repTotalUsers');
    if(elTotal) elTotal.innerText = reportData.length;
    const elStudent = document.getElementById('repStudentCount');
    if(elStudent) elStudent.innerText = reportData.filter(u => u.type === 'student').length;
    const elComputer = document.getElementById('repComputerUse');
    if(elComputer) elComputer.innerText = reportData.filter(u => u.purpose && !u.purpose.startsWith('AI')).length;
    const elAICount = document.getElementById('repAICount');
    if(elAICount) elAICount.innerText = aiCount;
    const elMaxDur = document.getElementById('repMaxDuration');
    if(elMaxDur) elMaxDur.innerText = durationText;
    const elMaxUser = document.getElementById('repMaxUser');
    if(elMaxUser) elMaxUser.innerText = maxUser !== '-' ? `(${maxUser})` : '';
    
    let maxVal = Math.max(...counts);
    let maxIdx = counts.indexOf(maxVal);
    const elPeak = document.getElementById('repPeakHour');
    if(elPeak) elPeak.innerText = maxVal > 0 ? labels[maxIdx] : '-';
}

function parseTime(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function exportReportCSV() {
    const reportType = document.getElementById('reportType').value;
    const dateInput = document.getElementById('reportDate').value;
    const selectedDate = new Date(dateInput);
    const selYear = selectedDate.getFullYear();
    
    let filtered = dbData.filter(u => {
        const d = new Date(u.date);
        if (reportType === 'daily') return d.toDateString() === selectedDate.toDateString();
        if (reportType === 'monthly') return d.getFullYear() === selYear;
        const currentYear = new Date().getFullYear();
        return d.getFullYear() >= (currentYear-4) && d.getFullYear() <= currentYear;
    });

    let csv = "Date,CheckIn,CheckOut,Name,Type,ID,Faculty,Status\n";
    filtered.forEach(row => {
        csv += `${row.date},${row.checkIn},${row.checkOut},${row.name},${row.type},${row.stdId},${row.faculty},${row.status}\n`;
    });

    const link = document.createElement("a");
    link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
    link.download = `report_${reportType}.csv`;
    document.body.appendChild(link);
    link.click();
}

// ============================================
// 7. USER SIDE CONTROLLER (Login Page)
// ============================================
async function handleCheckIn(e) {
    if(e) e.preventDefault();
    const idInput = document.getElementById('studentId');
    if(!idInput) return;
    const id = idInput.value.trim();
    if (id.length < 3) { alert("กรุณากรอกข้อมูลให้ครบถ้วน"); return; }

    const submitBtn = document.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "กำลังตรวจสอบ...";
    submitBtn.disabled = true;

    const catEl = document.querySelector('input[name="userCategory"]:checked');
    const selectedCategory = catEl ? catEl.value : 'guest';

    let userData = { name: `ผู้ใช้งาน (${id})`, faculty: 'บุคคลทั่วไป', year: '-', type: 'guest' };

    // Logic แยกประเภท (API or Guest)
    if (selectedCategory === 'staff') {
        const apiInfo = await fetchStudentInfo(id);
        if (apiInfo && apiInfo.data) { 
            const d = apiInfo.data;
            const prefix = d.USERPREFIXNAME || '';
            const fname = d.USERNAME || '';
            const lname = d.USERSURNAME || '';
            userData.name = `${prefix}${fname} ${lname}`;
            userData.faculty = d.FACULTYNAME;
            if (d.USERTYPE === 'นักศึกษา') {
                userData.type = 'student';
                userData.year = d.STUDENTYEAR;
            } else if (d.USERTYPE && (d.USERTYPE.includes('อาจารย์') || d.USERTYPE.includes('สอน'))) {
                userData.type = 'teacher';
            } else {
                userData.type = 'staff'; 
            }
        }
    } else {
        const nameInput = document.getElementById('username');
        const surInput = document.getElementById('surname');
        if (nameInput && surInput && nameInput.value && surInput.value) {
            userData.name = `${nameInput.value} ${surInput.value}`;
        } else {
            userData.name = `ผู้เยี่ยมชม (${id})`;
        }
        userData.stdId = id; 
    }

    const usageEl = document.querySelector('input[name="usageType"]:checked');
    let purpose = 'Com';
    if (usageEl && usageEl.value === 'ai') {
        const tool = document.getElementById('aiTool')?.value || 'Unknown';
        purpose = `AI: ${tool}`;
    } else if (usageEl) { purpose = 'Com'; }

    const deskNo = 'A-' + Math.floor(Math.random()*20+1); 
    const payload = {
        name: userData.name, stdId: id, faculty: userData.faculty, year: userData.year,
        type: userData.type, desk: deskNo, purpose: purpose
    };

    const res = await apiCheckIn(payload);
    submitBtn.innerText = originalText;
    submitBtn.disabled = false;

    if(res) showModal(userData.name, res.time);
}

function showModal(name, time) { 
    document.getElementById('modalUserName').innerText = name; 
    document.getElementById('modalUserTime').innerText = `เวลาเข้า: ${time}`; 
    document.getElementById('successModal').classList.add('show'); 
}
function closeModal() {
    document.getElementById('successModal').classList.remove('show');
    document.getElementById('checkinForm').reset();
    document.getElementById('studentId').focus();
    const u = document.getElementById('username'); if(u) u.value='';
    const s = document.getElementById('surname'); if(s) s.value='';
}
function switchMode(m) { 
    const v1=document.getElementById('viewManual');
    if(v1) v1.classList.remove('hidden');
}
function generateLoginQR() {}