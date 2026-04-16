const Dashboard = {
  rangePreset: 'thisWeek',
  customStart: '',
  customEnd: '',

  render() {
    this.renderStats();
    this.renderCharts();
    this.renderRecentOrders();
  },

  byId(id) {
    return document.getElementById(id);
  },

  getOrders() {
    return Store.get('orders') || [];
  },

  getMenuItems() {
    return Store.get('menuItems') || [];
  },

  getTables() {
    return Store.get('tables') || [];
  },

  // ---------------------------
  // Accounting helpers
  // ---------------------------
  getBilledOrders() {
    return this.getOrders().filter(
      (o) => (o.billingStatus || 'pending') === 'completed' && !!o.billingCompletedAt
    );
  },

  startOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  },

  toISODateInputValue(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  },

  formatRangeTitle(start, endExclusive) {
    const endInclusive = new Date(endExclusive.getTime() - 1);
    const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const e = endInclusive.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const y1 = start.getFullYear();
    const y2 = endInclusive.getFullYear();
    if (y1 === y2) return `${s} — ${e}, ${y1}`;
    return `${s}, ${y1} — ${e}, ${y2}`;
  },

  getWeekRange(offsetWeeks = 0) {
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;

    const start = new Date(now);
    start.setDate(now.getDate() + mondayOffset + offsetWeeks * 7);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    return { start, end };
  },

  getMonthRange(offsetMonths = 0) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 1);
    return { start, end };
  },

  compressLabels(labels, maxLabels = 14) {
    if (!labels || labels.length <= maxLabels) return labels;
    const step = Math.ceil(labels.length / maxLabels);
    return labels.map((l, i) => (i % step === 0 ? l : ''));
  },

  // ---------------------------
  // Date range picker
  // ---------------------------
  setRangePreset(preset) {
    this.rangePreset = preset || 'thisWeek';

    if (this.rangePreset === 'custom') {
      if (!this.customStart || !this.customEnd) {
        const end = this.startOfDay(new Date());
        const start = this.addDays(end, -6);
        this.customStart = this.toISODateInputValue(start);
        this.customEnd = this.toISODateInputValue(end);
      }
    }

    this.renderCharts();
  },

  setCustomStart(value) {
    this.customStart = value || '';
  },

  setCustomEnd(value) {
    this.customEnd = value || '';
  },

  applyCustomRange() {
    if (!this.customStart || !this.customEnd) {
      App.toast('Please select both start and end dates', 'warning');
      return;
    }

    const start = this.startOfDay(new Date(this.customStart));
    const end = this.startOfDay(new Date(this.customEnd));

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      App.toast('Invalid custom dates', 'error');
      return;
    }

    if (end.getTime() < start.getTime()) {
      App.toast('End date cannot be before start date', 'warning');
      return;
    }

    this.renderCharts();
  },

  getSelectedRange() {
    const nowStart = this.startOfDay(new Date());

    if (this.rangePreset === 'today') {
      const start = nowStart;
      const end = this.addDays(start, 1);
      return { start, end, granularity: 'hour', title: 'Today', subtitle: 'Hourly billed revenue for today' };
    }

    if (this.rangePreset === 'yesterday') {
      const end = nowStart;
      const start = this.addDays(end, -1);
      return { start, end, granularity: 'hour', title: 'Yesterday', subtitle: 'Hourly billed revenue for yesterday' };
    }

    if (this.rangePreset === 'thisWeek') {
      const { start, end } = this.getWeekRange(0);
      return { start, end, granularity: 'day', title: 'This Week', subtitle: 'Daily billed revenue for this week' };
    }

    if (this.rangePreset === 'lastWeek') {
      const { start, end } = this.getWeekRange(-1);
      return { start, end, granularity: 'day', title: 'Last Week', subtitle: 'Daily billed revenue for last week' };
    }

    if (this.rangePreset === 'thisMonth') {
      const { start, end } = this.getMonthRange(0);
      const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return { start, end, granularity: 'day', title: label, subtitle: 'Daily billed revenue for this month' };
    }

    if (this.rangePreset === 'lastMonth') {
      const { start, end } = this.getMonthRange(-1);
      const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return { start, end, granularity: 'day', title: label, subtitle: 'Daily billed revenue for last month' };
    }

    if (this.rangePreset === 'custom') {
      const start = this.customStart ? this.startOfDay(new Date(this.customStart)) : this.startOfDay(new Date());
      const endInclusive = this.customEnd ? this.startOfDay(new Date(this.customEnd)) : this.startOfDay(new Date());
      const end = this.addDays(endInclusive, 1);

      const isSameDay = start.getTime() === endInclusive.getTime();
      const granularity = isSameDay ? 'hour' : 'day';

      return {
        start,
        end,
        granularity,
        title: this.formatRangeTitle(start, end),
        subtitle: granularity === 'hour' ? 'Hourly billed revenue for selected day' : 'Daily billed revenue for selected range'
      };
    }

    const { start, end } = this.getWeekRange(0);
    return { start, end, granularity: 'day', title: 'This Week', subtitle: 'Daily billed revenue for this week' };
  },

  // ---------------------------
  // Dashboard Stats (Accounting style)
  // ---------------------------
  getTodayBilledRange() {
    const start = this.startOfDay(new Date());
    const end = this.addDays(start, 1);
    return { start: start.getTime(), end: end.getTime() };
  },

  getTodayBilledOrders() {
    const { start, end } = this.getTodayBilledRange();
    return this.getBilledOrders().filter((o) => o.billingCompletedAt >= start && o.billingCompletedAt < end);
  },

  getStatsData() {
    const billedToday = this.getTodayBilledOrders();
    const billedRevenueToday = billedToday.reduce((sum, o) => sum + (o.total || 0), 0);

    const avgInvoiceValue = billedToday.length ? billedRevenueToday / billedToday.length : 0;

    const pendingBills = this.getOrders().filter(
      (o) => (o.status === 'completed') && ((o.billingStatus || 'pending') !== 'completed')
    ).length;

    const tables = this.getTables();
    const activeTables = tables.filter((t) => t.status === 'occupied' || t.status === 'reserved').length;

    return {
      billedRevenueToday,
      invoicesToday: billedToday.length,
      avgInvoiceValue,
      pendingBills,
      activeTables,
      totalTables: tables.length
    };
  },

  renderStats() {
    const stats = this.getStatsData();
    const container = this.byId('dashboardStats');
    if (!container) return;

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--accent-bg);color:var(--accent)">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"></path>
          </svg>
        </div>
        <div class="stat-value">${App.currency(stats.billedRevenueToday)}</div>
        <div class="stat-label">Today's Billed Revenue</div>
        <span class="stat-change up">Accounting basis</span>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background:var(--success-bg);color:var(--success)">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M9 12h6"></path>
            <path d="M9 16h6"></path>
            <path d="M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"></path>
          </svg>
        </div>
        <div class="stat-value">${stats.invoicesToday}</div>
        <div class="stat-label">Invoices Billed Today</div>
        <span class="stat-change up">Billing completed</span>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background:var(--info-bg);color:var(--info)">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M18 20V10M12 20V4M6 20v-6"></path>
          </svg>
        </div>
        <div class="stat-value">${App.currency(stats.avgInvoiceValue)}</div>
        <div class="stat-label">Avg Invoice Value (Today)</div>
        <span class="stat-change up">Billed orders</span>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background:var(--warning-bg);color:var(--warning)">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M12 9v4"></path>
            <path d="M12 17h.01"></path>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path>
          </svg>
        </div>
        <div class="stat-value">${stats.pendingBills}</div>
        <div class="stat-label">Pending Bills</div>
        <span class="stat-change down">Needs billing</span>
      </div>
    `;
  },

  // ---------------------------
  // Revenue Chart (Accounting style)
  // ---------------------------
  getRevenueChartData() {
    const billedOrders = this.getBilledOrders();
    const range = this.getSelectedRange();
    const startMs = range.start.getTime();
    const endMs = range.end.getTime();

    const inRange = billedOrders.filter((o) => o.billingCompletedAt >= startMs && o.billingCompletedAt < endMs);

    if (range.granularity === 'hour') {
      const labels = [];
      const data = [];

      for (let h = 0; h < 24; h++) {
        const bucketStart = new Date(range.start);
        bucketStart.setHours(h, 0, 0, 0);

        const bucketEnd = new Date(bucketStart);
        bucketEnd.setHours(h + 1, 0, 0, 0);

        labels.push(bucketStart.toLocaleTimeString('en-US', { hour: '2-digit' }));

        const revenue = inRange
          .filter((o) => o.billingCompletedAt >= bucketStart.getTime() && o.billingCompletedAt < bucketEnd.getTime())
          .reduce((sum, o) => sum + (o.total || 0), 0);

        data.push(revenue);
      }

      const compactLabels = labels.map((l, i) => (i % 3 === 0 ? l : ''));

      return { labels: compactLabels, data, title: range.title, subtitle: range.subtitle };
    }

    const labels = [];
    const data = [];

    const cursor = new Date(range.start);
    while (cursor.getTime() < range.end.getTime()) {
      const next = new Date(cursor);
      next.setDate(cursor.getDate() + 1);

      let label = cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (this.rangePreset === 'thisWeek' || this.rangePreset === 'lastWeek') {
        label = cursor.toLocaleDateString('en-US', { weekday: 'short' });
      }
      if (this.rangePreset === 'thisMonth' || this.rangePreset === 'lastMonth') {
        label = String(cursor.getDate());
      }

      labels.push(label);

      const revenue = inRange
        .filter((o) => o.billingCompletedAt >= cursor.getTime() && o.billingCompletedAt < next.getTime())
        .reduce((sum, o) => sum + (o.total || 0), 0);

      data.push(revenue);
      cursor.setDate(cursor.getDate() + 1);
    }

    const compactLabels = this.compressLabels(labels, 14);
    return { labels: compactLabels, data, title: range.title, subtitle: range.subtitle };
  },

  // Category chart should align with accounting too
  getCategoryChartData() {
    const billedOrders = this.getBilledOrders();
    const menu = this.getMenuItems();
    const categories = {};

    billedOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const menuItem = menu.find((m) => m.id === item.menuId);
        const category = menuItem ? menuItem.category : 'Other';
        categories[category] = (categories[category] || 0) + (item.qty || 0);
      });
    });

    return {
      labels: Object.keys(categories),
      data: Object.values(categories),
      colors: ['#E85D24', '#22C55E', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4']
    };
  },

  renderRevenueHeader(chartData) {
    const titleEl = this.byId('dashboardRevenueTitle');
    const subtitleEl = this.byId('dashboardRevenueSubtitle');
    const controlsEl = this.byId('dashboardRevenueControls');

    if (titleEl) titleEl.textContent = chartData.title;
    if (subtitleEl) subtitleEl.textContent = chartData.subtitle;

    if (!controlsEl) return;

    const isCustom = this.rangePreset === 'custom';
    const startVal = this.customStart || '';
    const endVal = this.customEnd || '';

    controlsEl.innerHTML = `
      <div class="dashboard-chart-controls" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
        <select class="form-select" style="width:auto;padding:6px 30px 6px 10px;font-size:0.8rem"
          onchange="Dashboard.setRangePreset(this.value)">
          <option value="today" ${this.rangePreset === 'today' ? 'selected' : ''}>Today</option>
          <option value="yesterday" ${this.rangePreset === 'yesterday' ? 'selected' : ''}>Yesterday</option>
          <option value="thisWeek" ${this.rangePreset === 'thisWeek' ? 'selected' : ''}>This week</option>
          <option value="lastWeek" ${this.rangePreset === 'lastWeek' ? 'selected' : ''}>Last week</option>
          <option value="thisMonth" ${this.rangePreset === 'thisMonth' ? 'selected' : ''}>This month</option>
          <option value="lastMonth" ${this.rangePreset === 'lastMonth' ? 'selected' : ''}>Last month</option>
          <option value="custom" ${this.rangePreset === 'custom' ? 'selected' : ''}>Custom</option>
        </select>

        ${
          isCustom
            ? `
              <input class="form-input" type="date" style="width:auto;padding:6px 10px;font-size:0.8rem"
                value="${startVal}" onchange="Dashboard.setCustomStart(this.value)">
              <input class="form-input" type="date" style="width:auto;padding:6px 10px;font-size:0.8rem"
                value="${endVal}" onchange="Dashboard.setCustomEnd(this.value)">
              <button class="btn btn-secondary btn-xs" onclick="Dashboard.applyCustomRange()">Apply</button>
            `
            : ''
        }
      </div>
    `;
  },

  renderCharts() {
    const revenueChart = this.getRevenueChartData();
    const categoryChart = this.getCategoryChartData();

    this.renderRevenueHeader(revenueChart);

    setTimeout(() => {
      ChartLib.lineChart('revenueChart', {
        labels: revenueChart.labels,
        data: revenueChart.data,
        color: '#E85D24'
      });

      ChartLib.pieChart('categoryPieChart', {
        labels: categoryChart.labels,
        data: categoryChart.data,
        colors: categoryChart.colors
      });
    }, 50);
  },

  // recent orders can remain operational; no change required
  renderRecentOrders() {
    const container = this.byId('recentOrdersList');
    if (!container) return;

    const orders = [...this.getOrders()].sort((a, b) => b.timestamp - a.timestamp).slice(0, 4);

    const statusBadge = (status) => {
      const map = { pending: 'badge-warning', 'in-progress': 'badge-info', completed: 'badge-success' };
      return `<span class="badge ${map[status] || 'badge-info'}">${status.replace('-', ' ')}</span>`;
    };

    const typeBadge = (type) =>
      type === 'delivery'
        ? `<span class="badge badge-purple">Delivery</span>`
        : `<span class="badge badge-accent">Dine-in</span>`;

    if (!orders.length) {
      container.innerHTML = `<div class="empty-state"><p>No orders yet</p></div>`;
      return;
    }

    container.innerHTML = orders.map((order) => `
      <div class="premium-order-item" onclick="Dashboard.openOrderDetails(${JSON.stringify(order.id)})">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span style="font-weight:900; color:#fff; font-size:0.95rem;">#${order.id}</span>
            ${typeBadge(order.orderType || 'dine-in')}
            ${statusBadge(order.status)}
          </div>
          <div style="font-weight:900; color:var(--accent); font-size:1.1rem;">
            ${App.currency(order.total)}
          </div>
        </div>
        <div style="font-size:0.75rem; color:var(--text-muted); line-height:1.4;">
          ${(order.items || []).map((item) => `${item.qty}x ${App.safeText(item.name)}`).join(', ')}
        </div>
      </div>
    `).join('');
  },

  openOrderDetails(orderId) {
    const order = this.getOrders().find((entry) => String(entry.id) === String(orderId));
    if (!order) return;
    Billing.generateReceipt(order.id);
  }
};