import { db, auth, onAuthStateChanged, signOut, collection, addDoc, serverTimestamp, getDocs, doc, setDoc, getDoc, updateDoc, arrayUnion, query, where, limit } from "./firebase-config.js";

const AI_API_BASE_URL = "https://complications-radiation-russia-wilson.trycloudflare.com";

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            initDashboard();
        } else {
            // Redirect to login if not authenticated
            window.location.href = 'index.html';
        }
    });

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            signOut(auth).then(() => {
                window.location.href = 'index.html';
            }).catch((error) => console.error("Sign out error", error));
        });
    }
});

async function initDashboard() {
    const content = document.getElementById('dashboard-content');
    const clientName = document.getElementById('client-name');
    const dashboardLogo = document.getElementById('dashboard-logo');
    const breadcrumb = document.getElementById('breadcrumb');
    const navHome = document.getElementById('nav-home');
    const navStudents = document.getElementById('nav-students');

    // Fetch user info from Firestore first
    let company = 'Guest Client';
    let selectedModule = 'oee';
    
    try {
        const q = query(collection(db, "enterprise_pilots"), where("uid", "==", currentUser.uid), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            company = data.companyName || company;
            selectedModule = localStorage.getItem('selectedModule') || data.selectedModule || selectedModule;
        } else {
            company = localStorage.getItem('companyName') || company;
            selectedModule = localStorage.getItem('selectedModule') || selectedModule;
        }
    } catch(e) {
        console.error("Error fetching user info:", e);
        company = localStorage.getItem('companyName') || company;
        selectedModule = localStorage.getItem('selectedModule') || selectedModule;
    }

    // Set Header
    if (clientName) {
        if (localStorage.getItem('isPremium') === 'true') {
            clientName.innerHTML = `${company} <span class="tag" style="background: rgba(52, 211, 153, 0.2); color: var(--accent-green); margin-left: 10px; border-radius: 4px; padding: 2px 6px;">PRO</span>`;
        } else {
            clientName.innerText = company;
        }
    }

    // Inject UI based on module
    if (selectedModule === 'eduflow') {
        if (dashboardLogo) dashboardLogo.innerHTML = 'Edu<span>Flow</span>';
        if (breadcrumb) breadcrumb.innerText = 'Academic Portal > Overview';
        if (navHome) navHome.innerText = 'Campus Overview';
        if (navStudents) navStudents.style.display = 'block';

        injectAcademicUI(content);

        const navAnalytics = document.getElementById('nav-analytics');
        if (navAnalytics) navAnalytics.style.display = 'block';

        if (navHome && navStudents && navAnalytics) {
            navHome.addEventListener('click', (e) => {
                e.preventDefault();
                navHome.classList.add('active');
                navStudents.classList.remove('active');
                navAnalytics.classList.remove('active');
                breadcrumb.innerText = 'Academic Portal > Overview';
                injectAcademicUI(content);
            });

            navStudents.addEventListener('click', (e) => {
                e.preventDefault();
                navStudents.classList.add('active');
                navHome.classList.remove('active');
                navAnalytics.classList.remove('active');
                breadcrumb.innerText = 'Academic Portal > Student Details';
                injectStudentDetailsUI(content);
            });
            
            navAnalytics.addEventListener('click', (e) => {
                e.preventDefault();
                navAnalytics.classList.add('active');
                navHome.classList.remove('active');
                navStudents.classList.remove('active');
                breadcrumb.innerText = 'Academic Portal > Analytics';
                injectAnalyticsUI(content);
            });
        }

    } else {
        // We use VentureOS for industrial as per original CSS/Dashboard
        if (dashboardLogo) dashboardLogo.innerHTML = 'Venture<span>OS</span>';
        if (breadcrumb) breadcrumb.innerText = 'Industrial Portal > Overview';
        if (navHome) navHome.innerText = 'Plant Overview';
        
        if (selectedModule === 'vision') {
            injectVisionUI(content);
        } else if (selectedModule === 'predictive') {
            injectPredictiveUI(content);
        } else {
            injectOEEUI(content);
        }
    }
}

function injectAcademicUI(container) {
    if (!container) return;

    // 1. Initial Loading State
    container.innerHTML = `
        <div style="grid-column: span 2; display:flex; flex-direction:column; justify-content:center; align-items:center; height: 300px; gap:20px;">
            <div style="color:var(--text-muted); font-size:15px; display:flex; align-items:center; gap:10px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Analyzing campus data...
            </div>
        </div>
    `;

    // 2. Fetch Data Asynchronously
    setTimeout(async () => {
        try {
            // Fetch all students for this user
            const studentsQuery = query(collection(db, "eduflow"), where("uid", "==", currentUser.uid));
            const studentsSnap = await getDocs(studentsQuery);
            
            let totalMarks = 0;
            let totalAttendance = 0;
            let subjectCount = 0;
            let studentsCount = 0;
            
            let criticalAlerts = [];
            
            const diagnosticsPromises = [];

            studentsSnap.forEach(docSnap => {
                const data = docSnap.data();
                studentsCount++;
                
                // Calculate averages & generate alerts
                if (data.subjects && data.subjects.length > 0) {
                    data.subjects.forEach(s => {
                        const mark = parseFloat(s.marks) || 0;
                        const att = parseFloat(s.attendance) || 0;
                        
                        totalMarks += mark;
                        totalAttendance += att;
                        subjectCount++;
                        
                        if (mark < 40) {
                            criticalAlerts.push(`<b>${data.name}</b> is failing ${s.subject} (Score: ${mark}). Review suggested.`);
                        }
                        if (att < 75) {
                            criticalAlerts.push(`<b>${data.name}</b> has low attendance in ${s.subject} (${att}%). Early intervention needed.`);
                        }
                    });
                }
                
                // Queue diagnostic fetch
                const diagQuery = query(collection(db, "students", docSnap.id, "diagnostics"), where("uid", "==", currentUser.uid));
                diagnosticsPromises.push(getDocs(diagQuery).then(snap => {
                    const docs = [];
                    snap.forEach(d => {
                        const dData = d.data();
                        dData.studentName = data.name; // Tag with student name
                        docs.push(dData);
                    });
                    return docs;
                }));
            });

            // Calculate overall metrics
            const avgMarks = subjectCount > 0 ? (totalMarks / subjectCount).toFixed(1) : 0;
            const avgAttendance = subjectCount > 0 ? (totalAttendance / subjectCount).toFixed(1) : 0;
            
            // Generate Alerts HTML
            let alertsHTML = '';
            if (criticalAlerts.length > 0) {
                // Show up to 3 alerts
                criticalAlerts.slice(0, 3).forEach(alertText => {
                    alertsHTML += `<div class="alert critical" style="margin-bottom:8px;">${alertText}</div>`;
                });
                if (criticalAlerts.length > 3) {
                    alertsHTML += `<div class="alert normal" style="margin-top:4px;">+ ${criticalAlerts.length - 3} more alerts needing attention.</div>`;
                }
            } else {
                alertsHTML = '<div class="alert normal">All student cohorts tracking above baseline. No critical issues detected.</div>';
            }

            // Resolve all diagnostics
            const allDiagnosticsArrays = await Promise.all(diagnosticsPromises);
            let allDiagnostics = allDiagnosticsArrays.flat();
            
            // Sort by date descending
            allDiagnostics.sort((a, b) => {
                const getMs = (t) => t ? (typeof t.toMillis === 'function' ? t.toMillis() : new Date(t).getTime()) : 0;
                return getMs(b.created_at) - getMs(a.created_at);
            });
            
            // Generate Diagnostics Stream HTML
            let diagnosticsStreamHTML = '';
            if (allDiagnostics.length > 0) {
                allDiagnostics.slice(0, 3).forEach(d => {
                    let dateStr = 'Just now';
                    if (d.created_at) {
                        dateStr = typeof d.created_at.toDate === 'function' 
                            ? d.created_at.toDate().toLocaleString() 
                            : new Date(d.created_at).toLocaleString();
                    }
                    diagnosticsStreamHTML += `
                        <div class="sensor-box" style="margin-bottom: 12px; padding: 12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:8px;">
                            <h4 style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">${dateStr} &bull; ${d.studentName}</h4>
                            <div class="sensor-value" style="font-size: 14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:6px;">
                                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#60a5fa;"></span>
                                <span style="color:#60a5fa;">${d.subject}</span> AI Diagnostic Generated
                            </div>
                        </div>
                    `;
                });
            } else {
                diagnosticsStreamHTML = `
                    <div class="sensor-box" style="grid-column: span 3; text-align:center; padding: 20px; background:transparent; border:1px dashed rgba(255,255,255,0.1);">
                        <span style="color:var(--text-muted);">No AI diagnostics run yet.</span>
                    </div>
                `;
            }

            // Render Final HTML
            container.innerHTML = `
                <style>
                    @keyframes spin { 100% { transform: rotate(360deg); } }
                </style>
                <section class="card modules-card" style="grid-column: span 2;">
                    <h3>Active Academic Modules</h3>
                    <div class="module-list" style="display: flex; gap: 15px;">
                        <div class="module-item active" style="flex: 1;">
                            <span>Student Progress Analytics</span>
                            <span class="tag">Active</span>
                        </div>
                        <div class="module-item active" style="flex: 1;">
                            <span>NLP AI Query Assistant</span>
                            <span class="tag">Active</span>
                        </div>
                    </div>
                </section>

                <section class="card metrics-card">
                    <h3>Student Cohort Progress</h3>
                    <div class="big-metric" style="color:${avgMarks >= 75 ? 'var(--accent-green)' : (avgMarks >= 50 ? '#fbbf24' : 'var(--accent-red)')}">
                        <span id="progress-score">${avgMarks}</span>%
                    </div>
                    <div class="sub-metrics">
                        <div>Avg Attendance: <span style="color:${avgAttendance >= 75 ? 'var(--accent-green)' : 'var(--accent-red)'}">${avgAttendance}%</span></div>
                        <div>Total Students: <span>${studentsCount}</span></div>
                    </div>
                </section>

                <section class="card alert-card">
                    <h3>Teacher Alerts</h3>
                    <div class="alert-feed">
                        ${alertsHTML}
                    </div>
                </section>

                <section class="card sensor-card" style="grid-column: span 2;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h3 style="margin:0;">Recent AI Diagnostics</h3>
                        <span style="font-size:12px; color:var(--text-muted); background:rgba(255,255,255,0.1); padding:2px 8px; border-radius:12px;">${allDiagnostics.length} Total Reports</span>
                    </div>
                    <div class="sensor-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
                        ${diagnosticsStreamHTML}
                    </div>
                </section>
            `;

        } catch (e) {
            console.error("Error loading dynamic dashboard:", e);
            container.innerHTML = `<div style="grid-column:span 2; padding:40px; text-align:center; color:var(--accent-red); background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); border-radius:8px;">Failed to load dashboard data: ${e.message}</div>`;
        }
    }, 0);
}

function injectOEEUI(container) {
    if (!container) return;
    container.innerHTML = `
        <section class="card modules-card" style="grid-column: span 2;">
            <h3>Active Industrial Modules</h3>
            <div class="module-list" style="display: flex; gap: 15px;">
                <div class="module-item active" style="flex: 1;">
                    <span>Telemetry & OEE</span>
                    <span class="tag">Active</span>
                </div>
                <div class="module-item active" style="flex: 1;">
                    <span>Vision Quality Control</span>
                    <span class="tag">Active</span>
                </div>
                <div class="module-item inactive" style="flex: 1;">
                    <span>Predictive Maintenance</span>
                    ${localStorage.getItem('isPremium') === 'true' ? '<span class="tag">Active</span>' : '<button class="upgrade-btn" onclick="window.location.href=\\\'checkout.html\\\'">Upgrade</button>'}
                </div>
            </div>
        </section>

        <section class="card metrics-card">
            <h3>Overall Equipment Effectiveness (OEE)</h3>
            <div class="big-metric">
                <span id="oee-score">81.3</span>%
            </div>
            <div class="sub-metrics">
                <div>Availability: <span>94.2%</span></div>
                <div>Quality: <span>98.1%</span></div>
            </div>
        </section>

        <section class="card alert-card">
            <h3>System Alerts</h3>
            <div class="alert-feed">
                <div class="alert normal">All systems operating within normal parameters.</div>
            </div>
        </section>

        <section class="card sensor-card" style="grid-column: span 2;">
            <h3>Live Edge Telemetry: CNC_Milling_04</h3>
            <div class="sensor-grid">
                <div class="sensor-box">
                    <h4>Spindle Temp</h4>
                    <div class="sensor-value"><span>62.4</span>Â°C</div>
                </div>
                <div class="sensor-box">
                    <h4>Vibration</h4>
                    <div class="sensor-value"><span>115.2</span> Hz</div>
                </div>
                <div class="sensor-box">
                    <h4>Current Load</h4>
                    <div class="sensor-value"><span>12.4</span> A</div>
                </div>
            </div>
        </section>
    `;
}

function injectVisionUI(container) {
    if (!container) return;
    container.innerHTML = `
        <section class="card modules-card" style="grid-column: span 2;">
            <h3>Active Industrial Modules</h3>
            <div class="module-list" style="display: flex; gap: 15px;">
                <div class="module-item inactive" style="flex: 1;">
                    <span>Telemetry & OEE</span>
                    ${localStorage.getItem('isPremium') === 'true' ? '<span class="tag">Active</span>' : '<button class="upgrade-btn" onclick="window.location.href=\\\'checkout.html\\\'">Upgrade</button>'}
                </div>
                <div class="module-item active" style="flex: 1;">
                    <span>Vision Quality Control</span>
                    <span class="tag">Active</span>
                </div>
                <div class="module-item inactive" style="flex: 1;">
                    <span>Predictive Maintenance</span>
                    ${localStorage.getItem('isPremium') === 'true' ? '<span class="tag">Active</span>' : '<button class="upgrade-btn" onclick="window.location.href=\\\'checkout.html\\\'">Upgrade</button>'}
                </div>
            </div>
        </section>

        <section class="card metrics-card">
            <h3>Real-time Defect Rate</h3>
            <div class="big-metric">
                <span id="defect-score">1.2</span>%
            </div>
            <div class="sub-metrics">
                <div>Parts Scanned: <span>14,208</span></div>
                <div>False Positives: <span>0.05%</span></div>
            </div>
        </section>

        <section class="card alert-card">
            <h3>Vision Alerts</h3>
            <div class="alert-feed">
                <div class="alert critical" style="border-left-color: var(--accent-red); background: rgba(239, 68, 68, 0.1); color: #fca5a5;">
                    Critical: Defect threshold exceeded on Assembly Line 2 (Micro-fractures detected).
                </div>
                <div class="alert normal">Camera 1 and 3 operating nominally.</div>
            </div>
        </section>

        <section class="card sensor-card" style="grid-column: span 2;">
            <h3>Live Camera Feed Analysis</h3>
            <div class="sensor-grid">
                <div class="sensor-box" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 120px; border: 1px dashed var(--accent-green);">
                    <span style="color: var(--accent-green); font-weight: bold; margin-bottom: 5px;">[ CAM 1 ]</span>
                    <span style="font-size: 14px;">Clear</span>
                </div>
                <div class="sensor-box" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 120px; border: 1px dashed var(--accent-red);">
                    <span style="color: var(--accent-red); font-weight: bold; margin-bottom: 5px;">[ CAM 2 ]</span>
                    <span style="font-size: 14px; color: #fca5a5;">Anomaly Detected</span>
                </div>
                <div class="sensor-box" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 120px; border: 1px dashed var(--text-muted); opacity: 0.5;">
                    <span style="color: var(--text-muted); font-weight: bold; margin-bottom: 5px;">[ CAM 3 ]</span>
                    <span style="font-size: 14px;">Offline / Standby</span>
                </div>
            </div>
        </section>
    `;
}

function injectPredictiveUI(container) {
    if (!container) return;
    container.innerHTML = `
        <section class="card modules-card" style="grid-column: span 2;">
            <h3>Active Industrial Modules</h3>
            <div class="module-list" style="display: flex; gap: 15px;">
                <div class="module-item inactive" style="flex: 1;">
                    <span>Telemetry & OEE</span>
                    ${localStorage.getItem('isPremium') === 'true' ? '<span class="tag">Active</span>' : '<button class="upgrade-btn" onclick="window.location.href=\\\'checkout.html\\\'">Upgrade</button>'}
                </div>
                <div class="module-item inactive" style="flex: 1;">
                    <span>Vision Quality Control</span>
                    ${localStorage.getItem('isPremium') === 'true' ? '<span class="tag">Active</span>' : '<button class="upgrade-btn" onclick="window.location.href=\\\'checkout.html\\\'">Upgrade</button>'}
                </div>
                <div class="module-item active" style="flex: 1;">
                    <span>Predictive Maintenance</span>
                    <span class="tag">Active</span>
                </div>
            </div>
        </section>

        <section class="card metrics-card">
            <h3>Average Fleet Health</h3>
            <div class="big-metric">
                <span id="health-score">91</span>/100
            </div>
            <div class="sub-metrics">
                <div>Machines Monitored: <span>42</span></div>
                <div>Risk Level: <span style="color: var(--accent-green);">Low</span></div>
            </div>
        </section>

        <section class="card alert-card">
            <h3>Maintenance Schedule</h3>
            <div class="alert-feed">
                <div class="alert" style="border-left-color: #f59e0b; background: rgba(245, 158, 11, 0.1); color: #fcd34d;">
                    Upcoming: Schedule bearing replacement for CNC_04 before Friday.
                </div>
                <div class="alert normal">No immediate failures predicted.</div>
            </div>
        </section>

        <section class="card sensor-card" style="grid-column: span 2;">
            <h3>Predicted Time to Failure</h3>
            <div class="sensor-grid">
                <div class="sensor-box">
                    <h4>CNC_Milling_04</h4>
                    <div class="sensor-value" style="color: #f59e0b;">12 Days</div>
                </div>
                <div class="sensor-box">
                    <h4>Conveyor_Belt_01</h4>
                    <div class="sensor-value">45 Days</div>
                </div>
                <div class="sensor-box">
                    <h4>Hydraulic_Press_B</h4>
                    <div class="sensor-value">120+ Days</div>
                </div>
            </div>
        </section>
        </section>
    `;
}

// --- STUDENT DETAILS FIREBASE UI ---
let subjectCounter = 1;

window.addSubjectRow = function() {
    subjectCounter++;
    const container = document.getElementById('subjects-container');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'subject-row';
    row.id = `subject-row-${subjectCounter}`;
    row.style.cssText = 'display:flex; gap:8px; align-items:center;';
    row.innerHTML = `
        <input type="text" placeholder="Subject" required style="flex:2; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
        <input type="text" placeholder="Marks" required style="flex:1; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
        <input type="text" placeholder="Attend %" required style="flex:1; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
        <button type="button" onclick="window.removeSubjectRow('subject-row-${subjectCounter}')" style="width:36px; height:36px; background:rgba(239,68,68,0.2); color:#fca5a5; border:1px solid rgba(239,68,68,0.4); border-radius:4px; cursor:pointer; font-size:18px; display:flex; align-items:center; justify-content:center;">×</button>
    `;
    container.appendChild(row);
};

window.removeSubjectRow = function(rowId) {
    const row = document.getElementById(rowId);
    if (row) row.remove();
};

window.submitStudentForm = async function(event) {
    event.preventDefault();
    const btn = document.getElementById('add-student-btn');
    btn.innerText = "Adding...";
    btn.disabled = true;

    const name = document.getElementById('student-name').value;
    const regNo = document.getElementById('student-reg').value.trim();
    const branch = document.getElementById('student-branch').value;

    if (!regNo) {
        alert('Registration Number is required.');
        btn.innerText = "Add Student";
        btn.disabled = false;
        return;
    }

    // Collect all subject rows
    const rows = document.querySelectorAll('#subjects-container .subject-row');
    const subjects = [];
    rows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        const subName = inputs[0].value.trim();
        const subMarks = inputs[1].value.trim();
        const subAttend = inputs[2].value.trim();
        if (subName && subMarks) {
            subjects.push({ subject: subName, marks: subMarks, attendance: subAttend || '0' });
        }
    });

    try {
        // Use regNo as document ID in global eduflow collection, but link via uid field
        await setDoc(doc(db, "eduflow", regNo), {
            name, regNo, branch, subjects, uid: currentUser.uid, timestamp: serverTimestamp()
        });
        alert("Student added successfully!");
        document.getElementById('student-form').reset();
        const container = document.getElementById('subjects-container');
        container.innerHTML = `
            <div class="subject-row" id="subject-row-1" style="display:flex; gap:8px; align-items:center;">
                <input type="text" placeholder="Subject" required style="flex:2; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
                <input type="text" placeholder="Marks" required style="flex:1; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
                <input type="text" placeholder="Attend %" required style="flex:1; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
                <div style="width:36px;"></div>
            </div>
        `;
        subjectCounter = 1;
        window.loadStudentsList();
    } catch (e) {
        console.error("Error adding student: ", e);
        alert("Failed to add student. Check console.");
    } finally {
        btn.innerText = "Add Student";
        btn.disabled = false;
    }
};

// Load a clickable list of students (not full details)
window.loadStudentsList = async function() {
    const listContainer = document.getElementById('students-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">Loading students...</p>';

    try {
        const q = query(collection(db, "eduflow"), where("uid", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);
        listContainer.innerHTML = '';
        if (querySnapshot.empty) {
            listContainer.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">No students found.</p>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const card = document.createElement('div');
            card.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:8px; cursor:pointer; transition:all 0.2s;';
            card.onmouseover = () => { card.style.background = 'rgba(59,130,246,0.1)'; card.style.borderColor = 'var(--accent-blue)'; };
            card.onmouseout = () => { card.style.background = 'rgba(255,255,255,0.03)'; card.style.borderColor = 'var(--border-color)'; };
            card.onclick = () => window.showStudentDetail(docSnap.id);
            card.innerHTML = `
                <div>
                    <div style="font-weight:600; font-size:15px;">${data.name || 'Unknown'}</div>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">${data.branch || '-'} &bull; Reg: ${data.regNo || docSnap.id}</div>
                </div>
                <span style="color:var(--text-muted); font-size:20px;">›</span>
            `;
            listContainer.appendChild(card);
        });
    } catch (e) {
        console.error("Error fetching students: ", e);
        listContainer.innerHTML = '<p style="text-align:center; color:var(--accent-red); padding:20px;">Failed to load. Check console.</p>';
    }
};

// Show full details of a single student
window.showStudentDetail = async function(docId) {
    const content = document.getElementById('dashboard-content');
    if (!content) return;

    content.innerHTML = '<div style="grid-column:span 2; text-align:center; padding:40px; color:var(--text-muted);">Loading student data...</div>';

    try {
        const docSnap = await getDoc(doc(db, "eduflow", docId));
        if (!docSnap.exists() || docSnap.data().uid !== currentUser.uid) {
            content.innerHTML = '<div style="grid-column:span 2; text-align:center; padding:40px; color:var(--accent-red);">Student not found.</div>';
            return;
        }
        const data = docSnap.data();

        // Build subjects table rows
        let subjectRows = '';
        if (Array.isArray(data.subjects) && data.subjects.length > 0) {
            data.subjects.forEach((s, i) => {
                const subjStr = (s.subject || '').replace(/'/g, "\\'");
                const nameStr = (data.name || '').replace(/'/g, "\\'");
                const regStr = (data.regNo || docId).replace(/'/g, "\\'");
                subjectRows += `
                    <tr>
                        <td style="padding:10px 12px; border-bottom:1px solid var(--border-color);">${i + 1}</td>
                        <td style="padding:10px 12px; border-bottom:1px solid var(--border-color);">${s.subject}</td>
                        <td style="padding:10px 12px; border-bottom:1px solid var(--border-color);">${s.marks}</td>
                        <td style="padding:10px 12px; border-bottom:1px solid var(--border-color);">${s.attendance || '0'}%</td>
                        <td style="padding:10px 12px; border-bottom:1px solid var(--border-color);">
                            <button onclick="window.openAnalysisModal('${subjStr}', '${s.marks}', '${s.attendance || '0'}%', '${nameStr}', '${regStr}', '${docId}')" style="padding: 6px 12px; border-radius: 8px; background: rgba(37,99,235,0.2); color: #60a5fa; border: 1px solid rgba(59,130,246,0.3); font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;" onmouseover="this.style.background='#2563eb'; this.style.color='white';" onmouseout="this.style.background='rgba(37,99,235,0.2)'; this.style.color='#60a5fa';">
                                Analyze ↗
                            </button>
                        </td>
                    </tr>
                `;
            });
        } else {
            subjectRows = '<tr><td colspan="5" style="text-align:center; padding:15px; color:var(--text-muted);">No subjects recorded.</td></tr>';
        }

        content.innerHTML = `
            <div style="grid-column: span 2;">
                <button onclick="window.injectStudentDetailsUI(document.getElementById('dashboard-content'))" style="background:none; border:1px solid var(--border-color); color:var(--accent-blue); padding:8px 16px; border-radius:6px; cursor:pointer; font-size:14px; margin-bottom:20px;">← Back to Student List</button>
            </div>

            <section class="card" style="grid-column: span 2;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <div>
                        <h3 style="font-size:22px; color:var(--text-main); margin-bottom:4px;">${data.name}</h3>
                        <p style="color:var(--text-muted); font-size:14px;">Reg. No: ${data.regNo || docId} &bull; Branch: ${data.branch || '-'}</p>
                    </div>
                    <div style="display:flex; gap:12px; align-items:center;">
                        <span class="status-badge green">Active</span>
                        <button onclick="window.editStudentUI('${docId}')" style="background:rgba(255,255,255,0.05); color:var(--text-main); border:1px solid var(--border-color); padding:6px 16px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600; transition:0.2s;">Edit Details</button>
                    </div>
                </div>
            </section>

            <section class="card" style="grid-column: span 2;">
                <h3 style="margin-bottom:15px;">Subjects, Marks & Attendance</h3>
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead>
                        <tr style="border-bottom:1px solid var(--border-color); color:var(--text-muted); font-size:13px;">
                            <th style="padding:10px 12px;">#</th>
                            <th style="padding:10px 12px;">Subject</th>
                            <th style="padding:10px 12px;">Marks</th>
                            <th style="padding:10px 12px;">Attendance</th>
                            <th style="padding:10px 12px;">Action</th>

                        </tr>
                    </thead>
                    <tbody>
                        ${subjectRows}
                    </tbody>
                </table>
            </section>
            
            <section class="card" id="diagnostic-history-section" style="grid-column: span 2;">
                <h3 style="margin-bottom:15px;">Diagnostic History</h3>
                <div id="diagnostic-history-container">
                    <p style="color:var(--text-muted); font-size:14px; text-align:center; padding:20px;">Loading history...</p>
                </div>
            </section>
        `;

        // Fetch Diagnostic History asynchronously to avoid blocking the main UI render
        setTimeout(async () => {
            const histContainer = document.getElementById('diagnostic-history-container');
            if (!histContainer) return;

            try {
                const diagQuery = query(collection(db, "students", docId, "diagnostics"), where("uid", "==", currentUser.uid));
                const diagSnap = await getDocs(diagQuery);
                let historyHTML = '';
                
                if (!diagSnap.empty) {
                    const docs = [];
                    diagSnap.forEach(d => docs.push({ id: d.id, ...d.data() }));
                    // Sort descending by date
                    docs.sort((a, b) => {
                        const getMs = (t) => t ? (typeof t.toMillis === 'function' ? t.toMillis() : new Date(t).getTime()) : 0;
                        return getMs(b.created_at) - getMs(a.created_at);
                    });
                    
                    docs.forEach(d => {
                        let dateStr = 'Just now';
                        if (d.created_at) {
                            dateStr = typeof d.created_at.toDate === 'function' 
                                ? d.created_at.toDate().toLocaleString() 
                                : new Date(d.created_at).toLocaleString();
                        }
                        historyHTML += `
                            <details style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:8px; margin-bottom:12px;">
                                <summary style="padding:16px; outline:none; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                                    <span style="color:#60a5fa; font-weight:600; font-size:14px; display:flex; align-items:center;">
                                        <span style="margin-right:8px; font-size:10px;">▶</span>
                                        ${d.subject} &bull; ${d.exam_type || 'CAT-1'} 
                                        <span style="color: #94a3b8; font-weight: normal; margin-left: 8px;">(Score: ${d.marks}, Attend: ${d.attendance})</span>
                                    </span>
                                    <span style="color:var(--text-muted); font-size:12px;">${dateStr}</span>
                                </summary>
                                <div style="padding: 0 16px 16px 16px; border-top: 1px solid rgba(255,255,255,0.1); padding-top:16px; margin-top:4px; color:#cbd5e1; font-size:14px; line-height:1.6; overflow-x: auto;">
                                    ${parseMarkdown(d.analysis_report)}
                                    <div style="margin-top: 16px;">
                                        <button style="background: rgba(59, 130, 246, 0.1); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.2s; font-size: 13px;" onmouseover="this.style.background='#3b82f6'; this.style.color='#fff';" onmouseout="this.style.background='rgba(59, 130, 246, 0.1)'; this.style.color='#60a5fa';" onclick="startVirtualInterview(this)" data-subject="${d.subject}" data-report="${btoa(unescape(encodeURIComponent(d.analysis_report || '')))}" data-docid="${d.id}" data-studentid="${docId}">
                                            Start Virtual Interview
                                        </button>
                                    </div>
                                    ${(() => {
                                        let allInterviews = d.interviews || [];
                                        if (d.interview) allInterviews = [d.interview, ...allInterviews];
                                        
                                        if (allInterviews.length === 0) return '';
                                        
                                        let html = '<div style="margin-top: 20px;"><h4 style="color: #60a5fa; margin-bottom: 10px; font-size: 14px;">Virtual Interview History</h4>';
                                        allInterviews.forEach((inv, index) => {
                                            html += `
                                            <div style="margin-top: 12px; padding: 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; background: rgba(0,0,0,0.2);">
                                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                                    <strong style="color: #cbd5e1; font-size: 13px;">Attempt #${allInterviews.length - index}</strong>
                                                    <span style="font-size: 12px; color: ${inv.score >= 70 ? '#10b981' : '#ef4444'}; font-weight: bold;">Score: ${inv.score}/100</span>
                                                </div>
                                                <div style="font-size: 13px; color: #94a3b8; margin-bottom: 8px;"><b>Prompt:</b> ${inv.prompt}</div>
                                                <div style="font-size: 13px; color: #cbd5e1; margin-bottom: 8px;"><b>Student:</b> "${inv.transcription}"</div>
                                                <div style="font-size: 13px; font-style: italic; color: #f8fafc;"><b>AI Feedback:</b> "${inv.feedback}"</div>
                                            </div>`;
                                        });
                                        html += '</div>';
                                        return html;
                                    })()}
                                </div>
                            </details>
                        `;
                    });
                } else {
                    historyHTML = '<p style="color:var(--text-muted); font-size:14px; text-align:center; padding:20px;">No diagnostic history available for this student.</p>';
                }
                histContainer.innerHTML = historyHTML;
            } catch (err) {
                console.error("Failed to load history:", err);
                histContainer.innerHTML = `<p style="color:#ef4444; font-size:14px; text-align:center; padding:20px;">Failed to load diagnostic history: ${err.message}</p>`;
            }
        }, 0);
    } catch (e) {
        console.error("Error loading student: ", e);
        content.innerHTML = '<div style="grid-column:span 2; text-align:center; padding:40px; color:var(--accent-red);">Error loading student. Check console.</div>';
    }
};

window.injectStudentDetailsUI = function injectStudentDetailsUI(container) {
    if (!container) return;

    container.innerHTML = `
        <div style="grid-column: span 2; display: flex; gap: 24px;">
            <!-- Form Section -->
            <section class="card" style="flex: 1; height: fit-content;">
                <h3 style="margin-bottom: 20px;">Add New Student</h3>
                <form id="student-form" onsubmit="window.submitStudentForm(event)" style="display: flex; flex-direction: column; gap: 15px;">
                    <div>
                        <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:5px;">Full Name</label>
                        <input type="text" id="student-name" required style="width:100%; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:5px;">Registration Number</label>
                        <input type="text" id="student-reg" required style="width:100%; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:5px;">Branch</label>
                        <input type="text" id="student-branch" required style="width:100%; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
                    </div>
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <label style="font-size:12px; color:var(--text-muted);">Subjects, Marks & Attendance</label>
                            <button type="button" onclick="window.addSubjectRow()" style="padding:4px 12px; background:rgba(59,130,246,0.2); color:var(--accent-blue); border:1px solid rgba(59,130,246,0.4); border-radius:4px; cursor:pointer; font-size:16px; font-weight:bold;">+ Add Subject</button>
                        </div>
                        <div id="subjects-container" style="display:flex; flex-direction:column; gap:8px;">
                            <div class="subject-row" id="subject-row-1" style="display:flex; gap:8px; align-items:center;">
                                <input type="text" placeholder="Subject" required style="flex:2; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
                                <input type="text" placeholder="Marks" required style="flex:1; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
                                <input type="text" placeholder="Attend %" required style="flex:1; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
                                <div style="width:36px;"></div>
                            </div>
                        </div>
                    </div>
                    <button type="submit" id="add-student-btn" style="padding:12px; background:var(--accent-blue); color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer; margin-top:10px;">Add Student</button>
                </form>
            </section>

            <!-- Student List Section -->
            <section class="card" style="flex: 2;">
                <h3 style="margin-bottom: 20px;">Students</h3>
                <div id="students-list" style="display:flex; flex-direction:column; gap:10px;">
                    <!-- Populated by JS -->
                </div>
            </section>
        </div>
    `;

    window.loadStudentsList();
}

// ----------------------------------------------------
// Edit Student Logic
// ----------------------------------------------------
window.editStudentUI = async function(docId) {
    const content = document.getElementById('dashboard-content');
    if (!content) return;
    
    content.innerHTML = '<div style="grid-column:span 2; text-align:center; padding:40px; color:var(--text-muted);">Loading student data for edit...</div>';
    
    try {
        const docSnap = await getDoc(doc(db, "eduflow", docId));
        if (!docSnap.exists() || docSnap.data().uid !== currentUser.uid) {
            content.innerHTML = '<div style="grid-column:span 2; text-align:center; padding:40px; color:var(--accent-red);">Student not found.</div>';
            return;
        }
        const data = docSnap.data();
        
        let subjectRowsHTML = '';
        window.editSubjectCounter = 0;
        
        if (Array.isArray(data.subjects) && data.subjects.length > 0) {
            data.subjects.forEach((s) => {
                window.editSubjectCounter++;
                subjectRowsHTML += `
                    <div class="subject-row" id="edit-subject-row-${window.editSubjectCounter}" style="display:flex; gap:8px; align-items:center;">
                        <input type="text" placeholder="Subject" value="${s.subject || ''}" required style="flex:2; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
                        <input type="text" placeholder="Marks" value="${s.marks || ''}" required style="flex:1; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
                        <input type="text" placeholder="Attend %" value="${s.attendance || ''}" required style="flex:1; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
                        <button type="button" onclick="window.removeEditSubjectRow('edit-subject-row-${window.editSubjectCounter}')" style="width:36px; height:36px; background:rgba(239,68,68,0.2); color:#fca5a5; border:1px solid rgba(239,68,68,0.4); border-radius:4px; cursor:pointer; font-size:18px; display:flex; align-items:center; justify-content:center;">×</button>
                    </div>
                `;
            });
        } else {
            window.editSubjectCounter = 1;
            subjectRowsHTML = `
                <div class="subject-row" id="edit-subject-row-1" style="display:flex; gap:8px; align-items:center;">
                    <input type="text" placeholder="Subject" required style="flex:2; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
                    <input type="text" placeholder="Marks" required style="flex:1; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
                    <input type="text" placeholder="Attend %" required style="flex:1; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
                    <button type="button" onclick="window.removeEditSubjectRow('edit-subject-row-1')" style="width:36px; height:36px; background:rgba(239,68,68,0.2); color:#fca5a5; border:1px solid rgba(239,68,68,0.4); border-radius:4px; cursor:pointer; font-size:18px; display:flex; align-items:center; justify-content:center;">×</button>
                </div>
            `;
        }

        content.innerHTML = `
            <div style="grid-column: span 2;">
                <button onclick="window.showStudentDetail('${docId}')" style="background:none; border:1px solid var(--border-color); color:var(--accent-blue); padding:8px 16px; border-radius:6px; cursor:pointer; font-size:14px; margin-bottom:20px;">← Cancel Edit</button>
            </div>
            
            <section class="card" style="grid-column: span 2;">
                <h3 style="margin-bottom: 20px;">Edit Student: ${data.name}</h3>
                <form id="edit-student-form" onsubmit="window.submitEditStudentForm(event, '${docId}')" style="display: flex; flex-direction: column; gap: 15px;">
                    <div style="display:flex; gap:15px; flex-wrap:wrap;">
                        <div style="flex:1; min-width:200px;">
                            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:5px;">Full Name</label>
                            <input type="text" id="edit-student-name" value="${data.name || ''}" required style="width:100%; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
                        </div>
                        <div style="flex:1; min-width:200px;">
                            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:5px;">Registration Number (Fixed)</label>
                            <input type="text" id="edit-student-reg" value="${data.regNo || docId}" disabled style="width:100%; padding:10px; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); color:var(--text-muted); border-radius:4px; cursor:not-allowed;">
                        </div>
                        <div style="flex:1; min-width:200px;">
                            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:5px;">Branch</label>
                            <input type="text" id="edit-student-branch" value="${data.branch || ''}" required style="width:100%; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
                        </div>
                    </div>
                    
                    <div style="margin-top:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                            <label style="font-size:12px; color:var(--text-muted);">Subjects, Marks & Attendance</label>
                            <button type="button" onclick="window.addEditSubjectRow()" style="padding:4px 12px; background:rgba(59,130,246,0.2); color:var(--accent-blue); border:1px solid rgba(59,130,246,0.4); border-radius:4px; cursor:pointer; font-size:16px; font-weight:bold;">+ Add Subject</button>
                        </div>
                        <div id="edit-subjects-container" style="display:flex; flex-direction:column; gap:8px;">
                            ${subjectRowsHTML}
                        </div>
                    </div>
                    
                    <button type="submit" id="save-edit-btn" style="padding:12px; background:var(--accent-green); color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer; margin-top:20px; width:100%; max-width:300px;">Save Changes</button>
                </form>
            </section>
        `;
    } catch (e) {
        console.error("Error loading student for edit: ", e);
        content.innerHTML = '<div style="grid-column:span 2; text-align:center; padding:40px; color:var(--accent-red);">Error loading student data. Check console.</div>';
    }
};

window.addEditSubjectRow = function() {
    window.editSubjectCounter++;
    const container = document.getElementById('edit-subjects-container');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'subject-row';
    row.id = `edit-subject-row-${window.editSubjectCounter}`;
    row.style.cssText = 'display:flex; gap:8px; align-items:center;';
    row.innerHTML = `
        <input type="text" placeholder="Subject" required style="flex:2; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
        <input type="text" placeholder="Marks" required style="flex:1; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
        <input type="text" placeholder="Attend %" required style="flex:1; padding:10px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:4px;">
        <button type="button" onclick="window.removeEditSubjectRow('edit-subject-row-${window.editSubjectCounter}')" style="width:36px; height:36px; background:rgba(239,68,68,0.2); color:#fca5a5; border:1px solid rgba(239,68,68,0.4); border-radius:4px; cursor:pointer; font-size:18px; display:flex; align-items:center; justify-content:center;">×</button>
    `;
    container.appendChild(row);
};

window.removeEditSubjectRow = function(rowId) {
    const row = document.getElementById(rowId);
    if (row) row.remove();
};

window.submitEditStudentForm = async function(event, docId) {
    event.preventDefault();
    const btn = document.getElementById('save-edit-btn');
    btn.innerText = "Saving...";
    btn.disabled = true;

    const name = document.getElementById('edit-student-name').value;
    const branch = document.getElementById('edit-student-branch').value;

    const rows = document.querySelectorAll('#edit-subjects-container .subject-row');
    const subjects = [];
    rows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        const subName = inputs[0].value.trim();
        const subMarks = inputs[1].value.trim();
        const subAttend = inputs[2].value.trim();
        if (subName && subMarks) {
            subjects.push({ subject: subName, marks: subMarks, attendance: subAttend || '0' });
        }
    });

    try {
        await updateDoc(doc(db, "eduflow", docId), {
            name, branch, subjects
        });
        alert("Student updated successfully!");
        window.showStudentDetail(docId); // Go back to view mode
    } catch (e) {
        console.error("Error updating student: ", e);
        alert("Failed to update student. Check console.");
        btn.innerText = "Save Changes";
        btn.disabled = false;
    }
};

// --- AI GAP ANALYSIS MODAL LOGIC ---
window.openAnalysisModal = function(subject, marks, attendance, name, regNo, docId) {
    const modal = document.getElementById('analysis-modal');
    if (!modal) return;
    
    // Store data for submission
    modal.dataset.studentDocId = docId;
    modal.dataset.subject = subject;
    modal.dataset.marks = marks;
    modal.dataset.attendance = attendance;
    modal.dataset.name = name;
    modal.dataset.regNo = regNo;
    
    document.getElementById('analysis-subtitle').innerText = `Diagnosing ${subject} for ${name} (${regNo})`;
    document.getElementById('analysis-score-badge').innerText = `Score: ${marks}/100`;
    document.getElementById('analysis-attend-badge').innerText = `Attendance: ${attendance}`;
    
    // Reset state
    document.getElementById('notes-upload-label').innerText = 'Upload Professor Notes / Syllabus (Optional PDF)';
    document.getElementById('script-upload-label').innerText = 'Upload Student CAT-1 Answer Sheet (Mandatory PDF)';
    document.getElementById('analysis-loading').style.display = 'none';
    document.getElementById('analysis-loading').querySelector('p').innerText = 'Analyzing student answer script against syllabus...';
    document.getElementById('analysis-results').style.display = 'none';
    document.getElementById('run-analysis-btn').style.display = 'block';
    
    document.getElementById('professor-notes-upload').value = '';
    document.getElementById('answer-script-upload').value = '';
    
    modal.style.display = 'flex';
};

window.closeAnalysisModal = function() {
    const modal = document.getElementById('analysis-modal');
    if (modal) modal.style.display = 'none';
};

window.handleNotesUpload = function(event) {
    const file = event.target.files[0];
    if (file) {
        document.getElementById('notes-upload-label').innerText = file.name;
    }
};

window.handleScriptUpload = function(event) {
    const file = event.target.files[0];
    if (file) {
        document.getElementById('script-upload-label').innerText = file.name;
    }
};

window.runSubjectAnalysis = async function() {
    const modal = document.getElementById('analysis-modal');
    if (!modal) return;

    const answerScriptInput = document.getElementById('answer-script-upload');
    const professorNotesInput = document.getElementById('professor-notes-upload');
    
    const scriptFile = answerScriptInput.files[0];
    const notesFile = professorNotesInput.files[0];

    if (!scriptFile) {
        alert("Please upload the Mandatory Student CAT-1 Answer Sheet (PDF) before running analysis.");
        return;
    }

    const runBtn = document.getElementById('run-analysis-btn');
    const loading = document.getElementById('analysis-loading');
    const results = document.getElementById('analysis-results');
    
    runBtn.style.display = 'none';
    loading.style.display = 'block';
    results.style.display = 'none';

    try {
        const formData = new FormData();
        formData.append("student_id", modal.dataset.regNo);
        formData.append("student_name", modal.dataset.name);
        formData.append("subject", modal.dataset.subject);
        // Ensure marks and attendance are sent as numbers (or at least clean strings without %) to prevent 422 Validation Error
        formData.append("marks", parseInt(modal.dataset.marks, 10) || 0);
        formData.append("attendance", parseInt(modal.dataset.attendance.replace('%', ''), 10) || 0);
        formData.append("answer_script", scriptFile);
        
        if (notesFile) {
            formData.append("professor_notes", notesFile);
        }

        const response = await fetch(`${AI_API_BASE_URL}/api/analyze-script`, {
            method: "POST",
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`API returned status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.analysis) {
            // Save AI text to Firestore
            const docRef = await addDoc(collection(db, "students", modal.dataset.studentDocId, "diagnostics"), {
                subject: modal.dataset.subject,
                marks: modal.dataset.marks,
                attendance: modal.dataset.attendance,
                analysis_report: data.analysis,
                uid: currentUser.uid,
                created_at: serverTimestamp()
            });

            // Display results in Modal
            results.innerHTML = parseMarkdown(data.analysis) + `
                <div style="margin-top: 20px; text-align: center;">
                    <button style="background: rgba(59, 130, 246, 0.1); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.2s; font-size: 13px;" onmouseover="this.style.background='#3b82f6'; this.style.color='#fff';" onmouseout="this.style.background='rgba(59, 130, 246, 0.1)'; this.style.color='#60a5fa';" onclick="startVirtualInterview(this)" data-subject="${modal.dataset.subject}" data-report="${btoa(unescape(encodeURIComponent(data.analysis || '')))}" data-docid="${docRef.id}" data-studentid="${modal.dataset.studentDocId}">
                        Start Virtual Interview
                    </button>
                </div>
            `;
            loading.style.display = 'none';
            results.style.display = 'block';
        }

    } catch (e) {
        console.error("Error running diagnostic:", e);
        results.innerHTML = `<p style="color: #ef4444; margin-bottom: 12px;">Error running diagnostic analysis.</p><p style="color: #94a3b8; font-size: 13px;">${e.message}</p>`;
        loading.style.display = 'none';
        results.style.display = 'block';
    }
};

// Simple Markdown Parser for AI Text
function parseMarkdown(md) {
    if (!md) return '';
    let html = md;
    
    // Headers (# to ####)
    html = html.replace(/^#### (.*$)/gim, '<h4 style="color: #f8fafc; font-weight: 600; margin-top: 12px; margin-bottom: 8px;">$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3 style="color: #f8fafc; font-weight: 600; margin-top: 14px; margin-bottom: 8px;">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 style="color: #f8fafc; font-weight: 700; margin-top: 16px; margin-bottom: 10px;">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 style="color: #f8fafc; font-weight: 700; margin-top: 20px; margin-bottom: 12px; font-size: 20px;">$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Bullet points
    html = html.replace(/^[-*]\s+(.*$)/gim, '<p style="margin-bottom: 6px; color: #94a3b8; display: flex;"><span style="margin-right:8px;">•</span><span>$1</span></p>');

    // Line breaks for remaining text
    html = html.replace(/\n(?!<)/g, '<br/>\n');

    return html;
}

window.injectAnalyticsUI = function(container) {
    if (!container) return;
    container.innerHTML = `
        <div style="grid-column: span 2; display:flex; flex-direction:column; justify-content:center; align-items:center; height: 300px; gap:20px;">
            <div style="color:var(--text-muted); font-size:15px; display:flex; align-items:center; gap:10px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Aggregating AI Diagnostics...
            </div>
        </div>
    `;

    setTimeout(async () => {
        try {
            await window.loadAnalyticsData(container);
        } catch (e) {
            console.error("Error loading analytics:", e);
            container.innerHTML = `<div style="grid-column:span 2; padding:40px; text-align:center; color:var(--accent-red); background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); border-radius:8px;">Failed to load analytics: ${e.message}</div>`;
        }
    }, 0);
};

window.loadAnalyticsData = async function(container) {
    // 1. Fetch Students & Diagnostics
    const studentsQuery = query(collection(db, "eduflow"), where("uid", "==", currentUser.uid));
    const studentsSnap = await getDocs(studentsQuery);
    
    const diagnosticsPromises = [];
    studentsSnap.forEach(docSnap => {
        const studentData = docSnap.data();
        const diagQuery = query(collection(db, "students", docSnap.id, "diagnostics"), where("uid", "==", currentUser.uid));
        
        diagnosticsPromises.push(getDocs(diagQuery).then(snap => {
            const docs = [];
            snap.forEach(d => {
                const diag = d.data();
                diag.studentName = studentData.name || "Unknown";
                diag.studentId = docSnap.id;
                docs.push(diag);
            });
            return docs;
        }));
    });
    
    const allDiagsArrays = await Promise.all(diagnosticsPromises);
    const allDiags = allDiagsArrays.flat();
    
    // Check if empty
    if (allDiags.length === 0) {
        container.innerHTML = '<div style="grid-column:span 2; padding:40px; text-align:center; color:var(--text-muted);">No diagnostic data available to analyze.</div>';
        return;
    }
    
    // Group Data for Module 1
    const subjectStats = {};
    const scatterData = [];
    const highRiskStudents = [];
    
    allDiags.forEach(diag => {
        const subject = diag.subject || 'Unknown';
        const marks = parseFloat(diag.marks) || 0;
        const attend = parseFloat(diag.attendance) || 0;
        
        if (!subjectStats[subject]) subjectStats[subject] = { totalMarks: 0, count: 0 };
        subjectStats[subject].totalMarks += marks;
        subjectStats[subject].count++;
        
        // Scatter plot dataset
        scatterData.push({ x: attend, y: marks, r: 5 });
        
        if (marks < 50 || attend < 75) {
            highRiskStudents.push({
                name: diag.studentName,
                id: diag.studentId,
                subject: subject,
                marks: marks,
                attendance: attend
            });
        }
    });
    
    const barLabels = Object.keys(subjectStats);
    const barData = barLabels.map(s => (subjectStats[s].totalMarks / subjectStats[s].count).toFixed(1));
    
    // Generate High-Risk Table HTML
    let tableRows = '';
    if (highRiskStudents.length > 0) {
        highRiskStudents.forEach(hr => {
            tableRows += `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05); color:var(--text-muted); font-size:13px;">
                    <td style="padding:12px;">${hr.name}</td>
                    <td style="padding:12px;">${hr.subject}</td>
                    <td style="padding:12px; color:${hr.marks < 50 ? 'var(--accent-red)' : 'var(--text-main)'}">${hr.marks}</td>
                    <td style="padding:12px; color:${hr.attendance < 75 ? 'var(--accent-red)' : 'var(--text-main)'}">${hr.attendance}%</td>
                    <td style="padding:12px;">
                        <button onclick="window.showStudentDetail('${hr.id}')" style="background:rgba(255,255,255,0.05); color:var(--accent-blue); border:1px solid rgba(255,255,255,0.1); padding:4px 10px; border-radius:4px; cursor:pointer; font-size:12px;">View Record ↗</button>
                    </td>
                </tr>
            `;
        });
    } else {
        tableRows = '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted);">No high-risk students found!</td></tr>';
    }
    
    // Inject Layout
    container.innerHTML = `
        <style>
            @keyframes spin { 100% { transform: rotate(360deg); } }
            .analytics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; width:100%; grid-column: span 2; }
            @media (max-width: 900px) { .analytics-grid { grid-template-columns: 1fr; } }
        </style>
        
        <div class="analytics-grid">
            <section class="card" style="min-height: 350px;">
                <h3 style="margin-bottom:15px; font-size:15px;">Subject-Wise Knowledge Gap</h3>
                <div style="position:relative; height: 280px; width: 100%;">
                    <canvas id="gap-bar-chart"></canvas>
                </div>
            </section>
            
            <section class="card" style="min-height: 350px;">
                <h3 style="margin-bottom:15px; font-size:15px;">Attendance vs. Score Correlation</h3>
                <div style="position:relative; height: 280px; width: 100%;">
                    <canvas id="corr-scatter-chart"></canvas>
                </div>
            </section>
        </div>
        
        <section class="card" style="grid-column: span 2;">
            <h3 style="margin-bottom:15px; font-size:15px; color:var(--accent-red);">High-Risk Interventions Queue</h3>
            <table style="width:100%; border-collapse:collapse; text-align:left;">
                <thead>
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.1); color:var(--text-muted); font-size:12px;">
                        <th style="padding:10px 12px; font-weight:600;">Student Name</th>
                        <th style="padding:10px 12px; font-weight:600;">Subject</th>
                        <th style="padding:10px 12px; font-weight:600;">Score</th>
                        <th style="padding:10px 12px; font-weight:600;">Attendance</th>
                        <th style="padding:10px 12px; font-weight:600;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </section>
    `;
    
    // Render Charts
    const ctxBar = document.getElementById('gap-bar-chart');
    if (ctxBar) {
        new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: barLabels,
                datasets: [{
                    label: 'Avg Score',
                    data: barData,
                    backgroundColor: 'rgba(96, 165, 250, 0.7)',
                    borderColor: 'rgba(96, 165, 250, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }
    
    const ctxScatter = document.getElementById('corr-scatter-chart');
    if (ctxScatter) {
        new Chart(ctxScatter, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Students',
                    data: scatterData,
                    backgroundColor: 'rgba(239, 68, 68, 0.6)',
                    borderColor: 'rgba(239, 68, 68, 1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Marks: ${context.raw.y}, Attendance: ${context.raw.x}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        title: { display: true, text: 'Marks', color: '#94a3b8' },
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    x: {
                        title: { display: true, text: 'Attendance %', color: '#94a3b8' },
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }
};

// ==========================================
// VIRTUAL INTERVIEW LOGIC
// ==========================================
const INTERVIEW_API_BASE_URL = "https://onion-drugs-robust-nancy.trycloudflare.com";

window.startVirtualInterview = async function(button) {
    const subject = button.getAttribute('data-subject');
    const reportBase64 = button.getAttribute('data-report');
    const docId = button.getAttribute('data-docid');
    const studentId = button.getAttribute('data-studentid');
    const report = decodeURIComponent(escape(atob(reportBase64)));
    
    // Create Modal UI if it doesn't exist
    let modal = document.getElementById('interview-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'interview-modal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; flex-direction: column;">
                <div style="background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 30px; width: 90%; max-width: 600px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
                    <h2 style="color: #f8fafc; font-size: 24px; margin-bottom: 20px;">Virtual Interview: <span style="color:#60a5fa">${subject}</span></h2>
                    
                    <div id="interview-status" style="color: #94a3b8; margin-bottom: 20px; font-size: 14px;">Connecting to AI Interviewer...</div>
                    <div id="interview-prompt" style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin-bottom: 30px; font-style: italic; min-height: 80px;"></div>
                    
                    <div id="record-controls" style="display: none;">
                        <button id="btn-record" style="background: #ef4444; color: white; border: none; padding: 12px 24px; border-radius: 30px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; margin: 0 auto; gap: 8px;">
                            <span style="display: inline-block; width: 12px; height: 12px; background: white; border-radius: 50%; animation: pulse 1.5s infinite;"></span>
                            Start Recording
                        </button>
                    </div>
                    
                    <div style="margin-top: 30px;">
                        <button onclick="document.getElementById('interview-modal').style.display='none'" style="background: transparent; border: none; color: #64748b; cursor: pointer; text-decoration: underline;">Cancel Interview</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    modal.style.display = 'flex';
    const statusEl = document.getElementById('interview-status');
    const promptEl = document.getElementById('interview-prompt');
    const controls = document.getElementById('record-controls');
    const btnRecord = document.getElementById('btn-record');
    
    statusEl.innerText = "Analyzing CAT report & generating prompt...";
    promptEl.innerText = "";
    controls.style.display = 'none';
    
    let originalPromptText = "";
    
    try {
        // 1. Generate Interview Prompt
        const response = await fetch(`${INTERVIEW_API_BASE_URL}/api/generate-interview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analysis_report: report, subject: subject })
        });
        
        if (!response.ok) throw new Error("Failed to generate prompt. Ensure backend is running.");
        
        const data = await response.json();
        originalPromptText = data.prompt_text;
        
        statusEl.innerText = "AI is speaking...";
        promptEl.innerText = `"${originalPromptText}"`;
        
        // Play AI Voice
        if (data.audio_base64) {
            const audio = new Audio(data.audio_base64);
            audio.play();
            audio.onended = () => {
                statusEl.innerText = "Your turn. Click below to start answering.";
                controls.style.display = 'block';
            };
        } else if ('speechSynthesis' in window) {
            const msg = new SpeechSynthesisUtterance(originalPromptText);
            msg.onend = () => {
                statusEl.innerText = "Your turn. Click below to start answering.";
                controls.style.display = 'block';
            };
            window.speechSynthesis.speak(msg);
        } else {
            statusEl.innerText = "Your turn. Click below to start answering.";
            controls.style.display = 'block';
        }
        
    } catch (e) {
        statusEl.innerText = "Error: " + e.message;
        return;
    }
    
    // 2. Recording Logic
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;
    
    btnRecord.onclick = async () => {
        if (!isRecording) {
            // Start Recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                
                mediaRecorder.ondataavailable = event => {
                    audioChunks.push(event.data);
                };
                
                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                     submitInterviewAudio(audioBlob, subject, originalPromptText, statusEl, promptEl, controls, docId, studentId);
        };
                
                mediaRecorder.start();
                isRecording = true;
                btnRecord.innerHTML = "Stop Recording";
                btnRecord.style.background = "#3b82f6"; // blue
                statusEl.innerText = "Recording... Speak clearly.";
                
            } catch (err) {
                alert("Microphone access denied or unavailable.");
            }
        } else {
            // Stop Recording
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(t => t.stop());
            isRecording = false;
            btnRecord.innerHTML = "Start Recording";
            btnRecord.style.background = "#ef4444";
            controls.style.display = 'none';
        }
    };
};

async function submitInterviewAudio(audioBlob, subject, originalPrompt, statusEl, promptEl, controls, docId, studentId) {
    statusEl.innerText = "Transcribing and evaluating your response via Whisper & LLM...";
    promptEl.innerText = "";
    
    const formData = new FormData();
    formData.append('audio', audioBlob, 'response.webm');
    formData.append('subject', subject);
    formData.append('original_prompt', originalPrompt);
    
    try {
        const response = await fetch(`${INTERVIEW_API_BASE_URL}/api/evaluate-interview`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error("Evaluation failed.");
        const result = await response.json();
        
        promptEl.innerHTML = `
            <div style="font-size: 14px; color: #94a3b8; margin-bottom: 15px;">Your Transcript: "${result.transcription}"</div>
            <div style="color: ${result.score >= 70 ? '#10b981' : '#ef4444'}; font-weight: bold; margin-bottom: 10px;">Score: ${result.score}/100</div>
            <div style="font-style: italic; color: #f8fafc;">"${result.ai_voice_response}"</div>
        `;
        
        statusEl.innerText = result.deploy_sandbox ? "Action Required!" : "Interview Passed.";

        // Save interview results to Firestore
        console.log("Attempting to save interview...", { docId, studentId, result });
        if (docId && studentId) {
            try {
                await updateDoc(doc(db, "students", studentId, "diagnostics", docId), {
                    interviews: arrayUnion({
                        prompt: originalPrompt,
                        transcription: result.transcription,
                        score: result.score,
                        feedback: result.ai_voice_response,
                        passed: !result.deploy_sandbox,
                        timestamp: new Date().toISOString()
                    })
                });
            } catch (err) {
                console.error("Error saving interview results:", err);
            }
        }
        
        if (result.audio_base64) {
            const audio = new Audio(result.audio_base64);
            audio.play();
        } else if ('speechSynthesis' in window) {
            const msg = new SpeechSynthesisUtterance(result.ai_voice_response);
            window.speechSynthesis.speak(msg);
        }
        
        if (result.deploy_sandbox) {
            setTimeout(() => {
                document.getElementById('interview-modal').style.display = 'none';
                deploySandboxDrop(subject, result.sandbox_task_title, result.sandbox_task_desc);
            }, 6000); // give them 6 seconds to hear the AI drop the sandbox
        }
        
    } catch (e) {
        statusEl.innerText = "Error: " + e.message;
    }
}

function deploySandboxDrop(subject, taskTitle, taskDesc) {
    const container = document.getElementById('dashboard-content');
    if (!container) return;
    
    // Default fallback if backend didn't provide one
    const title = taskTitle || "Secure Code Implementation";
    const desc = taskDesc || `Write a short script to demonstrate practical mastery of ${subject}.`;
    
    const sandboxHTML = `
        <section class="card" id="sandbox-deployment" style="border: 2px solid #ef4444; background: rgba(239, 68, 68, 0.05); margin-bottom: 20px; animation: slideDown 0.5s ease-out;">
            <div style="display: flex; align-items: center; margin-bottom: 15px; color: #ef4444;">
                <span class="material-icons-outlined" style="margin-right: 10px;">warning</span>
                <h3 style="margin: 0; color: #ef4444;">SANDBOX DEPLOYED: IMMEDIATE ACTION REQUIRED</h3>
            </div>
            <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
                Your interview response failed to demonstrate practical application. You have been assigned a mandatory micro-project.
            </p>
            
            <div style="background: #1e293b; border-radius: 8px; padding: 20px; border: 1px solid #334155;">
                <h4 style="color: #60a5fa; margin-top: 0; margin-bottom: 10px;">Task: ${title}</h4>
                <p style="color: #94a3b8; font-size: 13px; margin-bottom: 15px;">${desc}</p>
                <textarea id="sandbox-code-editor" style="width: 100%; height: 150px; background: #0f172a; color: #10b981; font-family: 'Roboto Mono', monospace; border: 1px solid #334155; border-radius: 4px; padding: 10px; resize: vertical;" placeholder="# Write your code here..."></textarea>
                <div id="sandbox-eval-result" style="margin-top: 10px; font-size: 13px;"></div>
                <div style="text-align: right; margin-top: 10px;">
                    <button class="upgrade-btn" style="background: #ef4444; color: white; border: none; padding: 8px 20px;" onclick="submitSandboxCode(this, '${btoa(unescape(encodeURIComponent(title)))}', '${btoa(unescape(encodeURIComponent(desc)))}')">Run Code</button>
                </div>
            </div>
        </section>
    `;
    
    // Inject at the top
    container.insertAdjacentHTML('afterbegin', sandboxHTML);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.submitSandboxCode = async function(btn, titleB64, descB64) {
    const title = decodeURIComponent(escape(atob(titleB64)));
    const desc = decodeURIComponent(escape(atob(descB64)));
    const code = document.getElementById('sandbox-code-editor').value;
    const resultDiv = document.getElementById('sandbox-eval-result');
    
    if (!code.trim()) {
        resultDiv.innerHTML = '<span style="color: #ef4444;">Please write some code first!</span>';
        return;
    }
    
    btn.innerText = "Evaluating...";
    btn.disabled = true;
    resultDiv.innerHTML = '<span style="color: #60a5fa;">Running AI Code Analysis...</span>';
    
    try {
        const response = await fetch(`${INTERVIEW_API_BASE_URL}/api/evaluate-sandbox-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: code,
                task_title: title,
                task_desc: desc
            })
        });
        
        if (!response.ok) throw new Error("Evaluation failed");
        
        const result = await response.json();
        
        if (result.passed) {
            resultDiv.innerHTML = `<span style="color: #10b981; font-weight: bold;">PASSED ✓</span> <br/><span style="color: #94a3b8;">${result.feedback}</span>`;
            btn.style.display = 'none';
        } else {
            resultDiv.innerHTML = `<span style="color: #ef4444; font-weight: bold;">FAILED ✗</span> <br/><span style="color: #94a3b8;">${result.feedback}</span>`;
            btn.innerText = "Try Again";
            btn.disabled = false;
        }
        
    } catch (e) {
        resultDiv.innerHTML = `<span style="color: #ef4444;">Error: ${e.message}</span>`;
        btn.innerText = "Run Code";
        btn.disabled = false;
    }
};