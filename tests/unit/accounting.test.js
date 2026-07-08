import { describe, it, expect } from 'vitest';

await import('../../js/accounting.js');
const { Accounting } = globalThis;

describe('Payroll math', () => {
  it('computes daily rate on a 30-day month', () => {
    expect(Accounting.dailyRate(3000)).toBe(100);
  });

  it('rounds attendance deductions', () => {
    // 3000 salary => 100/day; 2 absent + 1 half => 200 + 50 = 250
    expect(Accounting.attendanceDeductions(2, 1, 3000)).toBe(250);
  });

  it('computes net salary with deductions, bonuses and penalties', () => {
    // 3000 - 250 + 100 - 50 = 2800
    expect(Accounting.netSalary({ baseSalary: 3000, absentDays: 2, halfDays: 1, bonuses: 100, penalties: 50 })).toBe(2800);
  });
});

describe('Supervision & project balance', () => {
  it('excludes design expenses from supervision base', () => {
    expect(Accounting.supervisionFee(10000, 2000, 10)).toBe(800);
  });

  it('computes project net balance', () => {
    // deposits 20000, expenses 12000, design 2000, supervision 10%
    // supervision = (12000 - 2000) * 0.10 = 1000
    // net = 20000 - 12000 - 1000 = 7000
    expect(Accounting.projectNetBalance({ deposits: 20000, expenses: 12000, designExpenses: 2000, supervisionPercentage: 10 })).toBe(7000);
  });

  it('computes client balance as sum of project balances', () => {
    const projects = [
      { deposits: 10000, expenses: 5000, designExpenses: 0, supervisionPercentage: 10 }, // 10000 - 5000 - 500 = 4500
      { deposits: 20000, expenses: 12000, designExpenses: 2000, supervisionPercentage: 10 } // 7000
    ];
    expect(Accounting.clientBalance(projects)).toBe(11500);
  });
});

describe('Vendor balance', () => {
  it('computes vendor balance with direct settlement and merchandise payments', () => {
    // owed = 5000 service + 3000 merchandise = 8000
    // paid = 2000 settlement + 1000 merchandise = 3000
    expect(Accounting.vendorBalance({ serviceOwed: 5000, merchandiseOwed: 3000, directSettlementPaid: 2000, merchandisePaid: 1000 })).toBe(5000);
  });

  it('shows negative balance when over-paid', () => {
    expect(Accounting.vendorBalance({ serviceOwed: 1000, directSettlementPaid: 1500 })).toBe(-500);
  });
});

describe('Office balance', () => {
  it('computes office net position', () => {
    expect(Accounting.officeBalance({ ownerDeposits: 10000, supervisionIncome: 2000, officeVendorIncome: 500, officeExpenses: 3000, withdrawals: 1000 })).toBe(8500);
  });

  it('is negative when outflows exceed income', () => {
    expect(Accounting.officeBalance({ ownerDeposits: 1000, officeExpenses: 3000 })).toBe(-2000);
  });
});

describe('Retention / holdback', () => {
  it('computes retained amount from deposit and percentage', () => {
    expect(Accounting.retainedAmount(100000, 10)).toBe(10000);
  });

  it('computes net deposit after withheld and released retention', () => {
    expect(Accounting.netDeposit({ deposits: 100000, retentionWithheld: 10000, retentionReleased: 0 })).toBe(90000);
    expect(Accounting.netDeposit({ deposits: 100000, retentionWithheld: 10000, retentionReleased: 10000 })).toBe(100000);
  });
});

describe('Custody & row balance', () => {
  it('computes remaining custody', () => {
    expect(Accounting.custodyRemaining({ given: 5000, spent: 2500, returned: 1000 })).toBe(1500);
  });

  it('computes unpaid row balance', () => {
    expect(Accounting.unpaidBalance(10000, 4000)).toBe(6000);
  });
});
