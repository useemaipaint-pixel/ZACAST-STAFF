/* ==========================================================================
   ZACAST STAFF APP  (Lecturer + Admin)
   Admin  : controls everything (students, academics, papers, accounts, backup)
   Lecturer: teaching tools only — what a lecturer may open is set by the Admin
   ========================================================================== */
window.ZacastApp = (function () {
  const app = { role: null, user: null, current: "home" };
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const SECTION_PERM = {
    search: "students", globalSearch: "students", courses: "courses", results: "results", gpaDashboard: "results",
    attendance: "attendance", timetable: "timetable", announcements: "announcements", support: "support",
    documents: "documents", reports: "reports", departmental: "departmental", studentVerification: "verification"
  };
  const ADMIN_ONLY = ["register", "bulkImport", "promote", "admin", "accounts"];
  const PERM_LABELS = {
    students: "Search students & global search", courses: "Courses", results: "Results & GPA", attendance: "Attendance",
    timetable: "Timetable", announcements: "Announcements", support: "Support tickets", documents: "Student documents",
    reports: "Reports", departmental: "Departmental papers (view only)", verification: "Verify student ID"
  };

  app.isAdmin = () => app.role === "admin";
  function perms() { return Object.assign({}, ...Object.keys(PERM_LABELS).map(k => ({ [k]: true })), ZacastStorage.getJSON("lecturerPermissions", {})); }
  app.canOpen = function (id) {
    if (!app.user) return false;
    if (app.role === "admin") return true;
    if (ADMIN_ONLY.includes(id)) return false;
    const p = SECTION_PERM[id];
    return !p || perms()[p] !== false;
  };
  app.visibleAnnouncements = function () {
    if (app.role === "admin") return AnnouncementService.getAll().filter(AnnouncementService.isPublished);
    return AnnouncementService.getRelevantFor({ role: "lecturer" });
  };
  app.sanitizeEdit = (rec, old) => { if (old && old.registrationDate) rec.registrationDate = old.registrationDate; return rec; };
  app.onStudentRegistered = function (admission) { showNotification(`Student ${admission} registered.`, "success"); };

  /* ---------------- start-up ---------------- */
  app.onReady = async function () {
    updateHomeLiveClock(); setInterval(updateHomeLiveClock, 1000);
    initializeFilterOptions(); initStates(); initializeDigitalSignaturePad();
    restoreSavedTheme(); restoreSidebarCollapseState(); restoreNavGroupState();
    restoreNotificationSoundPreference(); restoreNotificationPreferences();
    await StaffAuth.ensureDefaults();
    const acc = StaffAuth.getSession();
    if (acc) enter(acc, true); else showLogin();
  };

  function showLogin() {
    app.user = null; app.role = null;
    document.body.classList.remove("role-admin", "role-lecturer");
    document.body.classList.add("guest-mode");
    $("appMainWorkspace").style.display = "none";
    $("gatewayWelcomePage").style.display = "flex";
    $("adminLoginBox").style.display = "none";
    $("lecturerLoginBox").style.display = "block";
  }

  function enter(acc, silent) {
    app.user = acc; app.role = acc.role;
    document.body.classList.remove("guest-mode", "role-admin", "role-lecturer");
    document.body.classList.add("role-" + acc.role);
    $("gatewayWelcomePage").style.display = "none";
    $("appMainWorkspace").style.display = "grid";
    $("sidebarUserName").textContent = acc.name || acc.username;
    $("sidebarUserRole").textContent = acc.role === "admin" ? "ADMINISTRATOR" : "LECTURER";
    applyNavPermissions();
    showSection(acc.role === "admin" ? "admin" : "home");
    if (!silent) showNotification(`Welcome, ${acc.name || acc.username}`, "success");
  }

  function applyNavPermissions() {
    const p = perms();
    document.querySelectorAll("[data-perm]").forEach(el => {
      el.style.display = (app.role === "lecturer" && p[el.dataset.perm] === false) ? "none" : "";
    });
  }

  /* ---------------- login actions ---------------- */
  async function doLogin(role, uId, pId) {
    const r = await StaffAuth.login(role, $(uId).value, $(pId).value);
    if (!r.ok) { showNotification(r.error, "error"); return; }
    $(pId).value = "";
    logActivity("Staff Login", `${r.account.name || r.account.username} (${role}) logged in.`);
    enter(r.account);
  }
  window.lecturerLogin = () => doLogin("lecturer", "lecUser", "lecPass");
  window.adminLogin = () => doLogin("admin", "admUser", "admPass");
  window.fingerprintLogin = async function () {
    const r = await StaffAuth.loginWithFingerprint();
    if (!r.ok) { showNotification(r.error, "error"); return; }
    logActivity("Staff Login", `${r.account.name || r.account.username} (admin) logged in with fingerprint.`);
    enter(r.account);
  };
  window.showAdminLoginBox = function () {
    $("lecturerLoginBox").style.display = "none"; $("adminLoginBox").style.display = "block";
    StaffAuth.fingerprintSupported().then(ok => { $("fpLoginBtn").style.display = ok ? "flex" : "none"; });
  };
  window.showLecturerLoginBox = function () { $("adminLoginBox").style.display = "none"; $("lecturerLoginBox").style.display = "block"; };
  window.logoutEntireSystemWorkspace = function () {
    if (app.user) logActivity("Staff Logout", `${app.user.name || app.user.username} logged out.`);
    StaffAuth.clearSession();
    ["lecPass", "admPass"].forEach(i => { if ($(i)) $(i).value = ""; });
    showLogin();
  };

  /* ---------------- section hooks ---------------- */
  app.refreshViews = function () {
    // someone changed data elsewhere
    const acc = StaffAuth.getSession();
    if (app.user && !acc) { showNotification("Your account was changed or removed. Please log in again.", "warning"); logoutEntireSystemWorkspace(); return; }
    if (acc) { app.user = acc; app.role = acc.role; applyNavPermissions(); }
    if (app.current && app.current !== "register" && app.current !== "accounts") app.onSectionOpen(app.current);
  };

  app.onSectionOpen = function (id) {
    app.current = id;
    switch (id) {
      case "home": renderStaffHome(); break;
      case "admin": initializeFilterOptions(); loadAdminPanel(); break;
      case "departmental": renderDepartmentGrid(); break;
      case "support": renderAllTickets(); break;
      case "announcements": populateAnnouncementDepartmentDropdown(); renderAnnouncementsList(); break;
      case "courses": populateCourseDepartmentDropdowns(); renderCoursesList(); break;
      case "results": populateResultCourseDropdown(); break;
      case "attendance": populateAttendanceDropdowns(); break;
      case "timetable": populateTimetableDropdowns(); renderTimetableGrid(); break;
      case "notifications": renderNotificationsList(); updateNotificationBadge(); break;
      case "accounts": if (app.isAdmin()) renderAccountsPage(); break;
    }
  };

  function renderStaffHome() {
    if (!app.user) return;
    $("staffHomeName").textContent = app.user.name || app.user.username;
    $("staffHomeRole").textContent = app.role === "admin" ? "Administrator" : "Lecturer";
    const students = StudentService.getAll(), tickets = SupportTicketService.getAll();
    const tiles = [
      ["search", "fa-users", students.length, "Students"],
      ["courses", "fa-book", CourseService.getAll().length, "Courses"],
      ["support", "fa-headset", tickets.filter(t => t.status === "Pending").length, "Pending Tickets"],
      ["announcements", "fa-bullhorn", AnnouncementService.getAll().length, "Announcements"]
    ].filter(t => app.canOpen(t[0]));
    $("staffHomeTiles").innerHTML = tiles.map(t => `<button class="tile" onclick="showSection('${t[0]}')"><i class="fas ${t[1]}"></i><b>${t[2]}</b><span>${t[3]}</span></button>`).join("");
    const acts = ActivityService.getAll().slice(-6).reverse();
    $("staffHomeActivity").innerHTML = acts.length ? acts.map(a => `<div class="mini-item"><b>${esc(a.type)}</b><div style="opacity:.8;">${esc(a.detail)}</div></div>`).join("") : "<p style='opacity:.7;'>No activity yet.</p>";
  }

  /* ==================================================================
     DEPARTMENT PAPERS — Admin can upload / replace / rename / delete
     ================================================================== */
  const DEPTS = () => Object.keys(deptData);
  window.renderPaperManager = async function (dept) {
    const box = $("paperManagerBox"); if (!box) return;
    box.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Loading papers…</p>`;
    const admin = app.isAdmin();
    const idx = DEPTS().indexOf(dept);
    const cards = await Promise.all(PaperStore.LEVELS.map(async lv => {
      const p = await PaperStore.get(dept, lv);
      return `<div class="paper-card">
        ${p.exists ? `<img class="paper-thumb" src="${p.src}" alt="${esc(p.title)}" onclick="openZoomModal(this.src)">` : `<div class="paper-thumb-empty">No paper uploaded</div>`}
        <h4 style="margin-top:10px;">${esc(p.title)}</h4>
        <small style="color:#bfe8cd;">${lv}${p.exists ? (p.custom ? " · updated " + esc(p.updatedAt || "") : " · default file") : ""}</small>
        <div class="paper-actions">
          ${p.exists ? `<button class="action-btn btn-edit" onclick="openPaper(DEPTS_LIST()[${idx}],'${lv}')"><i class="fas fa-eye"></i> View</button>` : ""}
          ${admin ? `
            <button class="action-btn btn-pdf" onclick="document.getElementById('paperFile_${lv}').click()"><i class="fas fa-upload"></i> ${p.exists ? "Replace" : "Upload"}</button>
            <input type="file" id="paperFile_${lv}" accept="image/png,image/jpeg,image/webp" hidden onchange="uploadPaper(${idx},'${lv}',this)">
            <button class="action-btn btn-edit" onclick="editPaperTitle(${idx},'${lv}')"><i class="fas fa-pen"></i> Edit title</button>
            ${p.exists ? `<button class="action-btn" style="background:#c0392b;" onclick="deletePaper(${idx},'${lv}')"><i class="fas fa-trash"></i> Delete</button>` : ""}` : ""}
        </div></div>`;
    }));
    box.innerHTML = `<div class="paper-grid">${cards.join("")}</div>${admin ? "" : '<p style="opacity:.7; margin-top:8px; font-size:12px;">View only — the Admin manages papers.</p>'}`;
  };
  window.DEPTS_LIST = DEPTS;
  window.uploadPaper = async function (idx, lv, input) {
    if (!app.isAdmin()) return;
    const dept = DEPTS()[idx], file = input.files && input.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { showNotification("Please choose an image (JPG/PNG).", "warning"); return; }
    try {
      showNotification("Uploading paper…", "info");
      const image = await ZacastImage.compress(file, 1400, 0.82);
      const old = await PaperStore.get(dept, lv);
      await PaperStore.save(dept, lv, { image, title: old.title, by: app.user.username });
      logActivity("Paper Uploaded", `${dept} ${lv} paper uploaded by ${app.user.username}`);
      showNotification(`${dept} ${lv} paper saved`, "success");
    } catch (e) { showNotification("Could not save the paper: " + (e.message || e), "error"); }
    input.value = "";
    renderPaperManager(dept);
  };
  window.editPaperTitle = async function (idx, lv) {
    if (!app.isAdmin()) return;
    const dept = DEPTS()[idx];
    const p = await PaperStore.get(dept, lv);
    const t = window.prompt("Edit paper title:", p.title);
    if (t === null || !t.trim()) return;
    try { await PaperStore.save(dept, lv, { title: t.trim(), image: p.custom ? p.src : undefined }); showNotification("Title updated", "success"); logActivity("Paper Edited", `${dept} ${lv} title changed`); }
    catch (e) { showNotification("Could not update: " + (e.message || e), "error"); }
    renderPaperManager(dept);
  };
  window.deletePaper = async function (idx, lv) {
    if (!app.isAdmin()) return;
    const dept = DEPTS()[idx];
    if (!window.confirm(`Delete the ${dept} ${lv} paper? Students will no longer see it.`)) return;
    try { await PaperStore.remove(dept, lv); showNotification("Paper deleted", "success"); logActivity("Paper Deleted", `${dept} ${lv} paper deleted by ${app.user.username}`); }
    catch (e) { showNotification("Could not delete: " + (e.message || e), "error"); }
    renderPaperManager(dept);
  };

  /* ==================================================================
     ACCOUNTS CONTROL (Admin only)
     ================================================================== */
  async function renderAccountsPage() {
    const box = $("accountsContent"); if (!box) return;
    const list = StaffAuth.getAll();
    const me = app.user;
    const fpOk = await StaffAuth.fingerprintSupported();
    const mine = list.find(a => a.id === me.id) || me;
    const p = perms();
    box.innerHTML = `
      <div class="setting-box" style="width:100%;">
        <h3><i class="fas fa-users-gear"></i> Staff Accounts (login username & password)</h3>
        <div id="acctList">${list.map(a => `
          <div class="acct-row">
            <div><b>${esc(a.name || a.username)}</b> <span class="badge ${a.role}">${a.role.toUpperCase()}</span>
              <div style="font-size:12px; color:#bfe8cd;">Username: ${esc(a.username)}${(a.fingerprints || []).length ? " · <i class='fas fa-fingerprint'></i> " + a.fingerprints.length : ""}</div></div>
            <div style="display:flex; gap:6px;">
              <button class="action-btn btn-edit" onclick="openAccountEditor('${a.id}')"><i class="fas fa-pen"></i> Edit</button>
              <button class="action-btn" style="background:#c0392b;" onclick="deleteStaffAccount('${a.id}')"><i class="fas fa-trash"></i></button>
            </div>
          </div>`).join("")}</div>
        <h4 style="margin-top:18px; color:var(--accent-color);">Add a new account</h4>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
          <select id="newAcctRole" style="flex:1; min-width:120px;"><option value="lecturer">Lecturer</option><option value="admin">Admin</option></select>
          <input id="newAcctName" placeholder="Full name" style="flex:2; min-width:150px;">
          <input id="newAcctUser" placeholder="Username" style="flex:2; min-width:140px;">
          <input id="newAcctPass" type="password" placeholder="Password (min 6)" style="flex:2; min-width:140px;">
          <button class="submitBtn" style="width:auto; padding:10px 20px;" onclick="addStaffAccount()"><i class="fas fa-plus"></i> Add</button>
        </div>
      </div>

      <div class="setting-box" style="width:100%; margin-top:16px;">
        <h3><i class="fas fa-fingerprint"></i> My Fingerprint Login (${esc(mine.username)})</h3>
        <p style="font-size:13px; color:#bfe8cd; margin:6px 0;">Register this device's fingerprint (or screen lock) so you can log in as Admin without typing the password.</p>
        <div>${(mine.fingerprints || []).map(f => `<div class="mini-item" style="display:flex; justify-content:space-between; align-items:center;"><span><i class="fas fa-fingerprint"></i> ${esc(f.label)} <small style="opacity:.7;">· ${esc(f.createdAt)}</small></span><button class="action-btn" style="background:#c0392b;" onclick="removeMyFingerprint('${f.id}')"><i class="fas fa-xmark"></i></button></div>`).join("") || "<p style='opacity:.7; font-size:13px;'>No fingerprint registered yet.</p>"}</div>
        <button class="submitBtn" style="width:auto; padding:10px 20px; margin-top:10px;" ${fpOk ? "" : "disabled"} onclick="registerMyFingerprint()"><i class="fas fa-fingerprint"></i> Register fingerprint on this device</button>
        ${fpOk ? "" : '<p style="font-size:12px; color:#ffb3b3; margin-top:6px;">This device/browser does not support fingerprint here (needs HTTPS + fingerprint or screen lock).</p>'}
      </div>

      <div class="setting-box" style="width:100%; margin-top:16px;">
        <h3><i class="fas fa-user-lock"></i> What can a Lecturer open?</h3>
        ${Object.keys(PERM_LABELS).map(k => `
          <label class="perm-row"><span>${PERM_LABELS[k]}</span>
            <input type="checkbox" ${p[k] !== false ? "checked" : ""} onchange="setLecturerPerm('${k}', this.checked)"></label>`).join("")}
      </div>

      <div class="setting-box" style="width:100%; margin-top:16px;">
        <h3><i class="fas fa-broom"></i> Data control</h3>
        <button class="action-btn" style="background:#c0392b;" onclick="clearActivityLogAdmin()"><i class="fas fa-trash"></i> Clear activity log</button>
        <button class="action-btn btn-backup" onclick="backupSystemData()"><i class="fas fa-database"></i> Backup everything</button>
        <button class="action-btn btn-print" onclick="triggerRestoreData()"><i class="fas fa-upload"></i> Restore backup</button>
      </div>`;
  }
  window.addStaffAccount = async function () {
    const r = await StaffAuth.addAccount({ role: $("newAcctRole").value, name: $("newAcctName").value, username: $("newAcctUser").value, password: $("newAcctPass").value });
    if (!r.ok) { showNotification(r.error, "error"); return; }
    logActivity("Account Added", `${$("newAcctRole").value} account "${$("newAcctUser").value}" created`);
    showNotification("Account added", "success"); renderAccountsPage();
  };
  window.deleteStaffAccount = function (id) {
    const a = StaffAuth.getAll().find(x => x.id === id);
    if (!a || !window.confirm(`Delete the ${a.role} account "${a.username}"?`)) return;
    const r = StaffAuth.removeAccount(id);
    if (!r.ok) { showNotification(r.error, "error"); return; }
    logActivity("Account Deleted", `${a.role} account "${a.username}" deleted`);
    if (id === app.user.id) { logoutEntireSystemWorkspace(); return; }
    showNotification("Account deleted", "success"); renderAccountsPage();
  };
  window.openAccountEditor = function (id) {
    const a = StaffAuth.getAll().find(x => x.id === id); if (!a) return;
    let m = $("acctEditModal");
    if (!m) { m = document.createElement("div"); m.id = "acctEditModal"; m.className = "modal-backdrop-blur"; document.body.appendChild(m); }
    m.innerHTML = `<div class="admin-login-card">
      <div style="text-align:right;"><i class="fas fa-times close-modal-btn" onclick="document.getElementById('acctEditModal').style.display='none'"></i></div>
      <h2>Edit ${esc(a.role)} account</h2>
      <input id="editAcctName" placeholder="Full name" value="${esc(a.name || "")}">
      <input id="editAcctUser" placeholder="Username" value="${esc(a.username)}">
      <input id="editAcctPass" type="password" placeholder="New password (leave empty to keep)">
      <button class="submitBtn" onclick="saveAccountEditor('${a.id}')">Save changes</button></div>`;
    m.style.display = "flex";
  };
  window.saveAccountEditor = async function (id) {
    const r = await StaffAuth.updateAccount(id, { name: $("editAcctName").value, username: $("editAcctUser").value, password: $("editAcctPass").value });
    if (!r.ok) { showNotification(r.error, "error"); return; }
    $("acctEditModal").style.display = "none";
    logActivity("Account Updated", `Account "${r.account.username}" updated`);
    showNotification("Account updated", "success");
    if (id === app.user.id) { app.user = r.account; $("sidebarUserName").textContent = r.account.name || r.account.username; }
    renderAccountsPage();
  };
  window.registerMyFingerprint = async function () {
    const r = await StaffAuth.registerFingerprint(app.user.id);
    if (!r.ok) { showNotification(r.error, "error"); return; }
    showNotification("Fingerprint registered on this device", "success"); renderAccountsPage();
  };
  window.removeMyFingerprint = function (fpId) { StaffAuth.removeFingerprint(app.user.id, fpId); renderAccountsPage(); };
  window.setLecturerPerm = function (key, on) {
    const cur = ZacastStorage.getJSON("lecturerPermissions", {}); cur[key] = !!on;
    ZacastStorage.setJSON("lecturerPermissions", cur);
    logActivity("Permissions", `Lecturer access to "${PERM_LABELS[key]}" ${on ? "allowed" : "blocked"}`);
  };
  window.clearActivityLogAdmin = function () {
    if (!window.confirm("Clear the whole activity log?")) return;
    ActivityService.saveAll([]); activities = [];
    showNotification("Activity log cleared", "success");
  };

  return app;
})();
