// Payroll Calculation Test Runner
import { dbService } from './db.js';

console.log('🧪 RUNNING PAYROLL MATHEMATICAL TESTS...\n');

const testCases = [
  // 1. Daily rate worker
  {
    name: 'Daily Rate Worker (Active Attendance)',
    pay_type: 'Daily',
    pay_rate: 150.00,
    present_count: 20,
    late_count: 2,
    absent_count: 4,
    expected_salary: (20 + 2) * 150.00 // 3300.00
  },
  // 2. Monthly contract worker with standard 26-day base
  {
    name: 'Monthly Salaried Worker (Deduction for Absences)',
    pay_type: 'Monthly',
    pay_rate: 5200.00,
    present_count: 20,
    late_count: 2,
    absent_count: 4,
    expected_salary: parseFloat(((22 / 26) * 5200.00).toFixed(2)) // 4400.00
  },
  // 3. Monthly contract worker with higher attendance logs (e.g. overtime days)
  {
    name: 'Monthly Salaried Worker (Extended Month Days)',
    pay_type: 'Monthly',
    pay_rate: 6000.00,
    present_count: 24,
    late_count: 4,
    absent_count: 2,
    expected_salary: parseFloat(((28 / 30) * 6000.00).toFixed(2)) // 5600.00
  },
  // 4. Monthly contract worker with zero attendance
  {
    name: 'Monthly Salaried Worker (No Attendance)',
    pay_type: 'Monthly',
    pay_rate: 4000.00,
    present_count: 0,
    late_count: 0,
    absent_count: 26,
    expected_salary: 0.00
  }
];

let failed = 0;

testCases.forEach((tc, idx) => {
  const row = {
    employee_id: idx + 1,
    employee_code: `TEST${idx}`,
    first_name: 'Test',
    last_name: 'Employee',
    role: 'Tester',
    pay_type: tc.pay_type,
    pay_rate: tc.pay_rate,
    site_name: 'Test Site',
    present_count: tc.present_count,
    late_count: tc.late_count,
    absent_count: tc.absent_count,
    payroll_id: null,
    calculated_salary: null,
    payout_status: 'Pending',
    paid_at: null
  };

  const result = dbService.calculateSalaryFromRow(row, 6, 2026);
  const matched = result.calculated_salary === tc.expected_salary;

  console.log(`CASE ${idx + 1}: ${tc.name}`);
  console.log(`👉 Inputs: Present=${tc.present_count}, Late=${tc.late_count}, Absent=${tc.absent_count}, Rate=₹${tc.pay_rate}`);
  console.log(`👉 Calculated: ₹${result.calculated_salary}`);
  console.log(`👉 Expected  : ₹${tc.expected_salary}`);
  
  if (matched) {
    console.log('✅ SUCCESS\n');
  } else {
    console.error('❌ FAILURE\n');
    failed++;
  }
});

console.log('--- TEST RUN COMPLETED ---');
if (failed === 0) {
  console.log('🎉 ALL PAYROLL CALCULATIONS ARE 100% CORRECT!');
  process.exit(0);
} else {
  console.error(`💥 ${failed} test cases failed.`);
  process.exit(1);
}
