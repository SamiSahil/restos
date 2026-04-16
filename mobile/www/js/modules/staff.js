const StaffPage = {
  isLoading: false,

  payrollMonth: '',
  payrollMap: new Map(),
  payrollFilter: 'all',

  calendarYear: null,
  calendarMonthIndex: null,

  byId(id) {
    return document.getElementById(id);
  },

  getStaff() {
    return Store.get('staff') || [];
  },

  findStaff(id) {
    return this.getStaff().find((p) => p._id === id);
  },

  // ---------------------------
  // Payroll month
  // ---------------------------
 getDefaultPayrollMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0'); // current month (local)
  return `${y}-${m}`;
},

  ensurePayrollMonth() {
    if (!this.payrollMonth) this.payrollMonth = this.getDefaultPayrollMonth();
    const input = this.byId('payrollMonthInput');
    if (input && input.value !== this.payrollMonth) input.value = this.payrollMonth;
  },

  setPayrollMonth(value) {
    this.payrollMonth = (value || '').trim() || this.getDefaultPayrollMonth();
    this.ensurePayrollMonth();
    this.load();
  },

  formatMonthLabel(monthStr) {
    if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) return monthStr || '';
    const [y, m] = monthStr.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  },

  // ---------------------------
  // Search/filter
  // ---------------------------
  setPayrollFilter(filter) {
    this.payrollFilter = filter || 'all';

    ['staffFilterAll', 'staffFilterDue', 'staffFilterPaid'].forEach((id) => {
      const el = this.byId(id);
      if (el) el.classList.remove('active');
    });

    const activeId =
      this.payrollFilter === 'due'
        ? 'staffFilterDue'
        : this.payrollFilter === 'paid'
          ? 'staffFilterPaid'
          : 'staffFilterAll';

    const active = this.byId(activeId);
    if (active) active.classList.add('active');

    this.renderTable();
  },

  getSearchText() {
    return (this.byId('staffSearchInput')?.value || '').trim().toLowerCase();
  },

  // ---------------------------
  // Attendance counts for selected month (UI consistency)
  // NEW RULE:
  // active = 1.0, leave = 0.5, absent/unmarked = 0
  // keep decimals
  // ---------------------------
  getAttendanceCountsForMonth(person, monthStr) {
    const entries = (person.attendance || []).filter((e) => e?.date && e.date.startsWith(monthStr));

    const presentDays = entries.filter((e) => e.status === 'active').length;
    const leaveDays = entries.filter((e) => e.status === 'on-leave').length;

    const paidEquivalentDays = presentDays + leaveDays * 0.5; // decimals
    const workingDays = Math.max(1, Number(person.workingDays || 30));
    const unpaidEquivalentDays = Math.max(workingDays - paidEquivalentDays, 0);

    return { workingDays, presentDays, leaveDays, paidEquivalentDays, unpaidEquivalentDays };
  },

  formatMonthAttendanceBadge(person) {
    const c = this.getAttendanceCountsForMonth(person, this.payrollMonth);

    return `
      <div class="staff-attendance-month">
        <span class="staff-att-badge"><strong>${c.presentDays}</strong> Present</span>
        <span class="staff-att-badge"><strong>${c.leaveDays}</strong> Leave (½)</span>
        <span class="staff-att-badge"><strong>${c.unpaidEquivalentDays.toFixed(1)}</strong> Unpaid</span>
        <span class="staff-att-badge"><strong>${c.paidEquivalentDays.toFixed(1)}</strong> Paid Days</span>
      </div>
    `;
  },

  // ---------------------------
  // Payroll API
  // ---------------------------
  async fetchPayrollSummary() {
    this.ensurePayrollMonth();
    const json = await Store.request(`/payroll/summary?month=${encodeURIComponent(this.payrollMonth)}`);
    const list = json.data || [];
    this.payrollMap = new Map(list.map((row) => [String(row.staffId), row]));
  },

  async fetchPayrollPayments(staffId) {
    this.ensurePayrollMonth();
    const json = await Store.request(
      `/payroll/payments?month=${encodeURIComponent(this.payrollMonth)}&staffId=${encodeURIComponent(staffId)}`
    );
    return json.data || [];
  },

  getPayrollForStaff(staffId) {
    return this.payrollMap.get(String(staffId)) || null;
  },

  // ---------------------------
  // Load/render
  // ---------------------------
  async load() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      this.ensurePayrollMonth();
      await Store.fetchStaff();
      await this.fetchPayrollSummary();
      this.render();
    } catch (error) {
      console.error(error);
      App.toast(error.message || 'Failed to load staff/payroll', 'error');
    } finally {
      this.isLoading = false;
    }
  },

  render() {
    this.ensurePayrollMonth();
    this.renderSummary();
    this.renderTable();
  },

  // ---------------------------
  // Summary
  // ---------------------------
  getSummaryData() {
    const staff = this.getStaff();
    const basePayroll = staff.reduce((sum, p) => sum + Number(p.monthlySalary || 0), 0);

    let payableTotal = 0;
    let paidTotal = 0;
    let dueTotal = 0;

    staff.forEach((p) => {
      const row = this.getPayrollForStaff(p._id);
      if (row) {
        payableTotal += Number(row.payableAmount || 0);
        paidTotal += Number(row.paidAmount || 0);
        dueTotal += Number(row.dueAmount || 0);
      }
    });

    return {
      monthLabel: this.formatMonthLabel(this.payrollMonth),
      totalStaff: staff.length,
      active: staff.filter((x) => x.status === 'active').length,
      onLeave: staff.filter((x) => x.status === 'on-leave').length,
      inactive: staff.filter((x) => x.status === 'inactive').length,
      basePayroll,
      payableTotal,
      paidTotal,
      dueTotal
    };
  },

  renderSummary() {
    const summary = this.byId('staffSummary');
    if (!summary) return;

    const s = this.getSummaryData();

    summary.innerHTML = `
      <div class="panel-muted" style="margin-bottom:16px">
        <strong>Salary Month:</strong> ${App.safeText(s.monthLabel)}
        <div class="text-soft" style="margin-top:6px">
          Rule: Present = 100%, Leave = 50%, Absent = 0%.
          (Decimals kept. Payments can be made any day. Receipts are proof.)
        </div>
      </div>

      <div class="staff-summary-grid">
        <div class="staff-summary-card">
          <div class="staff-summary-value staff-summary-accent">${s.totalStaff}</div>
          <div class="staff-summary-label">Total Staff</div>
        </div>
        <div class="staff-summary-card">
          <div class="staff-summary-value staff-summary-success">${s.active}</div>
          <div class="staff-summary-label">Active Today</div>
        </div>
        <div class="staff-summary-card">
          <div class="staff-summary-value staff-summary-warning">${s.onLeave}</div>
          <div class="staff-summary-label">On Leave Today</div>
        </div>
        <div class="staff-summary-card">
          <div class="staff-summary-value staff-summary-danger">${s.inactive}</div>
          <div class="staff-summary-label">Inactive Today</div>
        </div>
        <div class="staff-summary-card">
          <div class="staff-summary-value staff-summary-info">${App.currency(s.basePayroll)}</div>
          <div class="staff-summary-label">Base Monthly Payroll</div>
        </div>
        <div class="staff-summary-card">
          <div class="staff-summary-value staff-summary-purple">${App.currency(s.payableTotal)}</div>
          <div class="staff-summary-label">Payable (Selected Month)</div>
        </div>
        <div class="staff-summary-card">
          <div class="staff-summary-value staff-summary-success">${App.currency(s.paidTotal)}</div>
          <div class="staff-summary-label">Paid (Selected Month)</div>
        </div>
        <div class="staff-summary-card">
          <div class="staff-summary-value staff-summary-warning">${App.currency(s.dueTotal)}</div>
          <div class="staff-summary-label">Due (Selected Month)</div>
        </div>
      </div>
    `;
  },

  // ---------------------------
  // UI helpers
  // ---------------------------
  getRoleBadge(role) {
    const roleMap = {
      admin: 'badge-danger',
      manager: 'badge-purple',
      cashier: 'badge-info',
      kitchen: 'badge-warning',
      waiter: 'badge-success'
    };
    return `<span class="badge ${roleMap[role] || 'badge-accent'}">${App.safeText(role)}</span>`;
  },

  getInitials(fullName) {
    if (!fullName) return 'ST';
    return fullName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  },

  getTodayDateString() {
    return new Date().toISOString().slice(0, 10);
  },

  // ---------------------------
  // Attendance controls (Today)
  // ---------------------------
  renderStatusControls(person) {
    const today = this.getTodayDateString();
    const currentStatus =
      (person.attendance || []).find((entry) => entry.date === today)?.status ||
      person.status ||
      'inactive';

    return `
      <div class="staff-status-actions">
        <button class="staff-status-btn ${currentStatus === 'active' ? 'is-active active-green' : ''}"
          onclick="StaffPage.quickUpdateStatus('${person._id}', 'active')">
          <span class="staff-status-dot"></span><span class="staff-status-label">Active</span>
        </button>

        <button class="staff-status-btn ${currentStatus === 'inactive' ? 'is-active active-red' : ''}"
          onclick="StaffPage.quickUpdateStatus('${person._id}', 'inactive')">
          <span class="staff-status-dot"></span><span class="staff-status-label">Inactive</span>
        </button>

        <button class="staff-status-btn ${currentStatus === 'on-leave' ? 'is-active active-yellow' : ''}"
          onclick="StaffPage.quickUpdateStatus('${person._id}', 'on-leave')">
          <span class="staff-status-dot"></span><span class="staff-status-label">Leave</span>
        </button>

        <button class="btn btn-secondary btn-xs" onclick="StaffPage.openAttendanceCalendar('${person._id}')">Calendar</button>
      </div>
    `;
  },

  async quickUpdateStatus(id, status) {
    try {
      await Store.request(`/staff/${id}/attendance`, {
        method: 'PATCH',
        body: JSON.stringify({ status, date: this.getTodayDateString() })
      });

      await Store.fetchStaff();
      await this.fetchPayrollSummary();
      this.render();
      App.toast(`Attendance updated to ${status.replace('-', ' ')}`, 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to update attendance', 'error');
    }
  },

  // ---------------------------
  // Payroll cell
  // ---------------------------
  renderPayrollCell(person) {
    const row = this.getPayrollForStaff(person._id);
    const payable = Number(row?.payableAmount || 0);
    const paid = Number(row?.paidAmount || 0);
    const due = Number(row?.dueAmount || 0);

    const badge = due <= 0
      ? `<span class="badge badge-success">Paid</span>`
      : `<span class="badge badge-warning">Due</span>`;

    return `
      <div class="staff-payroll-cell">
        <div class="staff-payroll-topline">
          <div class="staff-payroll-amount">${App.currency(payable)}</div>
          ${badge}
        </div>
        <div class="staff-payroll-meta">
          Paid: <strong style="color:var(--success)">${App.currency(paid)}</strong><br>
          Due: <strong style="color:${due <= 0 ? 'var(--success)' : 'var(--warning)'}">${App.currency(due)}</strong>
        </div>
      </div>
    `;
  },

  // ---------------------------
  // Table rendering
  // ---------------------------
  getFilteredStaffList() {
    const search = this.getSearchText();
    let staff = [...this.getStaff()];

    if (search) {
      staff = staff.filter((p) => {
        const hay = `${p.fullName || ''} ${p.email || ''} ${p.phone || ''}`.toLowerCase();
        return hay.includes(search);
      });
    }

    if (this.payrollFilter !== 'all') {
      staff = staff.filter((p) => {
        const row = this.getPayrollForStaff(p._id);
        const due = Number(row?.dueAmount || 0);
        return this.payrollFilter === 'due' ? due > 0 : due <= 0;
      });
    }

    return staff;
  },

  renderStaffAvatar(person) {
    if (person.photoUrl) {
      return `<img src="${App.safeText(person.photoUrl, '')}" class="staff-photo-avatar" alt="${App.safeText(person.fullName, '')}">`;
    }
    return `<div class="staff-avatar">${this.getInitials(person.fullName)}</div>`;
  },

  renderStaffRow(person) {
    const row = this.getPayrollForStaff(person._id);
    const due = Number(row?.dueAmount || 0);

    return `
      <tr>
        <td>
          <div class="staff-user-wrap">
            ${this.renderStaffAvatar(person)}
            <div>
              <div class="staff-user-name">${App.safeText(person.fullName)}</div>
              <div class="staff-user-email">${App.safeText(person.email)}</div>
            </div>
          </div>
        </td>

        <td>${this.getRoleBadge(person.role)}</td>
        <td>${this.renderStatusControls(person)}</td>
        <td>${App.safeText(person.phone || '-')}</td>
        <td>${person.joinDate ? new Date(person.joinDate).toLocaleDateString() : '-'}</td>
        <td>${App.currency(person.monthlySalary || 0)}</td>

        <td>
          <div class="text-soft" style="margin-bottom:8px;font-weight:700">
            ${App.safeText(this.formatMonthLabel(this.payrollMonth))}
          </div>
          ${this.formatMonthAttendanceBadge(person)}
        </td>

        <td>${this.renderPayrollCell(person)}</td>

        <td>
          <div class="staff-actions">
            <button class="btn btn-secondary btn-xs" onclick="StaffPage.openViewModal('${person._id}')">View</button>
            <button class="btn btn-primary btn-xs" onclick="StaffPage.openEditModal('${person._id}')">Edit</button>
            <button class="btn btn-danger btn-xs" onclick="StaffPage.deleteStaff('${person._id}')">Delete</button>
            <button class="btn btn-secondary btn-xs" onclick="StaffPage.openPaymentHistory('${person._id}')">History</button>
            ${due > 0 ? `<button class="btn btn-success btn-xs" onclick="StaffPage.openPaySalaryModal('${person._id}')">Pay</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  },

  renderTable() {
    const body = this.byId('staffBody');
    if (!body) return;

    const staff = this.getFilteredStaffList();

    if (!staff.length) {
      body.innerHTML = `<tr><td colspan="9" class="staff-empty-cell">No staff found</td></tr>`;
      return;
    }

    body.innerHTML = staff.map((p) => this.renderStaffRow(p)).join('');
  },

  // ---------------------------
  // Payroll: Pay / history / receipt (updated snapshot fields)
  // ---------------------------
  openPaySalaryModal(staffId) {
    const staff = this.findStaff(staffId);
    if (!staff) return App.toast('Staff not found', 'error');

    const row = this.getPayrollForStaff(staffId);
    const dueAmount = Number(row?.dueAmount || 0);
    const payableAmount = Number(row?.payableAmount || 0);
    const paidAmount = Number(row?.paidAmount || 0);

    if (dueAmount <= 0) return App.toast('No due salary for this month.', 'info');

    App.openModal(
      'Pay Salary (Cash)',
      `
        <div class="modal-stack">
          <div class="panel-muted">
            <div><strong>Staff:</strong> ${App.safeText(staff.fullName)}</div>
            <div><strong>Salary Month:</strong> ${App.safeText(this.formatMonthLabel(this.payrollMonth))}</div>
            <div><strong>Payable:</strong> ${App.currency(payableAmount)}</div>
            <div><strong>Paid:</strong> ${App.currency(paidAmount)}</div>
            <div><strong>Due:</strong> <span style="color:var(--warning);font-weight:900">${App.currency(dueAmount)}</span></div>
          </div>

          <div class="form-group">
            <label class="form-label">Pay Amount</label>
            <input class="form-input" id="salaryPayAmount" type="number" min="0.01" step="0.01" value="${dueAmount}">
          </div>

          <div class="form-group">
            <label class="form-label">Note (optional)</label>
            <textarea class="form-textarea" id="salaryPayNote" rows="2"></textarea>
          </div>
        </div>
      `,
      `
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="confirmSalaryPayBtn" onclick="StaffPage.confirmPaySalary('${staffId}')">Confirm</button>
      `
    );
  },

  async confirmPaySalary(staffId) {
    const btn = this.byId('confirmSalaryPayBtn');
    const amount = Number(this.byId('salaryPayAmount')?.value || 0);
    const note = (this.byId('salaryPayNote')?.value || '').trim();

    if (!amount || amount <= 0) return App.toast('Enter a valid amount', 'warning');

    App.setButtonLoading(btn, true, 'Saving...', 'Confirm');

    try {
      const json = await Store.request('/payroll/payments', {
        method: 'POST',
        body: JSON.stringify({
          staffId,
          month: this.payrollMonth,
          amount,
          note
        })
      });

      await this.fetchPayrollSummary();
      this.render();
      App.closeModal();
      App.toast(`Payment saved. Receipt: ${json.data.receiptNumber}`, 'success');
      this.openSalaryReceipt(json.data);
    } catch (error) {
      console.error(error);
      App.toast(error.message || 'Payment failed', 'error');
    } finally {
      App.setButtonLoading(btn, false, 'Saving...', 'Confirm');
    }
  },

  async openPaymentHistory(staffId) {
    const staff = this.findStaff(staffId);
    if (!staff) return App.toast('Staff not found', 'error');

    try {
      const payments = await this.fetchPayrollPayments(staffId);
      const row = this.getPayrollForStaff(staffId);

      const listHtml = payments.length
        ? payments.map((p) => `
            <div class="panel-muted" style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
              <div>
                <div style="font-weight:900">${App.safeText(p.receiptNumber)}</div>
                <div class="text-soft">${new Date(p.paidAt).toLocaleString()}</div>
                ${p.note ? `<div class="text-soft">Note: ${App.safeText(p.note)}</div>` : ''}
              </div>
              <div style="text-align:right">
                <div style="font-weight:900;color:var(--accent)">${App.currency(p.amount)}</div>
                <button class="btn btn-secondary btn-xs" onclick='StaffPage.openSalaryReceipt(${JSON.stringify(p)})'>Receipt</button>
              </div>
            </div>
          `).join('')
        : `<div class="empty-state"><p>No payments for this month</p></div>`;

      App.openModal(
        'Salary Payment History (Proof)',
        `
          <div class="modal-stack">
            <div class="panel-info">
              <div><strong>Staff:</strong> ${App.safeText(staff.fullName)}</div>
              <div><strong>Salary Month:</strong> ${App.safeText(this.formatMonthLabel(this.payrollMonth))}</div>
              <div><strong>Payable:</strong> ${App.currency(row?.payableAmount || 0)}</div>
              <div><strong>Paid:</strong> ${App.currency(row?.paidAmount || 0)}</div>
              <div><strong>Due:</strong> ${App.currency(row?.dueAmount || 0)}</div>
            </div>
            ${listHtml}
          </div>
        `,
        `<button class="btn btn-secondary" onclick="App.closeModal()">Close</button>`
      );
    } catch (error) {
      console.error(error);
      App.toast(error.message || 'Failed to load payments', 'error');
    }
  },

  openSalaryReceipt(payment) {
    if (!payment) return;

    const staffName = payment.staff?.fullName || '-';
    const staffPhone = payment.staff?.phone || '-';
    const staffRole = payment.staff?.role || '-';
    const paidBy = payment.paidBy?.fullName
      ? `${payment.paidBy.fullName} (${payment.paidBy.role || ''})`
      : '-';

    const snap = payment.snapshot || {};
    const monthLabel = this.formatMonthLabel(payment.month);

    App.openModal(
      'Salary Receipt (Proof)',
      `
        <div class="receipt-preview" id="salaryReceiptPrint">
          <h2>RestOS</h2>
          <p class="receipt-sub">Salary Payment Receipt (Cash)</p>

          <hr class="receipt-divider" />
          <div class="receipt-row"><span>Receipt #</span><span>${App.safeText(payment.receiptNumber)}</span></div>
          <div class="receipt-row"><span>Salary Month</span><span>${App.safeText(monthLabel)}</span></div>
          <div class="receipt-row"><span>Paid At</span><span>${new Date(payment.paidAt).toLocaleString()}</span></div>
          <div class="receipt-row"><span>Paid By</span><span>${App.safeText(paidBy)}</span></div>

          <hr class="receipt-divider" />
          <div class="receipt-section-title">Staff</div>
          <div class="receipt-row"><span>Name</span><span>${App.safeText(staffName)}</span></div>
          <div class="receipt-row"><span>Role</span><span>${App.safeText(staffRole)}</span></div>
          <div class="receipt-row"><span>Phone</span><span>${App.safeText(staffPhone)}</span></div>

          <hr class="receipt-divider" />
          <div class="receipt-section-title">Payment</div>
          <div class="receipt-row bold"><span>Amount Paid</span><span>${App.currency(payment.amount)}</span></div>
          ${payment.note ? `<div class="receipt-row"><span>Note</span><span>${App.safeText(payment.note)}</span></div>` : ''}

          <hr class="receipt-divider" />
          <div class="receipt-section-title">Snapshot (Proof)</div>
          <div class="receipt-row"><span>Monthly Salary</span><span>${App.currency(snap.monthlySalary || 0)}</span></div>
          <div class="receipt-row"><span>Working Days</span><span>${Number(snap.workingDays || 0)}</span></div>
          <div class="receipt-row"><span>Present</span><span>${Number(snap.presentDays || 0)}</span></div>
          <div class="receipt-row"><span>Leave</span><span>${Number(snap.leaveDays || 0)} (50%)</span></div>
          <div class="receipt-row"><span>Paid Days (Eq.)</span><span>${Number(snap.paidEquivalentDays || 0).toFixed(1)}</span></div>
          <div class="receipt-row"><span>Unpaid (Eq.)</span><span>${Number(snap.unpaidEquivalentDays || 0).toFixed(1)}</span></div>
          <div class="receipt-row"><span>Payable</span><span>${App.currency(snap.payableAmount || 0)}</span></div>
          <div class="receipt-row"><span>Paid Before</span><span>${App.currency(snap.paidBefore || 0)}</span></div>
          <div class="receipt-row"><span>Due Before</span><span>${App.currency(snap.dueBefore || 0)}</span></div>

          <hr class="receipt-divider" />
          <p class="receipt-footer">System-generated proof of salary payment.</p>
        </div>
      `,
      `
        <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
        <button class="btn btn-primary" onclick="StaffPage.printSalaryReceipt()">Print</button>
      `
    );
  },

  printSalaryReceipt() {
    const receipt = this.byId('salaryReceiptPrint');
    if (!receipt) return App.toast('Receipt not found', 'error');

    const w = window.open('', '_blank', 'width=420,height=700');
    if (!w) return App.toast('Unable to open print window', 'error');

    w.document.write(`<html><head><title>Salary Receipt</title></head><body>${receipt.innerHTML}</body></html>`);
    w.document.close();
    w.focus();

    setTimeout(() => {
      w.print();
      w.close();
    }, 300);
  },

  // ---------------------------
  // Calendar (opens on payroll month; future disabled)
  // ---------------------------
  getAttendanceStatusForDate(person, dateStr) {
    const entry = (person.attendance || []).find((item) => item.date === dateStr);
    return entry?.status || '';
  },

  getCalendarCellClass(status) {
    if (status === 'active') return 'calendar-day active-green';
    if (status === 'inactive') return 'calendar-day active-red';
    if (status === 'on-leave') return 'calendar-day active-yellow';
    return 'calendar-day';
  },

  openAttendanceCalendar(id) {
    const staff = this.findStaff(id);
    if (!staff) return App.toast('Staff not found', 'error');

    this.ensurePayrollMonth();
    const [yearStr, monthStr] = this.payrollMonth.split('-');
    this.calendarYear = Number(yearStr);
    this.calendarMonthIndex = Number(monthStr) - 1;

    this.renderAttendanceCalendarModal(staff._id);
  },

  renderAttendanceCalendarModal(staffId) {
    const staff = this.findStaff(staffId);
    if (!staff) return;

    const year = this.calendarYear;
    const monthIndex = this.calendarMonthIndex;

    const monthStart = new Date(year, monthIndex, 1);
    const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let daysHtml = '';
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, monthIndex, day);
      dateObj.setHours(0, 0, 0, 0);
      const dateStr = dateObj.toISOString().slice(0, 10);

      const isFuture = dateObj.getTime() > todayStart.getTime();
      const status = isFuture ? '' : this.getAttendanceStatusForDate(staff, dateStr);

      daysHtml += `
        <button class="${this.getCalendarCellClass(status)}"
          ${isFuture ? 'disabled style="opacity:0.35;cursor:not-allowed"' : ''}
          onclick="${isFuture ? '' : `StaffPage.openAttendanceDayPicker('${staff._id}', '${dateStr}')`}"
        >
          <div class="calendar-day-number">${day}</div>
          <div class="calendar-day-status">${status ? status.replace('-', ' ') : '-'}</div>
        </button>
      `;
    }

    App.openModal(
      `Attendance Calendar — ${App.safeText(staff.fullName)}`,
      `
        <div class="panel-muted" style="margin-bottom:12px">
          <div><strong>Viewing:</strong> ${App.safeText(monthLabel)}</div>
          <div class="text-soft" style="margin-top:6px">Future dates are disabled.</div>
        </div>
        <div class="calendar-grid">${daysHtml}</div>
      `,
      `
        <button class="btn btn-secondary" onclick="StaffPage.prevCalendarMonth('${staff._id}')">← Prev</button>
        <button class="btn btn-secondary" onclick="StaffPage.nextCalendarMonth('${staff._id}')">Next →</button>
        <button class="btn btn-primary" onclick="App.closeModal()">Close</button>
      `
    );
  },

  prevCalendarMonth(staffId) {
    if (this.calendarMonthIndex == null || this.calendarYear == null) return;
    this.calendarMonthIndex -= 1;
    if (this.calendarMonthIndex < 0) {
      this.calendarMonthIndex = 11;
      this.calendarYear -= 1;
    }
    this.renderAttendanceCalendarModal(staffId);
  },

  nextCalendarMonth(staffId) {
    if (this.calendarMonthIndex == null || this.calendarYear == null) return;
    this.calendarMonthIndex += 1;
    if (this.calendarMonthIndex > 11) {
      this.calendarMonthIndex = 0;
      this.calendarYear += 1;
    }
    this.renderAttendanceCalendarModal(staffId);
  },

  openAttendanceDayPicker(staffId, dateStr) {
    App.openModal(
      `Set Attendance — ${dateStr}`,
      `
        <div class="modal-stack">
          <button class="btn btn-success" onclick="StaffPage.setAttendanceForDate('${staffId}', '${dateStr}', 'active')">Mark Active</button>
          <button class="btn btn-danger" onclick="StaffPage.setAttendanceForDate('${staffId}', '${dateStr}', 'inactive')">Mark Inactive</button>
          <button class="btn btn-secondary" onclick="StaffPage.setAttendanceForDate('${staffId}', '${dateStr}', 'on-leave')">Mark Leave</button>
        </div>
      `,
      `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>`
    );
  },

  async setAttendanceForDate(staffId, dateStr, status) {
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (target.getTime() > today.getTime()) {
      App.toast('You cannot set attendance for a future date.', 'warning');
      return;
    }

    try {
      await Store.request(`/staff/${staffId}/attendance`, {
        method: 'PATCH',
        body: JSON.stringify({ status, date: dateStr })
      });

      await Store.fetchStaff();
      await this.fetchPayrollSummary();
      App.closeModal();
      this.render();
      App.toast(`Attendance updated (${status.replace('-', ' ')})`, 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to update attendance', 'error');
    }
  },

  // ---------------------------
  // Staff CRUD + photo + NID
  // ---------------------------
  openAddModal() {
    const body = `
      <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="staffFullName"></div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="staffEmail" type="email"></div>
      <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="staffPhone"></div>
      <div class="form-group"><label class="form-label">Password</label><input class="form-input" id="staffPassword" type="password"></div>
      <div class="form-group"><label class="form-label">Address</label><textarea class="form-textarea" id="staffAddress"></textarea></div>

      <div class="form-group"><label class="form-label">Staff Photo</label><input class="form-input" id="staffPhoto" type="file" accept="image/*"></div>

      <div class="form-group"><label class="form-label">NID Number</label><input class="form-input" id="staffNidNumber"></div>
      <div class="form-group"><label class="form-label">NID Image</label><input class="form-input" id="staffNidImage" type="file" accept="image/*"></div>

      <div class="form-group">
        <label class="form-label">Role</label>
        <select class="form-select" id="staffRole">
          <option value="waiter">Waiter</option>
          <option value="cashier">Cashier</option>
          <option value="kitchen">Kitchen</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div class="form-group"><label class="form-label">Join Date</label><input class="form-input" id="staffJoinDate" type="date"></div>
      <div class="form-group"><label class="form-label">Monthly Salary</label><input class="form-input" id="staffMonthlySalary" type="number" min="0"></div>
      <div class="form-group"><label class="form-label">Working Days</label><input class="form-input" id="staffWorkingDays" type="number" min="1" value="30"></div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveStaffBtn" onclick="StaffPage.saveNewStaff()">Save</button>
    `;

    App.openModal('Add Staff', body, footer);
  },

  buildStaffFormData(prefix = '') {
    const formData = new FormData();
    const field = (baseId) => {
      const id = prefix ? `${prefix}${baseId.charAt(0).toUpperCase()}${baseId.slice(1)}` : baseId;
      return this.byId(id);
    };

    formData.append('fullName', field('staffFullName')?.value?.trim() || '');
    formData.append('email', field('staffEmail')?.value?.trim() || '');
    formData.append('phone', field('staffPhone')?.value?.trim() || '');
    formData.append('password', field('staffPassword')?.value?.trim() || '');
    formData.append('address', field('staffAddress')?.value?.trim() || '');
    formData.append('nidNumber', field('staffNidNumber')?.value?.trim() || '');
    formData.append('role', field('staffRole')?.value || 'waiter');
    formData.append('status', field('staffStatus')?.value || 'active');
    formData.append('joinDate', field('staffJoinDate')?.value || '');
    formData.append('monthlySalary', field('staffMonthlySalary')?.value || '0');
    formData.append('workingDays', field('staffWorkingDays')?.value || '30');

    const nid = field('staffNidImage')?.files?.[0];
    if (nid) formData.append('nidImage', nid);

    const photo = field('staffPhoto')?.files?.[0];
    if (photo) formData.append('photo', photo);

    return formData;
  },

  validateStaffForm(formData, isEdit = false) {
    const fullName = formData.get('fullName');
    const email = formData.get('email');
    const password = formData.get('password');
    if (!fullName || !email) return App.toast('Full name and email are required', 'warning'), false;
    if (!isEdit && !password) return App.toast('Password is required', 'warning'), false;

    const workingDays = Number(formData.get('workingDays') || 0);
    if (workingDays < 1) return App.toast('Working days must be at least 1', 'warning'), false;

    return true;
  },

  async saveNewStaff() {
    const saveBtn = this.byId('saveStaffBtn');
    const formData = this.buildStaffFormData('');

    if (!this.validateStaffForm(formData, false)) return;

    App.setButtonLoading(saveBtn, true, 'Saving...', 'Save');
    try {
      await Store.request('/staff', { method: 'POST', body: formData });
      await Store.fetchStaff();
      await this.fetchPayrollSummary();
      this.render();
      App.closeModal();
      App.toast('Staff added successfully', 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to add staff', 'error');
    } finally {
      App.setButtonLoading(saveBtn, false, 'Saving...', 'Save');
    }
  },

  openViewModal(id) {
    const staff = this.findStaff(id);
    if (!staff) return App.toast('Staff not found', 'error');

    const avatarHtml = staff.photoUrl
      ? `<img src="${App.safeText(staff.photoUrl, '')}" class="staff-profile-photo-lg" alt="${App.safeText(staff.fullName, '')}">`
      : `<div class="staff-profile-initials-lg">${this.getInitials(staff.fullName)}</div>`;

    const nidHtml = staff.nidImageUrl
      ? `<div class="staff-detail-image-wrap"><strong>NID Image:</strong><br><img src="${App.safeText(staff.nidImageUrl, '')}" class="staff-detail-image"></div>`
      : `<div class="panel-muted"><strong>NID Image:</strong> <span class="text-soft">No NID image uploaded</span></div>`;

    App.openModal(
      'Staff Details',
      `
        <div class="modal-stack">
          <div class="staff-profile-header">
            ${avatarHtml}
            <div class="staff-profile-title">
              <div class="staff-profile-name">${App.safeText(staff.fullName)}</div>
              <div class="staff-profile-meta">
                ${App.safeText(staff.role)} • ${App.safeText(staff.status)}<br>
                ${App.safeText(staff.email)}
              </div>
            </div>
          </div>

          <div class="staff-detail-grid">
            <div><strong>Phone:</strong> ${App.safeText(staff.phone || '-')}</div>
            <div><strong>Address:</strong> ${App.safeText(staff.address || '-')}</div>
            <div><strong>NID Number:</strong> ${App.safeText(staff.nidNumber || '-')}</div>
            <div><strong>Join Date:</strong> ${staff.joinDate ? new Date(staff.joinDate).toLocaleDateString() : '-'}</div>
            <div><strong>Monthly Salary:</strong> ${App.currency(staff.monthlySalary || 0)}</div>
            <div><strong>Working Days:</strong> ${staff.workingDays || 30}</div>
          </div>

          ${nidHtml}
        </div>
      `,
      `<button class="btn btn-primary" onclick="App.closeModal()">Close</button>`
    );
  },

  openEditModal(id) {
    const staff = this.findStaff(id);
    if (!staff) return App.toast('Staff not found', 'error');

    const joinDateValue = staff.joinDate ? new Date(staff.joinDate).toISOString().slice(0, 10) : '';

    const body = `
      <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="editStaffFullName" value="${App.safeText(staff.fullName,'')}"></div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="editStaffEmail" type="email" value="${App.safeText(staff.email,'')}"></div>
      <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="editStaffPhone" value="${App.safeText(staff.phone||'','')}"></div>
      <div class="form-group"><label class="form-label">New Password (optional)</label><input class="form-input" id="editStaffPassword" type="password" placeholder="Leave blank to keep current"></div>
      <div class="form-group"><label class="form-label">Address</label><textarea class="form-textarea" id="editStaffAddress">${App.safeText(staff.address||'','')}</textarea></div>

      <div class="panel-muted"><strong>Current Photo:</strong><br>
        ${staff.photoUrl ? `<img src="${App.safeText(staff.photoUrl,'')}" class="staff-detail-image" style="margin-top:10px">` : `<span class="text-soft">No photo</span>`}
      </div>

      <div class="form-group"><label class="form-label">Replace Staff Photo</label><input class="form-input" id="editStaffPhoto" type="file" accept="image/*"></div>

      <div class="form-group"><label class="form-label">NID Number</label><input class="form-input" id="editStaffNidNumber" value="${App.safeText(staff.nidNumber||'','')}"></div>
      <div class="form-group"><label class="form-label">Replace NID Image</label><input class="form-input" id="editStaffNidImage" type="file" accept="image/*"></div>

      <div class="form-group">
        <label class="form-label">Role</label>
        <select class="form-select" id="editStaffRole">
          <option value="waiter" ${staff.role === 'waiter' ? 'selected' : ''}>Waiter</option>
          <option value="cashier" ${staff.role === 'cashier' ? 'selected' : ''}>Cashier</option>
          <option value="kitchen" ${staff.role === 'kitchen' ? 'selected' : ''}>Kitchen</option>
          <option value="manager" ${staff.role === 'manager' ? 'selected' : ''}>Manager</option>
          <option value="admin" ${staff.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="editStaffStatus">
          <option value="active" ${staff.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="inactive" ${staff.status === 'inactive' ? 'selected' : ''}>Inactive</option>
          <option value="on-leave" ${staff.status === 'on-leave' ? 'selected' : ''}>On Leave</option>
        </select>
      </div>

      <div class="form-group"><label class="form-label">Join Date</label><input class="form-input" id="editStaffJoinDate" type="date" value="${joinDateValue}"></div>
      <div class="form-group"><label class="form-label">Monthly Salary</label><input class="form-input" id="editStaffMonthlySalary" type="number" min="0" value="${staff.monthlySalary||0}"></div>
      <div class="form-group"><label class="form-label">Working Days</label><input class="form-input" id="editStaffWorkingDays" type="number" min="1" value="${staff.workingDays||30}"></div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveEditStaffBtn" onclick="StaffPage.saveEditStaff('${id}')">Save Changes</button>
    `;

    App.openModal('Edit Staff', body, footer);
  },

  async saveEditStaff(id) {
    const saveBtn = this.byId('saveEditStaffBtn');
    const formData = this.buildStaffFormData('edit');
    if (!this.validateStaffForm(formData, true)) return;

    App.setButtonLoading(saveBtn, true, 'Saving...', 'Save Changes');
    try {
      await Store.request(`/staff/${id}`, { method: 'PUT', body: formData });
      await Store.fetchStaff();
      await this.fetchPayrollSummary();
      this.render();
      App.closeModal();
      App.toast('Staff updated successfully', 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to update staff', 'error');
    } finally {
      App.setButtonLoading(saveBtn, false, 'Saving...', 'Save Changes');
    }
  },

  deleteStaff(id) {
    const staff = this.findStaff(id);
    if (!staff) return App.toast('Staff not found', 'error');

    App.openModal(
      'Delete Staff',
      `<p class="text-muted">Are you sure you want to delete <strong>${App.safeText(staff.fullName)}</strong>?</p>`,
      `
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-danger" id="deleteStaffBtn" onclick="StaffPage.confirmDelete('${id}')">Delete</button>
      `
    );
  },

  async confirmDelete(id) {
    const deleteBtn = this.byId('deleteStaffBtn');
    App.setButtonLoading(deleteBtn, true, 'Deleting...', 'Delete');

    try {
      await Store.request(`/staff/${id}`, { method: 'DELETE' });
      await Store.fetchStaff();
      await this.fetchPayrollSummary();
      this.render();
      App.closeModal();
      App.toast('Staff deleted successfully', 'warning');
    } catch (error) {
      App.toast(error.message || 'Failed to delete staff', 'error');
    } finally {
      App.setButtonLoading(deleteBtn, false, 'Deleting...', 'Delete');
    }
  }
};
