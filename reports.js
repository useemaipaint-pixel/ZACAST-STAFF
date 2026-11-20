/* ==========================================================================
   REPORTING SUITE
   ========================================================================== */

let currentReportData = null;

function renderReport(type) {
  const container = document.getElementById("reportOutputContainer");
  const students = StudentService.getAll();
  const courses = CourseService.getAll();

  if (type === "students") {
    const rows = students.map(s => [s.name, s.admission, s.department, s.level, s.status || "Active"]);
    renderReportTable(container, "Student Report", ["Name", "Admission", "Department", "Level", "Status"], rows);

  } else if (type === "departments") {
    const rows = Object.keys(deptData).map(d => [
      d,
      students.filter(s => s.department === d).length,
      courses.filter(c => c.department === d).length
    ]);
    renderReportTable(container, "Department Report", ["Department", "Students", "Courses"], rows);

  } else if (type === "admissions") {
    const rows = students.map(s => [s.name, s.admission, s.department, s.year || "—"]);
    renderReportTable(container, "Admission Report", ["Name", "Admission", "Department", "Academic Year"], rows);

  } else if (type === "attendance") {
    const records = AttendanceService.getAll();
    const byStudent = {};
    records.forEach(r => {
      byStudent[r.studentAdmission] = byStudent[r.studentAdmission] || { present: 0, late: 0, absent: 0, total: 0 };
      byStudent[r.studentAdmission].total++;
      if (r.status === "Present") byStudent[r.studentAdmission].present++;
      else if (r.status === "Late") byStudent[r.studentAdmission].late++;
      else byStudent[r.studentAdmission].absent++;
    });
    const rows = Object.keys(byStudent).map(adm => {
      const st = StudentService.getByAdmission(adm);
      const s = byStudent[adm];
      const pct = s.total ? (((s.present + s.late) / s.total) * 100).toFixed(1) : "0.0";
      return [st ? st.name : adm, adm, s.present, s.late, s.absent, pct + "%"];
    });
    renderReportTable(container, "Attendance Report", ["Name", "Admission", "Present", "Late", "Absent", "Attendance %"], rows);

  } else if (type === "results") {
    const results = ResultService.getAll().filter(r => r.published);
    const rows = results.map(r => {
      const st = StudentService.getByAdmission(r.studentAdmission);
      return [st ? st.name : r.studentAdmission, r.studentAdmission, r.courseCode, r.total, r.grade];
    });
    renderReportTable(container, "Result Report", ["Name", "Admission", "Course", "Total", "Grade"], rows);

  } else if (type === "gpa") {
    const rows = students.map(s => {
      const results = ResultService.getByStudent(s.admission).filter(r => r.published);
      const cgpa = ResultService.computeGpa(results, courses);
      return [s.name, s.admission, cgpa.toFixed(2)];
    });
    renderReportTable(container, "GPA/CGPA Report", ["Name", "Admission", "CGPA"], rows);

  } else if (type === "courses") {
    const rows = courses.map(c => [c.code, c.title, c.department, c.level, c.unit, c.type]);
    renderReportTable(container, "Course Report", ["Code", "Title", "Department", "Level", "Unit", "Type"], rows);
  }
}

function renderReportTable(container, title, headers, rows) {
  currentReportData = { title, headers, rows };

  if (!rows.length) {
    container.innerHTML = `<div class="paper-placeholder" style="width:auto; min-height:auto; padding:24px;">
      <i class="fas fa-chart-bar" style="font-size:24px; color:var(--accent-color,#3fdd33);"></i>
      <p style="margin-top:8px;">No data available for this report yet.</p>
    </div>`;
    return;
  }

  container.innerHTML = `
    <div id="printableReport">
      <h2 style="color:var(--accent-color,#3fdd33);">${title}</h2>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; margin-top:10px;">
          <thead><tr style="text-align:left; border-bottom:1px solid var(--accent-color,#3fdd33);">${headers.map(h => `<th style="padding:6px 8px;">${h}</th>`).join("")}</tr></thead>
          <tbody>${rows.map(r => `<tr>${r.map(c => `<td style="padding:6px 8px;">${c}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </div>
    <div style="margin-top:15px; display:flex; gap:8px; flex-wrap:wrap;">
      <button class="action-btn btn-pdf" onclick="downloadReportPDF()"><i class="fas fa-file-pdf"></i> PDF</button>
      <button class="action-btn" style="background:#217346;" onclick="downloadReportExcel()"><i class="fas fa-file-excel"></i> Excel</button>
      <button class="action-btn" style="background:#2f7a58;" onclick="downloadReportCSV()"><i class="fas fa-file-csv"></i> CSV</button>
      <button class="action-btn btn-print" onclick="window.print()"><i class="fas fa-print"></i> Print</button>
    </div>
  `;
}

function downloadReportPDF() {
  const el = document.getElementById("printableReport");
  if (!el || !currentReportData) return;
  showNotification("Generating PDF...", "info");
  exportHTMLToPDF(el, currentReportData.title.replace(/\s+/g, "_") + ".pdf", { orientation: "landscape", width: 1100 })
    .then(() => showNotification("PDF generated successfully", "success"))
    .catch(() => showNotification("Something went wrong generating the PDF", "error"));
}

function downloadReportExcel() {
  if (!currentReportData) return;
  const { title, headers, rows } = currentReportData;
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, title.slice(0, 30));
  XLSX.writeFile(workbook, title.replace(/\s+/g, "_") + ".xlsx");
  showNotification("Excel file exported successfully", "success");
}

function downloadReportCSV() {
  if (!currentReportData) return;
  const { title, headers, rows } = currentReportData;
  const csvLines = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))];
  const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = title.replace(/\s+/g, "_") + ".csv";
  link.click();
  showNotification("CSV file exported successfully", "success");
}
