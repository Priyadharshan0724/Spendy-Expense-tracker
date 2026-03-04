/**
 * app.js — Spendly
 * ─────────────────────────────────────────────────────────────────
 * Main application logic:
 *   • Authentication (Google via Firebase, with demo-mode fallback)
 *   • Expense CRUD  (LocalStorage, keyed per user UID)
 *   • Category filter
 *   • Stats calculation
 *   • Chart.js doughnut chart
 *   • jsPDF export
 * ─────────────────────────────────────────────────────────────────
 */

import { signInWithGoogle, signOutUser, onAuthChange, isConfigured }
  from "./firebase.js";

// ══════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════

const CAT_COLORS = {
  Food:          "#f97316",
  Transport:     "#3b82f6",
  Health:        "#ec4899",
  Entertainment: "#8b5cf6",
  Shopping:      "#f59e0b",
  Utilities:     "#14b8a6",
  Rent:          "#ef4444",
  Other:         "#6b7280"
};

// ══════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════

let currentUser   = null;   // Firebase User object (or demo user)
let expenses      = [];     // Array of expense objects
let filteredCat   = "all";  // Current filter category
let editingId     = null;   // ID of expense being edited
let chartInstance = null;   // Chart.js instance

// ══════════════════════════════════════════════════════════════════
// DOM REFERENCES
// ══════════════════════════════════════════════════════════════════

const DOM = {
  authScreen:    document.getElementById("auth-screen"),
  app:           document.getElementById("app"),
  btnSignIn:     document.getElementById("btn-google-signin"),
  btnSignOut:    document.getElementById("btn-signout"),
  authError:     document.getElementById("auth-error"),
  userName:      document.getElementById("user-name-display"),
  userAvatar:    document.getElementById("user-avatar"),

  // Stats
  statTotal:     document.getElementById("stat-total"),
  statCount:     document.getElementById("stat-count"),
  statMonth:     document.getElementById("stat-month"),
  statMonthLbl:  document.getElementById("stat-month-label"),
  statTopCat:    document.getElementById("stat-top-cat"),
  statTopAmt:    document.getElementById("stat-top-amt"),
  statAvg:       document.getElementById("stat-avg"),

  // Form inputs
  inpName:       document.getElementById("inp-name"),
  inpAmount:     document.getElementById("inp-amount"),
  inpCategory:   document.getElementById("inp-category"),
  inpDate:       document.getElementById("inp-date"),
  btnAdd:        document.getElementById("btn-add-expense"),

  // List & filters
  expenseList:   document.getElementById("expense-list"),
  filterRow:     document.getElementById("filter-row"),
  btnExportPDF:  document.getElementById("btn-export-pdf"),

  // Chart
  pieChart:      document.getElementById("pie-chart"),
  chartLegend:   document.getElementById("chart-legend"),

  // Modal
  editModal:     document.getElementById("edit-modal"),
  editName:      document.getElementById("edit-name"),
  editAmount:    document.getElementById("edit-amount"),
  editCategory:  document.getElementById("edit-category"),
  editDate:      document.getElementById("edit-date"),
  btnModalSave:  document.getElementById("btn-modal-save"),
  btnModalCancel:document.getElementById("btn-modal-cancel"),

  // Toast
  toast:         document.getElementById("toast"),
};

// ══════════════════════════════════════════════════════════════════
// LOCAL STORAGE
// ══════════════════════════════════════════════════════════════════

function storageKey() {
  return `spendly_expenses_${currentUser?.uid || "demo"}`;
}

function saveExpenses() {
  localStorage.setItem(storageKey(), JSON.stringify(expenses));
}

function loadExpenses() {
  try {
    const raw = localStorage.getItem(storageKey());
    expenses  = raw ? JSON.parse(raw) : [];
  } catch {
    expenses = [];
  }
}

// ══════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ══════════════════════════════════════════════════════════════════

/**
 * Handle Google Sign-In button click.
 * Falls back to demo mode if Firebase is not configured.
 */
async function handleSignIn() {
  clearAuthError();
  DOM.btnSignIn.disabled = true;
  DOM.btnSignIn.textContent = "Signing in…";

  if (!isConfigured) {
    // Demo mode — no real Firebase credentials
    enterDemoMode();
    return;
  }

  try {
    const result = await signInWithGoogle();
    // onAuthChange will fire and call onLogin()
  } catch (err) {
    DOM.btnSignIn.disabled    = false;
    DOM.btnSignIn.innerHTML   = googleBtnHTML();

    if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
      // User closed the popup — no error message needed
      return;
    }
    if (err.code === "auth/popup-blocked") {
      showAuthError("Popup was blocked. Please allow popups for this site and try again.");
      return;
    }
    showAuthError("Sign-in failed: " + (err.message || err.code));
    console.error("[Spendly] Sign-in error:", err);
  }
}

function enterDemoMode() {
  currentUser = {
    uid:         "demo",
    displayName: "Demo User",
    email:       "demo@spendly.app",
    photoURL:    null,
  };
  onLogin(currentUser);
}

async function handleSignOut() {
  try {
    await signOutUser();
  } catch {
    // ignore
  } finally {
    currentUser = null;
    expenses    = [];
    DOM.app.style.display        = "none";
    DOM.authScreen.style.display = "flex";
    DOM.btnSignIn.disabled       = false;
    DOM.btnSignIn.innerHTML      = googleBtnHTML();
  }
}

function onLogin(user) {
  currentUser = user;

  // Show app, hide auth screen
  DOM.authScreen.style.display = "none";
  DOM.app.style.display        = "block";

  // Render user info
  const name = user.displayName || user.email || "User";
  DOM.userName.textContent = name.split(" ")[0];

  if (user.photoURL) {
    DOM.userAvatar.innerHTML = `<img src="${user.photoURL}" alt="${escHtml(name)}" referrerpolicy="no-referrer" />`;
  } else {
    DOM.userAvatar.textContent = name.charAt(0).toUpperCase();
  }

  // Load data and render
  loadExpenses();
  setDateDefault();
  render();
}

// ── Auth state listener ───────────────────────────────────────────
onAuthChange((user) => {
  if (user) {
    onLogin(user);
  }
  // If null: stay on auth screen (already visible by default)
});

// ── Hint text on auth screen ──────────────────────────────────────
if (!isConfigured) {
  DOM.btnSignIn.title = "No Firebase config found — will use demo mode";
}

function showAuthError(msg) {
  DOM.authError.textContent = msg;
  DOM.authError.classList.add("visible");
}
function clearAuthError() {
  DOM.authError.textContent = "";
  DOM.authError.classList.remove("visible");
}

function googleBtnHTML() {
  return `<svg viewBox="0 0 24 24" fill="none" style="width:20px;height:20px;flex-shrink:0">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
  Continue with Google`;
}

// ══════════════════════════════════════════════════════════════════
// EXPENSE CRUD
// ══════════════════════════════════════════════════════════════════

function addExpense() {
  const name     = DOM.inpName.value.trim();
  const amount   = parseFloat(DOM.inpAmount.value);
  const category = DOM.inpCategory.value;
  const date     = DOM.inpDate.value;

  if (!name)               { toast("Enter an expense name");    return; }
  if (!amount || amount <= 0) { toast("Enter a valid amount");  return; }
  if (!date)               { toast("Pick a date");              return; }

  expenses.unshift({
    id: Date.now(),
    name,
    amount,
    category,
    date,
  });

  saveExpenses();

  DOM.inpName.value   = "";
  DOM.inpAmount.value = "";
  setDateDefault();
  DOM.inpName.focus();

  render();
  toast("Expense added ✓");
}

function deleteExpense(id) {
  expenses = expenses.filter(e => e.id !== id);
  saveExpenses();
  render();
  toast("Deleted");
}

// ── Edit Modal ────────────────────────────────────────────────────

function openEdit(id) {
  const e = expenses.find(x => x.id === id);
  if (!e) return;

  editingId              = id;
  DOM.editName.value     = e.name;
  DOM.editAmount.value   = e.amount;
  DOM.editCategory.value = e.category;
  DOM.editDate.value     = e.date;
  DOM.editModal.classList.add("open");
  DOM.editName.focus();
}

function closeModal() {
  DOM.editModal.classList.remove("open");
  editingId = null;
}

function saveEdit() {
  if (!editingId) return;

  const idx = expenses.findIndex(x => x.id === editingId);
  if (idx === -1) return;

  const name   = DOM.editName.value.trim();
  const amount = parseFloat(DOM.editAmount.value);

  if (!name)               { toast("Name cannot be empty");    return; }
  if (!amount || amount <= 0) { toast("Enter a valid amount"); return; }

  expenses[idx] = {
    ...expenses[idx],
    name,
    amount,
    category: DOM.editCategory.value,
    date:     DOM.editDate.value,
  };

  saveExpenses();
  closeModal();
  render();
  toast("Changes saved ✓");
}

// ══════════════════════════════════════════════════════════════════
// FILTERS
// ══════════════════════════════════════════════════════════════════

function setFilter(cat) {
  filteredCat = cat;
  DOM.filterRow.querySelectorAll(".filter-chip").forEach(chip => {
    chip.classList.toggle("active", chip.dataset.filter === cat);
  });
  renderList();
}

// ══════════════════════════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════════════════════════

function render() {
  renderStats();
  renderList();
  renderChart();
}

// ── Stats ─────────────────────────────────────────────────────────
function renderStats() {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const now   = new Date();
  const monthStr   = now.toISOString().slice(0, 7);
  const monthTotal = expenses
    .filter(e => e.date.startsWith(monthStr))
    .reduce((s, e) => s + e.amount, 0);
  const avg = expenses.length ? total / expenses.length : 0;

  const catTotals = {};
  expenses.forEach(e => {
    catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
  });
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  DOM.statTotal.textContent    = fmt(total);
  DOM.statCount.textContent    = `${expenses.length} expense${expenses.length !== 1 ? "s" : ""}`;
  DOM.statMonth.textContent    = fmt(monthTotal);
  DOM.statMonthLbl.textContent = now.toLocaleString("default", { month: "long", year: "numeric" });
  DOM.statTopCat.textContent   = topCat ? topCat[0] : "—";
  DOM.statTopAmt.textContent   = topCat ? fmt(topCat[1]) + " spent" : "no data yet";
  DOM.statAvg.textContent      = fmt(avg);
}

// ── Expense List ──────────────────────────────────────────────────
function renderList() {
  const filtered = filteredCat === "all"
    ? expenses
    : expenses.filter(e => e.category === filteredCat);

  if (!filtered.length) {
    DOM.expenseList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💸</div>
        <div>No expenses ${filteredCat !== "all" ? "in <strong>" + filteredCat + "</strong>" : "yet"}.<br/>Add your first one above.</div>
      </div>`;
    return;
  }

  DOM.expenseList.innerHTML = filtered.map(e => `
    <div class="expense-item" data-id="${e.id}">
      <div class="cat-dot" style="background:${CAT_COLORS[e.category] || "#6b7280"}"></div>
      <div class="expense-info">
        <div class="expense-name">${escHtml(e.name)}</div>
        <div class="expense-meta">${escHtml(e.category)} · ${fmtDate(e.date)}</div>
      </div>
      <div class="expense-amount">${fmt(e.amount)}</div>
      <div class="expense-actions">
        <button class="btn-icon edit"   data-action="edit"   data-id="${e.id}" title="Edit expense">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn-icon delete" data-action="delete" data-id="${e.id}" title="Delete expense">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
      </div>
    </div>
  `).join("");
}

// ── Chart ─────────────────────────────────────────────────────────
function renderChart() {
  const catTotals = {};
  expenses.forEach(e => {
    catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
  });
  const entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const total   = expenses.reduce((s, e) => s + e.amount, 0);

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (!entries.length) {
    DOM.chartLegend.innerHTML = `
      <div style="color:var(--muted);font-family:var(--mono);font-size:0.8rem;text-align:center;padding:1rem">
        No data to chart yet
      </div>`;
    return;
  }

  chartInstance = new Chart(DOM.pieChart, {
    type: "doughnut",
    data: {
      labels: entries.map(([k]) => k),
      datasets: [{
        data:            entries.map(([, v]) => v),
        backgroundColor: entries.map(([k]) => CAT_COLORS[k] || "#6b7280"),
        borderWidth:     2,
        borderColor:     "#111118",
        hoverOffset:     6,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      cutout:              "68%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${fmt(ctx.parsed)}  (${((ctx.parsed / total) * 100).toFixed(1)}%)`
          },
          backgroundColor: "#18181f",
          borderColor:     "#2a2a35",
          borderWidth:     1,
          titleColor:      "#f0f0f5",
          bodyColor:       "#c8f542",
          titleFont:       { family: "Syne",    weight: "700" },
          bodyFont:        { family: "DM Mono" },
        },
      },
    },
  });

  // Legend
  DOM.chartLegend.innerHTML = entries.map(([cat, amt]) => `
    <div class="legend-item">
      <div class="legend-color" style="background:${CAT_COLORS[cat] || "#6b7280"}"></div>
      <span class="legend-label">${escHtml(cat)}</span>
      <span class="legend-pct">${((amt / total) * 100).toFixed(1)}%</span>
      <span class="legend-amt">${fmt(amt)}</span>
    </div>
  `).join("");
}

// ══════════════════════════════════════════════════════════════════
// PDF EXPORT
// ══════════════════════════════════════════════════════════════════

function exportPDF() {
  if (!expenses.length) { toast("No expenses to export"); return; }

  // Resolve jsPDF from whichever global it attached to
  const JsPDF =
    (window.jspdf && window.jspdf.jsPDF) ||
    window.jsPDF ||
    (typeof jsPDF !== "undefined" ? jsPDF : null);

  if (!JsPDF) {
    toast("PDF library not loaded — try again");
    console.error("[Spendly] jsPDF not found on window");
    return;
  }

  try {
    const doc   = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const now   = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const total = expenses.reduce((s, e) => s + e.amount, 0);

    // ── Dark header band ──
    doc.setFillColor(10, 10, 15);
    doc.rect(0, 0, 210, 44, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(200, 245, 66);
    doc.text("SPENDLY", 15, 25);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 140);
    doc.text("Expense Report  //  " + now, 15, 36);

    // User name (top right)
    const userName = currentUser?.displayName || currentUser?.email || "User";
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 120);
    doc.text(userName, 195, 25, { align: "right" });

    // ── Summary boxes ──
    doc.setFillColor(200, 245, 66);
    doc.roundedRect(15, 52, 85, 16, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(10, 10, 15);
    doc.text("Total Spent: " + fmt(total), 19, 62);

    doc.setFillColor(24, 24, 31);
    doc.roundedRect(105, 52, 90, 16, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(160, 160, 180);
    doc.text(
      expenses.length + " expense" + (expenses.length !== 1 ? "s" : "") + " recorded",
      110, 62
    );

    // ── Table header ──
    let y = 82;
    doc.setFillColor(28, 28, 38);
    doc.rect(15, y - 5, 180, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 160);
    doc.text("DATE",     18,  y);
    doc.text("NAME",     52,  y);
    doc.text("CATEGORY", 122, y);
    doc.text("AMOUNT",   168, y);
    y += 9;

    // ── Rows ──
    doc.setFont("helvetica", "normal");
    expenses.forEach((e, i) => {
      if (y > 272) {
        doc.addPage();
        y = 20;
        doc.setFillColor(28, 28, 38);
        doc.rect(15, y - 5, 180, 9, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(140, 140, 160);
        doc.text("DATE", 18, y); doc.text("NAME", 52, y);
        doc.text("CATEGORY", 122, y); doc.text("AMOUNT", 168, y);
        y += 9;
        doc.setFont("helvetica", "normal");
      }

      if (i % 2 === 0) {
        doc.setFillColor(18, 18, 26);
        doc.rect(15, y - 5, 180, 8, "F");
      }

      doc.setFontSize(8);
      doc.setTextColor(160, 160, 185);
      doc.text(fmtDate(e.date),                   18, y);
      doc.text((e.name || "").substring(0, 32),   52, y);
      doc.text(e.category,                       122, y);
      doc.setTextColor(200, 245, 66);
      doc.text(fmt(e.amount),                    168, y);
      y += 8;
    });

    // ── Footer ──
    doc.setDrawColor(42, 42, 53);
    doc.line(15, 282, 195, 282);
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 100);
    doc.text("Generated by Spendly", 15, 288);
    doc.text(new Date().toLocaleString(), 195, 288, { align: "right" });

    doc.save("spendly-expenses-" + new Date().toISOString().split("T")[0] + ".pdf");
    toast("PDF exported ✓");

  } catch (err) {
    console.error("[Spendly] PDF generation error:", err);
    toast("Export failed: " + err.message);
  }
}

// ══════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════

function fmt(n) {
  return "$" + (n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return new Date(+y, +m - 1, +day)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;");
}

let toastTimer = null;
function toast(msg) {
  DOM.toast.textContent = msg;
  DOM.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => DOM.toast.classList.remove("show"), 2600);
}

function setDateDefault() {
  DOM.inpDate.value = new Date().toISOString().split("T")[0];
}

// ══════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ══════════════════════════════════════════════════════════════════

// Auth
DOM.btnSignIn.addEventListener("click",  handleSignIn);
DOM.btnSignOut.addEventListener("click", handleSignOut);

// Add expense
DOM.btnAdd.addEventListener("click", addExpense);
DOM.inpName.addEventListener("keydown", e => { if (e.key === "Enter") addExpense(); });
DOM.inpAmount.addEventListener("keydown", e => { if (e.key === "Enter") addExpense(); });

// Expense list — delegated clicks for edit/delete
DOM.expenseList.addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id     = Number(btn.dataset.id);
  const action = btn.dataset.action;
  if (action === "edit")   openEdit(id);
  if (action === "delete") deleteExpense(id);
});

// Category filters — delegated clicks
DOM.filterRow.addEventListener("click", e => {
  const chip = e.target.closest(".filter-chip");
  if (!chip) return;
  setFilter(chip.dataset.filter);
});

// PDF export
DOM.btnExportPDF.addEventListener("click", exportPDF);

// Modal
DOM.btnModalSave.addEventListener("click",   saveEdit);
DOM.btnModalCancel.addEventListener("click", closeModal);
DOM.editModal.addEventListener("click", e => {
  if (e.target === DOM.editModal) closeModal();
});

// Keyboard shortcuts
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
  if (e.key === "Enter" && DOM.editModal.classList.contains("open")) {
    e.preventDefault();
    saveEdit();
  }
});
