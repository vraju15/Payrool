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

// 2. DASHBOARD STATS
app.get('/api/dashboard/stats', asyncHandler(async (req, res) => {
  const stats = await dbService.getDashboardStats();
  res.json(stats);
}));

// 3. SITES ENDPOINTS
app.get('/api/sites', asyncHandler(async (req, res) => {
  const sites = await dbService.getSites();
  res.json(sites);
}));

app.post('/api/sites', asyncHandler(async (req, res) => {
  const { name, location } = req.body;
  if (!name || !location) {
    return res.status(400).json({ error: 'Name and location are required.' });
  }
  const newSite = await dbService.createSite(name, location);
  res.status(201).json(newSite);
}));

// 4. EMPLOYEES ENDPOINTS
app.get('/api/employees', asyncHandler(async (req, res) => {
  const { siteId } = req.query;
  const employees = await dbService.getEmployees(siteId);
  res.json(employees);
}));

app.post('/api/employees', asyncHandler(async (req, res) => {
  const { employee_code, first_name, last_name, site_id, role, pay_type, pay_rate } = req.body;
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

app.put('/api/employees/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updatedEmp = await dbService.updateEmployee(id, req.body);
  res.json(updatedEmp);
}));

app.delete('/api/employees/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await dbService.deleteEmployee(id);
  res.json(result);
}));

// 5. ATTENDANCE ENDPOINTS
app.get('/api/attendance', asyncHandler(async (req, res) => {
  const { siteId, date } = req.query;
  if (!siteId || !date) {
    return res.status(400).json({ error: 'siteId and date parameters are required.' });
  }
  const records = await dbService.getAttendance(siteId, date);
  res.json(records);
}));

app.post('/api/attendance', asyncHandler(async (req, res) => {
  const { siteId, date, records, markedBy } = req.body;
  if (!siteId || !date || !Array.isArray(records)) {
    return res.status(400).json({ error: 'siteId, date, and records array are required.' });
  }
  const result = await dbService.saveAttendance(siteId, date, records, markedBy);
  res.json(result);
}));

// 6. PAYROLL ENDPOINTS
app.get('/api/payroll', asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) {
    return res.status(400).json({ error: 'month and year parameters are required.' });
  }
  const payroll = await dbService.getPayrollForPeriod(month, year);
  res.json(payroll);
}));

app.post('/api/payroll/payout', asyncHandler(async (req, res) => {
  const { employeeId, month, year, status } = req.body;
  if (!employeeId || !month || !year || !status) {
    return res.status(400).json({ error: 'employeeId, month, year, and status are required.' });
  }
  const result = await dbService.updatePayoutStatus(employeeId, month, year, status);
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
