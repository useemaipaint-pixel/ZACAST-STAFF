/* ==========================================================================
   DEPARTMENT WORKSPACE
   ==========================================================================
   Rebuilds "Departmental" from a flat list of paper-scan buttons into a
   real per-department dashboard: a grid of department cards, each
   opening a dedicated view with that department's students, courses,
   average GPA, attendance rate, and the existing ND1/ND2 paper viewer
   (openPaper/downloadPaperAsPDF in script.js — unchanged, just reused).

   This file introduces no new storage key of its own — it's a
   read-only aggregation over StudentService, CourseService,
   ResultService and AttendanceService, keyed by the same canonical
   department names as deptData (see script.js), so what shows up here
   always matches what the Course/Attendance/Results modules use.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
  renderDepartmentGrid();
});

function renderDepartmentGrid() {
  const grid = document.getElementById("departmentGrid");
  const detail = document.getElementById("departmentDetailView");
  if (!grid) return;
  detail.style.display = "none";
  detail.innerHTML = "";
  grid.style.display = "flex";

  const students = StudentService.getAll();
  const courses = CourseService.getAll();

  grid.innerHTML = "";
  Object.keys(deptData).forEach(dept => {
    const deptStudentCount = students.filter(s => s.department === dept).length;
    const deptCourseCount = courses.filter(c => c.department === dept).length;

    const card = document.createElement("div");
    card.className = "setting-box department-card";
    card.style.cursor = "pointer";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `Open ${dept} department dashboard`);
    card.innerHTML = `
      <h3><i class="fas fa-building-columns" style="color:var(--accent-color,#3fdd33); margin-right:8px;"></i>${dept}</h3>
      <div style="display:flex; gap:15px; margin-top:8px; font-size:13px; color:#b9dcc6;">
        <span><i class="fas fa-users"></i> ${deptStudentCount} Student(s)</span>
        <span><i class="fas fa-book"></i> ${deptCourseCount} Course(s)</span>
      </div>
    `;
    card.addEventListener("click", () => openDepartmentDetail(dept));
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDepartmentDetail(dept); } });
    grid.appendChild(card);
  });
}

function openDepartmentDetail(dept) {
  const grid = document.getElementById("departmentGrid");
  const detail = document.getElementById("departmentDetailView");
  grid.style.display = "none";
  detail.style.display = "block";

  const students = StudentService.getAll().filter(s => s.department === dept);
  const courses = CourseService.getAll().filter(c => c.department === dept);
  const courseCodesInDept = courses.map(c => c.code);
  const results = ResultService.getAll().filter(r => r.published && courseCodesInDept.includes(r.courseCode));
  const attendanceRecords = AttendanceService.getAll().filter(a => courseCodesInDept.includes(a.courseCode));

  const avgGpa = ResultService.computeGpa(results, courses);
  const attendedCount = attendanceRecords.filter(a => a.status === "Present" || a.status === "Late").length;
  const attendancePct = attendanceRecords.length ? (attendedCount / attendanceRecords.length) * 100 : 0;

  const activeStudents = students.filter(s => (s.status || "Active") === "Active").length;
  const level1Count = students.filter(s => s.level === "100 level").length;
  const level2Count = students.filter(s => s.level === "200 level").length;

  detail.innerHTML = `
    <button class="action-btn" style="background:#2f7a58; margin-bottom:15px;" onclick="renderDepartmentGrid()">
      <i class="fas fa-arrow-left"></i> Back to Departments</button>
    <h2 style="color:var(--accent-color,#3fdd33); margin-bottom:5px;">
      <i class="fas fa-building-columns"></i> ${dept}</h2>

    <div class="dashboard-stats-grid" style="margin-top:15px;">
      <div class="stat-card color-1"><h4>Total Students</h4><span>${students.length}</span></div>
      <div class="stat-card color-2"><h4>Active Students</h4><span>${activeStudents}</span></div>
      <div class="stat-card color-3"><h4>Courses</h4><span>${courses.length}</span></div>
    </div>
    <div class="dashboard-stats-grid">
      <div class="stat-card color-1"><h4>100 Level</h4><span>${level1Count}</span></div>
      <div class="stat-card color-2"><h4>200 Level</h4><span>${level2Count}</span></div>
      <div class="stat-card color-3"><h4>Average GPA</h4><span>${avgGpa.toFixed(2)}</span></div>
    </div>
    <div class="dashboard-stats-grid">
      <div class="stat-card color-1"><h4>Attendance Rate</h4><span>${attendancePct.toFixed(1)}%</span></div>
    </div>

    <h3 style="margin-top:25px; color:var(--accent-color,#3fdd33);">Students</h3>
    <div id="deptStudentsList">${renderDeptStudentsList(students)}</div>

    <h3 style="margin-top:25px; color:var(--accent-color,#3fdd33);">Courses</h3>
    <div id="deptCoursesList">${renderDeptCoursesList(courses)}</div>

    <h3 style="margin-top:25px; color:var(--accent-color);">Departmental Papers</h3>
    <div id="paperManagerBox"></div>
  `;

  renderPaperManager(dept);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDeptStudentsList(students) {
  if (!students.length) return `<p style="color:#a9d0b7;">No students registered in this department yet.</p>`;
  return students.map(s => `
    <div style="display:flex; justify-content:space-between; background:#005a33; border-radius:8px; padding:10px 14px; margin-top:6px; flex-wrap:wrap; gap:5px;">
      <span>${s.name} <small style="color:#b9dcc6;">(${s.admission})</small></span>
      <span style="color:#b9dcc6;">${s.level || ""}</span>
    </div>
  `).join("");
}

function renderDeptCoursesList(courses) {
  if (!courses.length) return `<p style="color:#a9d0b7;">No courses added for this department yet.</p>`;
  return courses.map(c => `
    <div style="display:flex; justify-content:space-between; background:#005a33; border-radius:8px; padding:10px 14px; margin-top:6px; flex-wrap:wrap; gap:5px;">
      <span>${c.code} — ${c.title}</span>
      <span style="color:#b9dcc6;">${c.level} · ${c.unit} Unit(s)</span>
    </div>
  `).join("");
}
