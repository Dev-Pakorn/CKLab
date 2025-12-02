// --- script.js (Final Version: Fixed Year Calculation & Mock Data) ---

const STORAGE_KEY = 'lab_access_db_v2';
const DESK_CONFIG_KEY = 'lab_desk_config';
const APP_CONFIG_KEY = 'lab_app_config';

// 🌟 1. แก้ไข Mock Data (เพิ่มรหัส 68114540227 ตามที่ขอ)
const STUDENT_DB = {
    "68114540083": { name: "เขมมิกา พันธ์แก่น", faculty: "วิทยาศาสตร์", year: "1" },
    "68114540353": { name: "ปภังกร นิชรัตน์", faculty: "วิทยาศาสตร์", year: "1" },
    "68114540227": { name: "ทดสอบ ระบบ", faculty: "วิทยาศาสตร์", year: "1" }, // ✅ เพิ่มให้แล้ว (ถ้า API จริงดึงได้ จะใช้ชื่อจริงทับอันนี้)
    
    // ตัวอย่างปี 3 (รหัสขึ้นต้น 66)
    "66114540001": { name: "สมชาย ใจดี", faculty: "วิศวกรรมศาสตร์", year: "3" },
    // ตัวอย่างปี 4 (รหัสขึ้นต้น 65)
    "65114540002": { name: "สมหญิง รักเรียน", faculty: "บริหารศาสตร์", year: "4" },
    // ตัวอย่างปี 5 (รหัสขึ้นต้น 64 - สำหรับคณะที่เรียน 5-6 ปี)
    "64114540003": { name: "มานะ อดทน", faculty: "เภสัชศาสตร์", year: "5" },
    
    "admin": { name: "Admin Staff", faculty: "สำนักคอมฯ", year: "-" }
};

// Global Variables
let dbData = [];
let deskConfig = {}; 
let appConfig = {
    zones: [{ id: 'A', count: 10 }, { id: 'B', count: 10 }, { id: 'C', count: 10 }],
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
let tempApiUser = null;

// ============================================
// 1. API CONNECTION & CONFIG LOAD
// ============================================
async function loadAllData() {
    try {
        const storedApp = localStorage.getItem(APP_CONFIG_KEY);
        if (storedApp) {
            const parsed = JSON.parse(storedApp);
            if (parsed.zones && parsed.zones.length > 0) appConfig.zones = parsed.zones;
            if (parsed.softwareList && parsed.softwareList.length > 0) appConfig.softwareList = parsed.softwareList;
        }
        
        const storedDesk = localStorage.getItem(DESK_CONFIG_KEY);
        if (storedDesk) deskConfig = JSON.parse(storedDesk);

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
        if (response.ok) {
            return await response.json();
        } else {
            console.warn("API Error Status:", response.status);
        }
    } catch (error) {
        console.error("Fetch Error (Check VPN):", error);
    }
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
        renderConfigUI(); 
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
        renderConfigUI(); 
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
// 4. SETTINGS & CONFIG UI LOGIC (Admin Config)
// ============================================
function renderConfigUI() {
    const zoneCont = document.getElementById('zoneConfigContainer');
    if(zoneCont) {
        zoneCont.innerHTML = '';
        appConfig.zones.forEach((zone, index) => {
            const div = document.createElement('div');
            div.style.cssText = "display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.9rem; padding:4px; border-bottom:1px solid #eee;";
            div.innerHTML = `<span><b>โซน ${zone.id}</b>: ${zone.count} โต๊ะ</span> <span style="color:red; cursor:pointer; font-weight:bold;" onclick="removeZone(${index})">×</span>`;
            zoneCont.appendChild(div);
        });
    }
    const swCont = document.getElementById('softwareListContainer');
    if(swCont) {
        swCont.innerHTML = '';
        appConfig.softwareList.forEach((sw, index) => {
            const tag = document.createElement('span');
            tag.className = 'desk-software-tag'; 
            tag.style.cssText = "font-size:0.85rem; padding:4px 8px; border:1px solid #ddd; margin-right:4px; margin-bottom:4px; display:inline-block; background:#fff;";
            tag.innerHTML = `${sw} <span style="margin-left:5px; cursor:pointer; color:#666; font-weight:bold;" onclick="removeSoftware(${index})">×</span>`;
            swCont.appendChild(tag);
        });
    }
}

function addZone() {
    const name = document.getElementById('newZoneName').value.trim().toUpperCase();
    const count = parseInt(document.getElementById('newZoneCount').value);
    if(name && count > 0) {
        appConfig.zones.push({ id: name, count: count });
        saveAppConfig();
        document.getElementById('newZoneName').value = '';
        document.getElementById('newZoneCount').value = '';
    } else { alert('กรุณากรอกข้อมูลให้ครบ'); }
}
function removeZone(index) { if(confirm('ยืนยันลบโซน?')) { appConfig.zones.splice(index, 1); saveAppConfig(); } }

function addSoftware() {
    const name = document.getElementById('newSoftwareName').value.trim();
    if(name && !appConfig.softwareList.includes(name)) {
        appConfig.softwareList.push(name);
        saveAppConfig();
        document.getElementById('newSoftwareName').value = '';
    }
}
function removeSoftware(index) { if(confirm('ลบรายการนี้?')) { appConfig.softwareList.splice(index, 1); saveAppConfig(); } }

function saveAppConfig() {
    localStorage.setItem(APP_CONFIG_KEY, JSON.stringify(appConfig));
    renderConfigUI();
    renderDeskMap(); 
    updateStats();   
}

// ============================================
// 5. MAP RENDER & DESK MANAGEMENT
// ============================================
function renderDeskMap() {
    const container = document.getElementById('deskMapContainer');
    if(!container) return;
    container.innerHTML = '';

    const activeUsers = dbData.filter(u => u.status === 'active');
    // 🌟 แก้ไข Fallback เป็น 10 ที่นั่งต่อโซน
    const zones = (appConfig.zones && appConfig.zones.length > 0) 
                  ? appConfig.zones 
                  : [{ id: 'A', count: 10 }, { id: 'B', count: 10 }, { id: 'C', count: 10 }];

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
            const isReserved = config.status === 'reserved';

            const deskItem = document.createElement('div');
            let statusClass = '', statusText = 'ว่าง', textColor = '#64748b';
            
            if (user) { 
                statusClass = 'active'; statusText = 'ใช้งาน'; textColor = '#166534';
            } else if (isMaintenance) { 
                statusClass = 'maintenance'; statusText = 'ปิดซ่อม'; textColor = '#991b1b';
            } else if (isReserved) {
                statusClass = ''; statusText = 'จองแล้ว'; deskItem.style.border = '2px dashed #f59e0b'; 
                deskItem.style.background = '#fffbeb'; textColor = '#b45309';
            }

            deskItem.className = `desk-item ${statusClass}`;
            deskItem.onclick = () => openDeskModal(deskId, user, config);

            let innerHTML = `<div class="desk-id" style="color:${textColor}">${deskId}</div><div class="desk-status">${statusText}</div>`;
            
            if (user) {
                innerHTML += `<div class="desk-user">${user.name}</div>`;
                if (user.purpose && user.purpose.startsWith('AI')) {
                    let toolName = user.purpose.split(':')[1]?.trim() || 'AI';
                    innerHTML += `<div class="desk-software-tag" style="background:#f3e8ff; color:#7e22ce; border:1px solid #d8b4fe;">🤖 ${toolName}</div>`;
                }
            }

            deskItem.innerHTML = innerHTML;
            grid.appendChild(deskItem);
        }
        zoneDiv.appendChild(grid);
        container.appendChild(zoneDiv);
    });
}

// --- Modal & Admin Check-in Logic ---

window.toggleAdminAi = function(show) {
    const el = document.getElementById('adminAiSelectWrapper');
    if(el) { if(show) el.classList.remove('hidden'); else el.classList.add('hidden'); }
}

window.toggleAdminInputType = function() {
    const type = document.getElementById('adminAddType').value;
    const guestSection = document.getElementById('adminGuestSection');
    const apiSection = document.getElementById('adminApiSection');
    tempApiUser = null;
    document.getElementById('adminApiResult').classList.add('hidden');
    document.getElementById('adminAddId').value = '';
    if (type === 'guest') {
        guestSection.classList.remove('hidden');
        apiSection.classList.add('hidden');
    } else {
        guestSection.classList.add('hidden');
        apiSection.classList.remove('hidden');
        const ph = type === 'staff' ? "รหัสบุคลากร / Account" : "รหัสนักศึกษา";
        document.getElementById('adminAddId').placeholder = ph;
    }
}

window.adminSearchUser = async function() {
    const idInput = document.getElementById('adminAddId');
    const stdId = idInput.value.trim();
    const resultDiv = document.getElementById('adminApiResult');
    if (stdId.length < 3) { alert("กรุณากรอกรหัส"); return; }

    idInput.disabled = true;
    resultDiv.innerHTML = `<p class="text-sm text-light">🔄 กำลังค้นหา...</p>`;
    resultDiv.classList.remove('hidden');

    const apiInfo = await fetchStudentInfo(stdId);
    idInput.disabled = false;

    if (apiInfo && apiInfo.data) {
        const d = apiInfo.data;
        const prefix = d.USERPREFIXNAME || '';
        const fname = d.USERNAME || '';
        const lname = d.USERSURNAME || '';
        
        tempApiUser = {
            name: `${prefix}${fname} ${lname} (${stdId})`,
            faculty: d.FACULTYNAME || 'ไม่ระบุ',
            year: d.STUDENTYEAR || '-',
            type: document.getElementById('adminAddType').value,
            stdId: stdId
        };
        resultDiv.innerHTML = `<div style="background:#e0f2fe; padding:8px; border-radius:6px; margin-top:5px;"><p class="text-sm text-success">✅ พบข้อมูล: ${tempApiUser.name}</p></div>`;
    } else {
        tempApiUser = null;
        resultDiv.innerHTML = `<p class="text-sm" style="color:var(--danger)">❌ ไม่พบข้อมูล (จะใช้ Mockup แทนถ้ามี)</p>`;
        
        // Mock Fallback for Admin Search
        if(STUDENT_DB[stdId]) {
            const m = STUDENT_DB[stdId];
            tempApiUser = { name: `${m.name} (${stdId})`, faculty: m.faculty, year: m.year, type: document.getElementById('adminAddType').value, stdId: stdId };
            resultDiv.innerHTML = `<div style="background:#fffbeb; padding:8px; border-radius:6px; margin-top:5px;"><p class="text-sm text-warning">⚠️ พบใน Mock Data: ${tempApiUser.name}</p></div>`;
        }
    }
}

function openDeskModal(deskId, user, config) {
    currentEditingDesk = deskId;
    tempApiUser = null; 
    const modal = document.getElementById('deskModal');
    document.getElementById('modalDeskId').innerText = deskId;
    const statusSelect = document.getElementById('deskStatusSelect');
    const userInfoSec = document.getElementById('userInfoSection');

    if (user) {
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
    } else {
        statusSelect.disabled = false;
        statusSelect.value = config.status === 'maintenance' ? 'maintenance' : (config.status === 'reserved' ? 'reserved' : 'available');
        
        let reservedOption = statusSelect.querySelector('option[value="reserved"]');
        if (!reservedOption) {
            reservedOption = document.createElement('option');
            reservedOption.value = 'reserved';
            reservedOption.innerText = '⚠️ จอง (Reserved)';
            statusSelect.appendChild(reservedOption);
        }

        userInfoSec.classList.remove('hidden');
        userInfoSec.innerHTML = `
            <div style="border-top:1px dashed #ddd; padding-top:10px; margin-top:5px;">
                <p class="font-bold text-sm mb-2" style="color:var(--primary);">Admin Check-in (เพิ่มผู้ใช้)</p>
                <div style="margin-bottom:8px;">
                    <label class="text-sm text-light">ประเภทผู้ใช้:</label>
                    <select id="adminAddType" class="input-field" style="width:100%; padding:6px; font-size:0.9rem;" onchange="toggleAdminInputType()">
                        <option value="student" selected>นักศึกษา</option>
                        <option value="staff">บุคลากร</option>
                        <option value="guest">บุคคลทั่วไป</option>
                    </select>
                </div>
                <div id="adminApiSection">
                    <div style="display:flex; gap:5px;">
                        <input type="text" id="adminAddId" class="input-field" placeholder="รหัสนักศึกษา" style="width:100%;">
                        <button class="btn btn-primary" onclick="adminSearchUser()">🔍</button>
                    </div>
                    <div id="adminApiResult" class="hidden"></div>
                </div>
                <div id="adminGuestSection" class="hidden">
                    <input type="text" id="adminGuestName" class="input-field" placeholder="ชื่อ-สกุล" style="width:100%; margin-bottom:5px;">
                    <input type="text" id="adminGuestId" class="input-field" placeholder="เบอร์โทร" style="width:100%;">
                </div>
                <div style="margin-top:10px;">
                     <div style="display:flex; gap:15px;">
                        <label><input type="radio" name="adminUsage" value="computer" checked onclick="toggleAdminAi(false)"> 💻 คอม</label>
                        <label><input type="radio" name="adminUsage" value="ai" onclick="toggleAdminAi(true)"> 🤖 AI</label>
                    </div>
                    <div id="adminAiSelectWrapper" class="hidden" style="margin-top:5px;">
                        <select id="adminAiTool" class="input-field" style="width:100%;">
                            ${appConfig.softwareList.map(s => `<option value="${s}">${s}</option>`).join('')}
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }
    
    const oldCheckboxes = document.getElementById('modalSoftwareCheckboxes');
    if(oldCheckboxes && oldCheckboxes.parentElement) {
        oldCheckboxes.parentElement.style.display = 'none';
    }

    modal.classList.add('show');
}

async function saveDeskDetails() {
    if (!currentEditingDesk) return;
    const status = document.getElementById('deskStatusSelect').value;
    const userType = document.getElementById('adminAddType')?.value;
    let payload = null;

    if (userType !== 'guest' && tempApiUser) {
        const usageEl = document.querySelector('input[name="adminUsage"]:checked');
        let purpose = 'Com';
        if (usageEl && usageEl.value === 'ai') purpose = `AI: ${document.getElementById('adminAiTool').value}`;
        payload = {
            name: tempApiUser.name, stdId: tempApiUser.stdId, faculty: tempApiUser.faculty, year: tempApiUser.year,
            type: userType, desk: currentEditingDesk, purpose: purpose
        };
    } else if (userType === 'guest') {
        const gName = document.getElementById('adminGuestName').value.trim();
        const gId = document.getElementById('adminGuestId').value.trim();
        if (gName && gId) {
            const usageEl = document.querySelector('input[name="adminUsage"]:checked');
            let purpose = 'Com';
            if (usageEl && usageEl.value === 'ai') purpose = `AI: ${document.getElementById('adminAiTool').value}`;
            payload = {
                name: gName, stdId: gId, faculty: 'บุคคลทั่วไป', year: '-',
                type: 'guest', desk: currentEditingDesk, purpose: purpose
            };
        }
    }

    if (payload) {
        await apiCheckIn(payload);
    } else {
        if (!deskConfig[currentEditingDesk]) deskConfig[currentEditingDesk] = {};
        deskConfig[currentEditingDesk].status = status;
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
    tempApiUser = null;
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
    } else { totalSeats = 30; } // 🌟 แก้ไข: Default เป็น 30

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
// 8. USER SIDE CONTROLLER (Login Page)
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

    // 🌟 2. Logic แยกประเภท (API or Guest)
    if (selectedCategory === 'staff') {
        const apiInfo = await fetchStudentInfo(id);
        
        // แก้ไข: เช็ค data ก่อนใช้งาน
        if (apiInfo && apiInfo.data) { 
            const d = apiInfo.data;
            const prefix = d.USERPREFIXNAME || '';
            const fname = d.USERNAME || '';
            const lname = d.USERSURNAME || '';
            userData.name = `${prefix}${fname} ${lname} (${id})`;
            userData.faculty = d.FACULTYNAME || 'ไม่ระบุ';
            
            if (d.USERTYPE === 'นักศึกษา') {
                userData.type = 'student';
                userData.year = d.STUDENTYEAR;
            } else if (d.USERTYPE && (d.USERTYPE.includes('อาจารย์') || d.USERTYPE.includes('สอน'))) {
                userData.type = 'teacher';
            } else {
                userData.type = 'staff'; 
            }
        } else {
            // กรณี API ไม่เจอ: ใช้ Mock Fallback (เพื่อให้เห็นว่าระบบทำงาน)
            // หรือจะ Alert แจ้งเตือนก็ได้
            console.log("API not found, using fallback");
            if(STUDENT_DB[id]) {
                const m = STUDENT_DB[id];
                userData.name = `${m.name} (${id})`;
                userData.faculty = m.faculty;
                userData.year = m.year;
                userData.type = 'student';
            }
        }
    } else {
        // Guest
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