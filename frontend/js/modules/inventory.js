const Inventory = {
  currentFilter: 'all',

  render() {
    this.renderTable();
  },

  byId(id) {
    return document.getElementById(id);
  },

  getItems() {
    return Store.get('menuItems') || [];
  },

  getSearchText() {
    return (this.byId('inventorySearchInput')?.value || '').trim().toLowerCase();
  },

  setFilter(filter, el) {
    this.currentFilter = filter;

    document
      .querySelectorAll('#page-inventory .filter-chip')
      .forEach((chip) => chip.classList.remove('active'));

    if (el) {
      el.classList.add('active');
    }

    this.renderTable();
  },

  filter() {
    this.renderTable();
  },

  getFilteredItems() {
    let items = [...this.getItems()];
    const search = this.getSearchText();

    if (search) {
      items = items.filter((item) =>
        item.name.toLowerCase().includes(search) ||
        item.category.toLowerCase().includes(search)
      );
    }

    if (this.currentFilter === 'low') {
      items = items.filter((item) => item.stock > 0 && item.stock <= 10);
    } else if (this.currentFilter === 'out') {
      items = items.filter((item) => item.stock <= 0);
    }

    return items;
  },

  getMaxStock() {
    return Math.max(...this.getItems().map((item) => item.stock || 0), 1);
  },

  getStockMeta(item, maxStock) {
    const stock = Number(item.stock || 0);
    const percentage = (stock / maxStock) * 100;

    if (stock <= 0) {
      return {
        percentage,
        barColor: 'var(--danger)',
        badge: '<span class="badge badge-danger">Out of Stock</span>'
      };
    }

    if (stock <= 10) {
      return {
        percentage,
        barColor: 'var(--warning)',
        badge: '<span class="badge badge-warning">Low Stock</span>'
      };
    }

    return {
      percentage,
      barColor: 'var(--success)',
      badge: '<span class="badge badge-success">In Stock</span>'
    };
  },

  renderItemMedia(item) {
    if (item.imageUrl) {
      return `
        <img
          src="${App.safeText(item.imageUrl, '')}"
          alt="${App.safeText(item.name)}"
          class="inventory-item-image"
        >
      `;
    }

    return `
      <span class="inventory-item-emoji">
        ${App.safeText(item.emoji || '🍽️')}
      </span>
    `;
  },

  renderRow(item, maxStock) {
    const stockMeta = this.getStockMeta(item, maxStock);

    return `
      <tr>
        <td class="inventory-item-cell">
          <div class="inventory-item-wrap">
            <div class="inventory-item-thumb">
              ${this.renderItemMedia(item)}
            </div>

            <div>
              <div class="inventory-item-name">${App.safeText(item.name)}</div>
              <div class="inventory-item-desc">${App.safeText(item.description || '')}</div>
            </div>
          </div>
        </td>

        <td>${App.safeText(item.category)}</td>

        <td>
          <div class="inventory-stock-wrap">
            <span class="inventory-stock-count">${Number(item.stock || 0)}</span>
            <div class="stock-bar inventory-stock-bar">
              <div
                class="stock-bar-fill"
                style="width:${stockMeta.percentage}%;background:${stockMeta.barColor}"
              ></div>
            </div>
          </div>
        </td>

        <td>${stockMeta.badge}</td>

        <td>
          <button class="btn btn-secondary btn-xs" onclick="Inventory.restock('${item.id}')">
            + Restock
          </button>
        </td>
      </tr>
    `;
  },

  renderTable() {
    const body = this.byId('inventoryBody');
    if (!body) return;

    const items = this.getFilteredItems();
    const maxStock = this.getMaxStock();

    if (!items.length) {
      body.innerHTML = `
        <tr>
          <td colspan="5" class="inventory-empty-cell">
            No items found
          </td>
        </tr>
      `;
      return;
    }

    body.innerHTML = items.map((item) => this.renderRow(item, maxStock)).join('');
  },

  findItem(id) {
    return this.getItems().find((item) => item.id === id);
  },

  restock(id) {
    const item = this.findItem(id);
    if (!item) {
      App.toast('Item not found', 'error');
      return;
    }

    App.openModal(
      `Restock ${App.safeText(item.name)}`,
      `
        <div class="form-group">
          <label class="form-label">Add Stock Quantity</label>
          <input type="number" class="form-input" id="restockQty" value="20" min="1">
        </div>
      `,
      `
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="confirmRestockBtn" onclick="Inventory.confirmRestock('${id}')">
          Restock
        </button>
      `
    );
  },

  buildRestockPayload(item, qty) {
    return {
      name: item.name,
      category: item.category,
      price: item.price,
      stock: item.stock + qty,
      emoji: item.emoji || '🍽️',
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      imagePublicId: item.imagePublicId || ''
    };
  },

  updateItemLocally(id, qty) {
    const updatedItems = this.getItems().map((item) =>
      item.id === id
        ? { ...item, stock: item.stock + qty }
        : item
    );

    Store.setLocal('menuItems', updatedItems);
  },

  async confirmRestock(id) {
    const confirmBtn = this.byId('confirmRestockBtn');
    const qty = parseInt(this.byId('restockQty')?.value || '0', 10);

    if (qty <= 0) {
      App.toast('Please enter a valid quantity', 'warning');
      return;
    }

    const item = this.findItem(id);
    if (!item) {
      App.toast('Item not found', 'error');
      return;
    }

    const payload = this.buildRestockPayload(item, qty);

    App.setButtonLoading(confirmBtn, true, 'Saving...', 'Restock');

    if (!navigator.onLine) {
      try {
        Store.addToQueue({
          type: 'UPDATE_MENU_ITEM',
          itemId: id,
          payload
        });

        this.updateItemLocally(id, qty);

        App.closeModal();
        this.renderTable();
        App.toast(`Offline: Restock for ${item.name} queued (+${qty})`, 'warning');
      } finally {
        App.setButtonLoading(confirmBtn, false, 'Saving...', 'Restock');
      }
      return;
    }

    try {
      await Store.request(`/menu/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      await Store.fetchMenuItems();
      App.closeModal();
      this.renderTable();
      App.toast(`Restocked ${item.name} (+${qty})`, 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to restock item', 'error');
    } finally {
      App.setButtonLoading(confirmBtn, false, 'Saving...', 'Restock');
    }
  }
};