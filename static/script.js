// --- script.js (Fix: Restore Report Logic & Monthly View) ---

const STORAGE_KEY = 'lab_access_db_v2';

// Global Variables
let dbData = [];
let chartInstance = null;
let aiChartInstance = null;
let currentSortCol = 'checkIn';
let currentSortDir = 'desc';

// ============================================
// 1. API CONNECTION
// ============================================
async function loadAllData() {
    try {
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
        dbData = await loadAllData();
        
        populateDropdowns();
        renderMonitorTable();
        updateStats();

        const dateInput = document.getElementById('reportDate');
        if(dateInput) dateInput.valueAsDate = new Date();
        
        initChart();
        initAIChart(); 
        updateReport();

        setInterval(async () => {
            if(!document.getElementById('viewMonitor').classList.contains('hidden')){
                const searchVal = document.getElementById('searchInput') ? document.getElementById('searchInput').value : '';
                if(!searchVal) {
                    dbData = await loadAllData();
                    renderMonitorTable();
                    updateStats();
                }
            }
        }, 5000);
    });
}

// ============================================
// 3. MONITOR LOGIC
// ============================================
function populateDropdowns() {
    const faculties = [
        "คณะวิทยาศาสตร์", "คณะเกษตรศาสตร์", "คณะวิศวกรรมศาสตร์", "คณะศิลปศาสตร์", "คณะเภสัชศาสตร์",
        "คณะบริหารศาสตร์", "คณะพยาบาลศาสตร์", "วิทยาลัยแพทยศาสตร์และการสาธารณสุข", "คณะศิลปประยุกต์และสถาปัตยกรรมศาสตร์",
        "คณะนิติศาสตร์", "คณะรัฐศาสตร์", "คณะศึกษาศาสตร์", "สำนักคอมพิวเตอร์และเครือข่าย",
        "สำนักบริหารทรัพย์สินและสิทธิประโยชน์", "สำนักวิทยบริการ", "กองกลาง", "กองแผนงาน", "กองคลัง",
        "กองบริการการศึกษา", "กองการเจ้าหน้าที่", "สำนักงานส่งเสริมและบริหารงานวิจัย ฯ", "สำนักงานพัฒนานักศึกษา",
        "สำนักงานบริหารกายภาพและสิ่งแวดล้อม", "สำนักงานวิเทศสัมพันธ์", "สำนักงานกฏหมายและนิติการ",
        "สำนักงานตรวจสอบภายใน", "สำนักงานรักษาความปลอดภัย", "สภาอาจารย์", "สหกรณ์ออมทรัพย์มหาวิทยาลัยอุบลราชธานี",
        "อุทยานวิทยาศาสตร์มหาวิทยาลัยอุบลราชธานี", "ศูนย์การจัดการความรู้ (KM)",
        "ศูนย์การเรียนรู้และพัฒนา \"งา\" เชิงเกษตรอุตสาหกรรมครัวเรือนแบบยั่งยืน", "สถานปฏิบัติการโรงแรมฯ (U-Place)",
        "ศูนย์วิจัยสังคมอนุภาคลุ่มน้ำโขง ฯ", "ศูนย์เครื่องมือวิทยาศาสตร์", "โรงพิมพ์มหาวิทยาลัยอุบลราชธานี"
    ];

    const facSelect = document.getElementById('facultyFilter');
    if(facSelect) {
        facSelect.innerHTML = '<option value="all">🏢 ทุกคณะ/หน่วยงาน</option>';
        faculties.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f; opt.innerText = f;
            facSelect.appendChild(opt);
        });
    }

    const years = ['1', '2', '3', '4']; 
    const yearSelect = document.getElementById('yearFilter');
    if(yearSelect) {
        yearSelect.innerHTML = '<option value="all">🎓 ทุกชั้นปี</option>';
        years.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y; opt.innerText = `ปี ${y}`;
            yearSelect.appendChild(opt);
        });
        const optOther = document.createElement('option');
        optOther.value = 'other'; optOther.innerText = 'อื่นๆ / ปี 4 ขึ้นไป';
        yearSelect.appendChild(optOther);
    }

    const zones = [...new Set(dbData.map(u => u.desk ? u.desk.charAt(0).toUpperCase() : '').filter(z => z.match(/[A-Z]/)))].sort();
    const zoneSelect = document.getElementById('zoneFilter');
    if(zoneSelect) {
        zoneSelect.innerHTML = '<option value="all">🪑 ทุกโซน</option>';
        zones.forEach(z => {
            const opt = document.createElement('option');
            opt.value = z; opt.innerText = `โซน ${z}`;
            zoneSelect.appendChild(opt);
        });
    }
}

function resetFilters() {
    ['typeFilter', 'facultyFilter', 'yearFilter', 'zoneFilter'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).value = 'all';
    });
    if(document.getElementById('statusFilter')) document.getElementById('statusFilter').value = 'active'; 
    if(document.getElementById('searchInput')) document.getElementById('searchInput').value = '';
    renderMonitorTable();
}

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
                          (u.stdId && u.stdId.toLowerCase().includes(searchVal)) ||
                          (u.faculty && u.faculty.toLowerCase().includes(searchVal));

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
            if (user.type === 'teacher') { badgeClass = 'badge-teacher'; typeLabel = 'อาจารย์'; }
            if (user.type === 'staff') { badgeClass = 'badge-staff'; typeLabel = 'บุคลากร'; }
            if (user.type === 'guest') { typeLabel = 'บุคคลทั่วไป'; }

            let displayPurpose = '';
            let purposeColor = '#0369a1';
            
            if (user.purpose && user.purpose.startsWith('AI')) {
                let tool = user.purpose.split(':')[1] || '';
                displayPurpose = `🤖 ใช้งาน AI ${tool}`;
                purposeColor = '#9333ea';
            } else {
                displayPurpose = `💻 คอมฯ ทั่วไป`;
            }

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

function handleSort(column) {
    if (currentSortCol === column) {
        currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortCol = column;
        currentSortDir = 'asc';
    }
    document.querySelectorAll('.sort-icon').forEach(icon => icon.innerText = '↕');
    const header = document.querySelector(`th[onclick="handleSort('${column}')"] .sort-icon`);
    if(header) header.innerText = currentSortDir === 'asc' ? '↑' : '↓';
    renderMonitorTable();
}

async function toggleUserStatus(id, checkbox) {
    dbData = await loadAllData();
    const idx = dbData.findIndex(u => u.id === id);
    if(idx !== -1) {
        if(!checkbox.checked) {
            if(confirm(`ยืนยัน Check-out: ${dbData[idx].name}?`)) {
                await apiCheckOut(id);
                dbData = await loadAllData();
                renderMonitorTable();
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
    const elActive = document.getElementById('statActive');
    if(elActive) {
        elActive.innerText = activeCount;
        document.getElementById('statToday').innerText = dbData.filter(u => u.date === todayStr).length;
        document.getElementById('statStudent').innerText = dbData.filter(u => u.type === 'student' && u.date === todayStr).length;
        document.getElementById('statSeats').innerText = `${40 - activeCount}/40`;
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
// 4. REPORT LOGIC (กู้คืนส่วนที่หายไป)
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

    // 1. Filter Data ตามช่วงเวลา
    let reportData = dbData.filter(u => {
        const d = new Date(u.date);
        if (reportType === 'daily') return d.getFullYear()===selYear && (d.getMonth()+1)===selMonth && d.getDate()===selDay;
        // แก้ไข: รายเดือน = ทั้ง 12 เดือนของปีนั้น (ตามที่ขอ)
        if (reportType === 'monthly') return d.getFullYear()===selYear;
        // รายปี = 5 ปีย้อนหลัง
        return d.getFullYear() >= (new Date().getFullYear()-4) && d.getFullYear() <= new Date().getFullYear();
    });

    let labels = [], counts = [];

    // 2. Prepare Labels
    if (reportType === 'daily') {
        labels = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
        counts = labels.map(hour => reportData.filter(u => u.checkIn.startsWith(hour.substring(0,2))).length);
    } else if (reportType === 'monthly') {
        labels = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
        counts = labels.map((_, idx) => reportData.filter(u => new Date(u.date).getMonth() === idx).length);
    } else {
        const currentYear = new Date().getFullYear();
        labels = [currentYear-4, currentYear-3, currentYear-2, currentYear-1, currentYear];
        counts = labels.map(year => reportData.filter(u => new Date(u.date).getFullYear() === year).length);
    }

    // 3. Update Bar Chart
    const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
    const bgColors = labels.map((_, i) => palette[i % palette.length]);
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = counts;
    chartInstance.data.datasets[0].backgroundColor = bgColors;
    chartInstance.update();

    // 4. Update AI Chart & Stats (กู้คืนส่วนนี้กลับมา!)
    let aiStats = {}, aiCount = 0, maxDuration = 0, maxUser = '-';
    reportData.forEach(u => {
        // AI Count
        if (u.purpose && u.purpose.startsWith('AI')) {
            aiCount++;
            let toolName = u.purpose.split(':')[1]?.trim() || 'AI General';
            aiStats[toolName] = (aiStats[toolName] || 0) + 1;
        }
        // Duration Logic
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

    // Safe Update Elements
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
// 5. USER SIDE CONTROLLER (Login Page)
// ============================================
async function handleCheckIn(e) {
    if(e) e.preventDefault();
    const idInput = document.getElementById('studentId');
    if(!idInput) return;
    const id = idInput.value.trim();
    if (id.length < 3) { alert("กรุณากรอกรหัสนักศึกษา"); return; }

    let userData = { name: `ผู้ใช้งาน (${id})`, faculty: 'บุคคลทั่วไป', year: '-', type: 'guest' };
    const apiInfo = await fetchStudentInfo(id);
    
    if (apiInfo) {
        userData.name = apiInfo.fullNameThai || apiInfo.name_th || userData.name;
        userData.faculty = apiInfo.facultyNameThai || apiInfo.faculty || userData.faculty;
        userData.type = 'student';
        const entryYear = parseInt(id.substring(0, 2));
        if(!isNaN(entryYear)) {
            const currentYear2Digits = parseInt((new Date().getFullYear() + 543).toString().substring(2));
            userData.year = (currentYear2Digits - entryYear + 1).toString();
        }
    } else {
        if (id.toLowerCase().startsWith('t')) userData.type = 'teacher';
        else if (id.toLowerCase().startsWith('s') || id === 'admin') userData.type = 'staff';
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
    if(res) showModal(userData.name, res.time);
}

function switchAdminTab(tabName) {
    const viewMonitor = document.getElementById('viewMonitor');
    const viewReport = document.getElementById('viewReport');
    const btnMonitor = document.getElementById('tabBtnMonitor');
    const btnReport = document.getElementById('tabBtnReport');

    if (tabName === 'monitor') {
        viewMonitor.classList.remove('hidden'); viewReport.classList.add('hidden');
        btnMonitor.classList.remove('btn-outline'); btnMonitor.classList.add('btn-primary');
        btnReport.classList.remove('btn-primary'); btnReport.classList.add('btn-outline');
        loadAllData().then(data => { dbData = data; renderMonitorTable(); });
    } else {
        viewMonitor.classList.add('hidden'); viewReport.classList.remove('hidden');
        btnMonitor.classList.remove('btn-primary'); btnMonitor.classList.add('btn-outline');
        btnReport.classList.remove('btn-outline'); btnReport.classList.add('btn-primary');
        loadAllData().then(data => { dbData = data; updateReport(); });
    }
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
}
function switchMode(m) { 
    const v1=document.getElementById('viewManual'), v2=document.getElementById('viewQR');
    if(v1 && v2) {
        v1.classList.add('hidden'); v2.classList.add('hidden');
        document.getElementById('btnManual').classList.remove('active');
        document.getElementById('btnQR').classList.remove('active');
        if(m==='manual') { v1.classList.remove('hidden'); document.getElementById('btnManual').classList.add('active'); }
        else { v2.classList.remove('hidden'); document.getElementById('btnQR').classList.add('active'); generateLoginQR(); }
    }
}
function generateLoginQR() { 
    const c = document.getElementById("qrcodeDisplay"); 
    if(c) { c.innerHTML=""; new QRCode(c, {text:"lab", width:150, height:150}); document.getElementById("qrRefText").innerText = "TEST"; }
}