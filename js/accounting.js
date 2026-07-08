// ─── ACCOUNTING MATH HELPERS ───
// Pure implementations of the formulas documented in LOGIC_SPEC.md.
// These mirrors the server-side views so the math can be unit-tested
// independently of Supabase.

const Accounting = {
  // 6.1
  dailyRate(baseSalary) {
    return baseSalary / 30;
  },

  // 6.2
  attendanceDeductions(absentDays, halfDays, baseSalary) {
    const daily = this.dailyRate(baseSalary);
    return Math.round(absentDays * daily + halfDays * daily * 0.5);
  },

  // 6.4
  netSalary({ baseSalary, absentDays = 0, halfDays = 0, bonuses = 0, penalties = 0 }) {
    return baseSalary - this.attendanceDeductions(absentDays, halfDays, baseSalary) + bonuses - penalties;
  },

  // 2.2
  supervisionFee(expenses, designExpenses, supervisionPercentage) {
    return ((expenses - designExpenses) * supervisionPercentage) / 100;
  },

  // 2.3
  projectNetBalance({ deposits = 0, expenses = 0, designExpenses = 0, supervisionPercentage = 0 }) {
    return deposits - expenses - this.supervisionFee(expenses, designExpenses, supervisionPercentage);
  },

  // 2.4
  clientBalance(projects) {
    return projects.reduce((sum, p) => sum + this.projectNetBalance(p), 0);
  },

  // 3.3
  vendorBalance({ serviceOwed = 0, merchandiseOwed = 0, directSettlementPaid = 0, merchandisePaid = 0 }) {
    return (serviceOwed + merchandiseOwed) - (directSettlementPaid + merchandisePaid);
  },

  // 4.3
  officeBalance({ ownerDeposits = 0, supervisionIncome = 0, officeVendorIncome = 0, officeExpenses = 0, withdrawals = 0 }) {
    return (ownerDeposits + supervisionIncome + officeVendorIncome) - (officeExpenses + withdrawals);
  },

  // 7
  custodyRemaining({ given = 0, spent = 0, returned = 0 }) {
    return given - spent - returned;
  },

  // Retention / holdback
  retainedAmount(depositAmount, retentionPercentage) {
    return Math.round((+depositAmount || 0) * (+retentionPercentage || 0)) / 100;
  },

  netDeposit({ deposits = 0, retentionWithheld = 0, retentionReleased = 0 }) {
    return (+deposits || 0) - (+retentionWithheld || 0) + (+retentionReleased || 0);
  },

  // Basic balance equation
  unpaidBalance(amount, paidAmount) {
    return amount - paidAmount;
  }
};

if (typeof window !== 'undefined') {
  window.Accounting = Accounting;
}
