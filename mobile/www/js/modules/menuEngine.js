const MenuEngine = {
  filterCategory: 'All',
  searchText: '',

  render() {
    this.syncSearchState();
    this.renderFilters();
    this.renderGrid();
  },

  byId(id) {
    return document.getElementById(id);
  },

  getItems() {
    return Store.get('menuItems') || [];
  },

  syncSearchState() {
    const input = this.byId('menuSearchInput');
    this.searchText = (input?.value || '').trim().toLowerCase();
  },

  getCategories() {
    return ['All', ...new Set(this.getItems().map((item) => item.category))];
  },

  getFilteredItems() {
    let items = [...this.getItems()];

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
    const container = this.byId('menuFilterChips');
    if (!container) return;

    const categories = this.getCategories();

    container.innerHTML = categories
      .map((category) => `
        <div
          class="filter-chip ${category === this.filterCategory ? 'active' : ''}"
          onclick="MenuEngine.setCategory('${App.escapeHTML(category)}', this)"
        >
          ${App.safeText(category)}
        </div>
      `)
      .join('');
  },

  setCategory(category, el) {
    this.filterCategory = category;

    document
      .querySelectorAll('#menuFilterChips .filter-chip')
      .forEach((chip) => chip.classList.remove('active'));

    if (el) {
      el.classList.add('active');
    }

    this.renderGrid();
  },

  filter() {
    this.syncSearchState();
    this.renderGrid();
  },

  renderGrid() {
    const container = this.byId('menuGrid');
    if (!container) return;

    const items = this.getFilteredItems();

    if (!items.length) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <p>No menu items found</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map((item) => this.renderCard(item)).join('');
  },

  renderCard(item) {
    const stockBadgeClass =
      item.stock <= 0
        ? 'badge-danger'
        : item.stock <= 10
          ? 'badge-warning'
          : 'badge-success';

    const imageHtml = item.imageUrl
      ? `
        <img
          src="${App.safeText(item.imageUrl, '')}"
          alt="${App.safeText(item.name)}"
          class="menu-item-image"
        >
      `
      : `
        <div class="menu-item-emoji-wrap">
          ${App.safeText(item.emoji || '🍽️')}
        </div>
      `;

    return `
      <div class="menu-card">
        <div class="menu-card-img menu-item-media">
          ${imageHtml}
        </div>

        <div class="menu-card-body">
          <h4>${App.safeText(item.name)}</h4>
          <div class="menu-category">${App.safeText(item.category)}</div>
          <div class="menu-item-description">
            ${App.safeText(item.description || '')}
          </div>
          <div class="menu-price">${App.currency(item.price)}</div>

          <div class="menu-item-stock-row">
            <span class="badge ${stockBadgeClass}">
              Stock: ${Number(item.stock || 0)}
            </span>
          </div>
        </div>

        <div class="menu-card-footer">
          <button class="btn btn-secondary btn-xs" onclick="MenuEngine.openEditModal('${item.id}')">
            Edit
          </button>
          <button class="btn btn-danger btn-xs" onclick="MenuEngine.deleteItem('${item.id}')">
            Delete
          </button>
        </div>
      </div>
    `;
  },

  getEmojiOptions() {
    return [
      '🍔', '🥩', '🍝', '🍛', '🌮', '🍗', '🐟', '🥗', '🧆', '🍤',
      '🥟', '🍰', '🧁', '🍮', '🍨', '☕', '🥤', '🍹', '🍺', '🍟',
      '🥖', '🌽', '🧀', '🫔', '🎂', '🧃', '🍕', '🍣'
    ];
  },

  openAddModal() {
    const categories = [...new Set(this.getItems().map((item) => item.category))];
    const categoryOptions = categories
      .map((category) => `<option value="${App.safeText(category, '')}">${App.safeText(category)}</option>`)
      .join('');

    const emojiOptions = this.getEmojiOptions()
      .map((emoji) => `
        <span
          class="emoji-opt"
          onclick="MenuEngine.selectEmoji('${emoji}', this)"
        >
          ${emoji}
        </span>
      `)
      .join('');

    const body = `
      <div class="form-group">
        <label class="form-label">Item Name</label>
        <input type="text" class="form-input" id="menuItemName" placeholder="e.g. Margherita Pizza">
      </div>

      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-select" id="menuItemCategory">
          ${categoryOptions}
          <option value="__new">+ New Category</option>
        </select>
      </div>

      <div class="form-group" id="newCatGroup" style="display:none">
        <label class="form-label">New Category Name</label>
        <input type="text" class="form-input" id="menuItemNewCategory" placeholder="Category name">
      </div>

      <div class="form-grid-two">
        <div class="form-group">
         <label class="form-label">Price (${window.APP_CONFIG?.CURRENCY_CODE || 'BDT'})</label>
          <input type="number" class="form-input" id="menuItemPrice" placeholder="0.00" step="0.01" min="0">
        </div>

        <div class="form-group">
          <label class="form-label">Stock</label>
          <input type="number" class="form-input" id="menuItemStock" placeholder="0" min="0">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Image</label>
        <input type="file" class="form-input" id="menuItemImage" accept="image/*">
      </div>

      <div class="form-group">
        <label class="form-label">Emoji Fallback</label>
        <div class="emoji-picker" id="emojiPicker">
          ${emojiOptions}
        </div>
        <input type="hidden" id="menuItemEmoji" value="🍽️">
      </div>

      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="menuItemDesc" placeholder="Brief description..." rows="2"></textarea>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveMenuItemBtn" onclick="MenuEngine.saveNewItem()">Add Item</button>
    `;

    App.openModal('Add Menu Item', body, footer);

    const categorySelect = this.byId('menuItemCategory');
    if (categorySelect) {
      categorySelect.addEventListener('change', function () {
        const group = document.getElementById('newCatGroup');
        if (group) {
          group.style.display = this.value === '__new' ? 'block' : 'none';
        }
      });
    }
  },

  selectEmoji(emoji, el) {
    document.querySelectorAll('.emoji-opt').forEach((node) => {
      node.classList.remove('selected');
    });

    if (el) {
      el.classList.add('selected');
    }

    const hiddenInput = this.byId('menuItemEmoji');
    if (hiddenInput) {
      hiddenInput.value = emoji;
    }
  },

  validateItemForm({ name, category, price }) {
    if (!name || !category || price <= 0) {
      App.toast('Please fill in all required fields', 'error');
      return false;
    }

    return true;
  },

  buildFormData(data) {
    const formData = new FormData();

    formData.append('name', data.name);
    formData.append('category', data.category);
    formData.append('price', data.price);
    formData.append('stock', data.stock);
    formData.append('emoji', data.emoji);
    formData.append('description', data.description);

    if (data.imageFile) {
      formData.append('image', data.imageFile);
    }

    return formData;
  },

  async saveNewItem() {
    const saveBtn = this.byId('saveMenuItemBtn');

    const name = (this.byId('menuItemName')?.value || '').trim();
    const categorySelection = this.byId('menuItemCategory')?.value || '';
    const category =
      categorySelection === '__new'
        ? (this.byId('menuItemNewCategory')?.value || '').trim()
        : categorySelection;

    const price = parseFloat(this.byId('menuItemPrice')?.value || '0');
    const stock = parseInt(this.byId('menuItemStock')?.value || '0', 10);
    const emoji = this.byId('menuItemEmoji')?.value || '🍽️';
    const description = (this.byId('menuItemDesc')?.value || '').trim();
    const imageFile = this.byId('menuItemImage')?.files?.[0] || null;

    if (!this.validateItemForm({ name, category, price })) {
      return;
    }

    App.setButtonLoading(saveBtn, true, 'Saving...', 'Add Item');

    try {
      const formData = this.buildFormData({
        name,
        category,
        price,
        stock,
        emoji,
        description,
        imageFile
      });

      await Store.request('/menu', {
        method: 'POST',
        body: formData
      });

      await Store.fetchMenuItems();
      App.closeModal();
      this.render();
      App.toast(`"${name}" added to menu`, 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to add item', 'error');
    } finally {
      App.setButtonLoading(saveBtn, false, 'Saving...', 'Add Item');
    }
  },

  openEditModal(id) {
    const item = this.getItems().find((entry) => entry.id === id);
    if (!item) return;

    const categories = [...new Set(this.getItems().map((entry) => entry.category))];
    const categoryOptions = categories
      .map((category) => `
        <option value="${App.safeText(category, '')}" ${category === item.category ? 'selected' : ''}>
          ${App.safeText(category)}
        </option>
      `)
      .join('');

    const currentImageHtml = item.imageUrl
      ? `
        <div class="form-group">
          <label class="form-label">Current Image</label>
          <div class="menu-current-image-wrap">
            <img
              src="${App.safeText(item.imageUrl, '')}"
              alt="${App.safeText(item.name)}"
              class="menu-current-image"
            >
          </div>
        </div>
      `
      : '';

    const body = `
      <div class="form-group">
        <label class="form-label">Item Name</label>
        <input type="text" class="form-input" id="editItemName" value="${App.safeText(item.name, '')}">
      </div>

      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-select" id="editItemCategory">
          ${categoryOptions}
        </select>
      </div>

      <div class="form-grid-two">
        <div class="form-group">
          <label class="form-label">Price (${window.APP_CONFIG?.CURRENCY_CODE || 'BDT'})</label>
          <input type="number" class="form-input" id="editItemPrice" value="${Number(item.price || 0)}" step="0.01" min="0">
        </div>

        <div class="form-group">
          <label class="form-label">Stock</label>
          <input type="number" class="form-input" id="editItemStock" value="${Number(item.stock || 0)}" min="0">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Replace Image (optional)</label>
        <input type="file" class="form-input" id="editItemImage" accept="image/*">
      </div>

      ${currentImageHtml}

      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="editItemDesc" rows="2">${App.safeText(item.description || '', '')}</textarea>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveEditMenuBtn" onclick="MenuEngine.saveEdit('${id}')">Save Changes</button>
    `;

    App.openModal('Edit Menu Item', body, footer);
  },

  async saveEdit(id) {
    const item = this.getItems().find((entry) => entry.id === id);
    if (!item) return;

    const saveBtn = this.byId('saveEditMenuBtn');

    const name = (this.byId('editItemName')?.value || '').trim();
    const category = this.byId('editItemCategory')?.value || '';
    const price = parseFloat(this.byId('editItemPrice')?.value || '0');
    const stock = parseInt(this.byId('editItemStock')?.value || '0', 10);
    const description = (this.byId('editItemDesc')?.value || '').trim();
    const imageFile = this.byId('editItemImage')?.files?.[0] || null;

    if (!this.validateItemForm({ name, category, price })) {
      return;
    }

    App.setButtonLoading(saveBtn, true, 'Saving...', 'Save Changes');

    try {
      const formData = this.buildFormData({
        name,
        category,
        price,
        stock,
        emoji: item.emoji || '🍽️',
        description,
        imageFile
      });

      await Store.request(`/menu/${id}`, {
        method: 'PUT',
        body: formData
      });

      await Store.fetchMenuItems();
      App.closeModal();
      this.render();
      App.toast(`"${name}" updated`, 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to update item', 'error');
    } finally {
      App.setButtonLoading(saveBtn, false, 'Saving...', 'Save Changes');
    }
  },

  deleteItem(id) {
    const item = this.getItems().find((entry) => entry.id === id);
    if (!item) return;

    App.openModal(
      'Delete Item',
      `
        <p class="text-muted">
          Are you sure you want to delete <strong>"${App.safeText(item.name)}"</strong>?
        </p>
      `,
      `
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-danger" id="deleteMenuItemBtn" onclick="MenuEngine.confirmDelete('${id}')">Delete</button>
      `
    );
  },

  async confirmDelete(id) {
    const deleteBtn = this.byId('deleteMenuItemBtn');

    App.setButtonLoading(deleteBtn, true, 'Deleting...', 'Delete');

    try {
      await Store.request(`/menu/${id}`, {
        method: 'DELETE'
      });

      await Store.fetchMenuItems();
      App.closeModal();
      this.render();
      App.toast('Item deleted', 'warning');
    } catch (error) {
      App.toast(error.message || 'Failed to delete item', 'error');
    } finally {
      App.setButtonLoading(deleteBtn, false, 'Deleting...', 'Delete');
    }
  }
};