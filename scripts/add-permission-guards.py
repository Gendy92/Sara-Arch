import re

PATH = 'js/crud.js'

# function name -> (screen, action)
GUARDS = {
    # clients
    'addClient': ('clients', 'add'),
    'editClient': ('clients', 'edit'),
    'delClient': ('clients', 'delete'),
    # projects
    'addProject': ('projects', 'add'),
    'editProject': ('projects', 'edit'),
    'delProject': ('projects', 'delete'),
    'addProjectSupervision': ('projects', 'edit'),
    'closeProjectPeriod': ('projects', 'edit'),
    'reopenProjectPeriod': ('projects', 'edit'),
    'releaseRetention': ('projects', 'edit'),
    # transactions
    'addProjectDeposit': ('transactions', 'add'),
    'addProjectExpense': ('transactions', 'add'),
    'addClientReturn': ('transactions', 'add'),
    'editTx': ('transactions', 'edit'),
    'delTx': ('transactions', 'delete'),
    'addOfficeCustodyExpense': ('transactions', 'add'),
    '_openProjectCustodyExpenseSheet': ('transactions', 'add'),
    # office
    'addOfficeExpense': ('office', 'add'),
    'addOfficeIncome': ('office', 'add'),
    'addOwnerDeposit': ('office', 'add'),
    'addOwnerWithdrawal': ('office', 'add'),
    'addOfficeTransfer': ('office', 'add'),
    'addOfficeCustody': ('office', 'add'),
    'addOfficeCustodyExpense': ('office', 'add'),
    '_openOfficeCustodyExpenseSheet': ('office', 'add'),
    # vendors
    'addVendor': ('vendors', 'add'),
    'editVendor': ('vendors', 'edit'),
    'delVendor': ('vendors', 'delete'),
    'addProcurement': ('vendors', 'add'),
    'editProcurement': ('vendors', 'edit'),
    'delProcurement': ('vendors', 'delete'),
    'addVendorPayment': ('vendors', 'add'),
    'addVendorSettlement': ('vendors', 'add'),
    # employees
    'addEmp': ('employees', 'add'),
    'editEmp': ('employees', 'edit'),
    'delEmp': ('employees', 'delete'),
    'addSalaryHistory': ('employees', 'edit'),
    'editSalaryHistory': ('employees', 'edit'),
    'delSalaryHistory': ('employees', 'delete'),
    'addAttendance': ('employees', 'edit'),
    'editAttendance': ('employees', 'edit'),
    'delAttendance': ('employees', 'delete'),
    'addCustody': ('employees', 'edit'),
    'editCustody': ('employees', 'edit'),
    'delCustody': ('employees', 'delete'),
    'custodyReturn': ('employees', 'edit'),
    'addCustodyExpense': ('employees', 'edit'),
    'editCustodyExpense': ('employees', 'edit'),
    'delCustodyExpense': ('employees', 'delete'),
    'addEmpTransaction': ('employee-transactions', 'add'),
    'editEmpTransaction': ('employee-transactions', 'edit'),
    'delEmpTransaction': ('employee-transactions', 'delete'),
    # invoices
    'addInvoice': ('invoices', 'add'),
    'editInvoice': ('invoices', 'edit'),
    'delInvoice': ('invoices', 'delete'),
    'markInvoicePaid': ('invoices', 'edit'),
    # master data
    'addSector': ('master', 'add'),
    'editSector': ('master', 'edit'),
    'delSector': ('master', 'delete'),
    'addItem': ('master', 'add'),
    'editItem': ('master', 'edit'),
    'delItem': ('master', 'delete'),
    'addWorkSection': ('master', 'add'),
    'editWorkSection': ('master', 'edit'),
    'delWorkSection': ('master', 'delete'),
    'addWorkItem': ('master', 'add'),
    'editWorkItem': ('master', 'edit'),
    'delWorkItem': ('master', 'delete'),
    # users
    'addUser': ('users', 'add'),
    'editUser': ('users', 'edit'),
    'resetUserPassword': ('users', 'edit'),
    'emailNewPassword': ('users', 'edit'),
    # tasks
    'addProjectTask': ('tasks', 'add'),
    'editProjectTask': ('tasks', 'edit'),
    'delProjectTask': ('tasks', 'delete'),
    # payroll
    'approvePayroll': ('employees', 'edit'),
    'payPayroll': ('employees', 'edit'),
    'delPayroll': ('employees', 'delete'),
}

def guard_line(screen, action):
    return f"    if (!this._requirePermission('{screen}', '{action}')) return;"

with open(PATH, 'r', encoding='utf-8') as f:
    content = f.read()

# Add the helper if not present
helper = """  _requirePermission(screen, action) {
    if (Auth.can(screen, action)) return true;
    UI.toast('ليس لديك صلاحية لإجراء هذه العملية', 'error');
    return false;
  },

"""
if '_requirePermission' not in content:
    # Insert right after the Crud object opening / _currentUserName
    marker = "  _currentUserName() {\n    const user = this._currentUser();\n    return user ? (user.displayName || user.username || user.email || 'User') : 'User';\n  },\n"
    if marker in content:
        content = content.replace(marker, marker + "\n" + helper)
    else:
        # fallback: insert after object opening
        content = content.replace('const Crud = {\n', 'const Crud = {\n' + helper, 1)

for func, (screen, action) in GUARDS.items():
    guard = guard_line(screen, action)
    # Match function definition with optional async, possibly spanning args, opening brace on same line
    pattern = rf"^(\s*(?:async\s+)?{re.escape(func)}\([^)]*\)\s*\{{)$"
    repl = rf"\1\n{guard}"
    content_new, count = re.subn(pattern, repl, content, flags=re.MULTILINE)
    if count:
        content = content_new
    else:
        print(f"WARN: could not guard {func}")

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(content)

print("done")
