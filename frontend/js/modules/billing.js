const Billing = {
  currentOrder: null,

  render() {
    this.renderTable();
  },

  byId(id) {
    return document.getElementById(id);
  },

  getOrders() {
    return Store.get('orders') || [];
  },

  getSearchText() {
    return (this.byId('billingSearchInput')?.value || '').trim().toLowerCase();
  },

  getStatusFilter() {
    return this.byId('billingStatusFilter')?.value || 'all';
  },

  filter() {
    this.renderTable();
  },

  getFilteredOrders() {
    let orders = [...this.getOrders()].sort((a, b) => b.timestamp - a.timestamp);
    orders = orders.slice(0, 30);

    const search = this.getSearchText();
    const statusFilter = this.getStatusFilter();

    if (search) {
      orders = orders.filter((order) =>
        String(order.id).toLowerCase().includes(search) ||
        String(order.table || '').toLowerCase().includes(search) ||
        String(order.customerName || '').toLowerCase().includes(search) ||
        String(order.customerPhone || '').toLowerCase().includes(search)
      );
    }

    if (statusFilter !== 'all') {
      orders = orders.filter((order) => (order.billingStatus || 'pending') === statusFilter);
    }

    return orders;
  },

  isOnlineMethod(method) {
    return ['bKash', 'Nagad', 'Rocket'].includes(String(method || '').trim());
  },

  getBillingStatusBadge(status) {
    const map = { pending: 'badge-warning', completed: 'badge-success' };
    return `<span class="badge ${map[status] || 'badge-warning'}">${App.safeText(status)}</span>`;
  },

  getTypeBadge(type) {
    return type === 'delivery'
      ? `<span class="badge badge-purple">Delivery</span>`
      : `<span class="badge badge-accent">Dine-in</span>`;
  },

  renderCustomerBlock(order) {
    return `
      <div class="billing-customer-block">
        <span class="billing-customer-name">${App.safeText(order.customerName || 'Guest')}</span>
        <span class="billing-customer-phone">${App.safeText(order.customerPhone || 'No phone')}</span>
      </div>
    `;
  },

  renderTableRow(order) {
    const billingStatus = order.billingStatus || 'pending';
    return `
      <tr>
        <td class="billing-strong-cell">#${App.safeText(order.id)}</td>
        <td>
          ${order.orderType === 'dine-in' ? `Table ${App.safeText(order.table || '-')}` : `<span class="billing-muted-dash">—</span>`}
        </td>
        <td>${this.getTypeBadge(order.orderType || 'dine-in')}</td>
        <td>${this.renderCustomerBlock(order)}</td>
        <td class="billing-strong-cell">${App.currency(order.total)}</td>
        <td>${this.getBillingStatusBadge(billingStatus)}</td>
        <td class="billing-time-cell">${this.formatOrderTime(order.timestamp)}</td>
        <td style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-xs" onclick="Billing.openOrderDetails(${JSON.stringify(order.id)})">Details</button>
          <button class="btn btn-secondary btn-xs" onclick="Billing.generateReceipt(${JSON.stringify(order.id)})">Receipt</button>
        </td>
      </tr>
    `;
  },

  renderTable() {
    const body = this.byId('billingBody');
    if (!body) return;

    const orders = this.getFilteredOrders();

    if (!orders.length) {
      body.innerHTML = `
        <tr>
          <td colspan="8" class="billing-empty-cell">No orders found</td>
        </tr>
      `;
      return;
    }

    body.innerHTML = orders.map((order) => this.renderTableRow(order)).join('');
  },

  findOrder(orderId) {
    return this.getOrders().find((order) => String(order.id) === String(orderId));
  },

  // -----------------------
  // Complete payment flow
  // -----------------------
  openCompletePaymentModal(orderId) {
    const order = this.findOrder(orderId);
    if (!order) return App.toast('Order not found', 'error');
    if (!order.mongoId) return App.toast('Order is not synced yet', 'warning');
    if ((order.billingStatus || 'pending') === 'completed') return App.toast('Already billed', 'info');

    const online = this.isOnlineMethod(order.paymentMethod);
    const storedTxn = (order.paymentTransactionId || '').trim();

    const body = online
      ? `
        <div class="modal-stack">
          <div class="panel-info">
            <div><strong>Payment Method:</strong> ${App.safeText(order.paymentMethod)}</div>
            <div><strong>Stored Transaction ID:</strong> <code>${App.safeText(storedTxn || '-')}</code></div>
            <div class="text-soft" style="margin-top:6px">
              Enter the customer's Transaction ID exactly. Billing completes only if it matches.
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Enter Transaction ID to Confirm</label>
            <input class="form-input" id="confirmTxnId" placeholder="Transaction ID">
          </div>
        </div>
      `
      : `
        <div class="modal-stack">
          <div class="panel-muted">
            <div><strong>Payment Method:</strong> ${App.safeText(order.paymentMethod || 'cash')}</div>
            <div class="text-soft" style="margin-top:6px">No transaction verification required.</div>
          </div>
        </div>
      `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-success" id="confirmBillBtn" onclick="Billing.confirmCompletePayment(${JSON.stringify(order.id)})">
        Complete Payment
      </button>
    `;

    App.openModal('Complete Payment', body, footer);
  },

  async confirmCompletePayment(orderId) {
    const order = this.findOrder(orderId);
    const btn = this.byId('confirmBillBtn');
    if (!order || !order.mongoId) return;

    const online = this.isOnlineMethod(order.paymentMethod);
    const enteredTxn = (this.byId('confirmTxnId')?.value || '').trim();

    if (online && !enteredTxn) {
      App.toast('Transaction ID is required', 'warning');
      return;
    }

    App.setButtonLoading(btn, true, 'Saving...', 'Complete Payment');

    try {
      await Store.request(`/orders/${order.mongoId}/billing-status`, {
        method: 'PATCH',
        body: JSON.stringify({
          billingStatus: 'completed',
          paymentTransactionId: online ? enteredTxn : ''
        })
      });

      await Store.fetchOrders();
      App.closeModal();
      App.toast('Billing completed', 'success');
      this.renderTable();
    } catch (e) {
      App.toast(e.message || 'Failed to complete billing', 'error');
    } finally {
      App.setButtonLoading(btn, false, 'Saving...', 'Complete Payment');
    }
  },

  // -----------------------
  // Order details modal
  // -----------------------
  openOrderDetails(orderId) {
    const order = this.findOrder(orderId);
    if (!order) return App.toast('Order not found', 'error');

    const online = this.isOnlineMethod(order.paymentMethod);
    const txn = (order.paymentTransactionId || '').trim();
    const billingStatus = order.billingStatus || 'pending';

    const txnHtml = online
      ? `<div class="summary-row"><span>Transaction ID</span><span style="max-width:220px;text-align:right">${App.safeText(txn || '-')}</span></div>`
      : '';

    const body = `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-size:1.05rem;font-weight:800">Order #${App.safeText(order.id)}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">${App.formatDateTime(order.timestamp)}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span class="badge ${billingStatus === 'completed' ? 'badge-success' : 'badge-warning'}">${App.safeText(billingStatus)}</span>
            <span class="badge ${online ? 'badge-purple' : 'badge-accent'}">${App.safeText(order.paymentMethod || 'cash')}</span>
          </div>
        </div>

        <div style="background:var(--bg-input);padding:14px;border-radius:var(--radius)">
          <div class="summary-row"><span>Customer</span><span>${App.safeText(order.customerName || 'Guest')}</span></div>
          <div class="summary-row"><span>Phone</span><span>${App.safeText(order.customerPhone || '-')}</span></div>
          ${
            order.orderType === 'delivery'
              ? `<div class="summary-row"><span>Address</span><span style="max-width:220px;text-align:right">${App.safeText(order.deliveryAddress || '-')}</span></div>`
              : `<div class="summary-row"><span>Table</span><span>${App.safeText(order.table || '-')}</span></div>`
          }
          <div class="summary-row"><span>Payment</span><span>${App.safeText(order.paymentMethod || 'cash')}</span></div>
          ${txnHtml}
        </div>

        <div style="background:var(--bg-input);padding:14px;border-radius:var(--radius)">
          <div class="summary-row"><span>Subtotal</span><span>${App.currency(order.subtotal || 0)}</span></div>
          <div class="summary-row"><span>Tax</span><span>${App.currency(order.tax || 0)}</span></div>
          <div class="summary-row"><span>Discount</span><span>-${App.currency(order.discount || 0)}</span></div>
          <div class="summary-row total"><span>Total</span><span>${App.currency(order.total || 0)}</span></div>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
      ${
        billingStatus !== 'completed'
          ? `<button class="btn btn-success" onclick="Billing.openCompletePaymentModal(${JSON.stringify(order.id)})">Complete Payment</button>`
          : ''
      }
      <button class="btn btn-primary" onclick="Billing.generateReceipt(${JSON.stringify(order.id)})">Open Receipt</button>
    `;

    App.openModal('Order Details', body, footer);
  },

  // -----------------------
  // Receipt (no auto-complete here; staff must use Complete Payment)
  // -----------------------
  buildReceiptHTML(order) {
    const discountPercent = Number(order.discountPercent || 0);
    const discountAmount = Number(order.discount || 0);
    const online = this.isOnlineMethod(order.paymentMethod);

    const txnLine = online
      ? `<div class="receipt-row"><span>Txn ID</span><span>${App.safeText(order.paymentTransactionId || '-')}</span></div>`
      : '';

    return `
      <div class="receipt-preview" id="receiptPrint">
        <h2>RestOS</h2>
        <p class="receipt-sub">
          Uttara, Food City, Dhaka-1230<br>
          Mobile: +880 1903048550
        </p>

        <hr class="receipt-divider">

        <div class="receipt-row"><span>Order #</span><span>${App.safeText(order.id)}</span></div>
        <div class="receipt-row"><span>Type</span><span>${App.safeText(order.orderType || 'dine-in')}</span></div>
        <div class="receipt-row"><span>Customer</span><span>${App.safeText(order.customerName || 'Guest')}</span></div>

        ${
          order.orderType === 'delivery'
            ? `
              <div class="receipt-row"><span>Phone</span><span>${App.safeText(order.customerPhone || '-')}</span></div>
              <div class="receipt-row"><span>Address</span><span class="receipt-multiline-value">${App.safeText(order.deliveryAddress || '-')}</span></div>
            `
            : `
              <div class="receipt-row"><span>Table</span><span>${App.safeText(order.table || '-')}</span></div>
              <div class="receipt-row"><span>Phone</span><span>${App.safeText(order.customerPhone || '-')}</span></div>
            `
        }

        <div class="receipt-row"><span>Payment</span><span>${App.safeText(order.paymentMethod || 'cash')}</span></div>
        ${txnLine}

        <div class="receipt-row"><span>Date</span><span>${new Date(order.timestamp).toLocaleDateString()}</span></div>
        <div class="receipt-row"><span>Time</span><span>${new Date(order.timestamp).toLocaleTimeString()}</span></div>

        <hr class="receipt-divider">

        <div class="receipt-section-title">Items:</div>
        ${(order.items || []).map((item) => `
          <div class="receipt-row">
            <span>${Number(item.qty || 0)}x ${App.safeText(item.name)}</span>
            <span>${App.currency((item.price || 0) * (item.qty || 0))}</span>
          </div>
        `).join('')}

        <hr class="receipt-divider">

        <div class="receipt-row"><span>Subtotal</span><span>${App.currency(order.subtotal || 0)}</span></div>
        <div class="receipt-row"><span>Tax</span><span>${App.currency(order.tax || 0)}</span></div>
        <div class="receipt-row"><span>Discount (${discountPercent}%)</span><span>-${App.currency(discountAmount)}</span></div>

        <hr class="receipt-divider">

        <div class="receipt-row bold"><span>TOTAL</span><span>${App.currency(order.total || 0)}</span></div>

        <hr class="receipt-divider">

        <p class="receipt-footer">
          Billing Status: <strong>${App.safeText(order.billingStatus || 'pending')}</strong><br>
          Thank you for ordering with us!
        </p>
      </div>
    `;
  },

  generateReceipt(orderId) {
    const order = this.findOrder(orderId);
    if (!order) return App.toast('Order not found', 'error');

    this.currentOrder = order;

    const body = this.buildReceiptHTML(order);
    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
      <button class="btn btn-primary" onclick="Billing.printReceipt()">Print</button>
    `;
    App.openModal('Receipt', body, footer);
  },

  async printReceipt() {
    const receipt = this.byId('receiptPrint');
    if (!receipt) return App.toast('Receipt not found', 'error');

    const printWindow = window.open('', '_blank', 'width=420,height=700');
    if (!printWindow) return App.toast('Unable to open print window', 'error');

    printWindow.document.write(`
      <html><head><title>Receipt</title></head><body>${receipt.innerHTML}</body></html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  },

  formatOrderTime(timestamp) {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};