import { clearSession, getSession, gqlRequest, saveSession, signIn } from "./api.js";
import { renderAuditRatio, renderXpByProject, renderXpOverTime } from "./charts.js";

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const loginView   = document.getElementById("login-view");
const profileView = document.getElementById("profile-view");
const appRoot     = document.getElementById("app");
const loginForm   = document.getElementById("login-form");
const loginError  = document.getElementById("login-error");
const logoutBtn   = document.getElementById("logout-btn");
const refreshBtn  = document.getElementById("refresh-btn");
const passwordInput    = document.getElementById("password");
const togglePasswordBtn = document.getElementById("toggle-password");
const passwordEye      = document.getElementById("password-eye");

// Profile DOM
const welcomeName    = document.getElementById("welcome-name");
const sidebarLogin   = document.getElementById("sidebar-login");
const sidebarId      = document.getElementById("sidebar-id");
const sidebarCampus  = document.getElementById("sidebar-campus");
const sidebarEmail   = document.getElementById("sidebar-email");
const totalXpEl      = document.getElementById("total-xp");
const auditRatioEl   = document.getElementById("audit-ratio-value");
const xpHistory      = document.getElementById("xp-history");
const skillsList     = document.getElementById("skills-list");
const xpTimeChart    = document.getElementById("xp-time-chart");
const auditChart     = document.getElementById("audit-chart");
const xpProjectChart = document.getElementById("xp-project-chart");

// Nav
const navLinks = Array.from(document.querySelectorAll(".nav-link"));
const sections = Array.from(document.querySelectorAll(".content-section"));

// ─── GraphQL queries ──────────────────────────────────────────────────────────
const QUERIES = {
  // Normal query
  me: `
    query Me {
      user {
        id
        login
        attrs
        campus
      }
    }
  `,
  // Query with arguments (variables)
  xpByUser: `
    query XpByUser($userId: Int!) {
      transaction(
        where: { userId: { _eq: $userId }, type: { _eq: "xp" } }
        order_by: { createdAt: asc }
      ) {
        amount
        path
        createdAt
        object {
          name
          type
        }
      }
    }
  `,
  skillByUser: `
    query SkillByUser($userId: Int!) {
      transaction(
        where: { userId: { _eq: $userId }, type: { _like: "skill_%" } }
        order_by: { amount: desc }
      ) {
        type
        amount
      }
    }
  `,
  // Nested query
  auditByUserNested: `
    query AuditByUserNested($userId: Int!) {
      user(where: { id: { _eq: $userId } }) {
        id
        auditRatio
      }
    }
  `,
  auditTransactions: `
    query AuditTransactions($userId: Int!) {
      transaction(
        where: { userId: { _eq: $userId }, type: { _in: ["up", "down"] } }
      ) {
        type
        amount
      }
    }
  `,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtXp(n) {
  return `${(Number(n || 0) / 1000).toFixed(2)} kB`;
}

function parseAttrs(attrs) {
  if (!attrs) return null;
  if (typeof attrs === "string") {
    try { return JSON.parse(attrs); } catch { return null; }
  }
  return attrs;
}

function parseEmail(attrs) {
  const a = parseAttrs(attrs);
  return a?.email || "N/A";
}

function parseFullName(user) {
  const a = parseAttrs(user.attrs);
  if (!a) return user.login || "N/A";
  if (typeof a.fullName === "string" && a.fullName.trim()) return a.fullName.trim();
  if (typeof a.name === "string" && a.name.trim()) return a.name.trim();
  const first = typeof a.firstName === "string" ? a.firstName.trim() : "";
  const last  = typeof a.lastName  === "string" ? a.lastName.trim()  : "";
  return `${first} ${last}`.trim() || user.login || "N/A";
}

// ─── Render helpers ───────────────────────────────────────────────────────────
function renderSidebar(user, fullName) {
  welcomeName.textContent  = fullName;
  sidebarLogin.textContent = user.login  || "N/A";
  sidebarId.textContent    = user.id;
  sidebarCampus.textContent = user.campus || "N/A";
  sidebarEmail.textContent  = parseEmail(user.attrs);
}

function renderXpSection(transactions) {
  const total = transactions.reduce((s, t) => s + t.amount, 0);
  totalXpEl.textContent = fmtXp(total);

  // XP history list
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  xpHistory.innerHTML = sorted.length
    ? sorted.map((tx) => {
        const date = new Date(tx.createdAt).toLocaleDateString();
        const name = tx.object?.name || tx.path.split("/").filter(Boolean).at(-1) || tx.path;
        return `<div class="hist-row">
          <span class="hist-name" title="${tx.path}">${name}</span>
          <span class="hist-meta">${fmtXp(tx.amount)} · ${date}</span>
        </div>`;
      }).join("")
    : "<p class='no-data'>No XP history found.</p>";

  // Project chart data
  const projectOnly = transactions.filter((tx) =>
    tx.object?.type ? tx.object.type === "project" : !tx.path.includes("/exercise/")
  );
  const grouped = projectOnly.reduce((acc, tx) => {
    const name = tx.object?.name || tx.path.split("/").filter(Boolean).at(-1) || "unknown";
    if (!acc[name]) acc[name] = { xp: 0, submittedAt: new Date(tx.createdAt).getTime() };
    acc[name].xp += tx.amount;
    acc[name].submittedAt = Math.min(acc[name].submittedAt, new Date(tx.createdAt).getTime());
    return acc;
  }, {});
  const projectData = Object.entries(grouped).map(([project, d]) => ({ project, ...d }));
  renderXpByProject(xpProjectChart, projectData);
}

function renderSkills(skills) {
  const grouped = skills.reduce((acc, s) => {
    const label = String(s.type || "").replace(/^skill_/, "").replace(/_/g, " ").trim();
    if (!label) return acc;
    acc[label] = Math.max(acc[label] || 0, Number(s.amount || 0));
    return acc;
  }, {});

  const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  const maxVal = Math.max(...entries.map((e) => e[1]), 1);

  skillsList.innerHTML = entries.length
    ? entries.map(([skill, amount]) => `
        <div class="skill-row">
          <span class="skill-name">${skill}</span>
          <div class="skill-bar-bg">
            <div class="skill-bar-fill" style="width:${Math.round((amount / maxVal) * 100)}%"></div>
          </div>
          <span class="skill-val">${amount}</span>
        </div>`).join("")
    : "<p class='no-data'>No skills found.</p>";
}

function renderAuditSection(auditTx, auditNested) {
  let given = 0, received = 0;
  for (const tx of auditTx) {
    const a = Number(tx.amount || 0);
    if (tx.type === "up")   given    += a || 1;
    if (tx.type === "down") received += a || 1;
  }
  const ratio = received ? (given / received).toFixed(2) : "N/A";
  auditRatioEl.textContent = ratio;
  renderAuditRatio(auditChart, given, received);
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function navigateTo(id) {
  navLinks.forEach((l) => l.classList.toggle("active", l.dataset.section === id));
  sections.forEach((s) => s.classList.toggle("active", s.id === id));
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => navigateTo(link.dataset.section));
});

// ─── Auth flow ────────────────────────────────────────────────────────────────
function showLogin() {
  appRoot.classList.remove("dashboard-mode");
  loginView.classList.remove("hidden");
  profileView.classList.add("hidden");
}

function showProfile() {
  appRoot.classList.add("dashboard-mode");
  loginView.classList.add("hidden");
  profileView.classList.remove("hidden");
}

function setLoginError(msg) {
  loginError.textContent = msg || "";
}

togglePasswordBtn.addEventListener("click", () => {
  const show = passwordInput.type === "text";
  passwordInput.type = show ? "password" : "text";
  passwordEye.textContent = show ? "👁" : "🙈";
  togglePasswordBtn.setAttribute("aria-label", show ? "Show password" : "Hide password");
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setLoginError("");

  const form       = new FormData(loginForm);
  const identifier = String(form.get("identifier") || "").trim();
  const password   = String(form.get("password")   || "").trim();
  const domain     = String(form.get("domain")     || "").trim().replace(/^https?:\/\//, "");

  if (!identifier || !password || !domain) {
    setLoginError("All fields are required dawg.");
    return;
  }

  const btn = loginForm.querySelector("button[type='submit']");
  btn.disabled = true;
  btn.textContent = "Signing in…";

  try {
    const jwt = await signIn({ domain, identifier, password });
    const session = { domain, jwt };
    saveSession(session);
    await loadProfile(session);
    showProfile();
  } catch (err) {
    setLoginError(err.message || "Login failed. Check your credentials.");
    clearSession();
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign in";
  }
});

logoutBtn.addEventListener("click", () => {
  clearSession();
  showLogin();
});

refreshBtn.addEventListener("click", async () => {
  const session = getSession();
  if (!session) return;
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing…";
  try {
    await loadProfile(session);
  } catch {
    clearSession();
    showLogin();
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "↻ Refresh";
  }
});

// ─── Load profile ─────────────────────────────────────────────────────────────
async function loadProfile(session) {
  const meData = await gqlRequest({ domain: session.domain, jwt: session.jwt, query: QUERIES.me });
  const me = meData.user?.[0];
  if (!me) throw new Error("No user data returned.");

  const [xpData, skillData, auditTxData, auditNestedData] = await Promise.all([
    gqlRequest({ domain: session.domain, jwt: session.jwt, query: QUERIES.xpByUser,         variables: { userId: me.id } }),
    gqlRequest({ domain: session.domain, jwt: session.jwt, query: QUERIES.skillByUser,       variables: { userId: me.id } }),
    gqlRequest({ domain: session.domain, jwt: session.jwt, query: QUERIES.auditTransactions, variables: { userId: me.id } }),
    gqlRequest({ domain: session.domain, jwt: session.jwt, query: QUERIES.auditByUserNested, variables: { userId: me.id } }),
  ]);

  const fullName = parseFullName(me);
  renderSidebar(me, fullName);
  renderXpSection(xpData.transaction || []);
  renderSkills(skillData.transaction || []);
  renderAuditSection(auditTxData.transaction || [], auditNestedData.user || []);
  renderXpOverTime(xpTimeChart, xpData.transaction || []);
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
  const session = getSession();
  if (!session) { showLogin(); return; }
  try {
    await loadProfile(session);
    showProfile();
  } catch {
    clearSession();
    showLogin();
  }
}

bootstrap();
