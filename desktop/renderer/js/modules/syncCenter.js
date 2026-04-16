const SyncCenter = {
  byId(id) {
    return document.getElementById(id);
  },

  getQueue() {
    return Store.getQueue() || [];
  },

  actionLabel(type) {
    const map = {
      CREATE_ORDER: 'Create Order',
      UPDATE_ORDER_STATUS: 'Update Order Status',
      CREATE_FEEDBACK: 'Create Feedback',
      UPDATE_MENU_ITEM: 'Update Menu Item',
      CREATE_TABLE: 'Create Table',
      UPDATE_TABLE: 'Update Table',
      DELETE_TABLE: 'Delete Table'
    };

    return map[type] || type;
  },

  render() {
    this.renderSummary();
    this.renderQueueList();
  },

  refresh() {
    this.render();
    App.toast('Sync queue refreshed', 'info');
  },

  getSummaryData() {
    const queue = this.getQueue();
    const conflicts = queue.filter((item) => item.syncError).length;

    return {
      total: queue.length,
      conflicts,
      online: navigator.onLine
    };
  },

  renderSummary() {
    const container = this.byId('syncSummary');
    if (!container) return;

    const { total, conflicts, online } = this.getSummaryData();

    container.innerHTML = `
      <div class="sync-summary-grid">
        <div class="sync-summary-card">
          <div class="sync-summary-value sync-summary-accent">${total}</div>
          <div class="sync-summary-label">Queued Actions</div>
        </div>

        <div class="sync-summary-card">
          <div class="sync-summary-value sync-summary-warning">${conflicts}</div>
          <div class="sync-summary-label">Sync Conflicts</div>
        </div>

        <div class="sync-summary-card">
          <div class="sync-summary-value ${online ? 'sync-summary-success' : 'sync-summary-danger'}">
            ${online ? 'Online' : 'Offline'}
          </div>
          <div class="sync-summary-label">Connection Status</div>
        </div>
      </div>
    `;
  },

  getQueueBadge(item) {
    if (item.syncError) {
      return `<span class="badge badge-danger">Conflict / Failed Sync</span>`;
    }

    return `<span class="badge badge-warning">Queued</span>`;
  },

  findMenuItemName(menuId) {
    const menuItem = (Store.get('menuItems') || []).find((item) => String(item.id) === String(menuId));
    return menuItem?.name || menuId;
  },

  findTableLabel(tableId) {
    const table = (Store.get('tables') || []).find((entry) => String(entry.id) === String(tableId));
    return table ? `Table ${table.number}` : tableId;
  },

  renderCreateOrderPayload(item) {
    const payload = item.payload || {};
    const items = payload.items || [];
    const tableLabel = payload.tableId ? this.findTableLabel(payload.tableId) : 'No table';

    return `
      <div class="sync-order-preview">
        <div class="sync-order-meta"><strong>Table:</strong> ${App.safeText(tableLabel)}</div>

        <div class="sync-order-items">
          ${items.map((entry) => `
            <div class="sync-order-item-row">
              <span>${Number(entry.qty || 0)}x ${App.safeText(this.findMenuItemName(entry.menuId))}</span>
              <span>${entry.price != null ? App.currency((entry.price || 0) * (entry.qty || 0)) : ''}</span>
            </div>
          `).join('')}
        </div>

        <div class="sync-order-totals">
          <div class="summary-row"><span>Subtotal</span><span>${App.currency(payload.subtotal || 0)}</span></div>
          <div class="summary-row"><span>Tax</span><span>${App.currency(payload.tax || 0)}</span></div>
          <div class="summary-row"><span>Discount (${Number(payload.discountPercent || 0)}%)</span><span>-${App.currency(payload.discount || 0)}</span></div>
          <div class="summary-row total"><span>Total</span><span>${App.currency(payload.total || 0)}</span></div>
        </div>
      </div>
    `;
  },

  renderPayload(item) {
    switch (item.type) {
      case 'CREATE_ORDER':
        return this.renderCreateOrderPayload(item);

      default:
        return `
          <pre class="sync-queue-payload">${App.safeText(this.formatPayload(item), '')}</pre>
        `;
    }
  },

  formatPayload(item) {
    const clone = { ...item };
    delete clone.queueId;
    delete clone.createdAt;
    return JSON.stringify(clone, null, 2);
  },

  renderQueueCard(item) {
    return `
      <div class="card sync-queue-card">
        <div class="sync-queue-card-top">
          <div class="sync-queue-main">
            <div class="sync-queue-header">
              <strong class="sync-queue-title">${App.safeText(this.actionLabel(item.type))}</strong>
              ${this.getQueueBadge(item)}
            </div>

            <div class="sync-queue-time">
              Created ${App.timeAgo(item.createdAt)}
            </div>

            ${this.renderPayload(item)}

            ${
              item.syncError
                ? `
                  <div class="sync-queue-error">
                    <strong>Sync Error:</strong> ${App.safeText(item.syncError)}
                  </div>
                `
                : ''
            }
          </div>

          <div class="sync-queue-actions">
            <button class="btn btn-secondary btn-xs" onclick="SyncCenter.retryOne('${item.queueId}')">Retry</button>
            <button class="btn btn-danger btn-xs" onclick="SyncCenter.deleteOne('${item.queueId}')">Delete</button>
          </div>
        </div>
      </div>
    `;
  },

  renderQueueList() {
    const container = this.byId('syncQueueList');
    if (!container) return;

    const queue = this.getQueue();

    if (!queue.length) {
      container.innerHTML = `
        <div class="empty-state">
          <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M21 12a9 9 0 11-2.64-6.36"></path>
            <polyline points="21 3 21 9 15 9"></polyline>
          </svg>
          <p>No queued offline actions</p>
        </div>
      `;
      return;
    }

    container.innerHTML = queue.map((item) => this.renderQueueCard(item)).join('');
  },

  async retryAll() {
    if (!navigator.onLine) {
      App.toast('You are offline. Cannot retry sync now.', 'warning');
      return;
    }

    try {
      await Store.processQueue();
      this.render();
      App.updateSyncQueueBadge();
      App.toast('Queued actions retried', 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to retry queued actions', 'error');
    }
  },

  async retryOne(queueId) {
    if (!navigator.onLine) {
      App.toast('You are offline. Cannot retry sync now.', 'warning');
      return;
    }

    const queue = this.getQueue();
    const item = queue.find((entry) => entry.queueId === queueId);

    if (!item) {
      App.toast('Queue item not found', 'error');
      return;
    }

    try {
      await Store.processQueueItem(item);
      Store.removeQueueItem(queueId);

      await Store.refreshAll();
      this.render();
      App.updateSyncQueueBadge();
      App.toast('Queued action retried', 'success');
    } catch (error) {
      const updatedQueue = this.getQueue().map((entry) =>
        entry.queueId === queueId
          ? {
              ...entry,
              retryCount: (entry.retryCount || 0) + 1,
              lastTriedAt: Date.now(),
              syncError: error.message
            }
          : entry
      );

      Store.saveQueue(updatedQueue);
      this.render();
      App.updateSyncQueueBadge();
      App.toast(error.message || 'Retry failed', 'error');
    }
  },

  findQueueItem(queueId) {
    return this.getQueue().find((item) => item.queueId === queueId);
  },

  deleteOne(queueId) {
    const item = this.findQueueItem(queueId);
    if (!item) {
      App.toast('Queue item not found', 'error');
      return;
    }

    App.openModal(
      'Delete Queued Action',
      `
        <p class="text-muted">
          Are you sure you want to remove this queued action?
        </p>

        <div class="sync-delete-preview">
          ${App.safeText(this.actionLabel(item.type))}
        </div>
      `,
      `
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-danger" id="deleteQueueItemBtn" onclick="SyncCenter.confirmDeleteOne('${queueId}')">Delete</button>
      `
    );
  },

  confirmDeleteOne(queueId) {
    const queue = this.getQueue().filter((item) => item.queueId !== queueId);
    Store.saveQueue(queue);

    App.closeModal();
    this.render();
    App.updateSyncQueueBadge();
    App.toast('Queued action removed', 'warning');
  },

  clearAll() {
    const queue = this.getQueue();

    if (!queue.length) {
      App.toast('Queue is already empty', 'info');
      return;
    }

    App.openModal(
      'Clear Sync Queue',
      `
        <p class="text-muted">
          Are you sure you want to remove all queued offline actions?
        </p>
        <p class="sync-clear-warning">
          This cannot be undone.
        </p>
      `,
      `
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-danger" id="clearAllQueueBtn" onclick="SyncCenter.confirmClearAll()">Clear All</button>
      `
    );
  },

  confirmClearAll() {
    Store.saveQueue([]);

    App.closeModal();
    this.render();
    App.updateSyncQueueBadge();
    App.toast('All queued actions cleared', 'warning');
  }
};