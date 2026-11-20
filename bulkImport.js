/* ==========================================================================
   BULK IMPORT
   Uses the SheetJS (XLSX) library already loaded for the existing Excel
   export feature. Scope note: imported rows only carry the core fields
   below — a bulk-imported student's other fields (DOB, program, state/
   LGA, photo, signature) stay blank until edited individually, since a
   spreadsheet realistically won't carry a photo or signature anyway.
   ========================================================================== */

let pendingBulkImportRows = [];

function handleBulkImportFile() {
  const fileInput = document.getElementById("bulkImportFile");
  const file = fileInput.files[0];
  if (!file) return;
  showNotification("Reading file...", "info");

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      pendingBulkImportRows = rows;
      renderBulkImportPreview(rows);
    } catch (err) {
      showNotification("Could not read that file. Please make sure it's a valid Excel or CSV file.", "error");
    }
  };
  reader.onerror = function () { showNotification("Could not read that file.", "error"); };
  reader.readAsArrayBuffer(file);
}

// Accepts a few likely header spellings so the file doesn't have to
// match one exact template.
function normalizeBulkRow(row) {
  const get = (keys) => {
    for (const k of keys) { if (row[k] !== undefined && String(row[k]).trim() !== "") return String(row[k]).trim(); }
    return "";
  };
  return {
    name: get(["Name", "name", "Student Name", "Full Name"]),
    admission: get(["Admission", "admission", "Admission Number", "Admission No"]),
    department: get(["Department", "department"]),
    level: get(["Level", "level"]),
    gender: get(["Gender", "gender"]),
    phone: get(["Phone", "phone"]),
    email: get(["Email", "email"])
  };
}

function validateBulkRow(row, existingAdmissions, seenInBatch) {
  const errors = [];
  if (!row.name) errors.push("Missing name");
  if (!row.admission) errors.push("Missing admission number");
  if (!row.department) errors.push("Missing department");
  if (row.admission) {
    const key = row.admission.toLowerCase();
    if (existingAdmissions.has(key)) errors.push("Admission number already exists");
    else if (seenInBatch.has(key)) errors.push("Duplicate within this file");
    else seenInBatch.add(key);
  }
  return errors;
}

function renderBulkImportPreview(rawRows) {
  const container = document.getElementById("bulkImportPreviewContainer");
  const existingAdmissions = new Set(StudentService.getAll().map(s => (s.admission || "").toLowerCase()));
  const seenInBatch = new Set();

  const rows = rawRows.map(raw => {
    const row = normalizeBulkRow(raw);
    return { ...row, errors: validateBulkRow(row, existingAdmissions, seenInBatch) };
  });

  const validCount = rows.filter(r => r.errors.length === 0).length;
  const invalidCount = rows.length - validCount;

  const tableRows = rows.map(r => `
    <tr style="${r.errors.length ? "background:#3a1414;" : ""}">
      <td style="padding:6px 8px;">${r.name || "—"}</td>
      <td>${r.admission || "—"}</td>
      <td>${r.department || "—"}</td>
      <td>${r.level || "—"}</td>
      <td style="color:${r.errors.length ? "#ff6b6b" : "#4CAF50"};">${r.errors.length ? r.errors.join(", ") : "Valid"}</td>
    </tr>
  `).join("");

  container.innerHTML = `
    <div class="dashboard-stats-grid">
      <div class="stat-card color-2"><h4>Valid Rows</h4><span>${validCount}</span></div>
      <div class="stat-card color-1"><h4>Rows With Errors</h4><span>${invalidCount}</span></div>
    </div>
    <h3 style="margin-top:20px; color:var(--accent-color,#3fdd33);">Preview</h3>
    <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse; margin-top:10px;">
        <thead><tr style="text-align:left; border-bottom:1px solid var(--accent-color,#3fdd33);"><th>Name</th><th>Admission</th><th>Department</th><th>Level</th><th>Status</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <div style="margin-top:15px;">
      <button class="submitBtn" style="width:auto; padding:12px 24px;" onclick="confirmBulkImport()" ${validCount === 0 ? "disabled" : ""}>
        <i class="fas fa-file-import"></i> Import ${validCount} Valid Student(s)
      </button>
    </div>
  `;
}

function confirmBulkImport() {
  const existingAdmissions = new Set(StudentService.getAll().map(s => (s.admission || "").toLowerCase()));
  const seen = new Set();
  const toImport = [];

  pendingBulkImportRows.map(normalizeBulkRow).forEach(row => {
    const errors = validateBulkRow(row, existingAdmissions, seen);
    if (errors.length) return;
    toImport.push({
      admission: row.admission,
      name: row.name,
      department: row.department,
      level: row.level || "",
      gender: row.gender || "",
      phone: row.phone || "",
      email: row.email || "",
      status: "Active",
      image: "",
      signature: "",
      registrationDate: new Date().toLocaleString()
    });
  });

  if (!toImport.length) { showNotification("No valid new students to import.", "warning"); return; }
  if (!window.confirm(`Import ${toImport.length} student record(s)? This cannot be undone.`)) return;

  const allStudents = StudentService.getAll();
  toImport.forEach(s => allStudents.push(s));
  StudentService.saveAll(allStudents);
  students = StudentService.getAll(); // keep script.js's in-memory copy in sync

  logActivity("Bulk Import", `Imported ${toImport.length} student(s) from file.`);
  showNotification(`Successfully imported ${toImport.length} student(s)`, "success");

  pendingBulkImportRows = [];
  document.getElementById("bulkImportPreviewContainer").innerHTML = "";
  document.getElementById("bulkImportFile").value = "";
}
