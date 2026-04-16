const FloorMap = {
  byId(id) {
    return document.getElementById(id);
  },

  getTables() {
    return Store.get('tables') || [];
  },

  getCategories() {
    return [
      {
        id: 'small',
        label: '2-Seater Tables',
        icon: '🍷',
        filter: (table) => table.seats <= 2
      },
      {
        id: 'medium',
        label: '4-Seater Tables',
        icon: '🍽️',
        filter: (table) => table.seats > 2 && table.seats <= 4
      },
      {
        id: 'large',
        label: '6-Seater Tables',
        icon: '🥂',
        filter: (table) => table.seats > 4 && table.seats <= 6
      },
      {
        id: 'xlarge',
        label: '8+ Seater Tables',
        icon: '🎉',
        filter: (table) => table.seats > 6
      }
    ];
  },

  render() {
    const container = this.byId('floorGridContainer');
    if (!container) return;

    const tables = this.getTables();

    if (!tables.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No tables found. Add a new table to begin.</p>
        </div>
      `;
      return;
    }

    const sections = this.getCategories()
      .map((category) => this.renderCategorySection(category, tables))
      .filter(Boolean)
      .join('');

    container.innerHTML = sections;
  },

  renderCategorySection(category, tables) {
    const categoryTables = tables.filter(category.filter);

    if (!categoryTables.length) {
      return '';
    }

    return `
      <div class="floor-category-section">
        <div class="floor-category-header">
          <div class="floor-category-icon">${category.icon}</div>
          <h3 class="floor-category-title">${App.safeText(category.label)}</h3>
          <span class="floor-category-badge">${categoryTables.length}</span>
        </div>

        <div class="premium-floor-grid">
          ${categoryTables.map((table) => this.renderTableCard(table)).join('')}
        </div>
      </div>
    `;
  },

  renderTableCard(table) {
    return `
      <div
        class="premium-table-card ${App.safeText(table.status, '')}"
        onclick="FloorMap.openEditModal('${table.id}')"
        title="Table ${App.safeText(table.number)} — ${App.safeText(table.seats)} seats"
      >
        <div class="table-glow-border"></div>
        <div class="table-status-indicator"></div>

        <div class="table-content">
          <div class="table-number">T${App.safeText(table.number)}</div>
          <div class="table-seats">${App.safeText(table.seats)} Seats</div>
          <div class="table-status-text">
            ${App.safeText(this.formatStatus(table.status))}
          </div>
        </div>

        ${
          table.offlineQueued
            ? `
              <div class="offline-sync-badge">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M21 12a9 9 0 11-2.64-6.36"></path>
                  <polyline points="21 3 21 9 15 9"></polyline>
                </svg>
              </div>
            `
            : ''
        }
      </div>
    `;
  },

  formatStatus(status) {
    if (!status) return '';
    return status.charAt(0).toUpperCase() + status.slice(1);
  },

  openAddModal() {
    const body = `
      <div class="modal-center-section">
        <div class="modal-big-icon">➕</div>
        <h3>Add New Table</h3>
        <p class="modal-subtext">Create a new dining table</p>
      </div>

      <div class="form-group">
        <label class="form-label">Table Number</label>
        <input type="number" class="form-input" id="newTableNumber" placeholder="e.g. 16" min="1">
      </div>

      <div class="form-group">
        <label class="form-label">Seats</label>
        <input type="number" class="form-input" id="newTableSeats" placeholder="e.g. 4" min="1" max="20" value="4">
      </div>

      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="newTableStatus">
          <option value="available">Available</option>
          <option value="occupied">Occupied</option>
          <option value="reserved">Reserved</option>
        </select>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveNewTableBtn" onclick="FloorMap.saveNewTable()">Add Table</button>
    `;

    App.openModal('Add Table', body, footer);
  },

  validateTableForm({ number, seats }) {
    if (!number || number < 1) {
      App.toast('Please enter a valid table number', 'error');
      return false;
    }

    if (!seats || seats < 1) {
      App.toast('Please enter valid seats count', 'error');
      return false;
    }

    return true;
  },

  getNewTableFormData() {
    return {
      number: parseInt(this.byId('newTableNumber')?.value || '0', 10),
      seats: parseInt(this.byId('newTableSeats')?.value || '0', 10),
      status: this.byId('newTableStatus')?.value || 'available'
    };
  },

  getEditTableFormData() {
    return {
      number: parseInt(this.byId('editTableNumber')?.value || '0', 10),
      seats: parseInt(this.byId('tableSeatsInput')?.value || '1', 10),
      status: this.byId('tableStatusSelect')?.value || 'available'
    };
  },

  buildOfflineTable(id, payload) {
    return {
      id,
      number: payload.number,
      seats: payload.seats,
      status: payload.status,
      offlineQueued: true
    };
  },

  async saveNewTable() {
    const saveBtn = this.byId('saveNewTableBtn');
    const payload = this.getNewTableFormData();

    if (!this.validateTableForm(payload)) return;

    App.setButtonLoading(saveBtn, true, 'Saving...', 'Add Table');

    if (!navigator.onLine) {
      try {
        const offlineTableId = Store.generateOfflineId('OFF-TABLE');

        Store.addToQueue({
          type: 'CREATE_TABLE',
          offlineTableId,
          payload
        });

        const offlineTable = this.buildOfflineTable(offlineTableId, payload);
        Store.setLocal('tables', [...this.getTables(), offlineTable]);

        App.closeModal();
        this.render();
        App.toast(`Offline: Table ${payload.number} queued for creation`, 'warning');
      } finally {
        App.setButtonLoading(saveBtn, false, 'Saving...', 'Add Table');
      }
      return;
    }

    try {
      await Store.request('/tables', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      await Store.fetchTables();
      App.closeModal();
      this.render();
      App.toast(`Table ${payload.number} added successfully`, 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to add table', 'error');
    } finally {
      App.setButtonLoading(saveBtn, false, 'Saving...', 'Add Table');
    }
  },

  findTable(id) {
    return this.getTables().find((table) => table.id === id);
  },

  openEditModal(id) {
    const table = this.findTable(id);
    if (!table) return;

    const body = `
      <div class="modal-center-section">
        <div class="modal-big-icon">🪑</div>
        <h3>Table ${App.safeText(table.number)}</h3>
        <p class="modal-subtext">${App.safeText(table.seats)} seats</p>
        ${
          table.offlineQueued
            ? `<p class="modal-warning-text">This table is pending sync</p>`
            : ''
        }
      </div>

      <div class="form-group">
        <label class="form-label">Table Number</label>
        <input type="number" class="form-input" id="editTableNumber" value="${Number(table.number || 0)}" min="1">
      </div>

      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="tableStatusSelect">
          <option value="available" ${table.status === 'available' ? 'selected' : ''}>Available</option>
          <option value="occupied" ${table.status === 'occupied' ? 'selected' : ''}>Occupied</option>
          <option value="reserved" ${table.status === 'reserved' ? 'selected' : ''}>Reserved</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Seats</label>
        <input type="number" class="form-input" id="tableSeatsInput" value="${Number(table.seats || 1)}" min="1" max="20">
      </div>
    `;

    const footer = `
      <button class="btn btn-danger" onclick="FloorMap.deleteTable('${id}')">Delete</button>
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveEditTableBtn" onclick="FloorMap.saveTable('${id}')">Save</button>
    `;

    App.openModal('Edit Table', body, footer);
  },

  async saveTable(id) {
    const saveBtn = this.byId('saveEditTableBtn');
    const payload = this.getEditTableFormData();

    if (!this.validateTableForm(payload)) return;

    App.setButtonLoading(saveBtn, true, 'Saving...', 'Save');

    if (!navigator.onLine) {
      try {
        Store.addToQueue({
          type: 'UPDATE_TABLE',
          tableId: id,
          payload
        });

        const updatedTables = this.getTables().map((table) =>
          table.id === id
            ? { ...table, ...payload, offlineQueued: true }
            : table
        );

        Store.setLocal('tables', updatedTables);

        App.closeModal();
        this.render();
        App.toast('Offline: Table update queued', 'warning');
      } finally {
        App.setButtonLoading(saveBtn, false, 'Saving...', 'Save');
      }
      return;
    }

    try {
      await Store.request(`/tables/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      await Store.fetchTables();
      App.closeModal();
      this.render();
      App.toast('Table updated successfully', 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to update table', 'error');
    } finally {
      App.setButtonLoading(saveBtn, false, 'Saving...', 'Save');
    }
  },

  deleteTable(id) {
    const table = this.findTable(id);
    if (!table) return;

    App.openModal(
      'Delete Table',
      `
        <p class="text-muted">
          Are you sure you want to delete <strong>Table ${App.safeText(table.number)}</strong>?
        </p>
        <p class="text-soft-delete">
          This action cannot be undone.
        </p>
      `,
      `
        <button class="btn btn-secondary" onclick="FloorMap.openEditModal('${id}')">Back</button>
        <button class="btn btn-danger" id="confirmDeleteTableBtn" onclick="FloorMap.confirmDelete('${id}')">Delete</button>
      `
    );
  },

  async confirmDelete(id) {
    const deleteBtn = this.byId('confirmDeleteTableBtn');
    const table = this.findTable(id);
    if (!table) return;

    App.setButtonLoading(deleteBtn, true, 'Deleting...', 'Delete');

    if (!navigator.onLine) {
      try {
        if (String(id).startsWith('OFF-TABLE-')) {
          const filteredQueue = Store.getQueue().filter((item) => {
            if (item.type === 'CREATE_TABLE' && item.offlineTableId === id) return false;
            if (item.type === 'UPDATE_TABLE' && item.tableId === id) return false;
            return true;
          });

          Store.saveQueue(filteredQueue);
        } else {
          Store.addToQueue({
            type: 'DELETE_TABLE',
            tableId: id
          });
        }

        const updatedTables = this.getTables().filter((entry) => entry.id !== id);
        Store.setLocal('tables', updatedTables);

        App.closeModal();
        this.render();
        App.toast(`Offline: Table ${table.number} deletion queued`, 'warning');
      } finally {
        App.setButtonLoading(deleteBtn, false, 'Deleting...', 'Delete');
      }
      return;
    }

    try {
      await Store.request(`/tables/${id}`, {
        method: 'DELETE'
      });

      await Store.fetchTables();
      App.closeModal();
      this.render();
      App.toast('Table deleted successfully', 'warning');
    } catch (error) {
      App.toast(error.message || 'Failed to delete table', 'error');
    } finally {
      App.setButtonLoading(deleteBtn, false, 'Deleting...', 'Delete');
    }
  }
};