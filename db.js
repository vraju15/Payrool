import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

// Load environment variables (fallback values)
const PG_CONFIG = {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:vksb1503@localhost:5432/payroll_db',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

let pool = null;
let isPostgresMode = false;
const MOCK_DB_PATH = path.resolve('database.json');

// Realistic mock data generation helpers
const FIRST_NAMES = ['Liam', 'Noah', 'Oliver', 'James', 'Elijah', 'William', 'Henry', 'Lucas', 'Benjamin', 'Theodore', 'Mateo', 'Levi', 'Sebastian', 'Daniel', 'Jack', 'Michael', 'Alexander', 'Owen', 'Asher', 'Samuel', 'Ethan', 'Leo', 'Jackson', 'Mason', 'Ezra', 'John', 'Hudson', 'Luca', 'Connor', 'David', 'Olivia', 'Emma', 'Charlotte', 'Amelia', 'Sophia', 'Isabella', 'Ava', 'Mia', 'Evelyn', 'Harper', 'Luna', 'Camila', 'Gianna', 'Elizabeth', 'Eleanor', 'Ella', 'Abigail', 'Sofia', 'Avery', 'Scarlett', 'Emily', 'Aria', 'Penelope', 'Chloe', 'Layla', 'Mildred', 'Agnes', 'Josephine', 'Francis', 'Albert'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'];
const ROLES = [
  { role: 'Site Supervisor', payType: 'Monthly', payRate: 5200 },
  { role: 'Project Engineer', payType: 'Monthly', payRate: 6000 },
  { role: 'Safety Inspector', payType: 'Monthly', payRate: 4500 },
  { role: 'Lead Electrician', payType: 'Daily', payRate: 240 },
  { role: 'Lead Plumber', payType: 'Daily', payRate: 230 },
  { role: 'Heavy Equip Operator', payType: 'Daily', payRate: 210 },
  { role: 'Senior Mason', payType: 'Daily', payRate: 190 },
  { role: 'Welder', payType: 'Daily', payRate: 200 },
  { role: 'Carpenter', payType: 'Daily', payRate: 180 },
  { role: 'General Laborer', payType: 'Daily', payRate: 140 },
  { role: 'Apprentice Laborer', payType: 'Daily', payRate: 110 }
];

const SITES_LIST = [
  { name: 'Downtown Plaza', location: '450 Broadway St, NY' },
  { name: 'North Warehouse', location: '102 Industrial Pkwy, NJ' },
  { name: 'Metro Line Expansion', location: 'Zone 4 Transit Area' },
  { name: 'East Suburb Hub', location: '89 Oak Rd, Long Island' },
  { name: 'West Port Terminal', location: 'Pier 15 Harbor Dr' }
];

// Initialize DB Client
export async function initDb() {
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    pool = new Pool(PG_CONFIG);
    const client = await pool.connect();
    console.log('✅ PostgreSQL connected successfully!');
    isPostgresMode = true;
    client.release();
    
    // Automatically create tables if they do not exist
    await runPostgresMigration();
  } catch (err) {
    console.warn('⚠️ PostgreSQL connection failed. Falling back to high-fidelity Mock Mode (database.json).');
    console.warn(`Reason: ${err.message}`);
    isPostgresMode = false;
    initMockDb();
  }
}

// PostgreSQL migrations runner
async function runPostgresMigration() {
  const ddl = `
    CREATE TABLE IF NOT EXISTS sites (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      location VARCHAR(200) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      employee_code VARCHAR(20) NOT NULL UNIQUE,
      first_name VARCHAR(50) NOT NULL,
      last_name VARCHAR(50) NOT NULL,
      site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
      role VARCHAR(50) NOT NULL,
      pay_type VARCHAR(10) CHECK (pay_type IN ('Daily', 'Monthly')) DEFAULT 'Daily',
      pay_rate NUMERIC(10, 2) NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
      date DATE NOT NULL,
      status VARCHAR(10) CHECK (status IN ('Present', 'Absent', 'Late')) NOT NULL,
      notes VARCHAR(255),
      marked_by VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (employee_id, date)
    );

    CREATE TABLE IF NOT EXISTS payroll (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      month INTEGER CHECK (month BETWEEN 1 AND 12) NOT NULL,
      year INTEGER NOT NULL,
      days_present INTEGER NOT NULL DEFAULT 0,
      days_absent INTEGER NOT NULL DEFAULT 0,
      days_late INTEGER NOT NULL DEFAULT 0,
      calculated_salary NUMERIC(12, 2) NOT NULL,
      payout_status VARCHAR(10) CHECK (payout_status IN ('Pending', 'Paid')) DEFAULT 'Pending',
      paid_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (employee_id, month, year)
    );
  `;
  await pool.query(ddl);
  console.log('✅ PostgreSQL schema verified/created.');
}

// Seeding PostgreSQL with 5 sites, 250 employees and 30 days of attendance
export async function seedPostgresDb() {
  if (!isPostgresMode) {
    throw new Error('Not connected to PostgreSQL database.');
  }
  
  // Check if already seeded
  const checkResult = await pool.query('SELECT COUNT(*) FROM employees');
  if (parseInt(checkResult.rows[0].count) > 0) {
    console.log('✅ PostgreSQL already seeded.');
    return { success: true, message: 'Database already has records.' };
  }

  console.log('🌱 Seeding PostgreSQL Database with 5 sites and ~250 employees...');
  
  // 1. Insert Sites
  const siteIds = [];
  for (const s of SITES_LIST) {
    const res = await pool.query(
      'INSERT INTO sites (name, location) VALUES ($1, $2) RETURNING id',
      [s.name, s.location]
    );
    siteIds.push(res.rows[0].id);
  }

  // 2. Insert ~250 Employees (50 per site)
  let empCodeCounter = 1001;
  const employeesList = [];

  for (let sIdx = 0; sIdx < siteIds.length; sIdx++) {
    const siteId = siteIds[sIdx];
    for (let e = 0; e < 50; e++) {
      const fName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const roleConfig = ROLES[Math.floor(Math.random() * ROLES.length)];
      
      // Introduce slight salary variation per employee
      const rateMultiplier = 0.9 + Math.random() * 0.2; // 90% to 110%
      const finalRate = parseFloat((roleConfig.payRate * rateMultiplier).toFixed(2));
      
      const code = `EMP${empCodeCounter++}`;
      
      const empRes = await pool.query(
        `INSERT INTO employees (employee_code, first_name, last_name, site_id, role, pay_type, pay_rate) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [code, fName, lName, siteId, roleConfig.role, roleConfig.payType, finalRate]
      );
      
      employeesList.push({
        id: empRes.rows[0].id,
        site_id: siteId
      });
    }
  }

  // 3. Insert 30 Days of Manual Attendance Logs
  console.log('📅 Seeding 30 days of manual attendance...');
  const attendanceQuery = `
    INSERT INTO attendance (employee_id, site_id, date, status, marked_by) 
    VALUES ($1, $2, $3, $4, $5)
  `;

  for (let dayOffset = 30; dayOffset >= 1; dayOffset--) {
    const d = new Date();
    d.setDate(d.getDate() - dayOffset);
    // Ignore Sundays
    if (d.getDay() === 0) continue;
    
    const dateStr = d.toISOString().split('T')[0];
    
    for (const emp of employeesList) {
      // 90% Present, 7% Late, 3% Absent
      const rand = Math.random();
      let status = 'Present';
      if (rand > 0.97) {
        status = 'Absent';
      } else if (rand > 0.90) {
        status = 'Late';
      }
      
      await pool.query(attendanceQuery, [
        emp.id,
        emp.site_id,
        dateStr,
        status,
        'Site Manager'
      ]);
    }
  }

  console.log('✅ PostgreSQL seeding completed successfully!');
  return { success: true, message: 'Seeded 5 sites, 250 employees, and 30 days of attendance logs.' };
}

// --- MOCK DATABASE CONTROLLER (JSON FILE BASED) ---
function initMockDb() {
  if (fs.existsSync(MOCK_DB_PATH)) {
    console.log('✅ Loaded existing Mock Database from database.json');
    return;
  }
  
  console.log('🌱 Creating and Seeding database.json with 5 sites, 250 employees, and 30 days of attendance...');
  const db = {
    sites: [],
    employees: [],
    attendance: [],
    payroll: []
  };

  // 1. Create 5 Sites
  SITES_LIST.forEach((s, idx) => {
    db.sites.push({
      id: idx + 1,
      name: s.name,
      location: s.location,
      created_at: new Date().toISOString()
    });
  });

  // 2. Create 250 Employees (50 per site)
  let empId = 1;
  let codeNum = 1001;

  db.sites.forEach(site => {
    for (let i = 0; i < 50; i++) {
      const fName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const roleConfig = ROLES[Math.floor(Math.random() * ROLES.length)];
      
      const rateMultiplier = 0.9 + Math.random() * 0.2;
      const finalRate = parseFloat((roleConfig.payRate * rateMultiplier).toFixed(2));
      
      db.employees.push({
        id: empId++,
        employee_code: `EMP${codeNum++}`,
        first_name: fName,
        last_name: lName,
        site_id: site.id,
        role: roleConfig.role,
        pay_type: roleConfig.payType,
        pay_rate: finalRate,
        is_active: true,
        created_at: new Date().toISOString()
      });
    }
  });

  // 3. Create 30 Days of Manual Attendance
  for (let dayOffset = 30; dayOffset >= 1; dayOffset--) {
    const d = new Date();
    d.setDate(d.getDate() - dayOffset);
    if (d.getDay() === 0) continue; // Skip Sunday

    const dateStr = d.toISOString().split('T')[0];

    db.employees.forEach(emp => {
      const rand = Math.random();
      let status = 'Present';
      if (rand > 0.97) {
        status = 'Absent';
      } else if (rand > 0.90) {
        status = 'Late';
      }

      db.attendance.push({
        id: db.attendance.length + 1,
        employee_id: emp.id,
        site_id: emp.site_id,
        date: dateStr,
        status: status,
        notes: '',
        marked_by: 'Site Manager',
        created_at: new Date().toISOString()
      });
    });
  }

  saveMockDb(db);
  console.log('✅ Seeded and saved database.json!');
}

function loadMockDb() {
  try {
    const raw = fs.readFileSync(MOCK_DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load mock database:', err);
    return { sites: [], employees: [], attendance: [], payroll: [] };
  }
}

function saveMockDb(db) {
  try {
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save mock database:', err);
  }
}

// --- DATABASE UNIFIED INTERFACE (ADAPTERS) ---
export const dbService = {
  // Check Mode
  isPostgres() {
    return isPostgresMode;
  },

  // 1. SITES OPERATIONS
  async getSites() {
    if (isPostgresMode) {
      const res = await pool.query('SELECT * FROM sites ORDER BY name ASC');
      return res.rows;
    } else {
      const db = loadMockDb();
      return db.sites.sort((a, b) => a.name.localeCompare(b.name));
    }
  },

  async createSite(name, location) {
    if (isPostgresMode) {
      const res = await pool.query(
        'INSERT INTO sites (name, location) VALUES ($1, $2) RETURNING *',
        [name, location]
      );
      return res.rows[0];
    } else {
      const db = loadMockDb();
      const newSite = {
        id: db.sites.length > 0 ? Math.max(...db.sites.map(s => s.id)) + 1 : 1,
        name,
        location,
        created_at: new Date().toISOString()
      };
      db.sites.push(newSite);
      saveMockDb(db);
      return newSite;
    }
  },

  // 2. EMPLOYEES OPERATIONS
  async getEmployees(siteId = null) {
    if (isPostgresMode) {
      let query = 'SELECT e.*, s.name as site_name FROM employees e LEFT JOIN sites s ON e.site_id = s.id';
      const params = [];
      if (siteId) {
        query += ' WHERE e.site_id = $1';
        params.push(siteId);
      }
      query += ' ORDER BY e.id DESC';
      const res = await pool.query(query, params);
      return res.rows;
    } else {
      const db = loadMockDb();
      let emps = db.employees.map(e => {
        const site = db.sites.find(s => s.id === e.site_id);
        return { ...e, site_name: site ? site.name : 'Unassigned' };
      });
      if (siteId) {
        emps = emps.filter(e => e.site_id === parseInt(siteId));
      }
      return emps.sort((a, b) => b.id - a.id);
    }
  },

  async createEmployee(data) {
    const { employee_code, first_name, last_name, site_id, role, pay_type, pay_rate } = data;
    if (isPostgresMode) {
      const res = await pool.query(
        `INSERT INTO employees (employee_code, first_name, last_name, site_id, role, pay_type, pay_rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [employee_code, first_name, last_name, site_id, role, pay_type, pay_rate]
      );
      return res.rows[0];
    } else {
      const db = loadMockDb();
      const newEmp = {
        id: db.employees.length > 0 ? Math.max(...db.employees.map(e => e.id)) + 1 : 1,
        employee_code,
        first_name,
        last_name,
        site_id: parseInt(site_id) || null,
        role,
        pay_type,
        pay_rate: parseFloat(pay_rate),
        is_active: true,
        created_at: new Date().toISOString()
      };
      db.employees.push(newEmp);
      saveMockDb(db);
      return newEmp;
    }
  },

  async updateEmployee(id, data) {
    const { first_name, last_name, site_id, role, pay_type, pay_rate, is_active } = data;
    if (isPostgresMode) {
      const res = await pool.query(
        `UPDATE employees 
         SET first_name = $1, last_name = $2, site_id = $3, role = $4, pay_type = $5, pay_rate = $6, is_active = $7
         WHERE id = $8 RETURNING *`,
        [first_name, last_name, site_id, role, pay_type, pay_rate, is_active, id]
      );
      return res.rows[0];
    } else {
      const db = loadMockDb();
      const idx = db.employees.findIndex(e => e.id === parseInt(id));
      if (idx === -1) throw new Error('Employee not found');
      
      db.employees[idx] = {
        ...db.employees[idx],
        first_name,
        last_name,
        site_id: parseInt(site_id) || null,
        role,
        pay_type,
        pay_rate: parseFloat(pay_rate),
        is_active: is_active ?? db.employees[idx].is_active
      };
      saveMockDb(db);
      return db.employees[idx];
    }
  },

  async deleteEmployee(id) {
    if (isPostgresMode) {
      await pool.query('DELETE FROM employees WHERE id = $1', [id]);
      return { success: true };
    } else {
      const db = loadMockDb();
      db.employees = db.employees.filter(e => e.id !== parseInt(id));
      // Delete their attendance logs too
      db.attendance = db.attendance.filter(a => a.employee_id !== parseInt(id));
      saveMockDb(db);
      return { success: true };
    }
  },

  // 3. ATTENDANCE OPERATIONS
  async getAttendance(siteId, date) {
    if (isPostgresMode) {
      const res = await pool.query(
        `SELECT a.*, e.first_name, e.last_name, e.employee_code, e.role 
         FROM employees e
         LEFT JOIN attendance a ON e.id = a.employee_id AND a.date = $2
         WHERE e.site_id = $1 AND e.is_active = TRUE`,
        [siteId, date]
      );
      return res.rows;
    } else {
      const db = loadMockDb();
      const emps = db.employees.filter(e => e.site_id === parseInt(siteId) && e.is_active);
      return emps.map(emp => {
        const record = db.attendance.find(a => a.employee_id === emp.id && a.date === date);
        return {
          id: record ? record.id : null,
          employee_id: emp.id,
          site_id: emp.site_id,
          date: date,
          status: record ? record.status : null,
          notes: record ? record.notes : '',
          marked_by: record ? record.marked_by : '',
          first_name: emp.first_name,
          last_name: emp.last_name,
          employee_code: emp.employee_code,
          role: emp.role
        };
      });
    }
  },

  async saveAttendance(siteId, date, records, markedBy = 'Site Manager') {
    // records is an array of { employee_id, status, notes }
    if (isPostgresMode) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const rec of records) {
          await client.query(
            `INSERT INTO attendance (employee_id, site_id, date, status, notes, marked_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (employee_id, date) 
             DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes, marked_by = EXCLUDED.marked_by`,
            [rec.employee_id, siteId, date, rec.status, rec.notes || '', markedBy]
          );
        }
        await client.query('COMMIT');
        return { success: true };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const db = loadMockDb();
      records.forEach(rec => {
        const existingIdx = db.attendance.findIndex(
          a => a.employee_id === parseInt(rec.employee_id) && a.date === date
        );

        if (existingIdx !== -1) {
          db.attendance[existingIdx].status = rec.status;
          db.attendance[existingIdx].notes = rec.notes || '';
          db.attendance[existingIdx].marked_by = markedBy;
        } else {
          db.attendance.push({
            id: db.attendance.length > 0 ? Math.max(...db.attendance.map(a => a.id)) + 1 : 1,
            employee_id: parseInt(rec.employee_id),
            site_id: parseInt(siteId),
            date: date,
            status: rec.status,
            notes: rec.notes || '',
            marked_by: markedBy,
            created_at: new Date().toISOString()
          });
        }
      });
      saveMockDb(db);
      return { success: true };
    }
  },

  // 4. PAYROLL ENGINE & CALCULATIONS
  async getPayrollForPeriod(month, year) {
    if (isPostgresMode) {
      // Query to aggregate attendance counts and base info
      const aggQuery = `
        WITH attendance_counts AS (
          SELECT 
            employee_id,
            COUNT(CASE WHEN status = 'Present' THEN 1 END) as present_count,
            COUNT(CASE WHEN status = 'Absent' THEN 1 END) as absent_count,
            COUNT(CASE WHEN status = 'Late' THEN 1 END) as late_count
          FROM attendance
          WHERE EXTRACT(MONTH FROM date) = $1 AND EXTRACT(YEAR FROM date) = $2
          GROUP BY employee_id
        )
        SELECT 
          e.id as employee_id, e.employee_code, e.first_name, e.last_name, e.role, e.pay_type, e.pay_rate,
          s.name as site_name,
          COALESCE(ac.present_count, 0) as present_count,
          COALESCE(ac.absent_count, 0) as absent_count,
          COALESCE(ac.late_count, 0) as late_count,
          p.id as payroll_id, p.calculated_salary, COALESCE(p.payout_status, 'Pending') as payout_status, p.paid_at
        FROM employees e
        LEFT JOIN sites s ON e.site_id = s.id
        LEFT JOIN attendance_counts ac ON e.id = ac.employee_id
        LEFT JOIN payroll p ON e.id = p.employee_id AND p.month = $1 AND p.year = $2
        WHERE e.is_active = TRUE
        ORDER BY e.id DESC
      `;
      const res = await pool.query(aggQuery, [month, year]);
      return res.rows.map(row => this.calculateSalaryFromRow(row, month, year));
    } else {
      const db = loadMockDb();
      const emps = db.employees.filter(e => e.is_active);
      
      const result = emps.map(emp => {
        const site = db.sites.find(s => s.id === emp.site_id);
        
        // Filter attendance for month & year
        const monthStr = month.toString().padStart(2, '0');
        const prefix = `${year}-${monthStr}`;
        const atts = db.attendance.filter(
          a => a.employee_id === emp.id && a.date.startsWith(prefix)
        );

        const present_count = atts.filter(a => a.status === 'Present').length;
        const absent_count = atts.filter(a => a.status === 'Absent').length;
        const late_count = atts.filter(a => a.status === 'Late').length;

        // Check if payroll already paid/calculated in mock db
        const payRecord = db.payroll.find(
          p => p.employee_id === emp.id && p.month === parseInt(month) && p.year === parseInt(year)
        );

        const row = {
          employee_id: emp.id,
          employee_code: emp.employee_code,
          first_name: emp.first_name,
          last_name: emp.last_name,
          role: emp.role,
          pay_type: emp.pay_type,
          pay_rate: emp.pay_rate,
          site_name: site ? site.name : 'Unassigned',
          present_count,
          absent_count,
          late_count,
          payroll_id: payRecord ? payRecord.id : null,
          calculated_salary: payRecord ? payRecord.calculated_salary : null,
          payout_status: payRecord ? payRecord.payout_status : 'Pending',
          paid_at: payRecord ? payRecord.paid_at : null
        };

        return this.calculateSalaryFromRow(row, month, year);
      });

      return result.sort((a, b) => b.employee_id - a.employee_id);
    }
  },

  calculateSalaryFromRow(row, month, year) {
    const present = parseInt(row.present_count);
    const late = parseInt(row.late_count);
    const absent = parseInt(row.absent_count);
    const rate = parseFloat(row.pay_rate);

    // Present days = Present + Late (Late counts as working, but flagged)
    const totalWorkingDays = present + late;
    let finalSalary = 0;

    if (row.pay_type === 'Daily') {
      // Daily: Base rate multiplied by days worked
      finalSalary = totalWorkingDays * rate;
    } else {
      // Monthly: Base / working days in that month * present days
      // Let's assume standard working days in a month is 26 (excluding Sundays)
      // or calculate dynamic working days in that month. Let's use 26 days as standard
      // or if total logged days is greater, use that.
      const standardDays = 26;
      if (totalWorkingDays + absent === 0) {
        finalSalary = 0;
      } else {
        // Salary is proportional to present days
        const loggedDays = totalWorkingDays + absent;
        const totalDaysDenominator = Math.max(standardDays, loggedDays);
        finalSalary = (totalWorkingDays / totalDaysDenominator) * rate;
      }
    }

    // Round to 2 decimals
    finalSalary = parseFloat(finalSalary.toFixed(2));

    return {
      employee_id: parseInt(row.employee_id),
      employee_code: row.employee_code,
      first_name: row.first_name,
      last_name: row.last_name,
      role: row.role,
      pay_type: row.pay_type,
      pay_rate: rate,
      site_name: row.site_name,
      days_present: present,
      days_absent: absent,
      days_late: late,
      calculated_salary: row.calculated_salary !== null ? parseFloat(row.calculated_salary) : finalSalary,
      payout_status: row.payout_status,
      paid_at: row.paid_at,
      payroll_id: row.payroll_id
    };
  },

  async updatePayoutStatus(employeeId, month, year, status) {
    // Generate salary
    const records = await this.getPayrollForPeriod(month, year);
    const empRecord = records.find(r => r.employee_id === parseInt(employeeId));
    if (!empRecord) throw new Error('Employee record not found for period');

    const salary = empRecord.calculated_salary;

    if (isPostgresMode) {
      const paidAt = status === 'Paid' ? 'CURRENT_TIMESTAMP' : 'NULL';
      const res = await pool.query(
        `INSERT INTO payroll (employee_id, month, year, days_present, days_absent, days_late, calculated_salary, payout_status, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${status === 'Paid' ? 'NOW()' : 'NULL'})
         ON CONFLICT (employee_id, month, year)
         DO UPDATE SET payout_status = EXCLUDED.payout_status, paid_at = EXCLUDED.paid_at, calculated_salary = EXCLUDED.calculated_salary
         RETURNING *`,
        [employeeId, month, year, empRecord.days_present, empRecord.days_absent, empRecord.days_late, salary, status]
      );
      return res.rows[0];
    } else {
      const db = loadMockDb();
      const existingIdx = db.payroll.findIndex(
        p => p.employee_id === parseInt(employeeId) && p.month === parseInt(month) && p.year === parseInt(year)
      );

      const paidAtStr = status === 'Paid' ? new Date().toISOString() : null;

      if (existingIdx !== -1) {
        db.payroll[existingIdx].payout_status = status;
        db.payroll[existingIdx].paid_at = paidAtStr;
        db.payroll[existingIdx].calculated_salary = salary;
      } else {
        db.payroll.push({
          id: db.payroll.length > 0 ? Math.max(...db.payroll.map(p => p.id)) + 1 : 1,
          employee_id: parseInt(employeeId),
          month: parseInt(month),
          year: parseInt(year),
          days_present: empRecord.days_present,
          days_absent: empRecord.days_absent,
          days_late: empRecord.days_late,
          calculated_salary: salary,
          payout_status: status,
          paid_at: paidAtStr,
          created_at: new Date().toISOString()
        });
      }
      saveMockDb(db);
      return { success: true };
    }
  },

  // 5. DASHBOARD OPERATIONS
  async getDashboardStats() {
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (isPostgresMode) {
      const empsCount = await pool.query('SELECT COUNT(*) FROM employees WHERE is_active = TRUE');
      const sitesCount = await pool.query('SELECT COUNT(*) FROM sites');
      
      const attendanceToday = await pool.query(
        `SELECT status, COUNT(*) FROM attendance WHERE date = $1 GROUP BY status`,
        [todayStr]
      );
      
      // Monthly payroll sum
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const payrollSum = await pool.query(
        `SELECT SUM(calculated_salary) as total FROM payroll WHERE month = $1 AND year = $2`,
        [currentMonth, currentYear]
      );

      const stats = {
        totalEmployees: parseInt(empsCount.rows[0].count),
        totalSites: parseInt(sitesCount.rows[0].count),
        attendanceToday: {
          present: 0,
          absent: 0,
          late: 0
        },
        monthlyPayrollTotal: parseFloat(payrollSum.rows[0].total || 0)
      };

      attendanceToday.rows.forEach(r => {
        if (r.status === 'Present') stats.attendanceToday.present = parseInt(r.count);
        if (r.status === 'Absent') stats.attendanceToday.absent = parseInt(r.count);
        if (r.status === 'Late') stats.attendanceToday.late = parseInt(r.count);
      });

      return stats;
    } else {
      const db = loadMockDb();
      const activeEmps = db.employees.filter(e => e.is_active);
      const todayAtt = db.attendance.filter(a => a.date === todayStr);

      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      // Calculate estimated payroll if not fully marked paid
      const payrollRecords = db.payroll.filter(p => p.month === currentMonth && p.year === currentYear);
      const paidSum = payrollRecords.reduce((acc, p) => acc + p.calculated_salary, 0);

      const stats = {
        totalEmployees: activeEmps.length,
        totalSites: db.sites.length,
        attendanceToday: {
          present: todayAtt.filter(a => a.status === 'Present').length,
          absent: todayAtt.filter(a => a.status === 'Absent').length,
          late: todayAtt.filter(a => a.status === 'Late').length
        },
        monthlyPayrollTotal: parseFloat(paidSum.toFixed(2))
      };

      // If no today logs exist, give standard estimates based on database.json averages
      if (todayAtt.length === 0 && db.attendance.length > 0) {
        // Get the latest date logged
        const dates = [...new Set(db.attendance.map(a => a.date))].sort();
        const latestDate = dates[dates.length - 1];
        if (latestDate) {
          const latestAtt = db.attendance.filter(a => a.date === latestDate);
          stats.attendanceToday.present = latestAtt.filter(a => a.status === 'Present').length;
          stats.attendanceToday.absent = latestAtt.filter(a => a.status === 'Absent').length;
          stats.attendanceToday.late = latestAtt.filter(a => a.status === 'Late').length;
        }
      }

      return stats;
    }
  }
};
