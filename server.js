import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, dbService, seedPostgresDb } from './db.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Resolve directories for serving static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

// Middlewares
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// Helper for wrapping async endpoints
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('❌ Express Route Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });
};

// Lightweight session store
const sessions = new Map();

// Authentication Middleware
const authenticateSession = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Session missing' });
  }
  const token = authHeader.split(' ')[1];
  const sessionUser = sessions.get(token);
  if (!sessionUser) {
    return res.status(401).json({ error: 'Unauthorized: Session expired' });
  }
  req.user = sessionUser;
  next();
};

// --- SYSTEM API ROUTING ---

// 1. DB STATUS & CONFIGURATION
app.get('/api/db-status', asyncHandler(async (req, res) => {
  res.json({
    isPostgres: dbService.isPostgres(),
    mode: dbService.isPostgres() ? 'Production (PostgreSQL)' : 'Local Evaluation (Mock JSON)'
  });
}));

app.post('/api/seed-db', asyncHandler(async (req, res) => {
  if (!dbService.isPostgres()) {
    return res.status(400).json({ 
      error: 'Not running in PostgreSQL mode. Local mock database is seeded automatically.' 
    });
  }
  const result = await seedPostgresDb();
  res.json(result);
}));

// 2. AUTHENTICATION ENDPOINTS
app.post('/api/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const user = await dbService.authenticateUser(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  sessions.set(token, user);
  res.json({ token, user });
}));

app.post('/api/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    sessions.delete(token);
  }
  res.json({ success: true });
});

app.get('/api/me', authenticateSession, (req, res) => {
  res.json(req.user);
});

// 3. DASHBOARD STATS
app.get('/api/dashboard/stats', authenticateSession, asyncHandler(async (req, res) => {
  const siteId = req.user.role === 'manager' ? req.user.siteId : req.query.siteId;
  const stats = await dbService.getDashboardStats(siteId);
  res.json(stats);
}));

// 4. SITES ENDPOINTS
app.get('/api/sites', authenticateSession, asyncHandler(async (req, res) => {
  const sites = await dbService.getSites();
  if (req.user.role === 'manager') {
    return res.json(sites.filter(s => s.id === req.user.siteId));
  }
  res.json(sites);
}));

app.post('/api/sites', authenticateSession, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  const { name, location, manager_username, manager_password } = req.body;
  if (!name || !location) {
    return res.status(400).json({ error: 'Name and location are required.' });
  }
  const newSite = await dbService.createSite(name, location, manager_username, manager_password);
  res.status(201).json(newSite);
}));

app.put('/api/sites/:id', authenticateSession, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  const { id } = req.params;
  const { name, location, manager_username, manager_password } = req.body;
  if (!name || !location) {
    return res.status(400).json({ error: 'Name and location are required.' });
  }
  const updatedSite = await dbService.updateSite(id, name, location, manager_username, manager_password);
  res.json(updatedSite);
}));

// 5. EMPLOYEES ENDPOINTS
app.get('/api/employees', authenticateSession, asyncHandler(async (req, res) => {
  const siteId = req.user.role === 'manager' ? req.user.siteId : req.query.siteId;
  const employees = await dbService.getEmployees(siteId);
  res.json(employees);
}));

app.post('/api/employees', authenticateSession, asyncHandler(async (req, res) => {
  let { employee_code, first_name, last_name, site_id, role, pay_type, pay_rate } = req.body;
  if (req.user.role === 'manager') {
    site_id = req.user.siteId;
  }
  if (!employee_code || !first_name || !last_name || !role || !pay_rate) {
    return res.status(400).json({ error: 'Missing required employee fields.' });
  }
  const newEmp = await dbService.createEmployee({
    employee_code,
    first_name,
    last_name,
    site_id,
    role,
    pay_type: pay_type || 'Daily',
    pay_rate
  });
  res.status(201).json(newEmp);
}));

app.put('/api/employees/:id', authenticateSession, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (req.user.role === 'manager') {
    const employees = await dbService.getEmployees(req.user.siteId);
    const hasEmp = employees.some(e => e.id === parseInt(id));
    if (!hasEmp) {
      return res.status(403).json({ error: 'Access denied: employee belongs to another site' });
    }
    req.body.site_id = req.user.siteId;
  }
  
  const updatedEmp = await dbService.updateEmployee(id, req.body);
  res.json(updatedEmp);
}));

app.delete('/api/employees/:id', authenticateSession, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (req.user.role === 'manager') {
    const employees = await dbService.getEmployees(req.user.siteId);
    const hasEmp = employees.some(e => e.id === parseInt(id));
    if (!hasEmp) {
      return res.status(403).json({ error: 'Access denied: employee belongs to another site' });
    }
  }
  
  const result = await dbService.deleteEmployee(id);
  res.json(result);
}));

// 6. ATTENDANCE ENDPOINTS
app.get('/api/attendance', authenticateSession, asyncHandler(async (req, res) => {
  const siteId = req.user.role === 'manager' ? req.user.siteId : req.query.siteId;
  const { date } = req.query;
  if (!siteId || !date) {
    return res.status(400).json({ error: 'siteId and date parameters are required.' });
  }
  const records = await dbService.getAttendance(siteId, date);
  res.json(records);
}));

app.post('/api/attendance', authenticateSession, asyncHandler(async (req, res) => {
  let { siteId, date, records, markedBy } = req.body;
  if (req.user.role === 'manager') {
    siteId = req.user.siteId;
  }
  if (!siteId || !date || !Array.isArray(records)) {
    return res.status(400).json({ error: 'siteId, date, and records array are required.' });
  }
  const result = await dbService.saveAttendance(siteId, date, records, markedBy || req.user.name);
  res.json(result);
}));

// 7. PAYROLL ENDPOINTS
app.get('/api/payroll', authenticateSession, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  const { month, year } = req.query;
  if (!month || !year) {
    return res.status(400).json({ error: 'month and year parameters are required.' });
  }
  const payroll = await dbService.getPayrollForPeriod(month, year);
  res.json(payroll);
}));

app.post('/api/payroll/payout', authenticateSession, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  const { employeeId, month, year, status } = req.body;
  if (!employeeId || !month || !year || !status) {
    return res.status(400).json({ error: 'employeeId, month, year, and status are required.' });
  }
  const result = await dbService.updatePayoutStatus(employeeId, month, year, status);
  res.json(result);
}));

// 8. EXPENSES ENDPOINTS
app.get('/api/expenses', authenticateSession, asyncHandler(async (req, res) => {
  const siteId = req.user.role === 'manager' ? req.user.siteId : req.query.siteId;
  const { date } = req.query;
  const expenses = await dbService.getExpenses(siteId, date);
  res.json(expenses);
}));

app.post('/api/expenses', authenticateSession, asyncHandler(async (req, res) => {
  const { date, amount, type, description } = req.body;
  let siteId = req.body.siteId;
  if (req.user.role === 'manager') {
    siteId = req.user.siteId;
  }
  if (!siteId || !date || amount === undefined || !type || !description) {
    return res.status(400).json({ error: 'Missing required expense fields.' });
  }
  const newExp = await dbService.createExpense({ siteId, date, amount, type, description });
  res.status(201).json(newExp);
}));

app.delete('/api/expenses/:id', authenticateSession, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (req.user.role === 'manager') {
    const expenses = await dbService.getExpenses(req.user.siteId);
    const hasExp = expenses.some(e => e.id === parseInt(id));
    if (!hasExp) {
      return res.status(403).json({ error: 'Access denied: transaction belongs to another site' });
    }
  }
  
  const result = await dbService.deleteExpense(id);
  res.json(result);
}));

// Serves the client SPA for any unmatched paths
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Start Server after database initialization
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Attendance & Payroll Server active at: http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('💥 Critical database initialization failure:', err);
});
