const Profile = {
  month: '',
  summary: null,
  payments: [],
  isLoading: false,

  byId(id) {
    return document.getElementById(id);
  },

  defaultMonth() {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  },

  formatMonthLabel(monthStr) {
    if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) return monthStr || '';
    const [y, m] = monthStr.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  },

  getMe() {
    return Store.get('authUser');
  },

async load() {
  if (this.isLoading) return;
  this.isLoading = true;

  const page = this.byId('page-profile');
  if (page) {
    page.innerHTML = `<div class="empty-state"><p>Loading profile...</p></div>`;
  }

  try {
    if (!this.month) this.month = this.defaultMonth();
    await this.fetchMonthData();
    this.render();
  } catch (e) {
    App.toast(e.message || 'Failed to load profile', 'error');
  } finally {
    this.isLoading = false;
  }
},

async fetchMonthData() {
  const month = this.month || this.defaultMonth();

  const [summaryJson, paymentsJson] = await Promise.all([
    Store.request(`/payroll/summary/me?month=${encodeURIComponent(month)}`),
    Store.request(`/payroll/payments/me?month=${encodeURIComponent(month)}`)
  ]);

  this.summary = summaryJson.data;
  this.payments = paymentsJson.data || [];
},

  async setMonth(value) {
    this.month = value || this.defaultMonth();
    await this.fetchMonthData();
    this.render();
  },

  renderAvatar(user) {
    if (user?.photoUrl) {
      return `<img src="${App.safeText(user.photoUrl, '')}" class="staff-profile-photo-lg" alt="${App.safeText(user.fullName, '')}">`;
    }
    return `<div class="staff-profile-initials-lg">${App.safeText((user?.fullName || 'ST').slice(0,2).toUpperCase())}</div>`;
  },

 render() {
  const page = this.byId('page-profile');
  if (!page) return;

  const user = this.getMe();
  if (!user) {
    page.innerHTML = `<div class="empty-state"><p>Please log in</p></div>`;
    return;
  }

  const s = this.summary || {};
  const monthLabel = this.formatMonthLabel(this.month);

  const payments = Array.isArray(this.payments) ? this.payments : [];
  const paymentsHtml = payments.length
    ? payments.map(p => `
        <div class="profile-payment-row">
          <div class="profile-payment-left">
            <div class="profile-payment-receipt">${App.safeText(p.receiptNumber)}</div>
            <div class="profile-payment-time">${new Date(p.paidAt).toLocaleString()}</div>
            ${p.note ? `<div class="profile-payment-note">Note: ${App.safeText(p.note)}</div>` : ''}
          </div>

          <div class="profile-payment-right">
            <div class="profile-payment-amount">${App.currency(p.amount)}</div>
            <button class="btn btn-secondary btn-xs" onclick='Profile.openSalaryReceipt(${JSON.stringify(p)})'>Receipt</button>
          </div>
        </div>
      `).join('')
    : `<div class="panel-muted">No salary payments found for this month.</div>`;

  page.innerHTML = `
    <div class="profile-layout">
      <!-- HEADER -->
      <div class="card profile-hero-card">
        <div class="profile-hero">
          <div class="profile-hero-left">
            ${this.renderAvatar(user)}
            <div class="profile-hero-title">
              <div class="profile-name">${App.safeText(user.fullName)}</div>

              <div class="profile-badges">
                <span class="badge badge-accent">${App.safeText(user.role)}</span>
                <span class="badge ${user.status === 'active' ? 'badge-success' : user.status === 'on-leave' ? 'badge-warning' : 'badge-danger'}">
                  ${App.safeText(user.status)}
                </span>
              </div>

              <div class="profile-email">${App.safeText(user.email)}</div>
            </div>
          </div>

          <div class="profile-hero-actions">
            <button class="btn btn-secondary btn-sm" onclick="Profile.openChangePhoto()">Change Photo</button>
            <button class="btn btn-secondary btn-sm" onclick="Profile.openChangePassword()">Change Password</button>
          </div>
        </div>
      </div>

      <div class="profile-grid">
        <!-- LEFT COLUMN -->
        <div class="profile-col">
          <!-- PERSONAL INFO -->
          <div class="card profile-card">
            <div class="profile-card-header">
              <div>
                <div class="card-title">Personal Information</div>
                <div class="card-subtitle">Your basic details</div>
              </div>
            </div>

            <div class="profile-info-grid">
              <div class="profile-info-item"><span>Phone</span><strong>${App.safeText(user.phone || '-')}</strong></div>
              <div class="profile-info-item"><span>Address</span><strong>${App.safeText(user.address || '-')}</strong></div>
              <div class="profile-info-item"><span>Join Date</span><strong>${user.joinDate ? new Date(user.joinDate).toLocaleDateString() : '-'}</strong></div>
              <div class="profile-info-item"><span>Monthly Salary</span><strong>${App.currency(user.monthlySalary || 0)}</strong></div>
              <div class="profile-info-item"><span>Working Days</span><strong>${Number(user.workingDays || 0)}</strong></div>
              <div class="profile-info-item"><span>Last Login</span><strong>${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : '-'}</strong></div>
            </div>
          </div>

          <!-- PAYROLL OVERVIEW -->
          <div class="card profile-card">
            <div class="profile-card-header">
              <div>
                <div class="card-title">Payroll Overview</div>
                <div class="card-subtitle">Rule: Present=100%, Leave=50%, Absent=0% (decimals kept)</div>
              </div>

              <div class="profile-month-picker">
                <label class="text-soft">Month</label>
                <input class="form-input" style="width:auto" type="month" value="${this.month}" onchange="Profile.setMonth(this.value)">
              </div>
            </div>

            <div class="profile-stats-grid">
              <div class="profile-stat"><span>Present</span><strong>${Number(s.presentDays || 0)}</strong></div>
              <div class="profile-stat"><span>Leave (½)</span><strong>${Number(s.leaveDays || 0)}</strong></div>
              <div class="profile-stat"><span>Paid Days (Eq.)</span><strong>${Number(s.paidEquivalentDays || 0).toFixed(1)}</strong></div>
              <div class="profile-stat"><span>Unpaid (Eq.)</span><strong>${Number(s.unpaidEquivalentDays || 0).toFixed(1)}</strong></div>
            </div>

            <div class="profile-money-grid">
              <div class="profile-money profile-money-info">
                <span>Payable (${App.safeText(monthLabel)})</span>
                <strong>${App.currency(s.payableAmount || 0)}</strong>
              </div>
              <div class="profile-money profile-money-success">
                <span>Paid</span>
                <strong>${App.currency(s.paidAmount || 0)}</strong>
              </div>
              <div class="profile-money profile-money-danger">
                <span>Due</span>
                <strong>${App.currency(s.dueAmount || 0)}</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN -->
        <div class="profile-col">
          <div class="card profile-card">
            <div class="profile-card-header">
              <div>
                <div class="card-title">Salary Payment History (Proof)</div>
                <div class="card-subtitle">Receipts for ${App.safeText(monthLabel)}</div>
              </div>
            </div>

            <div class="profile-payments-list">
              ${paymentsHtml}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
},

  openChangePhoto() {
    App.openModal(
      'Change Profile Photo',
      `
        <div class="form-group">
          <label class="form-label">Select New Photo</label>
          <input class="form-input" id="myNewPhoto" type="file" accept="image/*">
        </div>
      `,
      `
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="Profile.savePhoto()">Save</button>
      `
    );
  },

  async savePhoto() {
    const file = this.byId('myNewPhoto')?.files?.[0];
    if (!file) return App.toast('Please select a photo', 'warning');

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const json = await Store.request('/profile/photo', { method: 'PUT', body: formData });

      // Update auth user in Store so UI instantly updates everywhere
      Store.setAuthUser(json.data);

      App.closeModal();
      this.render();
      App.toast('Photo updated', 'success');
    } catch (e) {
      App.toast(e.message || 'Failed to update photo', 'error');
    }
  },

  openChangePassword() {
    App.openModal(
      'Change Password',
      `
        <div class="form-group">
          <label class="form-label">Current Password</label>
          <input class="form-input" id="myCurrentPassword" type="password">
        </div>

        <div class="form-group">
          <label class="form-label">New Password</label>
          <input class="form-input" id="myNewPassword" type="password">
        </div>
      `,
      `
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="Profile.savePassword()">Update</button>
      `
    );
  },

  async savePassword() {
    const currentPassword = (this.byId('myCurrentPassword')?.value || '').trim();
    const newPassword = (this.byId('myNewPassword')?.value || '').trim();

    if (!currentPassword || !newPassword) {
      return App.toast('Both passwords are required', 'warning');
    }

    try {
      await Store.request('/profile/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      App.closeModal();
      App.toast('Password updated', 'success');
    } catch (e) {
      App.toast(e.message || 'Failed to update password', 'error');
    }
  },

  openSalaryReceipt(payment) {
    if (!payment) return;

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

          <hr class="receipt-divider" />
          <div class="receipt-row bold"><span>Amount Paid</span><span>${App.currency(payment.amount)}</span></div>

          <hr class="receipt-divider" />
          <div class="receipt-section-title">Snapshot</div>
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
        <button class="btn btn-primary" onclick="Profile.printReceipt()">Print</button>
      `
    );
  },

  printReceipt() {
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
  }
};