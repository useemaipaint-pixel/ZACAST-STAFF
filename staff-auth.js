/* ==========================================================================
   STAFF AUTH — Lecturer & Admin accounts (stored hashed, synced in the cloud).
   Defaults (change them in Admin > Accounts Control):
     Lecturer  LECTURER / zacast123
     Admin     Admin    / admin123   (+ fingerprint once registered)
   NOTE: this is browser-side authentication. It keeps normal people out but a
   determined technical person could bypass it — see SETUP.md "Security".
   ========================================================================== */
window.StaffAuth = (function (storage) {
  const KEY = "staffAccounts";
  const SESSION = "zacastStaffSession";
  const FAILS = "zc:loginFails";
  const DEFAULTS = [
    { id: "lecturer-default", role: "lecturer", name: "Lecturer", username: "LECTURER", pass: "zacast123" },
    { id: "admin-default", role: "admin", name: "Administrator", username: "Admin", pass: "admin123" }
  ];

  /* ---------- hashing ---------- */
  function sha256Fallback(str) {
    const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const bytes = Array.from(unescape(encodeURIComponent(str))).map(c => c.charCodeAt(0));
    const l = bytes.length * 8; bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (l >>> (i * 8)) & 255);
    let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const rr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < bytes.length; o += 64) {
      const w = [];
      for (let i = 0; i < 16; i++) w[i] = (bytes[o+i*4]<<24)|(bytes[o+i*4+1]<<16)|(bytes[o+i*4+2]<<8)|bytes[o+i*4+3];
      for (let i = 16; i < 64; i++) { const s0 = rr(w[i-15],7)^rr(w[i-15],18)^(w[i-15]>>>3), s1 = rr(w[i-2],17)^rr(w[i-2],19)^(w[i-2]>>>10); w[i] = (w[i-16]+s0+w[i-7]+s1)|0; }
      let [a,b,c,d,e,f,g,hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = rr(e,6)^rr(e,11)^rr(e,25), ch = (e&f)^(~e&g), t1 = (hh+S1+ch+K[i]+w[i])|0;
        const S0 = rr(a,2)^rr(a,13)^rr(a,22), mj = (a&b)^(a&c)^(b&c), t2 = (S0+mj)|0;
        hh=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
      }
      h = [(h[0]+a)|0,(h[1]+b)|0,(h[2]+c)|0,(h[3]+d)|0,(h[4]+e)|0,(h[5]+f)|0,(h[6]+g)|0,(h[7]+hh)|0];
    }
    return h.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }
  async function sha256(str) {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    }
    return sha256Fallback(str);
  }
  const hashPassword = (p) => sha256("zacast|" + p);

  /* ---------- accounts ---------- */
  let memoryDefaults = null;   // used only when the cloud is configured but unreachable on first run
  async function buildDefaults() {
    const out = [];
    for (const d of DEFAULTS) out.push({ id: d.id, role: d.role, name: d.name, username: d.username, password: await hashPassword(d.pass), fingerprints: [], createdAt: new Date().toLocaleString() });
    return out;
  }
  async function ensureDefaults() {
    let list = storage.getJSON(KEY, null);
    if (Array.isArray(list) && list.length) {
      if (!list.some(a => a.role === "admin")) { const d = await buildDefaults(); list.push(d[1]); storage.setJSON(KEY, list); }
      return;
    }
    const defaults = await buildDefaults();
    if (storage.cloud && storage.status !== "online") { memoryDefaults = defaults; return; }   // do not seed from an offline device
    storage.setJSON(KEY, defaults);
  }
  function getAll() {
    const list = storage.getJSON(KEY, null);
    if (Array.isArray(list) && list.length) return list;
    return memoryDefaults || [];
  }
  function saveAll(list) { memoryDefaults = null; return storage.setJSON(KEY, list); }

  /* ---------- brute-force slow-down ---------- */
  function lockInfo() { try { return JSON.parse(localStorage.getItem(FAILS) || "{}"); } catch (e) { return {}; } }
  function noteFail() {
    const f = lockInfo(); f.n = (f.n || 0) + 1;
    if (f.n >= 5) { f.until = Date.now() + 60000; f.n = 0; }
    localStorage.setItem(FAILS, JSON.stringify(f));
  }
  function clearFails() { localStorage.removeItem(FAILS); }

  async function login(role, username, password) {
    const f = lockInfo();
    if (f.until && f.until > Date.now()) return { ok: false, error: `Too many wrong attempts. Wait ${Math.ceil((f.until - Date.now()) / 1000)} seconds.` };
    const u = String(username || "").trim().toLowerCase();
    if (!u || !password) return { ok: false, error: "Enter your username and password." };
    const hash = await hashPassword(password);
    const acc = getAll().find(a => a.role === role && String(a.username).toLowerCase() === u && a.password === hash);
    if (!acc) { noteFail(); return { ok: false, error: "Wrong username or password." }; }
    clearFails(); setSession(acc);
    return { ok: true, account: acc };
  }

  /* ---------- session ---------- */
  function setSession(acc) { localStorage.setItem(SESSION, JSON.stringify({ id: acc.id, role: acc.role, at: Date.now() })); }
  function clearSession() { localStorage.removeItem(SESSION); }
  function getSession() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION) || "null");
      if (!s) return null;
      const acc = getAll().find(a => a.id === s.id && a.role === s.role);
      return acc || null;
    } catch (e) { return null; }
  }

  /* ---------- account management (Admin) ---------- */
  function uniqueName(list, role, username, exceptId) {
    const u = String(username).trim().toLowerCase();
    return !list.some(a => a.role === role && a.id !== exceptId && String(a.username).toLowerCase() === u);
  }
  async function addAccount({ role, name, username, password }) {
    username = String(username || "").trim(); name = String(name || "").trim() || username;
    if (!username || !password) return { ok: false, error: "Username and password are required." };
    if (String(password).length < 6) return { ok: false, error: "Password must be at least 6 characters." };
    const list = getAll().slice();
    if (!uniqueName(list, role, username)) return { ok: false, error: "That username is already used." };
    list.push({ id: role + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), role, name, username, password: await hashPassword(password), fingerprints: [], createdAt: new Date().toLocaleString() });
    saveAll(list);
    return { ok: true };
  }
  async function updateAccount(id, { name, username, password }) {
    const list = getAll().map(a => Object.assign({}, a));
    const acc = list.find(a => a.id === id);
    if (!acc) return { ok: false, error: "Account not found." };
    if (username !== undefined && String(username).trim()) {
      if (!uniqueName(list, acc.role, username, id)) return { ok: false, error: "That username is already used." };
      acc.username = String(username).trim();
    }
    if (name !== undefined && String(name).trim()) acc.name = String(name).trim();
    if (password) {
      if (String(password).length < 6) return { ok: false, error: "Password must be at least 6 characters." };
      acc.password = await hashPassword(password);
    }
    saveAll(list);
    return { ok: true, account: acc };
  }
  function removeAccount(id) {
    const list = getAll();
    const acc = list.find(a => a.id === id);
    if (!acc) return { ok: false, error: "Account not found." };
    if (acc.role === "admin" && list.filter(a => a.role === "admin").length <= 1) return { ok: false, error: "You cannot delete the only Admin account." };
    saveAll(list.filter(a => a.id !== id));
    return { ok: true };
  }
  async function verifyPassword(id, password) {
    const acc = getAll().find(a => a.id === id);
    return !!acc && acc.password === await hashPassword(password);
  }

  /* ---------- fingerprint (WebAuthn platform authenticator) ---------- */
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64 = (s) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
  async function fingerprintSupported() {
    try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { return false; }
  }
  function deviceLabel() {
    const ua = navigator.userAgent;
    const os = /android/i.test(ua) ? "Android" : /iphone|ipad/i.test(ua) ? "iPhone/iPad" : /windows/i.test(ua) ? "Windows" : /mac/i.test(ua) ? "Mac" : "Device";
    const br = /edg/i.test(ua) ? "Edge" : /chrome/i.test(ua) ? "Chrome" : /safari/i.test(ua) ? "Safari" : /firefox/i.test(ua) ? "Firefox" : "Browser";
    return `${os} · ${br}`;
  }
  async function registerFingerprint(accountId) {
    if (!(await fingerprintSupported())) return { ok: false, error: "This device/browser has no fingerprint (or screen-lock) support, or the page is not on HTTPS." };
    const list = getAll().map(a => Object.assign({}, a, { fingerprints: (a.fingerprints || []).slice() }));
    const acc = list.find(a => a.id === accountId);
    if (!acc) return { ok: false, error: "Account not found." };
    try {
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: "ZACAST Staff Portal", id: location.hostname },
          user: { id: new TextEncoder().encode(acc.id), name: acc.username, displayName: acc.name || acc.username },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
          timeout: 60000, attestation: "none"
        }
      });
      acc.fingerprints.push({ id: b64(cred.rawId), label: deviceLabel(), createdAt: new Date().toLocaleString() });
      saveAll(list);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e && e.name === "NotAllowedError" ? "Fingerprint set-up was cancelled." : "Could not set up fingerprint: " + (e.message || e) };
    }
  }
  function removeFingerprint(accountId, fpId) {
    const list = getAll().map(a => Object.assign({}, a));
    const acc = list.find(a => a.id === accountId);
    if (!acc) return;
    acc.fingerprints = (acc.fingerprints || []).filter(f => f.id !== fpId);
    saveAll(list);
  }
  async function loginWithFingerprint() {
    if (!(await fingerprintSupported())) return { ok: false, error: "Fingerprint login is not available on this device/browser (needs HTTPS and a fingerprint or screen lock)." };
    const admins = getAll().filter(a => a.role === "admin");
    const ids = [];
    admins.forEach(a => (a.fingerprints || []).forEach(f => ids.push(f.id)));
    if (!ids.length) return { ok: false, error: "No fingerprint is registered yet. Log in with your password first, then enable it in Accounts Control." };
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const cred = await navigator.credentials.get({
        publicKey: { challenge, rpId: location.hostname, userVerification: "required", timeout: 60000,
          allowCredentials: ids.map(id => ({ type: "public-key", id: unb64(id), transports: ["internal"] })) }
      });
      const client = JSON.parse(new TextDecoder().decode(cred.response.clientDataJSON));
      if (client.type !== "webauthn.get" || client.challenge !== b64(challenge) || client.origin !== location.origin) return { ok: false, error: "Fingerprint check failed." };
      const rid = b64(cred.rawId);
      const acc = admins.find(a => (a.fingerprints || []).some(f => f.id === rid));
      if (!acc) return { ok: false, error: "This fingerprint is not registered for any Admin." };
      clearFails(); setSession(acc);
      return { ok: true, account: acc };
    } catch (e) {
      return { ok: false, error: e && e.name === "NotAllowedError" ? "Fingerprint cancelled or not recognised on this device." : "Fingerprint error: " + (e.message || e) };
    }
  }

  return { ensureDefaults, getAll, login, getSession, clearSession, setSession, addAccount, updateAccount, removeAccount, verifyPassword,
    fingerprintSupported, registerFingerprint, removeFingerprint, loginWithFingerprint, hashPassword };
})(window.ZacastStorage);
