const POS = {
  cart: [],
  filterCategory: 'All',
  searchText: '',

  render() {
    this.syncSearchState();
    this.renderFilters();
    this.renderMenuItems();
    this.renderTableSelect();
    this.renderCart();
  },

  byId(id) {
    return document.getElementById(id);
  },

  getMenuItems() {
    return Store.get('menuItems') || [];
  },

  getTables() {
    return Store.get('tables') || [];
  },

  getDiscountPercent() {
    return Store.getDiscountPercent ? Store.getDiscountPercent() : 0;
  },

  syncSearchState() {
    const input = this.byId('posSearchInput');
    this.searchText = (input?.value || '').trim().toLowerCase();
  },

  getCategories() {
    return ['All', ...new Set(this.getMenuItems().map((item) => item.category))];
  },

  getFilteredItems() {
    this.syncSearchState();

    let items = [...this.getMenuItems()];

    if (this.filterCategory !== 'All') {
      items = items.filter((item) => item.category === this.filterCategory);
    }

    if (this.searchText) {
      items = items.filter((item) =>
        item.name.toLowerCase().includes(this.searchText) ||
        item.category.toLowerCase().includes(this.searchText)
      );
    }

    return items;
  },

  renderFilters() {
    const container = this.byId('posFilterChips');
    if (!container) return;

    container.innerHTML = this.getCategories()
      .map((category) => `
        <div
          class="filter-chip ${category === this.filterCategory ? 'active' : ''}"
          onclick="POS.setCategory('${App.escapeHTML(category)}', this)"
        >
          ${App.safeText(category)}
        </div>
      `)
      .join('');
  },

  setCategory(category, el) {
    this.filterCategory = category;

    document
      .querySelectorAll('#posFilterChips .filter-chip')
      .forEach((chip) => chip.classList.remove('active'));

    if (el) {
      el.classList.add('active');
    }

    this.renderMenuItems();
  },

  filterItems() {
    this.syncSearchState();
    this.renderMenuItems();
  },

  renderMenuItems() {
    const container = this.byId('posMenuItems');
    if (!container) return;

    const items = this.getFilteredItems();

    if (!items.length) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <p>No items found</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map((item) => this.renderMenuCard(item)).join('');
  },

  renderMenuCard(item) {
    const isOutOfStock = item.stock <= 0;

    const media = item.imageUrl
      ? `
        <img
          src="${App.safeText(item.imageUrl, '')}"
          alt="${App.safeText(item.name)}"
          class="pos-food-image"
        >
      `
      : `
        <div class="food-emoji">${App.safeText(item.emoji || '🍽️')}</div>
      `;

    return `
      <div
        class="pos-food-card ${isOutOfStock ? 'out-of-stock' : ''}"
        onclick="${!isOutOfStock ? `POS.addToCart('${item.id}')` : ''}"
      >
        <div class="pos-food-media">
          ${media}
        </div>

        <div class="food-name">${App.safeText(item.name)}</div>
        <div class="food-price">${App.currency(item.price)}</div>
        <div class="food-stock">
          ${isOutOfStock ? 'Out of Stock' : `Stock: ${Number(item.stock || 0)}`}
        </div>
      </div>
    `;
  },

  renderTableSelect() {
    const select = this.byId('posTableSelect');
    if (!select) return;

    const currentValue = select.value;
    const tables = this.getTables();

    select.innerHTML =
      '<option value="">Select Table</option>' +
      tables
        .map((table) => `
          <option value="${table.id}" ${table.id === currentValue ? 'selected' : ''}>
            Table ${table.number} (${table.seats} seats) ${table.status !== 'available' ? '— ' + table.status : ''}
          </option>
        `)
        .join('');
  },

  addToCart(menuId) {
    const item = this.getMenuItems().find((entry) => entry.id === menuId);
    if (!item || item.stock <= 0) return;

    const existing = this.cart.find((entry) => entry.menuId === menuId);

    if (existing) {
      if (existing.qty >= item.stock) {
        App.toast('Not enough stock!', 'warning');
        return;
      }
      existing.qty += 1;
    } else {
      this.cart.push({
        menuId: item.id,
        name: item.name,
        price: item.price,
        qty: 1,
        emoji: item.emoji || '🍽️',
        imageUrl: item.imageUrl || ''
      });
    }

    this.renderCart();
    App.toast(`Added ${item.name}`, 'info');
  },

  removeFromCart(menuId) {
    this.cart = this.cart.filter((entry) => entry.menuId !== menuId);
    this.renderCart();
  },

  changeQty(menuId, delta) {
    const cartItem = this.cart.find((entry) => entry.menuId === menuId);
    if (!cartItem) return;

    const menuItem = this.getMenuItems().find((entry) => entry.id === menuId);
    cartItem.qty += delta;

    if (cartItem.qty <= 0) {
      this.cart = this.cart.filter((entry) => entry.menuId !== menuId);
    } else if (menuItem && cartItem.qty > menuItem.stock) {
      cartItem.qty = menuItem.stock;
      App.toast('Not enough stock!', 'warning');
    }

    this.renderCart();
  },

  async handleDiscountKeydown(event, input) {
    if (event.key === 'Enter') {
      event.preventDefault();
      await this.applyDiscountPercent(input.value);
      input.blur();
    }
  },

  async applyDiscountPercent(value) {
    try {
      await Store.updateDiscountPercent(value);
      this.renderCart();
      App.toast(`Global discount set to ${Store.getDiscountPercent()}%`, 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to update global discount', 'error');
    }
  },

  getCartTotals() {
    const taxRate = window.APP_CONFIG?.TAX_RATE || 0.05;
    const subtotal = this.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const tax = subtotal * taxRate;

    let discountPercent = this.getDiscountPercent();
    if (discountPercent < 0) discountPercent = 0;
    if (discountPercent > 100) discountPercent = 100;

    const discount = subtotal * (discountPercent / 100);
    const total = subtotal + tax - discount;

    return { subtotal, tax, discountPercent, discount, total };
  },

  renderCartItem(item) {
    const media = item.imageUrl
      ? `
        <img
          src="${App.safeText(item.imageUrl, '')}"
          alt="${App.safeText(item.name)}"
          class="pos-cart-item-image"
        >
      `
      : `
        <span class="pos-cart-item-emoji">${App.safeText(item.emoji || '🍽️')}</span>
      `;

    return `
      <div class="pos-cart-item">
        <div class="pos-cart-item-thumb">
          ${media}
        </div>

        <div class="item-info">
          <div class="item-name">${App.safeText(item.name)}</div>
          <div class="item-price">${App.currency(item.price)} each</div>
        </div>

        <div class="item-qty">
          <button onclick="POS.changeQty('${item.menuId}', -1)">−</button>
          <span>${item.qty}</span>
          <button onclick="POS.changeQty('${item.menuId}', 1)">+</button>
        </div>

        <div class="item-total">${App.currency(item.price * item.qty)}</div>

        <button class="item-remove" onclick="POS.removeFromCart('${item.menuId}')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    `;
  },

  renderCart() {
    const container = this.byId('posCartItems');
    const summary = this.byId('posCartSummary');
    const placeBtn = this.byId('posPlaceOrderBtn');

    if (!container || !summary || !placeBtn) return;

    if (!this.cart.length) {
      container.innerHTML = `
        <div class="empty-state">
          <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"></path>
          </svg>
          <p>No items added yet</p>
        </div>
      `;

      summary.style.display = 'none';
      placeBtn.disabled = true;
      return;
    }

    container.innerHTML = this.cart.map((item) => this.renderCartItem(item)).join('');

    const { subtotal, tax, discountPercent, discount, total } = this.getCartTotals();

    summary.innerHTML = `
      <div class="summary-row">
        <span>Subtotal</span>
        <span id="posSubtotal">${App.currency(subtotal)}</span>
      </div>

      <div class="summary-row">
        <span>Tax (${((window.APP_CONFIG?.TAX_RATE || 0.05) * 100).toFixed(0)}%)</span>
        <span id="posTax">${App.currency(tax)}</span>
      </div>

      <div class="summary-row pos-discount-row">
        <span>Global Discount %</span>
        <div class="pos-discount-input-wrap">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            class="pos-discount-input"
            value="${discountPercent}"
            onkeydown="POS.handleDiscountKeydown(event, this)"
            onblur="POS.applyDiscountPercent(this.value)"
          >
          <span class="pos-discount-percent">%</span>
        </div>
      </div>

      <div class="summary-row">
        <span>Discount Amount</span>
        <span id="posDiscount">-${App.currency(discount)}</span>
      </div>

      <div class="summary-row total">
        <span>Total</span>
        <span id="posTotal">${App.currency(total)}</span>
      </div>
    `;

    summary.style.display = 'block';
    placeBtn.disabled = false;
  },

  validateOrder(tableId) {
    if (!this.cart.length) {
      App.toast('Cart is empty', 'warning');
      return false;
    }

    if (!tableId) {
      App.toast('Please select a table', 'warning');
      return false;
    }

    return true;
  },

  buildOrderPayload(tableId) {
    const { subtotal, tax, discountPercent, discount, total } = this.getCartTotals();

    return {
      tableId,
      items: this.cart.map((item) => ({
  menuId: item.menuId,
  qty: item.qty,
  price: item.price
})),
      subtotal,
      tax,
      discountPercent,
      discount,
      total
    };
  },

  buildOfflineOrder(tableId) {
    const selectedTable = this.getTables().find((table) => table.id === tableId);
    const { subtotal, tax, discountPercent, discount, total } = this.getCartTotals();

    return {
      mongoId: null,
      id: `OFF-${Date.now()}`,
      tableId,
      table: selectedTable?.number || '',
      items: this.cart.map((item) => ({
        menuId: item.menuId,
        name: item.name,
        qty: item.qty,
        price: item.price
      })),
      subtotal,
      tax,
      discountPercent,
      discount,
      total,
      status: 'pending',
      timestamp: Date.now(),
      offlineQueued: true
    };
  },

  resetCart() {
    this.cart = [];
    this.renderCart();
  },

  async placeOrder() {
    const placeBtn = this.byId('posPlaceOrderBtn');
    const tableId = this.byId('posTableSelect')?.value || '';

    if (!this.validateOrder(tableId)) return;

    const payload = this.buildOrderPayload(tableId);

    App.setButtonLoading(placeBtn, true, 'Placing...', 'Place Order');

    if (!navigator.onLine) {
      try {
        Store.addToQueue({
          type: 'CREATE_ORDER',
          payload
        });

        const offlineOrder = this.buildOfflineOrder(tableId);
        Store.setLocal('orders', [offlineOrder, ...Store.get('orders')]);

        this.resetCart();
        App.updatePendingBadge();
        App.toast('You are offline. Order saved and queued for sync.', 'warning');
      } finally {
        App.setButtonLoading(placeBtn, false, 'Placing...', 'Place Order');
      }
      return;
    }

    try {
      const json = await Store.request('/orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      this.resetCart();

      await Store.fetchMenuItems();
      this.renderMenuItems();
      this.renderTableSelect();

      App.toast(`Order #${json.data.orderNumber} placed successfully!`, 'success');
      App.updatePendingBadge();
    } catch (error) {
      App.toast(error.message || 'Failed to place order', 'error');
    } finally {
      App.setButtonLoading(placeBtn, false, 'Placing...', 'Place Order');
    }
  }
};