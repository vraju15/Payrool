import { icons } from './icons.js';

// --- APPLICATION STATE ---
const state = {
  activeView: 'dashboard',
  dbStatus: { isPostgres: false, mode: 'Loading...' },
  sites: [],
  employees: [],
  selectedSiteId: '',
  selectedDate: new Date().toISOString().split('T')[0],
  payrollMonth: new Date().getMonth() + 1,
  payrollYear: new Date().getFullYear(),
  token: null,
  user: null
};

// Global Fetch Interceptor for authentication
const originalFetch = window.fetch;
window.fetch = async (url, options = {}) => {
  if (state.token) {
    if (!options.headers) {
      options.headers = {};
    }
    if (options.headers instanceof Headers) {
      options.headers.set('Authorization', `Bearer ${state.token}`);
    } else {
      options.headers['Authorization'] = `Bearer ${state.token}`;
    }
  }
  const response = await originalFetch(url, options);
  if (response.status === 401 && state.token) {
    logout();
  }
  return response;
};

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('payroll_token');
  localStorage.removeItem('payroll_user');
  renderLoginScreen();
}

function applyUserRoleUI() {
  const user = state.user;
  if (!user) return;
  
  const brandIcon = document.querySelector('.brand-icon');
  if (brandIcon) brandIcon.textContent = '₹';
  
  const footerAvatar = document.querySelector('.footer-avatar');
  const footerName = document.querySelector('.footer-name');
  const footerRole = document.querySelector('.footer-role');
  
  if (footerAvatar) {
    footerAvatar.textContent = user.role === 'admin' ? 'AD' : user.siteName.substring(0, 2).toUpperCase();
  }
  if (footerName) {
    footerName.textContent = user.role === 'admin' ? 'Owner Portal' : user.siteName;
  }
  if (footerRole) {
    footerRole.textContent = user.role === 'admin' ? 'Master Access' : 'Site Manager';
  }
  
  const navSites = document.getElementById('nav-sites');
  const navPayroll = document.getElementById('nav-payroll');
  
  if (user.role === 'manager') {
    if (navSites) navSites.style.display = 'none';
    if (navPayroll) navPayroll.style.display = 'none';
    state.selectedSiteId = user.siteId;
  } else {
    if (navSites) navSites.style.display = 'flex';
    if (navPayroll) navPayroll.style.display = 'flex';
  }
}

function renderLoginScreen() {
  const existing = document.getElementById('login-overlay-container');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'login-overlay-container';
  overlay.className = 'login-overlay';
  overlay.innerHTML = `
    <div class="login-card">
      <div class="login-header">
        <div class="login-logo">₹</div>
        <h2 class="login-title">Payroll Hub</h2>
        <p class="login-subtitle">Sign in to your work location portal</p>
      </div>
      <form class="login-form" id="login-form">
        <div class="form-group">
          <label class="form-label">Username</label>
          <input type="text" class="form-input" id="login-username" placeholder="Enter username..." required>
        </div>
        <div class="form-group" style="margin-bottom: 24px;">
          <label class="form-label">Password</label>
          <input type="password" class="form-input" id="login-password" placeholder="••••••••" required>
        </div>
        <button type="submit" class="header-btn primary" style="width:100%; justify-content:center; padding: 12px;">
          Sign In
        </button>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  
  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    const loginBtn = form.querySelector('button');
    loginBtn.disabled = true;
    loginBtn.innerHTML = `${icons.spinner} Authenticating...`;
    
    try {
      const res = await originalFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('payroll_token', data.token);
        localStorage.setItem('payroll_user', JSON.stringify(data.user));
        
        overlay.remove();
        showToast(`Welcome back, ${data.user.name}!`, 'success');
        
        applyUserRoleUI();
        fetchInitialData();
      } else {
        showToast(data.error || 'Authentication failed', 'error');
      }
    } catch (err) {
      showToast('Error connecting to login service', 'error');
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = 'Sign In';
    }
  });
}

// --- DOM ELEMENTS ---
const elements = {
  sidebar: document.getElementById('app-sidebar'),
  viewTitle: document.getElementById('view-title'),
  viewSubtitle: document.getElementById('view-subtitle'),
  workspace: document.getElementById('app-content-workspace'),
  dbStatusBadge: document.getElementById('db-status-badge'),
  dbStatusText: document.getElementById('db-status-text'),
  dbSeedBtn: document.getElementById('db-seed-btn'),
  modalOverlay: document.getElementById('modal-overlay'),
  modalContainer: document.getElementById('modal-container'),
  toastHub: document.getElementById('toast-hub')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  setupIcons();
  setupNavigation();
  checkDbStatus();
  
  const storedToken = localStorage.getItem('payroll_token');
  const storedUser = localStorage.getItem('payroll_user');
  
  if (storedToken && storedUser) {
    state.token = storedToken;
    state.user = JSON.parse(storedUser);
    applyUserRoleUI();
    fetchInitialData();
  } else {
    renderLoginScreen();
  }
});

// Load vector icons into specific structural containers
function setupIcons() {
  document.getElementById('icon-dashboard').innerHTML = icons.dashboard;
  document.getElementById('icon-attendance').innerHTML = icons.attendance;
  document.getElementById('icon-employees').innerHTML = icons.employees;
  document.getElementById('icon-sites').innerHTML = icons.sites;
  document.getElementById('icon-expenses').innerHTML = icons.expenses;
  document.getElementById('icon-payroll').innerHTML = icons.payroll;
  document.getElementById('icon-logout').innerHTML = icons.logout;
  document.getElementById('icon-db').innerHTML = icons.db;
  document.getElementById('workspace-loading-spinner').innerHTML = icons.spinner;
}

// Setup sidebar navigations
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    if (item.id === 'nav-logout') {
      item.addEventListener('click', () => {
        logout();
      });
      return;
    }
    
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      const view = item.getAttribute('data-view');
      switchView(view);
    });
  });
  
  // Seed Database Click Event
  elements.dbSeedBtn.addEventListener('click', async () => {
    elements.dbSeedBtn.disabled = true;
    elements.dbSeedBtn.innerHTML = `${icons.spinner} Seeding...`;
    try {
      const res = await fetch('/api/seed-db', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast('Database seeded successfully!', 'success');
        fetchInitialData();
      } else {
        showToast(data.error || 'Failed to seed.', 'error');
      }
    } catch (err) {
      showToast('Error connecting to seeding API.', 'error');
    } finally {
      elements.dbSeedBtn.innerHTML = `Seed PostgreSQL`;
      elements.dbSeedBtn.disabled = false;
    }
  });
}

// Transition view active panels
function switchView(viewName) {
  state.activeView = viewName;
  
  // Clean overlay modal just in case
  closeModal();
  
  // Update titles
  if (viewName === 'dashboard') {
    elements.viewTitle.textContent = 'Dashboard';
    elements.viewSubtitle.textContent = 'Real-time statistics & workforce metrics';
    renderDashboard();
  } else if (viewName === 'attendance') {
    elements.viewTitle.textContent = 'Mark Site Attendance';
    elements.viewSubtitle.textContent = 'Log manual daily attendance for work locations';
    renderAttendance();
  } else if (viewName === 'employees') {
    elements.viewTitle.textContent = 'Employee Directory';
    elements.viewSubtitle.textContent = 'Manage wages, roles, and location assignments';
    renderEmployees();
  } else if (viewName === 'sites') {
    elements.viewTitle.textContent = 'Site Locations';
    elements.viewSubtitle.textContent = 'Overview of operational project locations';
    renderSites();
  } else if (viewName === 'expenses') {
    elements.viewTitle.textContent = 'Expense Tracker';
    elements.viewSubtitle.textContent = 'Track daily expenses and cash provisions for site locations';
    renderExpensesView();
  } else if (viewName === 'payroll') {
    elements.viewTitle.textContent = 'Payroll & Salary Calculator';
    elements.viewSubtitle.textContent = 'Automate payouts based on employee attendance';
    renderPayroll();
  }
}

// Check database adapter mode (PostgreSQL or local Mock Storage)
async function checkDbStatus() {
  try {
    const res = await fetch('/api/db-status');
    const data = await res.json();
    state.dbStatus = data;
    
    elements.dbStatusText.textContent = data.mode;
    elements.dbStatusBadge.className = 'badge ' + (data.isPostgres ? 'emerald' : 'amber');
    
    // Show seeding button only for PostgreSQL
    if (data.isPostgres) {
      elements.dbSeedBtn.style.display = 'flex';
    } else {
      elements.dbSeedBtn.style.display = 'none';
    }
  } catch (err) {
    elements.dbStatusText.textContent = 'Offline';
    elements.dbStatusBadge.className = 'badge crimson';
  }
}

async function fetchInitialData() {
  try {
    const res = await fetch('/api/sites');
    state.sites = await res.json();
    
    if (state.sites.length > 0) {
      state.selectedSiteId = state.sites[0].id;
    }
    
    // Force render current view once data loaded
    switchView(state.activeView);
  } catch (err) {
    showToast('Failed to load project site files.', 'error');
  }
}

// --- TOAST NOTIFICATIONS HUB ---
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconContent = icons.info;
  if (type === 'success') iconContent = icons.active;
  if (type === 'error') iconContent = icons.inactive;
  
  toast.innerHTML = `
    <span class="toast-icon">${iconContent}</span>
    <span>${message}</span>
  `;
  
  elements.toastHub.appendChild(toast);
  
  // Fade out
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}

// --- MODALS HELPER ---
function openModal(htmlContent) {
  elements.modalContainer.innerHTML = htmlContent;
  elements.modalOverlay.classList.add('active');
  
  // Bind close buttons automatically
  const closeBtns = elements.modalContainer.querySelectorAll('.modal-close, .btn-cancel');
  closeBtns.forEach(btn => {
    btn.addEventListener('click', closeModal);
  });
}

function closeModal() {
  elements.modalOverlay.classList.remove('active');
  setTimeout(() => {
    elements.modalContainer.innerHTML = '';
  }, 250);
}

// --- GENERATE AVATAR HELPER ---
function getAvatarHtml(firstName, lastName, index = 0) {
  const colors = [
    'linear-gradient(135deg, #3b82f6, #1d4ed8)', // Blue
    'linear-gradient(135deg, #10b981, #047857)', // Emerald
    'linear-gradient(135deg, #f59e0b, #b45309)', // Amber
    'linear-gradient(135deg, #ec4899, #be185d)', // Pink
    'linear-gradient(135deg, #8b5cf6, #5b21b6)', // Purple
    'linear-gradient(135deg, #f43f5e, #be123c)'  // Rose
  ];
  const char = ((firstName[0] || '') + (lastName[0] || '')).toUpperCase();
  const color = colors[index % colors.length];
  return `<div class="avatar" style="background: ${color}">${char}</div>`;
}

// --- 1. RENDER DASHBOARD PANEL ---
async function renderDashboard() {
  elements.workspace.innerHTML = `
    <div class="empty-state">
      <span>${icons.spinner}</span>
      <h3>Syncing Dashboard metrics</h3>
    </div>
  `;
  
  try {
    const res = await fetch('/api/dashboard/stats');
    const stats = await res.json();
    
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    
    // Calculate total logs today to generate present ratio
    const totalTodayLogs = stats.attendanceToday.present + stats.attendanceToday.absent + stats.attendanceToday.late;
    const presentRatio = totalTodayLogs > 0 
      ? Math.round(((stats.attendanceToday.present + stats.attendanceToday.late) / totalTodayLogs) * 100) 
      : 0;

    elements.workspace.innerHTML = `
      <!-- Headline Stat Cards -->
      <div class="stat-grid">
        
        <div class="card stat-card">
          <div class="stat-card-glow blue"></div>
          <div class="stat-info">
            <span class="stat-label">Active Headcount</span>
            <span class="stat-value">${stats.totalEmployees}</span>
            <span class="stat-change positive">Active across all sites</span>
          </div>
          <div class="stat-icon">${icons.employees}</div>
        </div>
        
        <div class="card stat-card">
          <div class="stat-card-glow emerald"></div>
          <div class="stat-info">
            <span class="stat-label">Present Today</span>
            <span class="stat-value">${stats.attendanceToday.present + stats.attendanceToday.late}</span>
            <span class="stat-change positive">${presentRatio}% Attendance Rate</span>
          </div>
          <div class="stat-icon">${icons.attendance}</div>
        </div>
        
        <div class="card stat-card">
          <div class="stat-card-glow amber"></div>
          <div class="stat-info">
            <span class="stat-label">Active Locations</span>
            <span class="stat-value">${stats.totalSites}</span>
            <span class="stat-change">Operational hubs</span>
          </div>
          <div class="stat-icon">${icons.sites}</div>
        </div>
        
        <div class="card stat-card">
          <div class="stat-card-glow crimson"></div>
          <div class="stat-info">
            <span class="stat-label">Payroll Paid (Month)</span>
            <span class="stat-value">₹${stats.monthlyPayrollTotal.toLocaleString()}</span>
            <span class="stat-change positive">Verified disbursements</span>
          </div>
          <div class="stat-icon">${icons.payroll}</div>
        </div>
        
      </div>
      
      <!-- Split-screen Analytics Details -->
      <div class="form-row">
        
        <!-- Attendance Ratios Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">${icons.attendance} Today's Attendance breakdown</h3>
            <span class="badge blue">${today}</span>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 20px; margin-top: 10px;">
            <div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.88rem;">
                <span style="font-weight:600; color: var(--accent-emerald);">Present On-Site (${stats.attendanceToday.present})</span>
                <span style="color:var(--text-muted);">${totalTodayLogs > 0 ? Math.round((stats.attendanceToday.present / totalTodayLogs) * 100) : 0}%</span>
              </div>
              <div style="background-color: var(--bg-app); height: 8px; border-radius: var(--radius-full); overflow: hidden;">
                <div style="background-color: var(--accent-emerald); height: 100%; width: ${totalTodayLogs > 0 ? (stats.attendanceToday.present / totalTodayLogs) * 100 : 0}%;"></div>
              </div>
            </div>
            
            <div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.88rem;">
                <span style="font-weight:600; color: var(--accent-amber);">Reported Late (${stats.attendanceToday.late})</span>
                <span style="color:var(--text-muted);">${totalTodayLogs > 0 ? Math.round((stats.attendanceToday.late / totalTodayLogs) * 100) : 0}%</span>
              </div>
              <div style="background-color: var(--bg-app); height: 8px; border-radius: var(--radius-full); overflow: hidden;">
                <div style="background-color: var(--accent-amber); height: 100%; width: ${totalTodayLogs > 0 ? (stats.attendanceToday.late / totalTodayLogs) * 100 : 0}%;"></div>
              </div>
            </div>
            
            <div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.88rem;">
                <span style="font-weight:600; color: var(--accent-crimson);">Absent / No-Show (${stats.attendanceToday.absent})</span>
                <span style="color:var(--text-muted);">${totalTodayLogs > 0 ? Math.round((stats.attendanceToday.absent / totalTodayLogs) * 100) : 0}%</span>
              </div>
              <div style="background-color: var(--bg-app); height: 8px; border-radius: var(--radius-full); overflow: hidden;">
                <div style="background-color: var(--accent-crimson); height: 100%; width: ${totalTodayLogs > 0 ? (stats.attendanceToday.absent / totalTodayLogs) * 100 : 0}%;"></div>
              </div>
            </div>
            
            ${totalTodayLogs === 0 ? `
              <div class="empty-state" style="padding: 20px 0;">
                <p>No manual attendance logs submitted today yet. Go to "Mark Attendance" to log your sites.</p>
              </div>
            ` : ''}
          </div>
        </div>
        
        <!-- Quick Informative Card -->
        <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div class="card-header">
              <h3 class="card-title">${icons.info} Master Admin Help Center</h3>
            </div>
            <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 16px;">
              Welcome to your centralized Payroll Hub. This software is customized to run on a robust **PostgreSQL** database cluster. 
            </p>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; align-items: flex-start; gap: 10px; font-size: 0.85rem;">
                <span style="color:var(--accent-primary); margin-top:2px;">${icons.active}</span>
                <span><strong>Multi-Site Isolation:</strong> Managers at different sites log daily attendance independently. Data merges instantly under central admin oversight.</span>
              </div>
              <div style="display: flex; align-items: flex-start; gap: 10px; font-size: 0.85rem;">
                <span style="color:var(--accent-primary); margin-top:2px;">${icons.active}</span>
                <span><strong>Salary Calculations:</strong> Daily payouts are present-day multiplied. Monthly payouts apply a standard daily-reduction formula for absent statuses.</span>
              </div>
            </div>
          </div>
          
          <button class="header-btn primary" style="width:100%; justify-content:center; margin-top: 24px;" onclick="document.getElementById('nav-attendance').click()">
            ${icons.attendance} Launch Attendance Sheet
          </button>
        </div>
        
      </div>
    `;
  } catch (err) {
    elements.workspace.innerHTML = `
      <div class="empty-state">
        <span style="color: var(--accent-crimson);">${icons.inactive}</span>
        <h3>Failed to compile dashboard metrics</h3>
        <p>Error: ${err.message}</p>
      </div>
    `;
  }
}

// --- 2. RENDER MANUAL ATTENDANCE GRID ---
async function renderAttendance() {
  if (state.sites.length === 0) {
    elements.workspace.innerHTML = `
      <div class="empty-state">
        <span>${icons.sites}</span>
        <h3>No site locations defined</h3>
        <p>Please add a project site location first in the "Site Locations" tab.</p>
      </div>
    `;
    return;
  }

  // Create workspace layout
  elements.workspace.innerHTML = `
    <div class="attendance-grid-container">
      
      <!-- Selection bar -->
      <div class="attendance-filters">
        <div class="filters-left">
          <div class="filter-item">
            <label class="form-label" for="att-site-select">Select Project Site:</label>
            <select class="form-select" id="att-site-select" style="min-width: 220px;">
              ${state.sites.map(s => `<option value="${s.id}" ${state.selectedSiteId == s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>
          
          <div class="filter-item">
            <label class="form-label" for="att-date-picker">Date:</label>
            <input type="date" class="form-input" id="att-date-picker" value="${state.selectedDate}" max="${new Date().toISOString().split('T')[0]}">
          </div>
        </div>
        
        <button class="header-btn primary" id="att-save-btn">
          ${icons.active} Save Attendance Grid
        </button>
      </div>

      <!-- Main attendance listing -->
      <div id="attendance-sheet-target">
        <div class="empty-state">
          <span>${icons.spinner}</span>
          <h3>Fetching daily log records...</h3>
        </div>
      </div>
      
    </div>
  `;

  // Bind dropdown & date actions
  const siteSelect = document.getElementById('att-site-select');
  const datePicker = document.getElementById('att-date-picker');
  const saveBtn = document.getElementById('att-save-btn');

  siteSelect.addEventListener('change', (e) => {
    state.selectedSiteId = e.target.value;
    loadAttendanceRecords();
  });

  datePicker.addEventListener('change', (e) => {
    state.selectedDate = e.target.value;
    loadAttendanceRecords();
  });

  saveBtn.addEventListener('click', saveAttendanceRecords);

  // Hide site selector if site manager
  if (state.user && state.user.role === 'manager') {
    const siteSelect = document.getElementById('att-site-select');
    if (siteSelect) {
      const filterItem = siteSelect.closest('.filter-item');
      if (filterItem) filterItem.style.display = 'none';
    }
  }

  // Load records initially
  loadAttendanceRecords();
}

let activeAttendanceList = [];

async function loadAttendanceRecords() {
  const target = document.getElementById('attendance-sheet-target');
  target.innerHTML = `
    <div class="empty-state">
      <span>${icons.spinner}</span>
      <h3>Loading employee lists...</h3>
    </div>
  `;

  try {
    const res = await fetch(`/api/attendance?siteId=${state.selectedSiteId}&date=${state.selectedDate}`);
    activeAttendanceList = await res.json();

    if (activeAttendanceList.length === 0) {
      target.innerHTML = `
        <div class="empty-state">
          <span>${icons.employees}</span>
          <h3>No active workers in this site</h3>
          <p>Please register employees to this location via the "Employees" tab first.</p>
        </div>
      `;
      return;
    }

    target.innerHTML = `
      <div class="attendance-grid">
        ${activeAttendanceList.map((rec, idx) => {
          // If status is empty, default it to Present
          if (!rec.status) {
            rec.status = 'Present';
          }
          
          return `
            <div class="attendance-card" data-emp-id="${rec.employee_id}">
              <div class="attendance-card-header">
                ${getAvatarHtml(rec.first_name, rec.last_name, idx)}
                <div class="attendance-name-info">
                  <span class="attendance-name">${rec.first_name} ${rec.last_name}</span>
                  <span class="attendance-role">${rec.role} • <span class="payslip-mono" style="font-size:0.75rem;">${rec.employee_code}</span></span>
                </div>
              </div>
              
              <div class="attendance-actions">
                <button class="toggle-btn present ${rec.status === 'Present' ? 'active' : ''}" onclick="toggleAttendance(${rec.employee_id}, 'Present', this)">
                  Present
                </button>
                <button class="toggle-btn late ${rec.status === 'Late' ? 'active' : ''}" onclick="toggleAttendance(${rec.employee_id}, 'Late', this)">
                  Late
                </button>
                <button class="toggle-btn absent ${rec.status === 'Absent' ? 'active' : ''}" onclick="toggleAttendance(${rec.employee_id}, 'Absent', this)">
                  Absent
                </button>
              </div>
              
              <input type="text" class="form-input" style="padding: 6px 10px; font-size: 0.8rem; border-style:dashed;" 
                placeholder="Optional manual notes..." value="${rec.notes || ''}" onchange="updateAttendanceNotes(${rec.employee_id}, this.value)">
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    target.innerHTML = `
      <div class="empty-state">
        <span style="color:var(--accent-crimson);">${icons.inactive}</span>
        <h3>Failed to fetch attendance logs</h3>
        <p>Error: ${err.message}</p>
      </div>
    `;
  }
}

// Global hook triggered inside toggle buttons
window.toggleAttendance = function(empId, status, clickedBtn) {
  const card = clickedBtn.closest('.attendance-card');
  const btns = card.querySelectorAll('.toggle-btn');
  
  btns.forEach(btn => btn.classList.remove('active'));
  clickedBtn.classList.add('active');

  const record = activeAttendanceList.find(r => r.employee_id == empId);
  if (record) {
    record.status = status;
  }
};

window.updateAttendanceNotes = function(empId, value) {
  const record = activeAttendanceList.find(r => r.employee_id == empId);
  if (record) {
    record.notes = value;
  }
};

async function saveAttendanceRecords() {
  const saveBtn = document.getElementById('att-save-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = `${icons.spinner} Saving Records...`;

  try {
    const payload = {
      siteId: state.selectedSiteId,
      date: state.selectedDate,
      records: activeAttendanceList.map(r => ({
        employee_id: r.employee_id,
        status: r.status || 'Present',
        notes: r.notes || ''
      })),
      markedBy: 'Site Manager'
    };

    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast(`Daily logs for ${state.selectedDate} saved successfully!`, 'success');
      loadAttendanceRecords();
    } else {
      const data = await res.json();
      showToast(data.error || 'Failed to submit grid records.', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to backend server.', 'error');
  } finally {
    saveBtn.innerHTML = `${icons.active} Save Attendance Grid`;
    saveBtn.disabled = false;
  }
}

// --- 3. RENDER EMPLOYEES DIRECTORY ---
async function renderEmployees() {
  elements.workspace.innerHTML = `
    <div class="attendance-filters">
      <div class="filters-left">
        <div class="filter-item" style="position:relative;">
          <input type="text" class="form-input" id="emp-search" placeholder="Search by name, code, role..." style="padding-left: 36px; min-width: 250px;">
          <span style="position:absolute; left: 12px; top: 10px; color: var(--text-dark); pointer-events: none;">${icons.search}</span>
        </div>
        
        <div class="filter-item">
          <select class="form-select" id="emp-site-filter">
            <option value="">All Project Sites</option>
            ${state.sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
      </div>

      <button class="header-btn primary" id="emp-add-btn">
        ${icons.plus} Register Employee
      </button>
    </div>

    <div class="card" style="padding:0; overflow:hidden;">
      <div id="employees-table-target">
        <div class="empty-state">
          <span>${icons.spinner}</span>
          <h3>Compiling personnel records...</h3>
        </div>
      </div>
    </div>
  `;

  // Bind actions
  document.getElementById('emp-search').addEventListener('input', filterEmployeesList);
  document.getElementById('emp-site-filter').addEventListener('change', loadEmployeesList);
  document.getElementById('emp-add-btn').addEventListener('click', () => openEmployeeModal());

  // Hide site selector if site manager
  if (state.user && state.user.role === 'manager') {
    const siteFilter = document.getElementById('emp-site-filter');
    if (siteFilter) {
      const filterItem = siteFilter.closest('.filter-item');
      if (filterItem) filterItem.style.display = 'none';
    }
  }

  loadEmployeesList();
}

let cachedEmployees = [];

async function loadEmployeesList() {
  const tableTarget = document.getElementById('employees-table-target');
  const siteFilter = document.getElementById('emp-site-filter').value;

  try {
    const url = siteFilter ? `/api/employees?siteId=${siteFilter}` : '/api/employees';
    const res = await fetch(url);
    cachedEmployees = await res.json();

    filterEmployeesList();
  } catch (err) {
    tableTarget.innerHTML = `
      <div class="empty-state">
        <span style="color:var(--accent-crimson);">${icons.inactive}</span>
        <h3>Failed to load personnel profiles</h3>
        <p>Error: ${err.message}</p>
      </div>
    `;
  }
}

function filterEmployeesList() {
  const query = document.getElementById('emp-search').value.toLowerCase().trim();
  const tableTarget = document.getElementById('employees-table-target');

  const filtered = cachedEmployees.filter(emp => {
    return (
      emp.first_name.toLowerCase().includes(query) ||
      emp.last_name.toLowerCase().includes(query) ||
      emp.employee_code.toLowerCase().includes(query) ||
      emp.role.toLowerCase().includes(query)
    );
  });

  if (filtered.length === 0) {
    tableTarget.innerHTML = `
      <div class="empty-state">
        <span>${icons.search}</span>
        <h3>No matching employees found</h3>
        <p>Try redefining your search criteria or register a new employee.</p>
      </div>
    `;
    return;
  }

  tableTarget.innerHTML = `
    <div class="table-wrapper">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Code</th>
            <th>Site Assignment</th>
            <th>Role</th>
            <th>Salary Model</th>
            <th>Pay Rate</th>
            <th>Status</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map((emp, idx) => `
            <tr>
              <td>
                <div class="avatar-cell">
                  ${getAvatarHtml(emp.first_name, emp.last_name, idx)}
                  <div>
                    <div style="font-weight: 600;">${emp.first_name} ${emp.last_name}</div>
                  </div>
                </div>
              </td>
              <td><span class="badge blue payslip-mono">${emp.employee_code}</span></td>
              <td>${emp.site_name || 'Unassigned'}</td>
              <td>${emp.role}</td>
              <td>
                <span class="badge ${emp.pay_type === 'Monthly' ? 'emerald' : 'blue'}">
                  ${emp.pay_type}
                </span>
              </td>
              <td><strong class="payslip-mono">₹${parseFloat(emp.pay_rate).toFixed(2)}${emp.pay_type === 'Daily' ? '/day' : '/mo'}</strong></td>
              <td>
                <span class="badge ${emp.is_active ? 'emerald' : 'crimson'}">
                  ${emp.is_active ? 'Active' : 'Suspended'}
                </span>
              </td>
              <td style="text-align: right;">
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                  <button class="header-btn" style="padding:6px; border-radius: var(--radius-sm);" onclick="openEmployeeModal(${emp.id})" title="Edit Employee">
                    ${icons.edit}
                  </button>
                  <button class="header-btn" style="padding:6px; border-radius: var(--radius-sm); color: var(--accent-crimson);" onclick="triggerDeleteEmployee(${emp.id}, '${emp.first_name} ${emp.last_name}')" title="Delete Profile">
                    ${icons.trash}
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Open Form Modal to Register/Edit Employees
window.openEmployeeModal = function(empId = null) {
  const isEdit = empId !== null;
  const emp = isEdit ? cachedEmployees.find(e => e.id == empId) : null;
  
  // Generate random default code for new employee
  const defaultCode = isEdit ? emp.employee_code : `EMP${1000 + cachedEmployees.length + 1}`;

  const html = `
    <div class="modal-header">
      <h3 class="modal-title">${isEdit ? 'Update Personnel Profile' : 'Register New Employee'}</h3>
      <button class="modal-close">${icons.close}</button>
    </div>
    <form id="employee-form">
      <div class="modal-body">
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">First Name</label>
            <input type="text" class="form-input" name="first_name" required value="${isEdit ? emp.first_name : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Last Name</label>
            <input type="text" class="form-input" name="last_name" required value="${isEdit ? emp.last_name : ''}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Employee Code</label>
            <input type="text" class="form-input payslip-mono" name="employee_code" required value="${defaultCode}" ${isEdit ? 'readonly style="background-color:var(--bg-app); opacity: 0.7;"' : ''}>
          </div>
          <div class="form-group">
            <label class="form-label">Assigned Site</label>
            <select class="form-select" name="site_id" required>
              <option value="">Select location</option>
              ${state.sites.map(s => `<option value="${s.id}" ${(isEdit && emp.site_id == s.id) || state.sites.length === 1 ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Workplace Role / Title</label>
          <input type="text" class="form-input" name="role" required placeholder="e.g. Safety Inspector, Electrician..." value="${isEdit ? emp.role : ''}">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Salary Model Type</label>
            <select class="form-select" name="pay_type" id="modal-pay-type" required>
              <option value="Daily" ${(isEdit && emp.pay_type === 'Daily') ? 'selected' : ''}>Daily Rate Payment</option>
              <option value="Monthly" ${(isEdit && emp.pay_type === 'Monthly') ? 'selected' : ''}>Monthly Salaried Contract</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" id="modal-rate-label">Daily Wage (₹)</label>
            <input type="number" step="0.01" class="form-input payslip-mono" name="pay_rate" required value="${isEdit ? emp.pay_rate : ''}">
          </div>
        </div>

        ${isEdit ? `
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" name="is_active">
              <option value="true" ${emp.is_active ? 'selected' : ''}>Active / Operating</option>
              <option value="false" ${!emp.is_active ? 'selected' : ''}>Suspended / Inactive</option>
            </select>
          </div>
        ` : ''}

      </div>
      <div class="modal-footer">
        <button type="button" class="header-btn btn-cancel">Cancel</button>
        <button type="submit" class="header-btn primary" id="modal-submit-btn">
          ${isEdit ? 'Save Changes' : 'Register Profile'}
        </button>
      </div>
    </form>
  `;

  openModal(html);

  // Dynamic label switcher inside modal
  const payTypeSelect = document.getElementById('modal-pay-type');
  const rateLabel = document.getElementById('modal-rate-label');
  const updateLabel = () => {
    rateLabel.textContent = payTypeSelect.value === 'Daily' ? 'Daily Wage (₹)' : 'Monthly Wage (₹)';
  };
  payTypeSelect.addEventListener('change', updateLabel);
  updateLabel(); // call once initially

  // Handle Form Submission
  const form = document.getElementById('employee-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    
    // Normalize data formats
    payload.pay_rate = parseFloat(payload.pay_rate);
    if (isEdit) {
      payload.is_active = payload.is_active === 'true';
    }

    const submitBtn = document.getElementById('modal-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `${icons.spinner} Submitting...`;

    try {
      const url = isEdit ? `/api/employees/${empId}` : '/api/employees';
      const method = isEdit ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(isEdit ? 'Profile updated successfully!' : 'New employee registered successfully!', 'success');
        closeModal();
        loadEmployeesList();
      } else {
        const errorData = await res.json();
        showToast(errorData.error || 'Failed to submit personnel form.', 'error');
      }
    } catch (err) {
      showToast('Error connecting to personnel service.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
};

window.triggerDeleteEmployee = function(empId, fullName) {
  const html = `
    <div class="modal-header">
      <h3 class="modal-title" style="color:var(--accent-crimson);">Confirm Profile Deletion</h3>
      <button class="modal-close">${icons.close}</button>
    </div>
    <div class="modal-body">
      <p style="margin-bottom:12px;">Are you sure you want to permanently delete the employee file for <strong>${fullName}</strong>?</p>
      <p style="font-size:0.82rem; color:var(--text-muted);">Warning: This will wipe out all corresponding manual attendance sheets and payroll data for this employee immediately. This action is irreversible.</p>
    </div>
    <div class="modal-footer">
      <button type="button" class="header-btn btn-cancel">Cancel</button>
      <button type="button" class="header-btn primary" style="background-color: var(--accent-crimson); border-color: var(--accent-crimson);" id="confirm-delete-btn">
        Delete Employee File
      </button>
    </div>
  `;

  openModal(html);

  document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    const delBtn = document.getElementById('confirm-delete-btn');
    delBtn.disabled = true;
    delBtn.innerHTML = `${icons.spinner} Deleting...`;

    try {
      const res = await fetch(`/api/employees/${empId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Employee file deleted successfully.', 'success');
        closeModal();
        loadEmployeesList();
      } else {
        showToast('Failed to delete file.', 'error');
      }
    } catch (err) {
      showToast('Error communicating with deletion API.', 'error');
    } finally {
      delBtn.disabled = false;
    }
  });
};

// --- 4. RENDER SITE LOCATIONS PANEL ---
async function renderSites() {
  elements.workspace.innerHTML = `
    <div class="attendance-filters" style="justify-content: flex-end;">
      <button class="header-btn primary" id="site-add-btn">
        ${icons.plus} Establish New Site
      </button>
    </div>

    <div class="card" style="padding:0; overflow:hidden;">
      <div id="sites-table-target">
        <div class="empty-state">
          <span>${icons.spinner}</span>
          <h3>Acquiring site location catalog...</h3>
        </div>
      </div>
    </div>
  `;

  document.getElementById('site-add-btn').addEventListener('click', openSiteModal);

  loadSitesList();
}

async function loadSitesList() {
  const tableTarget = document.getElementById('sites-table-target');
  const isAdmin = state.user && state.user.role === 'admin';
  try {
    const res = await fetch('/api/sites');
    state.sites = await res.json();

    if (state.sites.length === 0) {
      tableTarget.innerHTML = `
        <div class="empty-state">
          <span>${icons.sites}</span>
          <h3>No project sites configured</h3>
          <p>Click the "Establish New Site" button to declare a construction/work site.</p>
        </div>
      `;
      return;
    }

    tableTarget.innerHTML = `
      <div class="table-wrapper">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Site ID</th>
              <th>Name</th>
              <th>Location Address</th>
              <th>Status</th>
              <th>Created On</th>
              ${isAdmin ? '<th style="text-align: right;">Actions</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${state.sites.map(s => `
              <tr>
                <td><span class="badge blue payslip-mono">#${s.id}</span></td>
                <td><strong>${s.name}</strong></td>
                <td>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="color:var(--text-dark);">${icons.location}</span>
                    <span>${s.location}</span>
                  </div>
                </td>
                <td><span class="badge emerald">Operational</span></td>
                <td class="payslip-mono" style="font-size:0.8rem; color:var(--text-muted);">${new Date(s.created_at).toLocaleDateString()}</td>
                ${isAdmin ? `
                  <td style="text-align: right;">
                    <button class="header-btn" style="padding:6px; border-radius: var(--radius-sm); margin-left: auto;" onclick="openSiteModal(${s.id})" title="Edit Site">
                      ${icons.edit}
                    </button>
                  </td>
                ` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    tableTarget.innerHTML = `
      <div class="empty-state">
        <span style="color:var(--accent-crimson);">${icons.inactive}</span>
        <h3>Failed to load sites</h3>
        <p>Error: ${err.message}</p>
      </div>
    `;
  }
}

window.openSiteModal = function(siteId = null) {
  const isEdit = siteId !== null;
  const site = isEdit ? state.sites.find(s => s.id == siteId) : null;

  const html = `
    <div class="modal-header">
      <h3 class="modal-title">${isEdit ? 'Update Project Site' : 'Establish Project Site'}</h3>
      <button class="modal-close">${icons.close}</button>
    </div>
    <form id="site-form">
      <div class="modal-body">
        
        <div class="form-group">
          <label class="form-label">Project Site Name</label>
          <input type="text" class="form-input" name="name" required placeholder="e.g. South Terminal Plaza" style="width:100%;" value="${isEdit ? site.name : ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Location Address / Coordinates</label>
          <input type="text" class="form-input" name="location" required placeholder="e.g. 104 Harbor Side Pkwy, Sector 4" style="width:100%;" value="${isEdit ? site.location : ''}">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Manager Username</label>
            <input type="text" class="form-input" name="manager_username" placeholder="e.g. manager_username" value="${isEdit ? (site.manager_username || '') : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Manager Password</label>
            <input type="password" class="form-input" name="manager_password" placeholder="••••••••" value="${isEdit ? (site.manager_password || '') : ''}">
          </div>
        </div>

      </div>
      <div class="modal-footer">
        <button type="button" class="header-btn btn-cancel">Cancel</button>
        <button type="submit" class="header-btn primary" id="site-submit-btn">
          ${isEdit ? 'Save Changes' : 'Create Location'}
        </button>
      </div>
    </form>
  `;

  openModal(html);

  const form = document.getElementById('site-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    const submitBtn = document.getElementById('site-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `${icons.spinner} ${isEdit ? 'Saving...' : 'Creating...'}`;

    try {
      const url = isEdit ? `/api/sites/${siteId}` : '/api/sites';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(isEdit ? 'Project location updated successfully!' : 'New project location added successfully!', 'success');
        closeModal();
        
        // Refresh site data & list
        const fetchRes = await fetch('/api/sites');
        state.sites = await fetchRes.json();
        
        loadSitesList();
      } else {
        const errorData = await res.json();
        showToast(errorData.error || 'Failed to submit site form.', 'error');
      }
    } catch (err) {
      showToast('Error connecting to locations directory.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
};

// --- 5. RENDER PAYROLL CALCULATOR & INVOICE SLIPS ---
async function renderPayroll() {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const years = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];

  elements.workspace.innerHTML = `
    <div class="attendance-filters">
      <div class="filters-left">
        <div class="filter-item">
          <label class="form-label" for="pay-month-select">Billing Month:</label>
          <select class="form-select" id="pay-month-select">
            ${months.map((m, idx) => `<option value="${idx + 1}" ${state.payrollMonth == (idx + 1) ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>

        <div class="filter-item">
          <label class="form-label" for="pay-year-select">Year:</label>
          <select class="form-select" id="pay-year-select">
            ${years.map(y => `<option value="${y}" ${state.payrollYear == y ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
        </div>
      </div>
      
      <div style="font-size:0.85rem; color:var(--text-muted);">
        * Salaries are dynamically calculated: <strong>Daily Rate</strong> × Days Present, or <strong>Monthly base</strong> deductions proportional to absences.
      </div>
    </div>

    <div class="card" style="padding:0; overflow:hidden;">
      <div id="payroll-table-target">
        <div class="empty-state">
          <span>${icons.spinner}</span>
          <h3>Computing calculations on monthly logs...</h3>
        </div>
      </div>
    </div>
  `;

  // Bind actions
  document.getElementById('pay-month-select').addEventListener('change', (e) => {
    state.payrollMonth = parseInt(e.target.value);
    loadPayrollRecords();
  });

  document.getElementById('pay-year-select').addEventListener('change', (e) => {
    state.payrollYear = parseInt(e.target.value);
    loadPayrollRecords();
  });

  loadPayrollRecords();
}

let activePayrollList = [];

async function loadPayrollRecords() {
  const tableTarget = document.getElementById('payroll-table-target');
  
  try {
    const res = await fetch(`/api/payroll?month=${state.payrollMonth}&year=${state.payrollYear}`);
    activePayrollList = await res.json();

    if (activePayrollList.length === 0) {
      tableTarget.innerHTML = `
        <div class="empty-state">
          <span>${icons.payroll}</span>
          <h3>No attendance metrics logged</h3>
          <p>There are no recorded active employees or attendance files matching the selected billing month.</p>
        </div>
      `;
      return;
    }

    tableTarget.innerHTML = `
      <div class="table-wrapper">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Role</th>
              <th>Model</th>
              <th>Base Rate</th>
              <th>Present</th>
              <th>Absent</th>
              <th>Late</th>
              <th>Final Gross Salary</th>
              <th>Payout Status</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${activePayrollList.map((row, idx) => `
              <tr>
                <td>
                  <div class="avatar-cell">
                    ${getAvatarHtml(row.first_name, row.last_name, idx)}
                    <div>
                      <div style="font-weight: 600;">${row.first_name} ${row.last_name}</div>
                      <div style="font-size:0.75rem; color:var(--text-muted);">${row.site_name}</div>
                    </div>
                  </div>
                </td>
                <td>${row.role}</td>
                <td><span class="badge ${row.pay_type === 'Monthly' ? 'emerald' : 'blue'}">${row.pay_type}</span></td>
                <td class="payslip-mono">₹${row.pay_rate.toFixed(2)}</td>
                <td class="payslip-mono" style="color: var(--accent-emerald); font-weight:600;">${row.days_present}</td>
                <td class="payslip-mono" style="color: var(--accent-crimson); font-weight:600;">${row.days_absent}</td>
                <td class="payslip-mono" style="color: var(--accent-amber); font-weight:600;">${row.days_late}</td>
                <td>
                  <strong class="payslip-mono" style="color:var(--accent-emerald); font-size:1.02rem;">
                    ₹${row.calculated_salary.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </strong>
                </td>
                <td>
                  <span class="badge ${row.payout_status === 'Paid' ? 'emerald' : 'amber'}">
                    ${row.payout_status}
                  </span>
                </td>
                <td style="text-align: right;">
                  <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button class="header-btn" style="padding: 6px 12px; font-size:0.8rem;" onclick="viewItemizedPayslip(${row.employee_id})">
                      ${icons.print} Payslip
                    </button>
                    ${row.payout_status === 'Pending' ? `
                      <button class="header-btn primary" style="padding: 6px 12px; font-size:0.8rem;" onclick="togglePayoutStatus(${row.employee_id}, 'Paid')">
                        Release Pay
                      </button>
                    ` : `
                      <button class="header-btn" style="padding: 6px 12px; font-size:0.8rem; border-color:var(--accent-crimson); color:var(--accent-crimson);" onclick="togglePayoutStatus(${row.employee_id}, 'Pending')">
                        Void Pay
                      </button>
                    `}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    tableTarget.innerHTML = `
      <div class="empty-state">
        <span style="color:var(--accent-crimson);">${icons.inactive}</span>
        <h3>Failed to aggregate payroll statements</h3>
        <p>Error: ${err.message}</p>
      </div>
    `;
  }
}

window.togglePayoutStatus = async function(empId, status) {
  try {
    const res = await fetch('/api/payroll/payout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: empId,
        month: state.payrollMonth,
        year: state.payrollYear,
        status: status
      })
    });

    if (res.ok) {
      showToast(`Payout status updated to ${status}!`, 'success');
      loadPayrollRecords();
    } else {
      showToast('Failed to modify payout state.', 'error');
    }
  } catch (err) {
    showToast('Network error updating payout status.', 'error');
  }
};

window.viewItemizedPayslip = function(empId) {
  const row = activePayrollList.find(r => r.employee_id == empId);
  if (!row) return;

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = months[state.payrollMonth - 1];

  // Logic calculation itemized values
  const totalDays = row.days_present + row.days_late;
  const standardDays = 26;
  const rateVal = row.pay_rate;
  let breakdownHtml = '';

  if (row.pay_type === 'Daily') {
    breakdownHtml = `
      <div class="payslip-grid">
        <span class="payslip-label">Calculation Mode:</span>
        <span class="payslip-value">Daily Rate Wage</span>
        
        <span class="payslip-label">Daily Payout Rate:</span>
        <span class="payslip-value payslip-mono">₹${rateVal.toFixed(2)}</span>
        
        <span class="payslip-label">Days Present Logged:</span>
        <span class="payslip-value payslip-mono">${row.days_present} days</span>

        <span class="payslip-label">Days Late Logged:</span>
        <span class="payslip-value payslip-mono">${row.days_late} days</span>
        
        <span class="payslip-label">Total Days Compensated:</span>
        <span class="payslip-value payslip-mono">${totalDays} days</span>
      </div>
    `;
  } else {
    const maxDays = Math.max(standardDays, totalDays + row.days_absent);
    const deduction = row.days_absent > 0 ? (row.days_absent / maxDays) * rateVal : 0;
    
    breakdownHtml = `
      <div class="payslip-grid">
        <span class="payslip-label">Calculation Mode:</span>
        <span class="payslip-value">Monthly Base Contract</span>
        
        <span class="payslip-label">Monthly Gross Rate:</span>
        <span class="payslip-value payslip-mono">₹${rateVal.toFixed(2)}</span>

        <span class="payslip-label">Billing Period Days:</span>
        <span class="payslip-value payslip-mono">${maxDays} days</span>

        <span class="payslip-label">Unexcused Absences:</span>
        <span class="payslip-value payslip-mono" style="color:var(--accent-crimson); font-weight:600;">-${row.days_absent} days</span>
        
        <span class="payslip-label">Deduction For Absences:</span>
        <span class="payslip-value payslip-mono" style="color:var(--accent-crimson); font-weight:600;">-₹${deduction.toFixed(2)}</span>
      </div>
    `;
  }

  const html = `
    <div class="modal-header">
      <h3 class="modal-title">Itemized Pay Statement</h3>
      <button class="modal-close">${icons.close}</button>
    </div>
    <div class="modal-body" style="background-color: var(--bg-app); padding:20px;">
      
      <div class="payslip-invoice" id="printable-payslip-invoice">
        <div class="payslip-header">
          <div class="payslip-brand">₹ PAYROLL SERVICE</div>
          <div class="payslip-meta">Site Attendance Payout Receipt</div>
          <div class="payslip-meta" style="font-family: monospace; font-size:0.75rem; margin-top:10px;">ID: TX-${row.employee_code}-${state.payrollMonth}${state.payrollYear}</div>
        </div>

        <div class="payslip-section">
          <div class="payslip-section-title">Employee Details</div>
          <div class="payslip-grid">
            <span class="payslip-label">Full Name:</span>
            <span class="payslip-value">${row.first_name} ${row.last_name}</span>

            <span class="payslip-label">Personnel Code:</span>
            <span class="payslip-value payslip-mono">${row.employee_code}</span>

            <span class="payslip-label">Site Assignment:</span>
            <span class="payslip-value">${row.site_name}</span>

            <span class="payslip-label">Assigned Role:</span>
            <span class="payslip-value">${row.role}</span>
          </div>
        </div>

        <div class="payslip-section">
          <div class="payslip-section-title">Billing Period</div>
          <div class="payslip-grid">
            <span class="payslip-label">Target Month:</span>
            <span class="payslip-value">${monthName} ${state.payrollYear}</span>
            
            <span class="payslip-label">Log Verification:</span>
            <span class="payslip-value" style="color:var(--accent-emerald); font-weight:600;">Audit Complete</span>
          </div>
        </div>

        <div class="payslip-section">
          <div class="payslip-section-title">Earnings Breakdown</div>
          ${breakdownHtml}
        </div>

        <div class="payslip-total-block">
          <span class="payslip-total-label">NET PAYOUT RELEASED:</span>
          <span class="payslip-total-value">₹${row.calculated_salary.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>

        <div class="payslip-grid" style="font-size:0.75rem; margin-top:8px;">
          <span class="payslip-label">Payout Status:</span>
          <span class="payslip-value" style="font-weight: 700; color: ${row.payout_status === 'Paid' ? '#10b981' : '#f59e0b'};">${row.payout_status.toUpperCase()}</span>
          
          ${row.paid_at ? `
            <span class="payslip-label">Released Date:</span>
            <span class="payslip-value payslip-mono">${new Date(row.paid_at).toLocaleString()}</span>
          ` : ''}
        </div>

        <div class="payslip-footer-text">
          Certified by Payroll Hub Admin. This is a computer generated pay statement and requires no manual signature.
        </div>
      </div>

    </div>
    <div class="modal-footer">
      <button type="button" class="header-btn btn-cancel">Close</button>
      <button type="button" class="header-btn primary" id="print-receipt-btn">
        ${icons.print} Print Pay Slip
      </button>
    </div>
  `;

  openModal(html);

  // Bind receipt printing
  document.getElementById('print-receipt-btn').addEventListener('click', () => {
    const printContents = document.getElementById('printable-payslip-invoice').outerHTML;
    const originalContents = document.body.innerHTML;

    // Direct window print style configuration
    const popupWin = window.open('', '_blank', 'width=600,height=800');
    popupWin.document.open();
    popupWin.document.write(`
      <html>
        <head>
          <title>Pay Slip - ${row.first_name} ${row.last_name}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; padding: 20px; color: #1e293b; }
            .payslip-invoice { border: 1px solid #e2e8f0; padding: 30px; border-radius: 8px; max-width: 480px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
            .payslip-header { border-bottom: 2px dashed #cbd5e1; padding-bottom: 15px; margin-bottom: 15px; text-align: center; }
            .payslip-brand { font-weight: 800; font-size: 1.3rem; letter-spacing: -0.02em; color: #0f172a; }
            .payslip-meta { font-size: 0.8rem; color: #64748b; margin-top: 3px; }
            .payslip-section { margin-bottom: 15px; }
            .payslip-section-title { font-weight: 700; font-size: 0.75rem; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 3px; }
            .payslip-grid { display: grid; grid-template-columns: auto 1fr; row-gap: 5px; column-gap: 10px; font-size: 0.8rem; }
            .payslip-label { color: #64748b; }
            .payslip-value { font-weight: 600; text-align: right; }
            .payslip-mono { font-family: monospace; }
            .payslip-total-block { border-top: 2px dashed #cbd5e1; border-bottom: 2px dashed #cbd5e1; padding: 10px 0; margin: 12px 0; display: flex; justify-content: space-between; align-items: center; }
            .payslip-total-label { font-weight: 800; font-size: 0.85rem; color: #0f172a; }
            .payslip-total-value { font-weight: 800; font-size: 1.25rem; color: #10b981; }
            .payslip-footer-text { font-size: 0.7rem; color: #94a3b8; text-align: center; margin-top: 15px; }
            @media print {
              body { padding: 0; }
              .payslip-invoice { border: none; box-shadow: none; }
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${printContents}
        </body>
      </html>
    `);
    popupWin.document.close();
  });
};

// --- EXPENSE TRACKER VIEW ---
async function renderExpensesView() {
  if (state.sites.length === 0) {
    elements.workspace.innerHTML = `
      <div class="empty-state">
        <span>${icons.sites}</span>
        <h3>No site locations defined</h3>
        <p>Please add a project site location first in the "Site Locations" tab.</p>
      </div>
    `;
    return;
  }

  // Create workspace layout
  elements.workspace.innerHTML = `
    <div class="attendance-grid-container">
      
      <!-- Selection bar -->
      <div class="attendance-filters">
        <div class="filters-left">
          <div class="filter-item" id="exp-site-filter-container">
            <label class="form-label" for="exp-site-select">Project Site:</label>
            <select class="form-select" id="exp-site-select" style="min-width: 220px;">
              ${state.sites.map(s => `<option value="${s.id}" ${state.selectedSiteId == s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>
          
          <div class="filter-item">
            <label class="form-label" for="exp-date-picker">Date:</label>
            <input type="date" class="form-input" id="exp-date-picker" value="${state.selectedDate}" max="${new Date().toISOString().split('T')[0]}">
          </div>
        </div>
        
        <button class="header-btn primary" id="exp-add-btn">
          ${icons.plus} Add Transaction
        </button>
      </div>

      <!-- Real-time Balance Summary -->
      <div class="expense-summary-grid" id="expense-summary-target">
        <!-- Summaries load here -->
      </div>

      <!-- Main expense listing -->
      <div class="card" style="padding:0; overflow:hidden;">
        <div id="expense-sheet-target">
          <div class="empty-state">
            <span>${icons.spinner}</span>
            <h3>Fetching expense logs...</h3>
          </div>
        </div>
      </div>
      
    </div>
  `;

  // Hide site selector if site manager
  if (state.user && state.user.role === 'manager') {
    const container = document.getElementById('exp-site-filter-container');
    if (container) container.style.display = 'none';
  }

  // Bind dropdown & date actions
  const siteSelect = document.getElementById('exp-site-select');
  const datePicker = document.getElementById('exp-date-picker');
  const addBtn = document.getElementById('exp-add-btn');

  siteSelect.addEventListener('change', (e) => {
    state.selectedSiteId = e.target.value;
    loadExpenseRecords();
  });

  datePicker.addEventListener('change', (e) => {
    state.selectedDate = e.target.value;
    loadExpenseRecords();
  });

  addBtn.addEventListener('click', openExpenseModal);

  // Load records initially
  loadExpenseRecords();
}

async function loadExpenseRecords() {
  const summaryTarget = document.getElementById('expense-summary-target');
  const sheetTarget = document.getElementById('expense-sheet-target');
  
  if (!summaryTarget || !sheetTarget) return;

  try {
    const res = await fetch(`/api/expenses?siteId=${state.selectedSiteId}&date=${state.selectedDate}`);
    const expenses = await res.json();
    
    // Calculate daily metrics
    let totalReceived = 0;
    let totalSpent = 0;
    
    expenses.forEach(e => {
      if (e.type === 'Received') {
        totalReceived += parseFloat(e.amount);
      } else {
        totalSpent += parseFloat(e.amount);
      }
    });
    
    const balance = totalReceived - totalSpent;
    
    // Render summary cards
    summaryTarget.innerHTML = `
      <div class="expense-summary-card">
        <span class="expense-summary-label">Cash Provided by Owner</span>
        <span class="expense-summary-value received">₹${totalReceived.toFixed(2)}</span>
      </div>
      <div class="expense-summary-card">
        <span class="expense-summary-label">Expenses Logged</span>
        <span class="expense-summary-value spent">₹${totalSpent.toFixed(2)}</span>
      </div>
      <div class="expense-summary-card" style="border-left: 4px solid ${balance >= 0 ? 'var(--accent-emerald)' : 'var(--accent-crimson)'};">
        <span class="expense-summary-label">Balance in Hand</span>
        <span class="expense-summary-value balance" style="color: ${balance >= 0 ? 'var(--accent-emerald)' : 'var(--accent-crimson)'};">
          ₹${balance.toFixed(2)}
        </span>
      </div>
    `;
    
    // Render sheet table
    if (expenses.length === 0) {
      sheetTarget.innerHTML = `
        <div class="empty-state">
          <span>${icons.expenses}</span>
          <h3>No transactions recorded for today</h3>
          <p>Click "Add Transaction" to note down any expenses or owner-provided cash.</p>
        </div>
      `;
      return;
    }
    
    sheetTarget.innerHTML = `
      <div class="table-wrapper">
        <table class="custom-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Time</th>
              <th>Description / Purpose</th>
              <th>Type</th>
              <th>Amount</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.map(e => `
              <tr>
                <td><span class="badge blue payslip-mono">#${e.id}</span></td>
                <td class="payslip-mono" style="font-size:0.8rem; color:var(--text-muted);">
                  ${new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td><strong>${e.description}</strong></td>
                <td>
                  <span class="badge ${e.type === 'Received' ? 'emerald' : 'crimson'}">
                    ${e.type === 'Received' ? 'Received from Owner' : 'Spent Expense'}
                  </span>
                </td>
                <td>
                  <strong class="payslip-mono" style="color: ${e.type === 'Received' ? 'var(--accent-emerald)' : 'var(--accent-crimson)'};">
                    ${e.type === 'Received' ? '+' : '-'}₹${parseFloat(e.amount).toFixed(2)}
                  </strong>
                </td>
                <td style="text-align: right;">
                  <button class="header-btn" style="padding:6px; border-radius: var(--radius-sm); color: var(--accent-crimson); margin-left: auto;" 
                    onclick="deleteExpenseRecord(${e.id})" title="Delete Transaction">
                    ${icons.close}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    sheetTarget.innerHTML = `
      <div class="empty-state">
        <span style="color:var(--accent-crimson);">${icons.inactive}</span>
        <h3>Failed to fetch expense records</h3>
        <p>Error: ${err.message}</p>
      </div>
    `;
  }
}

window.deleteExpenseRecord = async function(id) {
  if (!confirm('Are you sure you want to delete this transaction record?')) return;
  try {
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Transaction deleted successfully.', 'success');
      loadExpenseRecords();
    } else {
      showToast('Failed to delete transaction.', 'error');
    }
  } catch (err) {
    showToast('Network error deleting transaction.', 'error');
  }
};

function openExpenseModal() {
  const html = `
    <div class="modal-header">
      <h3 class="modal-title">Record Daily Transaction</h3>
      <button class="modal-close">${icons.close}</button>
    </div>
    <form id="expense-form">
      <div class="modal-body">
        
        <div class="form-group">
          <label class="form-label">Transaction Type</label>
          <select class="form-select" name="type" required>
            <option value="Expense">Spent Expense</option>
            <option value="Received">Received Cash from Owner</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Amount (₹)</label>
          <input type="number" step="0.01" min="0.01" class="form-input payslip-mono" name="amount" required placeholder="0.00">
        </div>

        <div class="form-group">
          <label class="form-label">Description / Purpose</label>
          <input type="text" class="form-input" name="description" required placeholder="e.g. Purchased brick loads, Paid diesel bill, Cash received from owner" style="width:100%;">
        </div>

      </div>
      <div class="modal-footer">
        <button type="button" class="header-btn btn-cancel">Cancel</button>
        <button type="submit" class="header-btn primary" id="expense-submit-btn">
          Save Transaction
        </button>
      </div>
    </form>
  `;

  openModal(html);

  const form = document.getElementById('expense-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    
    payload.amount = parseFloat(payload.amount);
    payload.date = state.selectedDate;
    payload.siteId = state.selectedSiteId;

    const submitBtn = document.getElementById('expense-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `${icons.spinner} Saving...`;

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('Daily transaction recorded successfully!', 'success');
        closeModal();
        loadExpenseRecords();
      } else {
        const errorData = await res.json();
        showToast(errorData.error || 'Failed to record transaction.', 'error');
      }
    } catch (err) {
      showToast('Error connecting to expense services.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}
