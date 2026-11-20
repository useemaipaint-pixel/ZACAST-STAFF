/* ==========================================================================
   PROMOTE STUDENTS
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
  const select = document.getElementById("promoteDeptFilter");
  if (select) {
    const deptNames = Object.keys(typeof deptData !== "undefined" ? deptData : {});
    select.innerHTML = `<option value="All">All Departments</option>` + deptNames.map(d => `<option value="${d}">${d}</option>`).join("");
  }
});

function nextLevel(level) {
  if (level === "100 level") return "200 level";
  if (level === "200 level") return "300 level";
  return null;
}

function loadStudentsForPromotion() {
  const dept = document.getElementById("promoteDeptFilter").value;
  const fromLevel = document.getElementById("promoteFromLevel").value;
  const container = document.getElementById("promoteStudentsList");
  const submitWrap = document.getElementById("promoteSubmitWrap");

  if (!fromLevel) { showNotification("Please select a level to promote from.", "warning"); return; }

  const matchingStudents = StudentService.getAll().filter(s => (dept === "All" || !dept || s.department === dept) && s.level === fromLevel);

  if (!matchingStudents.length) {
    container.innerHTML = `<div class="paper-placeholder" style="width:auto; min-height:auto; padding:24px;">
      <i class="fas fa-user-graduate" style="font-size:24px; color:var(--accent-color,#3fdd33);"></i>
      <p style="margin-top:8px;">No students found at this level.</p>
    </div>`;
    submitWrap.style.display = "none";
    return;
  }

  container.innerHTML = `
    <label style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
      <input type="checkbox" id="promoteSelectAll" onchange="togglePromoteSelectAll(this)"> Select All (${matchingStudents.length})
    </label>
  ` + matchingStudents.map(s => `
    <label style="display:flex; align-items:center; gap:10px; background:#005a33; padding:10px 14px; border-radius:6px; margin-top:6px;">
      <input type="checkbox" class="promote-student-checkbox" value="${s.admission}">
      <span>${s.name} <small style="color:#b9dcc6;">(${s.admission}) · ${s.department}</small></span>
    </label>
  `).join("");

  submitWrap.style.display = "block";
}

function togglePromoteSelectAll(checkbox) {
  document.querySelectorAll(".promote-student-checkbox").forEach(cb => { cb.checked = checkbox.checked; });
}

function submitBulkPromotion() {
  const checkboxes = document.querySelectorAll(".promote-student-checkbox:checked");
  if (!checkboxes.length) { showNotification("Please select at least one student to promote.", "warning"); return; }

  const fromLevel = document.getElementById("promoteFromLevel").value;
  const toLevel = nextLevel(fromLevel);
  if (!toLevel) { showNotification("Students at this level cannot be promoted further.", "warning"); return; }

  const admissions = Array.from(checkboxes).map(cb => cb.value);
  if (!window.confirm(`Promote ${admissions.length} student(s) from ${fromLevel} to ${toLevel}? This cannot be undone.`)) return;

  const allStudents = StudentService.getAll();
  let promotedCount = 0;
  admissions.forEach(admission => {
    const idx = allStudents.findIndex(s => s.admission === admission);
    if (idx !== -1) { allStudents[idx].level = toLevel; promotedCount++; }
  });
  StudentService.saveAll(allStudents);
  students = StudentService.getAll();

  logActivity("Student Promotion", `Promoted ${promotedCount} student(s) from ${fromLevel} to ${toLevel}.`);
  showNotification(`${promotedCount} student(s) promoted successfully`, "success");
  loadStudentsForPromotion();
}
