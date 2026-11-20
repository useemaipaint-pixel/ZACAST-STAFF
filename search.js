/* ==========================================================================
   GLOBAL SEARCH
   ========================================================================== */

function performGlobalSearch() {
  const query = document.getElementById("globalSearchInput").value.trim().toLowerCase();
  const container = document.getElementById("globalSearchResults");
  if (!query) { container.innerHTML = ""; return; }

  const studentMatches = StudentService.getAll().filter(s =>
    (s.name || "").toLowerCase().includes(query) || (s.admission || "").toLowerCase().includes(query)
  ).slice(0, 10);

  const courseMatches = CourseService.getAll().filter(c =>
    (c.code || "").toLowerCase().includes(query) || (c.title || "").toLowerCase().includes(query)
  ).slice(0, 10);

  const deptMatches = Object.keys(typeof deptData !== "undefined" ? deptData : {})
    .filter(d => d.toLowerCase().includes(query)).slice(0, 10);

  const announcementMatches = (typeof AnnouncementService !== "undefined" ? AnnouncementService.getAll() : []).filter(a =>
    (a.title || "").toLowerCase().includes(query) || (a.message || "").toLowerCase().includes(query)
  ).slice(0, 10);

  if (!studentMatches.length && !courseMatches.length && !deptMatches.length && !announcementMatches.length) {
    container.innerHTML = `<div class="paper-placeholder" style="width:auto; min-height:auto; padding:24px;">
      <i class="fas fa-magnifying-glass" style="font-size:24px; color:var(--accent-color,#3fdd33);"></i>
      <p style="margin-top:8px;">No results found for "${query}".</p>
    </div>`;
    return;
  }

  let html = "";
  if (studentMatches.length) {
    html += `<h3 style="color:var(--accent-color,#3fdd33); margin-top:15px;">Students</h3>`;
    html += studentMatches.map(s => `
      <div class="global-search-result-row" onclick="jumpToStudentSearch('${s.admission}')">
        <i class="fas fa-user"></i> <strong>${s.name}</strong> <small style="color:#b9dcc6;">(${s.admission}) · ${s.department}</small>
      </div>`).join("");
  }
  if (courseMatches.length) {
    html += `<h3 style="color:var(--accent-color,#3fdd33); margin-top:15px;">Courses</h3>`;
    html += courseMatches.map(c => `
      <div class="global-search-result-row" onclick="showSection('courses')">
        <i class="fas fa-book"></i> <strong>${c.code}</strong> — ${c.title}
      </div>`).join("");
  }
  if (deptMatches.length) {
    html += `<h3 style="color:var(--accent-color,#3fdd33); margin-top:15px;">Departments</h3>`;
    html += deptMatches.map(d => `
      <div class="global-search-result-row" onclick="jumpToDepartment('${d}')">
        <i class="fas fa-building-columns"></i> ${d}
      </div>`).join("");
  }
  if (announcementMatches.length) {
    html += `<h3 style="color:var(--accent-color,#3fdd33); margin-top:15px;">Announcements</h3>`;
    html += announcementMatches.map(a => `
      <div class="global-search-result-row" onclick="showSection('announcements')">
        <i class="fas fa-bullhorn"></i> <strong>${a.title}</strong>
      </div>`).join("");
  }
  container.innerHTML = html;
}

function jumpToStudentSearch(admission) {
  showSection("search");
  document.getElementById("searchInput").value = admission;
  searchStudent();
}

function jumpToDepartment(dept) {
  showSection("departmental");
  setTimeout(() => openDepartmentDetail(dept), 50);
}
