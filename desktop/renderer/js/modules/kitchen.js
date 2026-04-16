const Kitchen = {
  hiddenCompletedKey: 'restaurantos_hidden_completed_orders',
  notifiedOrders: new Set(),

  byId(id) {
    return document.getElementById(id);
  },

  getOrders() {
    return Store.get('orders') || [];
  },

  getHiddenCompleted() {
    try {
      return JSON.parse(localStorage.getItem(this.hiddenCompletedKey)) || [];
    } catch {
      return [];
    }
  },

  saveHiddenCompleted(list) {
    localStorage.setItem(this.hiddenCompletedKey, JSON.stringify(list));
  },

  hideCompleted(orderId) {
    const hidden = this.getHiddenCompleted();

    if (!hidden.includes(orderId)) {
      hidden.push(orderId);
      this.saveHiddenCompleted(hidden);
    }

    this.render();
    App.toast(`Order #${orderId} removed from kitchen view`, 'info');
  },

  unhideAllCompleted() {
    this.saveHiddenCompleted([]);
    this.render();
    App.toast('Completed kitchen list restored', 'success');
  },

  getOrderGroups() {
    const orders = this.getOrders();
    const hiddenCompleted = this.getHiddenCompleted();

    const pending = orders
      .filter((order) => order.status === 'pending')
      .sort((a, b) => b.timestamp - a.timestamp);

    const inProgress = orders
      .filter((order) => order.status === 'in-progress')
      .sort((a, b) => a.timestamp - b.timestamp);

    const completed = orders
      .filter(
        (order) =>
          order.status === 'completed' &&
          !hiddenCompleted.includes(order.id)
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 7); // Limit to 7 most recent completed orders

    return {
      pending,
      inProgress,
      completed,
      hiddenCompleted
    };
  },

  getTimingInfo(order) {
    if (!order.estimatedReadyAt) {
      return {
        label: 'No estimate',
        className: 'badge badge-info',
        remainingMinutes: null,
        lateMinutes: null
      };
    }

    const now = Date.now();
    const diffMs = order.estimatedReadyAt - now;
    const diffMinutes = Math.ceil(diffMs / 60000);

    if (diffMinutes >= 0) {
      return {
        label: `Ready in ${diffMinutes}m`,
        className: 'badge badge-info',
        remainingMinutes: diffMinutes,
        lateMinutes: null
      };
    }

    return {
      label: `Late by ${Math.abs(diffMinutes)}m`,
      className: 'badge badge-danger',
      remainingMinutes: null,
      lateMinutes: Math.abs(diffMinutes)
    };
  },

  render() {
    const { pending, inProgress, completed, hiddenCompleted } = this.getOrderGroups();

    this.renderCounts({
      pending: pending.length,
      inProgress: inProgress.length,
      completed: completed.length
    });

    this.renderPending(pending);
    this.renderInProgress(inProgress);
    this.renderCompleted(completed, hiddenCompleted);
  },

  renderCounts({ pending, inProgress, completed }) {
    const pendingCount = this.byId('pendingCount');
    const inProgressCount = this.byId('inProgressCount');
    const completedCount = this.byId('completedCount');

    if (pendingCount) pendingCount.textContent = pending;
    if (inProgressCount) inProgressCount.textContent = inProgress;
    if (completedCount) completedCount.textContent = completed;
  },

  getOrderMeta(order) {
    if (order.orderType === 'delivery') {
      return `🚚 Delivery${order.customerName ? ` · ${App.safeText(order.customerName)}` : ''}`;
    }

    return `📍 Table ${App.safeText(order.table || '-')}`;
  },

  renderItemsList(order) {
    return (order.items || [])
      .map(
        (item) => `
          <li>
            <span>${Number(item.qty || 0)}x ${App.safeText(item.name)}</span>
            <span>${App.currency((item.price || 0) * (item.qty || 0))}</span>
          </li>
        `
      )
      .join('');
  },

  renderOfflineBadge(order) {
    if (!order.offlineQueued) return '';
    return `
      <div class="kitchen-order-badge-wrap">
        <span class="badge badge-warning">Queued Offline</span>
      </div>
    `;
  },

  renderTimingBadge(order) {
    if (order.status !== 'in-progress') return '';

    const timing = this.getTimingInfo(order);

    return `
      <div class="kitchen-order-badge-wrap">
        <span class="${timing.className}">${timing.label}</span>
      </div>
    `;
  },

  renderCard(order, actionsHtml) {
    return `
      <div class="order-card">
        <div class="order-card-header">
          <span class="order-num">#${App.safeText(order.id)}</span>
          <span class="order-time">${App.timeAgo(order.timestamp)}</span>
        </div>

        <div class="order-table-info">
          ${this.getOrderMeta(order)}
        </div>

        ${this.renderOfflineBadge(order)}
        ${this.renderTimingBadge(order)}

        <ul class="order-items-list">
          ${this.renderItemsList(order)}
        </ul>

        <div class="kitchen-order-total">
          Total: ${App.currency(order.total)}
        </div>

        <div class="order-card-actions">
          ${actionsHtml}
        </div>
      </div>
    `;
  },

  renderPending(orders) {
    const container = this.byId('pipelinePending');
    if (!container) return;

    if (!orders.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No pending orders</p>
        </div>
      `;
      return;
    }

    container.innerHTML = orders
      .map((order) =>
        this.renderCard(
          order,
          order.offlineQueued
            ? `<button class="btn btn-secondary btn-xs" disabled>Waiting for Sync</button>`
            : `
              <button class="btn btn-primary btn-xs" onclick="Kitchen.openStartCookingModal(${JSON.stringify(order.id)})">
                Start Cooking
              </button>
              <button class="btn btn-danger btn-xs" onclick="Kitchen.deletePendingOrder(${JSON.stringify(order.id)})">
                Delete
              </button>
            `
        )
      )
      .join('');
  },

  renderInProgress(orders) {
    const container = this.byId('pipelineInProgress');
    if (!container) return;

    if (!orders.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No orders in progress</p>
        </div>
      `;
      return;
    }

    container.innerHTML = orders
      .map((order) =>
        this.renderCard(
          order,
          `
            <button class="btn btn-success btn-xs" onclick="Kitchen.moveOrder(${JSON.stringify(order.id)}, 'completed')">
              Mark Complete
            </button>
            <button class="btn btn-danger btn-xs" onclick="Kitchen.moveOrder(${JSON.stringify(order.id)}, 'pending')">
              Back to Pending
            </button>
          `
        )
      )
      .join('');
  },

  renderCompleted(orders, hiddenCompleted) {
    const container = this.byId('pipelineCompleted');
    if (!container) return;

    if (!orders.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No completed orders</p>
          ${
            hiddenCompleted.length > 0
              ? `
                <button class="btn btn-secondary btn-sm kitchen-restore-btn" onclick="Kitchen.unhideAllCompleted()">
                  Restore Hidden Orders
                </button>
              `
              : ''
          }
        </div>
      `;
      return;
    }

    const restoreButton =
      hiddenCompleted.length > 0
        ? `
          <div class="kitchen-restore-wrap">
            <button class="btn btn-secondary btn-xs" onclick="Kitchen.unhideAllCompleted()">
              Restore Hidden Orders
            </button>
          </div>
        `
        : '';

    const cards = orders
      .map((order) =>
        this.renderCard(
          order,
          `
            <button class="btn btn-primary btn-xs" onclick="Kitchen.goToBilling(${JSON.stringify(order.id)})">
              Go to Billing
            </button>
          `
        )
      )
      .join('');

    container.innerHTML = `${restoreButton}${cards}`;
  },

  findOrderById(id) {
    return this.getOrders().find((order) => String(order.id) === String(id));
  },

  canUpdateOrder(order) {
    if (!order) {
      App.toast('Order not found', 'error');
      return false;
    }

    if (order.offlineQueued || !order.mongoId) {
      App.toast('This order is still queued offline and cannot be updated yet.', 'warning');
      return false;
    }

    return true;
  },

  openStartCookingModal(orderId) {
    const order = this.findOrderById(orderId);
    if (!order) {
      App.toast('Order not found', 'error');
      return;
    }

    const body = `
      <div class="form-group">
        <label class="form-label">Estimated Preparation Time (Minutes)</label>
        <select class="form-select" id="estimatedPrepMinutes">
          <option value="10">10 minutes</option>
          <option value="15">15 minutes</option>
          <option value="20" selected>20 minutes</option>
          <option value="30">30 minutes</option>
          <option value="45">45 minutes</option>
          <option value="60">60 minutes</option>
        </select>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="Kitchen.startCooking(${JSON.stringify(order.id)})">Start Cooking</button>
    `;

    App.openModal(`Start Cooking #${order.id}`, body, footer);
  },

  async startCooking(id) {
    const order = this.findOrderById(id);
    if (!this.canUpdateOrder(order)) return;

    const estimatedPrepMinutes = Number(this.byId('estimatedPrepMinutes')?.value || 0);

    if (estimatedPrepMinutes <= 0) {
      App.toast('Please select estimated preparation time', 'warning');
      return;
    }

    try {
      await Store.request(`/orders/${order.mongoId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'in-progress',
          estimatedPrepMinutes
        })
      });

      await Store.fetchOrders();
      App.closeModal();
      App.updatePendingBadge();
      this.render();
      App.toast(`Order #${id} started. Estimate: ${estimatedPrepMinutes} minutes`, 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to start cooking', 'error');
    }
  },

  async moveOrder(id, newStatus) {
    const order = this.findOrderById(id);
    if (!this.canUpdateOrder(order)) return;

    try {
      await Store.request(`/orders/${order.mongoId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });

      await Store.fetchOrders();
      App.updatePendingBadge();
      this.render();
      App.toast(`Order #${id} → ${newStatus.replace('-', ' ')}`, 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to update order status', 'error');
    }
  },

  deletePendingOrder(id) {
    const order = this.findOrderById(id);
    if (!order) {
      App.toast('Order not found', 'error');
      return;
    }

    if (order.status !== 'pending') {
      App.toast('Only pending orders can be deleted', 'warning');
      return;
    }

    App.openModal(
      'Delete Pending Order',
      `
        <p class="text-muted">
          Are you sure you want to permanently delete order <strong>#${App.safeText(order.id)}</strong>?
        </p>
        <p class="text-soft-delete">
          This will remove it from the database and restore stock.
        </p>
      `,
      `
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-danger" id="deletePendingOrderBtn" onclick="Kitchen.confirmDeletePendingOrder(${JSON.stringify(order.id)})">Delete</button>
      `
    );
  },

  async confirmDeletePendingOrder(id) {
    const order = this.findOrderById(id);
    const deleteBtn = this.byId('deletePendingOrderBtn');

    if (!order) {
      App.toast('Order not found', 'error');
      return;
    }

    if (!order.mongoId) {
      App.toast('This pending order is not synced yet and cannot be deleted from server.', 'warning');
      return;
    }

    App.setButtonLoading(deleteBtn, true, 'Deleting...', 'Delete');

    try {
      await Store.request(`/orders/${order.mongoId}`, {
        method: 'DELETE'
      });

      await Store.fetchOrders();
      await Store.fetchMenuItems();
      await Store.fetchTables();

      App.closeModal();
      this.render();
      App.updatePendingBadge();
      App.toast(`Order #${id} deleted successfully`, 'warning');
    } catch (error) {
      App.toast(error.message || 'Failed to delete pending order', 'error');
    } finally {
      App.setButtonLoading(deleteBtn, false, 'Deleting...', 'Delete');
    }
  },

  goToBilling(orderId) {
    App.navigate('billing');

    setTimeout(() => {
      if (typeof Billing !== 'undefined' && typeof Billing.openOrderDetails === 'function') {
        Billing.openOrderDetails(orderId);
      }
    }, 150);
  }
};