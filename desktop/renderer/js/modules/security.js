const Security = {
  state: {
    logs: [],
    blocked: [],
    topAbuse: [],
    loading: false,
    filters: {
      ip: '',
      action: '',
      statusCode: '',
      path: '',
      limit: 200
    }
  },

  _bound: false,

  byId(id) {
    return document.getElementById(id);
  },

  canAccess() {
    const u = Store.get('authUser');
    return u && (u.role === 'admin' || u.role === 'manager');
  },

  // ----------------------------
  // Event delegation (NO inline onclick)
  // ----------------------------
  bindEvents() {
    if (this._bound) return;
    const root = this.byId('page-security');
    if (!root) return;

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-sec-action]');
      if (!btn) return;

      const action = btn.getAttribute('data-sec-action');
      const ip = btn.getAttribute('data-ip') || '';

      if (action === 'refresh') return this.refresh();
      if (action === 'apply') return this.applyFilters();
      if (action === 'downloadCsv') return this.downloadCsv();
      if (action === 'openBlockModal') return this.openBlockModal();
      if (action === 'quickFilterIp') return this.quickFilterIp(ip);
      if (action === 'prefillBlock') return this.openBlockModalPrefill(ip);
      if (action === 'unblockPrompt') return this.unblockIP(ip);
    });

    this._bound = true;
  },

  // ----------------------------
  // Fetchers
  // ----------------------------
  async fetchLogs() {
    const f = this.state.filters;
    const qs = new URLSearchParams();

    if (f.ip) qs.set('ip', f.ip);
    if (f.action) qs.set('action', f.action);
    if (f.statusCode) qs.set('statusCode', f.statusCode);
    if (f.path) qs.set('path', f.path);
    qs.set('limit', String(f.limit || 200));

    const json = await Store.request(`/security/logs?${qs.toString()}`);
    this.state.logs = json.data || [];
  },

  async fetchTopAbuse(minutes = 60) {
    const json = await Store.request(`/security/top-abuse?minutes=${encodeURIComponent(minutes)}`);
    this.state.topAbuse = json.data || [];
  },

  async fetchBlocked() {
    const json = await Store.request('/security/blocked-ips');
    this.state.blocked = json.data || [];
  },

  async refresh() {
    if (!this.canAccess()) return;

    this.state.loading = true;
    this.renderSkeleton();

    try {
      await Promise.all([this.fetchLogs(), this.fetchBlocked(), this.fetchTopAbuse(60)]);
      this.render();
    } catch (e) {
      App.toast(e.message || 'Failed to load security data', 'error');
      this.render();
    } finally {
      this.state.loading = false;
    }
  },

  // ----------------------------
  // Render
  // ----------------------------
  renderSkeleton() {
    const page = this.byId('page-security');
    if (!page) return;
    page.innerHTML = `<div class="empty-state"><p>Loading security logs...</p></div>`;
  },

  render() {
    const page = this.byId('page-security');
    if (!page) return;

    // ensure event delegation is attached once
    this.bindEvents();

    if (!this.canAccess()) {
      page.innerHTML = `<div class="empty-state"><p>Access denied</p></div>`;
      return;
    }

    const f = this.state.filters;

    page.innerHTML = `
      <div class="filters-bar" style="justify-content:space-between;align-items:flex-end;flex-wrap:wrap">
        <div>
          <h3 style="font-size:1rem;font-weight:800;margin-bottom:4px">Security Logs</h3>
          <p style="font-size:0.8rem;color:var(--text-muted)">
            View audit logs and block suspicious IPs (admin/manager only).
          </p>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <input class="form-input" style="width:180px" id="secFilterIp" placeholder="Filter IP"
                 value="${App.safeText(f.ip, '')}">
          <input class="form-input" style="width:160px" id="secFilterAction" placeholder="Action (optional)"
                 value="${App.safeText(f.action, '')}">
          <input class="form-input" style="width:120px" id="secFilterStatus" placeholder="Status (e.g. 403)"
                 value="${App.safeText(f.statusCode, '')}">
          <input class="form-input" style="width:220px" id="secFilterPath" placeholder="Path contains"
                 value="${App.safeText(f.path, '')}">

          <select class="form-select" style="width:auto" id="secLimit">
            ${[50, 100, 200, 300, 500].map((n) => `
              <option value="${n}" ${Number(f.limit) === n ? 'selected' : ''}>Last ${n}</option>
            `).join('')}
          </select>

          <button class="btn btn-secondary" data-sec-action="apply">Apply</button>
          <button class="btn btn-primary" data-sec-action="refresh">Refresh</button>
          <button class="btn btn-secondary" data-sec-action="downloadCsv">Download CSV</button>
          <button class="btn btn-danger" data-sec-action="openBlockModal">Block IP</button>
        </div>
      </div>

      <div class="card" style="margin-top:12px">
        <div class="card-header" style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
          <div class="card-title">Top Abusive IPs (Last 60 min)</div>
          <div class="text-soft">Based on 401/403/429 frequency</div>
        </div>
        <div style="padding:14px">
          ${this.renderTopAbuse()}
        </div>
      </div>

      <div class="card" style="margin-top:12px">
        <div class="card-header" style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
          <div class="card-title">Blocked IPs</div>
          <div class="text-soft">Total: <strong>${this.state.blocked.length}</strong></div>
        </div>

        <div style="padding:14px">
          ${this.renderBlockedList()}
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-header" style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
          <div class="card-title">Audit Logs</div>
          <div class="text-soft">Showing: <strong>${this.state.logs.length}</strong></div>
        </div>

        <div class="inventory-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>IP</th>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>Staff</th>
                <th>Action</th>
                <th>User Agent</th>
              </tr>
            </thead>
            <tbody>
              ${this.renderLogsRows()}
            </tbody>
          </table>
        </div>
      </div>
    `;

    if (!this.state.logs.length && !this.state.loading) {
      this.refresh();
    }
  },

  renderTopAbuse() {
    const list = this.state.topAbuse || [];
    if (!list.length) return `<div class="panel-muted">No abusive activity detected</div>`;

    return `
      <div class="modal-stack" style="gap:10px">
        ${list.map((x) => {
          const ip = String(x._id || '');
          return `
            <div class="panel-muted" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
              <div>
                <div style="font-weight:900">${App.safeText(ip || '-')}</div>
                <div class="text-soft">
                  Total: <strong>${Number(x.total || 0)}</strong> |
                  Bad (401/403/429): <strong style="color:var(--warning)">${Number(x.bad || 0)}</strong>
                </div>
                <div class="text-soft">Last seen: ${x.lastAt ? new Date(x.lastAt).toLocaleString() : '-'}</div>
              </div>
              <div class="text-soft">
  Device: <strong>${App.safeText(this.deviceLabelFromUA(x.lastUserAgent || ""))}</strong>
</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-secondary btn-xs" data-sec-action="quickFilterIp" data-ip="${App.escapeHTML(ip)}">View Logs</button>
                <button class="btn btn-danger btn-xs" data-sec-action="prefillBlock" data-ip="${App.escapeHTML(ip)}">Block</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

deviceLabelFromUA(ua = "") {
  const s = String(ua || "").toLowerCase();
  if (!s) return "Unknown";

  // bots/scanners
  if (/(bot|crawl|spider|slurp|scanner|monitor|uptime)/i.test(s)) {
    return "Bot/Scanner";
  }

  const isTablet = /(ipad|tablet)/i.test(s);
  const isMobile = !isTablet && /(iphone|ipod|android|mobile)/i.test(s);

  let os = "";
  if (/android/i.test(s)) os = "Android";
  else if (/(iphone|ipad|ipod)/i.test(s)) os = "iOS";
  else if (/windows nt/i.test(s)) os = "Windows";
  else if (/(macintosh|mac os x)/i.test(s)) os = "macOS";
  else if (/linux/i.test(s)) os = "Linux";

  const device = isTablet ? "Tablet" : isMobile ? "Mobile" : "Desktop";
  return os ? `${device} (${os})` : device;
},

  renderBlockedList() {
    if (!this.state.blocked.length) return `<div class="panel-muted">No blocked IPs</div>`;

    return `
      <div class="modal-stack" style="gap:10px">
        ${this.state.blocked.map((b) => {
          const ip = String(b.ip || '');
          return `
            <div class="panel-muted" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
              <div>
                <div style="font-weight:900">${App.safeText(ip)}</div>
                <div class="text-soft">${b.reason ? `Reason: ${App.safeText(b.reason)}` : 'No reason'}</div>
                <div class="text-soft">Blocked at: ${b.blockedAt ? new Date(b.blockedAt).toLocaleString() : '-'}</div>
              </div>
              <button class="btn btn-secondary btn-xs" data-sec-action="unblockPrompt" data-ip="${App.escapeHTML(ip)}">Unblock</button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  renderLogsRows() {
    if (!this.state.logs.length) {
      return `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:16px">No logs found</td></tr>`;
    }

    const badge = (statusCode) => {
      const s = Number(statusCode || 0);
      const cls = s >= 500 ? 'badge-danger' : s >= 400 ? 'badge-warning' : 'badge-success';
      return `<span class="badge ${cls}">${App.safeText(String(s || ''))}</span>`;
    };

    return this.state.logs.map((l) => {
      const ip = String(l.ip || '');
      const staff = l.staffId ? `${l.staffRole || 'staff'}` : '—';
      const action = l.action || '—';
      const ua = (l.userAgent || '').slice(0, 45);

      return `
        <tr>
          <td>${l.at ? new Date(l.at).toLocaleString() : '-'}</td>
          <td>
            <button class="btn btn-secondary btn-xs" data-sec-action="quickFilterIp" data-ip="${App.escapeHTML(ip)}">
              ${App.safeText(ip || '-')}
            </button>
          </td>
          <td>${App.safeText(l.method || '-')}</td>
          <td style="max-width:320px;word-break:break-all">${App.safeText(l.path || '-')}</td>
          <td>${badge(l.statusCode)}</td>
          <td>${App.safeText(staff)}</td>
          <td>${App.safeText(action)}</td>
          <td title="${App.safeText(l.userAgent || '')}">${App.safeText(ua || '-')}</td>
        </tr>
      `;
    }).join('');
  },

  // ----------------------------
  // Filters
  // ----------------------------
  applyFilters() {
    this.state.filters.ip = (this.byId('secFilterIp')?.value || '').trim();
    this.state.filters.action = (this.byId('secFilterAction')?.value || '').trim();
    this.state.filters.statusCode = (this.byId('secFilterStatus')?.value || '').trim();
    this.state.filters.path = (this.byId('secFilterPath')?.value || '').trim();
    this.state.filters.limit = Number(this.byId('secLimit')?.value || 200);
    this.refresh();
  },

  quickFilterIp(ip) {
    if (!ip) return;
    this.state.filters.ip = ip;
    this.render();
    this.refresh();
  },

  // ----------------------------
  // Block / Unblock
  // ----------------------------
  openBlockModal() {
    App.openModal(
      'Block IP',
      `
        <div class="form-group">
          <label class="form-label">IP Address</label>
          <input class="form-input" id="blockIpValue" placeholder="e.g. 1.2.3.4">
        </div>
        <div class="form-group">
          <label class="form-label">Reason</label>
          <textarea class="form-textarea" id="blockIpReason" rows="2" placeholder="Why are you blocking this IP?"></textarea>
        </div>
      `,
      `
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-danger" id="confirmBlockIpBtn" onclick="Security.confirmBlockIP()">Block</button>
      `
    );
  },

  openBlockModalPrefill(ip) {
    this.openBlockModal();
    setTimeout(() => {
      const input = this.byId('blockIpValue');
      if (input) input.value = ip || '';
    }, 50);
  },

  async confirmBlockIP() {
    const btn = this.byId('confirmBlockIpBtn');
    const ip = (this.byId('blockIpValue')?.value || '').trim();
    const reason = (this.byId('blockIpReason')?.value || '').trim();

    if (!ip) return App.toast('IP is required', 'warning');

    App.setButtonLoading(btn, true, 'Blocking...', 'Block');
    try {
      await Store.request('/security/block-ip', {
        method: 'POST',
        body: JSON.stringify({ ip, reason })
      });

      App.toast('IP blocked', 'success');
      App.closeModal();
      await this.refresh();
    } catch (e) {
      App.toast(e.message || 'Failed to block IP', 'error');
    } finally {
      App.setButtonLoading(btn, false, 'Blocking...', 'Block');
    }
  },

  // store the ip temporarily for the modal action
_pendingUnblockIp: null,

unblockIP(ip) {
  if (!ip) return;

  this._pendingUnblockIp = ip;

  App.openModal(
    'Unblock IP',
    `<p class="text-muted">Unblock <strong>${App.safeText(ip)}</strong>?</p>`,
    `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="confirmUnblockBtn" onclick="Security.confirmUnblockIP()">Unblock</button>
    `
  );
},

async confirmUnblockIP() {
  const ip = this._pendingUnblockIp;
  if (!ip) {
    App.toast('No IP selected to unblock', 'error');
    return;
  }

  const btn = document.getElementById('confirmUnblockBtn');
  App.setButtonLoading(btn, true, 'Unblocking...', 'Unblock');

  try {
    await Store.request(`/security/block-ip/${encodeURIComponent(ip)}`, { method: 'DELETE' });
    App.closeModal();
    App.toast('IP unblocked', 'success');
    this._pendingUnblockIp = null;
    await this.refresh();
  } catch (e) {
    App.toast(e.message || 'Failed to unblock IP', 'error');
  } finally {
    App.setButtonLoading(btn, false, 'Unblocking...', 'Unblock');
  }
},

  // ----------------------------
  // CSV Export
  // ----------------------------
  downloadCsv() {
    const rows = this.state.logs || [];
    if (!rows.length) {
      App.toast('No logs to export', 'warning');
      return;
    }

    const header = ['at', 'ip', 'method', 'path', 'statusCode', 'staffId', 'staffRole', 'action', 'userAgent'];

    const escape = (v) => {
      const s = String(v ?? '');
      if (s.includes('"') || s.includes(',') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csv = [
      header.join(','),
      ...rows.map((l) => {
        const line = [
          l.at ? new Date(l.at).toISOString() : '',
          l.ip || '',
          l.method || '',
          l.path || '',
          l.statusCode ?? '',
          l.staffId || '',
          l.staffRole || '',
          l.action || '',
          l.userAgent || ''
        ];
        return line.map(escape).join(',');
      })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
    App.toast('CSV downloaded', 'success');
  }
};