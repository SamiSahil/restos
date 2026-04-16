const PublicHome = {
  cart: [],
  filterCategory: 'All',
  selectedTableId: '',
  searchText: '',
  reviewRating: 5,

  trackingHistoryKey: 'restaurantos_tracking_history',

  _paymentHandler: null,

  // ----------------------------
  // Main render
  // ----------------------------
  render() {
    this.renderLayout();
    this.renderTopBarBadges();
    this.renderFeatured();
    this.renderFilters();
    this.renderMenuGrid();
    this.renderReviewsSection();
    this.updateCartBadge();
  },

  byId(id) {
    return document.getElementById(id);
  },

  // ---------- Store getters ----------
  getMenuItems() {
    return Store.get('menuItems') || [];
  },

  getTables() {
    return Store.get('tables') || [];
  },

  getOrders() {
    return Store.get('orders') || [];
  },

  getFeedback() {
    return Store.get('feedback') || [];
  },

  getTopItems() {
    return Store.get('topItems') || [];
  },

  getDiscountPercent() {
    return Store.getDiscountPercent ? Store.getDiscountPercent() : 0;
  },

  getTaxRate() {
    return window.APP_CONFIG?.TAX_RATE || 0.05;
  },

openMobileNav() {
  const body = `
    <div class="modal-stack">
      <button class="btn btn-secondary" onclick="PublicHome.scrollToTopFromNav()">Home</button>
      <button class="btn btn-secondary" onclick="PublicHome.scrollToSectionFromNav('menu')">Menu</button>
      <button class="btn btn-secondary" onclick="PublicHome.scrollToSectionFromNav('reviews')">Reviews</button>
      <button class="btn btn-secondary" onclick="PublicHome.openAboutFromNav()">About</button>

      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:6px 0">

      <!-- ✅ Staff login in same color -->
      <button class="lp__ctaBtn lp__ctaBtn--menu" type="button" onclick="PublicHome.openStaffLoginFromNav()">
        Staff Login
      </button>
    </div>
  `;

  App.openModal('Menu', body, `<button class="btn btn-secondary" onclick="App.closeModal()">Close</button>`);
},

openStaffLoginFromNav() {
  App.closeModal();
  // small delay so modal transitions don't clash
  setTimeout(() => App.openLoginModal(), 50);
},

scrollToTopFromNav() {
  App.closeModal();
  window.scrollTo({ top: 0, behavior: 'smooth' });
},

scrollToSectionFromNav(id) {
  App.closeModal();
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
},

openAboutFromNav() {
  App.closeModal();
  // reuse your existing About modal
  setTimeout(() => PublicHome.showAbout(), 50);
},

  // ============================================================
  // HERO + FEATURED (Best Selling)
  // ============================================================
  renderLayout() {
    const page = this.byId('page-home');
    if (!page) return;

    const discountPercent = this.getDiscountPercent();

    page.innerHTML = `
      <section class="lp" id="publicLanding">
        <header class="lp__nav">
          <div class="lp__brand">
            <span class="lp__logo">RestOS</span>
          </div>

          <nav class="lp__links">
            <a href="#home" onclick="event.preventDefault(); window.scrollTo({top:0,behavior:'smooth'})">Home</a>
            <a href="#menu" onclick="event.preventDefault(); document.getElementById('menu').scrollIntoView({behavior:'smooth'})">Menu</a>
            <a href="#reviews" onclick="event.preventDefault(); document.getElementById('reviews').scrollIntoView({behavior:'smooth'})">Reviews</a>
            <a href="#about" onclick="event.preventDefault(); PublicHome.showAbout()">About</a>
          </nav>

          <div class="lp__actions">
            <button class="lp__iconBtn" type="button" aria-label="Cart" onclick="PublicHome.openCartModal()">
              🛒
              <span class="lp__badge" id="lpCartBadge" style="display:none">0</span>
            </button>
            <button class="lp__ctaBtn" type="button" onclick="App.openLoginModal()">Staff Login</button>
             <button class="lp__hamburger" type="button" aria-label="Menu" onclick="PublicHome.openMobileNav()">
    ☰
  </button>
          </div>
        </header>

        <div class="lp__hero">
          <div class="lp__heroLeft">
            <div class="lp__kicker">
              Fresh food • Fast service
              ${discountPercent > 0 ? `<span class="lp__discount">-${discountPercent}% Discount Available</span>` : ``}
            </div>

            <h1 class="lp__title">It’s not just Food, It’s an Experience.</h1>

            <div class="lp__ctaRow">
              <button class="lp__primary" type="button"
                onclick="document.getElementById('menu').scrollIntoView({behavior:'smooth'})">
                View Menu
              </button>
              <button class="lp__secondary" type="button" onclick="PublicHome.openCartModal()">
                Book A Table
              </button>
              <button class="lp__ghost" type="button" onclick="PublicHome.openTrackOrderModal()">
                Track Order
              </button>
            </div>

            <div class="lp__reviews">
              
              <div class="lp__reviewsMeta">Order & pay easily with bKash/Nagad/Rocket</div>
            </div>
          </div>

          <div class="lp__heroRight">
            <div class="lp__dishWrap">
              <img
                class="lp__dish"
                src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                alt="Dish"
              />
            </div>
          </div>
        </div>

        <div class="lp__featured">
          <div class="lp__featuredHeader">
            <h3>Best Selling</h3>
            <div class="lp__featuredControls">
              <button class="lp__arrow" type="button" onclick="PublicHome.scrollFeatured(-1)">←</button>
              <button class="lp__arrow" type="button" onclick="PublicHome.scrollFeatured(1)">→</button>
            </div>
          </div>

          <div class="lp__cards" id="featuredRow"></div>
        </div>
      </section>

      <!-- Menu section anchor -->
      <div id="menu" style="height:1px"></div>

      <section class="lp lp--content">
        <div class="public-menu-controls">
          <div class="search-input public-search-wrap">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="M21 21l-4.35-4.35"></path>
            </svg>
            <input type="text" placeholder="Search dishes..." id="publicMenuSearch" oninput="PublicHome.filterMenu()">
          </div>
          <div class="filter-chips" id="publicMenuFilterChips"></div>
        </div>

        <div class="menu-grid" id="publicMenuGrid"></div>

        <div id="reviews" style="height:1px"></div>
        <div id="publicReviewsSection"></div>
      </section>
    `;
  },

  renderTopBarBadges() {
    this.updateCartBadge();
  },

  scrollFeatured(dir) {
    const row = document.getElementById('featuredRow');
    if (!row) return;
    row.scrollBy({ left: dir * 320, behavior: 'smooth' });
  },

  // Map Store.topItems => MenuItem objects
  getBestSellingMenuItems(limit = 10) {
    const top = this.getTopItems();
    const menu = this.getMenuItems();

    const mapped = (top || [])
      .map((t) => {
        const item = menu.find((m) => String(m.id) === String(t.menuItemId));
        if (!item) return null;
        return {
          ...item,
          soldQty: Number(t.qty || 0),
          soldRevenue: Number(t.revenue || 0)
        };
      })
      .filter(Boolean);

    if (mapped.length) return mapped.slice(0, limit);

    return [...menu]
      .filter((x) => (x.stock ?? 0) > 0)
      .slice(0, limit);
  },

  renderFeaturedCard(item) {
    const img = item.imageUrl
      ? `<img class="lp__cardImg" src="${App.safeText(item.imageUrl, '')}" alt="${App.safeText(item.name)}">`
      : `<div class="lp__cardImg lp__cardImgFallback">${App.safeText(item.emoji || '🍽️')}</div>`;

    const out = (item.stock ?? 0) <= 0;

    const soldLine =
      item.soldQty != null
        ? `<div class="lp__cardSub">Sold: <strong>${Number(item.soldQty)}</strong></div>`
        : `<div class="lp__cardSub">${App.safeText(item.category || '')}</div>`;

    return `
      <article class="lp__card">
        ${img}
        <div class="lp__cardBody">
          <div class="lp__cardTitle">${App.safeText(item.name)}</div>
          ${soldLine}

          <div class="lp__cardBottom">
            <span class="lp__price">${App.currency(item.price || 0)}</span>
            <button
              class="lp__miniCart"
              type="button"
              ${out ? 'disabled style="opacity:0.45;cursor:not-allowed"' : ''}
              onclick="PublicHome.addToCart('${item.id}')"
              title="${out ? 'Out of stock' : 'Add to cart'}"
            >+</button>
          </div>
        </div>
      </article>
    `;
  },

  renderFeatured() {
    const row = document.getElementById('featuredRow');
    if (!row) return;

    const items = this.getBestSellingMenuItems(10);

    if (!items.length) {
      row.innerHTML = `<div class="panel-muted">No items to show</div>`;
      return;
    }

    row.innerHTML = items.map((it) => this.renderFeaturedCard(it)).join('');
  },

  // ============================================================
  // ONLINE PAYMENT HELPERS
  // ============================================================
  isOnlinePaymentMethod(method) {
    return ['bKash', 'Nagad', 'Rocket'].includes(String(method || '').trim());
  },

  getPaymentMeta(method) {
    const map = window.APP_CONFIG?.ONLINE_PAYMENTS || {};
    return map[String(method || '').trim()] || null;
  },

  async copyText(text, msg = 'Copied') {
    const value = String(text || '').trim();
    if (!value) return App.toast('Nothing to copy', 'warning');

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement('textarea');
        ta.value = value;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      App.toast(msg, 'success');
    } catch {
      App.toast('Copy failed', 'error');
    }
  },

  bindPaymentActions() {
    const root = document.getElementById('modalBody');
    if (!root) return;

    if (this._paymentHandler) {
      root.removeEventListener('click', this._paymentHandler);
    }

    this._paymentHandler = async (e) => {
      const openBtn = e.target.closest('.js-open-qr');
      if (openBtn) {
        const method = openBtn.dataset.method;
        this.openQrPreview(method);
        return;
      }

      const dlBtn = e.target.closest('.js-download-qr');
      if (dlBtn) {
        const method = dlBtn.dataset.method;
        this.downloadQr(method);
        return;
      }

      const copyBtn = e.target.closest('.js-copy-merchant');
      if (copyBtn) {
        const merchant = copyBtn.dataset.merchant || '';
        await this.copyText(merchant, 'Merchant number copied');
        return;
      }
    };

    root.addEventListener('click', this._paymentHandler);
  },

  openQrPreview(method) {
    const meta = this.getPaymentMeta(method);
    if (!meta?.qrImage) return App.toast('QR not configured', 'warning');

    const merchant = String(meta.merchantNumber || '-').trim();

    App.openModal(
      `${App.safeText(method)} QR`,
      `
        <div class="modal-stack">
          <div style="display:flex;justify-content:center">
            <img
              src="${meta.qrImage}"
              alt="${App.safeText(method)} QR"
              style="width:260px;height:260px;object-fit:cover;border-radius:16px;border:1px solid rgba(255,255,255,0.08)"
            >
          </div>

          <div class="panel-muted">
            <div style="font-weight:900;margin-bottom:6px">Merchant Number</div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <code style="padding:8px 10px;border-radius:10px;background:rgba(255,255,255,0.06);color:#fff;font-weight:900">
                ${App.safeText(merchant)}
              </code>

              <button
                type="button"
                class="btn btn-secondary btn-xs js-copy-merchant"
                data-merchant="${App.escapeHTML(merchant)}"
              >Copy</button>
            </div>

            <div class="text-soft" style="margin-top:8px">
              If you cannot scan on this phone, use <strong>Send Money/Payment</strong> to this merchant number.
            </div>
          </div>

          <div class="panel-info">
            Tip: Some apps support <strong>Scan from Gallery</strong>. Save this QR and try scanning from gallery inside your payment app.
          </div>
        </div>
      `,
      `
        <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
        <button type="button" class="btn btn-primary js-download-qr" data-method="${App.escapeHTML(method)}">Download QR</button>
      `
    );

    this.bindPaymentActions();
  },

  downloadQr(method) {
    const meta = this.getPaymentMeta(method);
    if (!meta?.qrImage) return App.toast('QR not configured', 'warning');

    const a = document.createElement('a');
    a.href = meta.qrImage;
    a.download = `${String(method || 'payment')}-qr`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    App.toast('QR download started (or opened by browser)', 'info');
  },

  renderOnlinePaymentBox(method, amount) {
    const meta = this.getPaymentMeta(method);
    const merchant = String(meta?.merchantNumber || '').trim();
    const qr = String(meta?.qrImage || '').trim();

    const merchantBlock = merchant
      ? `
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px">
          <div class="text-soft">Merchant Number:</div>
          <code style="padding:8px 10px;border-radius:10px;background:rgba(255,255,255,0.06);color:#fff;font-weight:900">
            ${App.safeText(merchant)}
          </code>
          <button
            class="btn btn-secondary btn-xs js-copy-merchant"
            type="button"
            data-merchant="${App.escapeHTML(merchant)}"
          >Copy</button>
        </div>
      `
      : `<div class="panel-warning" style="margin-top:10px">Merchant number is not configured.</div>`;

    const qrBlock = qr
      ? `
        <div style="display:flex;justify-content:center;margin-top:10px">
          <img
            src="${qr}"
            alt="${App.safeText(method)} QR"
            class="js-open-qr"
            data-method="${App.escapeHTML(method)}"
            style="width:180px;height:180px;object-fit:cover;border-radius:14px;border:1px solid rgba(255,255,255,0.08);cursor:pointer"
          >
        </div>

        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px">
          <button class="btn btn-secondary btn-xs js-open-qr" type="button" data-method="${App.escapeHTML(method)}">Open QR</button>
          <button class="btn btn-secondary btn-xs js-download-qr" type="button" data-method="${App.escapeHTML(method)}">Download QR</button>
        </div>

        <div class="text-soft" style="text-align:center;margin-top:8px">
          Tap QR to open. If your payment app supports it, try <strong>Scan from Gallery</strong>.
        </div>
      `
      : `<div class="panel-warning" style="margin-top:10px">QR image is not configured.</div>`;

    return `
      <div id="publicOnlinePaymentBox" style="margin-top:12px">
        <div class="panel-muted">
          <div style="font-weight:900">Online Payment: ${App.safeText(method)}</div>
          <div class="text-soft" style="margin-top:6px">
            Amount to pay: <strong style="color:var(--accent)">${App.currency(amount)}</strong>
          </div>

          ${qrBlock}
          ${merchantBlock}

          <div class="panel-info" style="margin-top:12px">
            If you cannot scan on this phone:
            open <strong>${App.safeText(method)}</strong> → choose <strong>Send Money/Payment</strong> →
            pay to the merchant number above → then come back and enter your Transaction ID.
          </div>
        </div>

        <div class="form-group" style="margin-top:12px">
          <label class="form-label">Transaction ID (required)</label>
          <input class="form-input" id="publicTransactionId" placeholder="Enter transaction ID">
        </div>
      </div>
    `;
  },

  togglePaymentMethodFields() {
    const method = this.byId('publicPaymentMethod')?.value || 'cash';
    const wrap = this.byId('publicOnlinePaymentWrap');
    if (!wrap) return;

    const { total } = this.getCartTotals();

    if (!this.isOnlinePaymentMethod(method)) {
      wrap.innerHTML = '';
      return;
    }

    wrap.innerHTML = this.renderOnlinePaymentBox(method, total);
    this.bindPaymentActions();
  },

  // ============================================================
  // Menu Search/Filters/Grid
  // ============================================================
  syncSearchState() {
    const input = this.byId('publicMenuSearch');
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
    const container = this.byId('publicMenuFilterChips');
    if (!container) return;

    container.innerHTML = this.getCategories()
      .map((category) => `
        <div class="filter-chip ${category === this.filterCategory ? 'active' : ''}"
             onclick="PublicHome.setCategory('${App.escapeHTML(category)}', this)">
          ${App.safeText(category)}
        </div>
      `)
      .join('');
  },

  setCategory(category, el) {
    this.filterCategory = category;
    document.querySelectorAll('#publicMenuFilterChips .filter-chip').forEach((chip) => chip.classList.remove('active'));
    if (el) el.classList.add('active');
    this.renderMenuGrid();
  },

  filterMenu() {
    this.syncSearchState();
    this.renderMenuGrid();
  },

  renderMenuGrid() {
    const grid = this.byId('publicMenuGrid');
    if (!grid) return;

    const items = this.getFilteredItems();
    if (!items.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>No menu items found</p></div>`;
      return;
    }

    grid.innerHTML = items.map((item) => this.renderMenuCard(item)).join('');
  },

 renderMenuCard(item) {
  const img = item.imageUrl
    ? `<img class="lp__cardImg" src="${App.safeText(item.imageUrl, '')}" alt="${App.safeText(item.name)}">`
    : `<div class="lp__cardImg lp__cardImgFallback">${App.safeText(item.emoji || '🍽️')}</div>`;

  const out = (item.stock ?? 0) <= 0;

  const desc = (item.description || '').trim();
  const shortDesc = desc.length > 70 ? desc.slice(0, 70) + '...' : desc;

  return `
    <article class="lp__card lp__menuCard">
      ${img}
      <div class="lp__cardBody">
        <div class="lp__cardTitle">${App.safeText(item.name)}</div>

        <div class="lp__cardSub lp__desc">
          ${App.safeText(shortDesc || '—')}
        </div>

        <div class="lp__cardBottom">
          <span class="lp__price">${App.currency(item.price || 0)}</span>
          <button
            class="lp__miniCart"
            type="button"
            ${out ? 'disabled style="opacity:0.45;cursor:not-allowed"' : ''}
            onclick="PublicHome.addToCart('${item.id}')"
            title="${out ? 'Out of stock' : 'Add to cart'}"
          >+</button>
        </div>
      </div>
    </article>
  `;
},

  // ---------- About ----------
 showAbout() {
  const phone = '+880 1903048550';
  const address = 'Uttara, Food City, Dhaka-1230';

  App.openModal(
    'About RestaurantOS',
    `
      <div class="modal-stack">

        <div class="panel-muted">
          <strong>Restaurant</strong><br>
          RestOS<br>
          <span class="text-soft">${App.safeText(address)}</span>
        </div>

        <div class="panel-muted">
          <strong>Contact</strong><br>
          Phone: <strong>${App.safeText(phone)}</strong>
          <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
            <a class="btn btn-secondary btn-sm" href="tel:${phone.replace(/\s+/g,'')}" style="text-decoration:none">Call Now</a>
            <a class="btn btn-secondary btn-sm" href="https://wa.me/${phone.replace(/[^\d]/g,'')}" target="_blank" style="text-decoration:none">WhatsApp</a>
          </div>
        </div>

        <div class="panel-info">
          <strong>Track your order</strong><br>
          Use your tracking code after placing an order to see live status.
          <div style="margin-top:10px">
            <button class="btn btn-primary btn-sm" onclick="App.closeModal(); PublicHome.openTrackOrderModal();">
              Track Order
            </button>
          </div>
        </div>

        <div class="panel-muted">
          <strong>Online payment instructions</strong><br>
          Scan QR if possible or pay manually to merchant number. Then enter your <strong>Transaction ID</strong>.
          Staff will verify and complete billing.
        </div>

        <div class="panel-muted">
          <strong>Support</strong><br>
          For order issues (wrong item / late delivery), please contact us with your order number or tracking code.
        </div>

      </div>
    `,
    `<button class="btn btn-primary" onclick="App.closeModal()">Close</button>`
  );
},

  // ============================================================
  // Cart
  // ============================================================
  getCartCount() {
    return this.cart.reduce((sum, item) => sum + item.qty, 0);
  },

  updateCartBadge() {
    const count = this.getCartCount();

    const heroBadge = document.getElementById('lpCartBadge');
    if (heroBadge) {
      heroBadge.textContent = count;
      heroBadge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  },

  addToCart(menuId) {
    const item = this.getMenuItems().find((entry) => entry.id === menuId);
    if (!item) return;

    const existing = this.cart.find((entry) => entry.menuId === menuId);

    if (existing) {
      if (existing.qty >= item.stock) return App.toast('Not enough stock available', 'warning');
      existing.qty += 1;
    } else {
      this.cart.push({
        menuId: item.id,
        name: item.name,
        price: item.price,
        qty: 1,
        imageUrl: item.imageUrl || '',
        emoji: item.emoji || '🍽️'
      });
    }

    this.updateCartBadge();
    App.toast(`${item.name} added to cart`, 'success');
  },

  getCartTotals() {
    const taxRate = this.getTaxRate();
    const subtotal = this.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const tax = subtotal * taxRate;

    let discountPercent = this.getDiscountPercent();
    discountPercent = Math.max(0, Math.min(100, Number(discountPercent || 0)));

    const discount = subtotal * (discountPercent / 100);
    const total = subtotal + tax - discount;
    return { subtotal, tax, discountPercent, discount, total };
  },

  changeCartQty(menuId, delta) {
    const cartItem = this.cart.find((entry) => entry.menuId === menuId);
    if (!cartItem) return;

    const menuItem = this.getMenuItems().find((entry) => entry.id === menuId);
    cartItem.qty += delta;

    if (cartItem.qty <= 0) this.cart = this.cart.filter((entry) => entry.menuId !== menuId);
    else if (menuItem && cartItem.qty > menuItem.stock) {
      cartItem.qty = menuItem.stock;
      App.toast('Not enough stock available', 'warning');
    }

    this.updateCartBadge();

    if (!this.cart.length) {
      App.closeModal();
      App.toast('Your cart is empty', 'info');
      return;
    }

    this.openCartModal(true);
  },

  removeFromCart(menuId) {
    this.cart = this.cart.filter((entry) => entry.menuId !== menuId);
    this.updateCartBadge();

    if (!this.cart.length) {
      App.closeModal();
      App.toast('Your cart is empty', 'info');
      return;
    }

    this.openCartModal(true);
  },

  getAvailableTables() {
    return this.getTables().filter((table) => table.status === 'available');
  },

  renderCartItem(item) {
    const media = item.imageUrl
      ? `<img src="${App.safeText(item.imageUrl, '')}" alt="${App.safeText(item.name)}" class="public-cart-item-image">`
      : `<span class="public-cart-item-emoji">${App.safeText(item.emoji || '🍽️')}</span>`;

    return `
      <div class="public-cart-item">
        <div class="public-cart-thumb">${media}</div>

        <div class="public-cart-info">
          <div class="public-cart-name">${App.safeText(item.name)}</div>
          <div class="public-cart-price">${App.currency(item.price)} each</div>
        </div>

        <div class="public-cart-qty">
          <button class="btn btn-secondary btn-xs" onclick="PublicHome.changeCartQty('${item.menuId}', -1)">−</button>
          <span>${item.qty}</span>
          <button class="btn btn-secondary btn-xs" onclick="PublicHome.changeCartQty('${item.menuId}', 1)">+</button>
        </div>

        <div class="public-cart-total">${App.currency(item.price * item.qty)}</div>
        <button class="btn btn-danger btn-xs" onclick="PublicHome.removeFromCart('${item.menuId}')">Remove</button>
      </div>
    `;
  },

  renderTableOption(table) {
    return `
      <div class="public-table-card" onclick="PublicHome.selectTable('${table.id}', this)">
        <div class="public-table-card-image">🪑</div>
        <div class="public-table-card-number">Table ${table.number}</div>
        <div class="public-table-card-seats">${table.seats} seats</div>
      </div>
    `;
  },

  // ============================================================
  // Cart Modal / Order flow
  // ============================================================
  openCartModal(reopen = false) {
    if (!this.cart.length) {
      if (!reopen) App.toast('Your cart is empty', 'info');
      return;
    }

    this.selectedTableId = '';

    const availableTables = this.getAvailableTables();
    const { subtotal, tax, discountPercent, discount, total } = this.getCartTotals();

    const cartHtml = this.cart.map((item) => this.renderCartItem(item)).join('');
    const tablesHtml = availableTables.length
      ? availableTables.map((table) => this.renderTableOption(table)).join('')
      : `<div class="text-soft">No available tables right now</div>`;

    const body = `
      <div class="cart-modal-intro">
        <h4 class="cart-modal-title">Your Cart</h4>
        <p class="cart-modal-subtitle">Review your selected dishes before placing your order.</p>
      </div>

      <div class="public-cart-list">${cartHtml}</div>

      <div class="cart-summary-box">
        <div class="summary-row"><span>Subtotal</span><span>${App.currency(subtotal)}</span></div>
        <div class="summary-row"><span>Tax (${(this.getTaxRate() * 100).toFixed(0)}%)</span><span>${App.currency(tax)}</span></div>
        <div class="summary-row"><span>Discount (${discountPercent}%)</span><span>-${App.currency(discount)}</span></div>
        <div class="summary-row total"><span>Total</span><span>${App.currency(total)}</span></div>
      </div>

      <div class="form-group">
        <label class="form-label">Order Type</label>
        <select class="form-select" id="publicOrderType" onchange="PublicHome.toggleOrderTypeFields()">
          <option value="delivery">Home Delivery</option>
          <option value="dine-in">Choose Table</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Customer Name</label>
        <input type="text" class="form-input" id="publicCustomerName" placeholder="Your name">
      </div>

      <div class="form-group">
        <label class="form-label">Phone Number</label>
        <input type="text" class="form-input" id="publicCustomerPhone" placeholder="e.g. 017XXXXXXXX">
      </div>

      <div class="form-group" id="deliveryAddressGroup">
        <label class="form-label">Home Address</label>
        <textarea class="form-textarea" id="publicDeliveryAddress" placeholder="Enter your delivery address"></textarea>
      </div>

      <div class="form-group" id="tableSelectGroup" style="display:none">
        <label class="form-label">Choose Available Table</label>
        <div class="public-table-picker">${tablesHtml}</div>
        <input type="hidden" id="publicTableSelect" value="">
      </div>

      <div class="form-group">
        <label class="form-label">Payment Method</label>
        <select class="form-select" id="publicPaymentMethod" onchange="PublicHome.togglePaymentMethodFields()">
          <option value="bKash">bKash</option>
          <option value="Nagad">Nagad</option>
          <option value="Rocket">Rocket</option>
          <option value="COD">Cash on Delivery</option>
          <option value="cash">Cash</option>
        </select>
      </div>

      <div id="publicOnlinePaymentWrap"></div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="publicSubmitOrderBtn" onclick="PublicHome.submitCartOrder()">Place Order</button>
    `;

    App.openModal('Place Your Order', body, footer);

    this.bindPaymentActions();
    this.toggleOrderTypeFields();
    this.togglePaymentMethodFields();
  },
    toggleOrderTypeFields() {
    const type = this.byId('publicOrderType');
    const deliveryGroup = this.byId('deliveryAddressGroup');
    const tableGroup = this.byId('tableSelectGroup');
    const orderType = type?.value || 'delivery';

    if (deliveryGroup) deliveryGroup.style.display = orderType === 'delivery' ? 'block' : 'none';
    if (tableGroup) tableGroup.style.display = orderType === 'dine-in' ? 'block' : 'none';
  },

  selectTable(tableId, el) {
    this.selectedTableId = tableId;

    const hiddenInput = this.byId('publicTableSelect');
    if (hiddenInput) hiddenInput.value = tableId;

    document.querySelectorAll('.public-table-card').forEach((card) => card.classList.remove('selected'));
    if (el) el.classList.add('selected');
  },

  validateOrderForm({ orderType, customerPhone, deliveryAddress, tableId, paymentMethod, transactionId }) {
    if (!customerPhone) return App.toast('Phone number is required', 'warning'), false;
    if (orderType === 'delivery' && !deliveryAddress) return App.toast('Delivery address is required', 'warning'), false;
    if (orderType === 'dine-in' && !tableId) return App.toast('Please choose an available table', 'warning'), false;

    if (this.isOnlinePaymentMethod(paymentMethod)) {
      if (!transactionId || String(transactionId).trim().length < 6) {
        return App.toast('Transaction ID is required for online payment', 'warning'), false;
      }
    }
    return true;
  },

  buildOrderPayload({ orderType, customerName, customerPhone, deliveryAddress, paymentMethod, tableId, transactionId }) {
    const { subtotal, tax, discountPercent, discount, total } = this.getCartTotals();

    return {
      orderType,
      customerName,
      customerPhone,
      deliveryAddress: orderType === 'delivery' ? deliveryAddress : '',
      paymentMethod,
      paymentTransactionId: this.isOnlinePaymentMethod(paymentMethod) ? String(transactionId || '').trim() : '',
      tableId: orderType === 'dine-in' ? tableId : null,
      items: this.cart.map((item) => ({ menuId: item.menuId, qty: item.qty, price: item.price })),
      subtotal,
      tax,
      discountPercent,
      discount,
      total
    };
  },

  // ===========================
  // Tracking code utilities
  // ===========================
  getTrackingHistory() {
    try {
      const raw = localStorage.getItem(this.trackingHistoryKey);
      const list = JSON.parse(raw || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },

  saveTrackingHistory(list) {
    localStorage.setItem(this.trackingHistoryKey, JSON.stringify(list || []));
  },

  addTrackingToHistory({ trackingCode, orderNumber }) {
    if (!trackingCode) return;

    const existing = this.getTrackingHistory();

    const next = [
      { trackingCode, orderNumber: orderNumber || null, savedAt: Date.now() },
      ...existing.filter((x) => x?.trackingCode !== trackingCode)
    ].slice(0, 6);

    this.saveTrackingHistory(next);
  },

  async copyTrackingCode(code) {
    if (!code) {
      App.toast('Tracking code not found', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(String(code));
      App.toast('Tracking code copied', 'success');
    } catch {
      App.toast('Copy failed', 'error');
    }
  },

  showOrderPlacedModal(orderData) {
    const trackingCode = orderData?.trackingCode || '';

    this.addTrackingToHistory({
      trackingCode,
      orderNumber: orderData?.orderNumber
    });

    const estimatedText = orderData.estimatedPrepMinutes
      ? `Estimated completion time: <strong>${orderData.estimatedPrepMinutes} min</strong>`
      : `Your order is waiting for kitchen confirmation. Estimated completion time will appear once cooking starts.`;

    const isOnline = this.isOnlinePaymentMethod(orderData.paymentMethod);

    const trackingHtml = trackingCode
      ? `
        <div class="panel-muted" style="display:flex; justify-content:space-between; align-items:center; gap:12px; border: 1px dashed var(--accent);">
          <div style="overflow: hidden;">
            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Tracking Code</div>
            <strong style="color:var(--accent); font-size:1.1rem; letter-spacing:1px; word-break:break-all;">
              ${App.safeText(trackingCode)}
            </strong>
          </div>
          <button class="btn btn-secondary btn-xs" style="flex-shrink:0;" onclick='PublicHome.copyTrackingCode(${JSON.stringify(trackingCode)})'>
            Copy
          </button>
        </div>
      `
      : '';

    App.openModal(
      `Order #${orderData.orderNumber} Placed`,
      `
        <div class="modal-stack">
          ${trackingHtml}
          <div class="panel-muted"><strong>Status:</strong> ${App.safeText(orderData.status || 'pending')}</div>
          ${
            isOnline
              ? `<div class="panel-warning"><strong>Online payment:</strong> Staff will confirm your Transaction ID before completing billing.</div>`
              : ''
          }
          <div class="panel-info">${estimatedText}</div>
          <div class="panel-muted" style="font-size: 1.1rem;">
            Total: <strong>${App.currency(orderData.total || 0)}</strong>
          </div>
        </div>
      `,
      `<button class="btn btn-primary" onclick="App.closeModal()">OK</button>`
    );
  },

  openTrackOrderModal() {
    const history = this.getTrackingHistory();

    const historyHtml = history.length
      ? `
        <div class="form-group">
          <label class="form-label">Recent Tracking Codes</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${history.map((h) => `
              <button class="btn btn-secondary btn-xs" onclick="PublicHome.fillTrackingCode(${JSON.stringify(h.trackingCode)})">
                ${App.safeText(h.trackingCode)}
              </button>
            `).join('')}
          </div>
        </div>
      `
      : '';

    const body = `
      <div class="form-group">
        <label class="form-label">Tracking Code</label>
        <input type="text" class="form-input" id="trackOrderCode" placeholder="e.g. TRK-xxxxxxxxxxxxxxxxxxxxxxxx">
      </div>
      ${historyHtml}
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="PublicHome.trackOrder()">Track Order</button>
    `;

    App.openModal('Track Your Order', body, footer);
  },

  fillTrackingCode(code) {
    const input = this.byId('trackOrderCode');
    if (input) input.value = code || '';
  },

  async trackOrder() {
    const code = (this.byId('trackOrderCode')?.value || '').trim();

    if (!code) {
      App.toast('Please enter your tracking code', 'warning');
      return;
    }

    try {
      const json = await Store.request(`/orders/track/${encodeURIComponent(code)}`);
      const o = json.data || {};

      const itemsHtml = (o.items || []).map((it) => `
        <div class="receipt-row">
          <span>${Number(it.qty || 0)}x ${App.safeText(it.name)}</span>
          <span>${App.currency(it.lineTotal != null ? it.lineTotal : (Number(it.price || 0) * Number(it.qty || 0)))}</span>
        </div>
      `).join('');

      const addressHtml =
        o.orderType === 'delivery'
          ? `
            <div class="receipt-row">
              <span>Address</span>
              <span class="receipt-multiline-value">${App.safeText(o.deliveryAddress || '-')}</span>
            </div>
          `
          : `
            <div class="receipt-row"><span>Table</span><span>${o.tableNumber != null ? App.safeText(o.tableNumber) : '-'}</span></div>
          `;

      const timingHtml = o.estimatedPrepMinutes
        ? `
          <div class="panel-info">
            <strong>Estimated:</strong> ${Number(o.estimatedPrepMinutes)} min<br>
            <strong>Ready At:</strong> ${o.estimatedReadyAt ? new Date(o.estimatedReadyAt).toLocaleString() : '-'}
          </div>
        `
        : `<div class="panel-muted">Kitchen has not started cooking yet.</div>`;

      App.openModal(
        `Order #${App.safeText(o.orderNumber)}`,
        `
          <div class="modal-stack">
            <div class="panel-muted"><strong>Status:</strong> ${App.safeText(o.status || '-')}</div>
            ${timingHtml}

            <div class="receipt-preview" style="margin-top:10px" id="publicTrackedOrderPrint">
              <div class="receipt-row"><span>Ordered At</span><span>${o.createdAt ? new Date(o.createdAt).toLocaleString() : '-'}</span></div>
              <div class="receipt-row"><span>Type</span><span>${App.safeText(o.orderType || '-')}</span></div>
              <div class="receipt-row"><span>Customer</span><span>${App.safeText(o.customerName || 'Guest')}</span></div>
              <div class="receipt-row"><span>Phone</span><span>${App.safeText(o.customerPhone || '-')}</span></div>
              ${addressHtml}
              <div class="receipt-row"><span>Payment</span><span>${App.safeText(o.paymentMethod || '-')}</span></div>

              <hr class="receipt-divider">
              <div class="receipt-section-title">Items</div>
              ${itemsHtml || '<div class="panel-muted">No items</div>'}

              <hr class="receipt-divider">
              <div class="receipt-row"><span>Subtotal</span><span>${App.currency(o.subtotal || 0)}</span></div>
              <div class="receipt-row"><span>Tax</span><span>${App.currency(o.tax || 0)}</span></div>
              <div class="receipt-row"><span>Discount (${Number(o.discountPercent || 0)}%)</span><span>-${App.currency(o.discount || 0)}</span></div>
              <div class="receipt-row bold"><span>Total</span><span>${App.currency(o.total || 0)}</span></div>
            </div>
          </div>
        `,
        `
          <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
          <button class="btn btn-primary" onclick="PublicHome.printTrackedOrder()">Print</button>
        `
      );
    } catch (error) {
      App.toast(error.message || 'Order not found', 'error');
    }
  },

  printTrackedOrder() {
    const el = this.byId('publicTrackedOrderPrint');
    if (!el) return App.toast('Printable view not found', 'error');

    const w = window.open('', '_blank', 'width=420,height=700');
    if (!w) return App.toast('Unable to open print window', 'error');

    w.document.write(`
      <html>
        <head>
          <title>Order Details</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; max-width: 380px; margin: 0 auto; }
            .receipt-divider { border: none; border-top: 1px dashed #ccc; margin: 12px 0; }
            .receipt-row { display:flex; justify-content:space-between; font-size:0.82rem; padding:2px 0; gap:8px; }
            .receipt-row.bold { font-weight:700; font-size:0.95rem; }
            .receipt-section-title { font-weight:700; margin-bottom:6px; }
            .receipt-multiline-value { text-align:right; max-width: 180px; }
          </style>
        </head>
        <body>${el.innerHTML}</body>
      </html>
    `);

    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
    }, 300);
  },

  async submitCartOrder() {
    if (!this.cart.length) return App.toast('Your cart is empty', 'warning');

    const submitBtn = this.byId('publicSubmitOrderBtn');

    const orderType = this.byId('publicOrderType')?.value || 'delivery';
    const customerName = (this.byId('publicCustomerName')?.value || '').trim();
    const customerPhone = (this.byId('publicCustomerPhone')?.value || '').trim();
    const deliveryAddress = (this.byId('publicDeliveryAddress')?.value || '').trim();
    const paymentMethod = this.byId('publicPaymentMethod')?.value || 'cash';

    const transactionId = (this.byId('publicTransactionId')?.value || '').trim();
    const tableId = this.byId('publicTableSelect')?.value || '';

    const ok = this.validateOrderForm({
      orderType,
      customerPhone,
      deliveryAddress,
      tableId,
      paymentMethod,
      transactionId
    });
    if (!ok) return;

    App.setButtonLoading(submitBtn, true, 'Placing...', 'Place Order');

    try {
      const payload = this.buildOrderPayload({
        orderType,
        customerName,
        customerPhone,
        deliveryAddress,
        paymentMethod,
        tableId,
        transactionId
      });

      const json = await Store.request('/orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      this.cart = [];
      this.selectedTableId = '';
      this.updateCartBadge();

      await Store.fetchMenuItems();
      await Store.fetchTables();

      App.closeModal();
      this.showOrderPlacedModal(json.data);
    } catch (error) {
      console.error('Public order submit failed:', error);
      App.toast(error.message || 'Failed to place order', 'error');
    } finally {
      App.setButtonLoading(submitBtn, false, 'Placing...', 'Place Order');
    }
  },

  // ============================================================
  // REVIEWS / FEEDBACK
  // ============================================================
  getTopReviews(limit = 3) {
    return [...this.getFeedback()]
      .sort((a, b) => {
        const r = Number(b.rating || 0) - Number(a.rating || 0);
        if (r !== 0) return r;
        return Number(b.timestamp || 0) - Number(a.timestamp || 0);
      })
      .slice(0, limit);
  },

  renderStars(rating = 0) {
    const r = Math.max(0, Math.min(5, Number(rating || 0)));
    const filled = '★'.repeat(r);
    const empty = '☆'.repeat(5 - r);
    return `<span style="color:var(--warning);font-size:0.95rem">${filled}${empty}</span>`;
  },

  renderReviewsSection() {
    const container = this.byId('publicReviewsSection');
    if (!container) return;

    const top = this.getTopReviews(3);

    const cards = top.length
      ? top
          .map(
            (r) => `
        <div class="card" style="background:var(--bg-card);border-radius:var(--radius-lg)">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px">
            <div style="font-weight:800;color:var(--text-primary)">${App.safeText(r.name || 'Anonymous')}</div>
            ${this.renderStars(r.rating)}
          </div>
          <div style="color:var(--text-secondary);font-size:0.85rem;line-height:1.5">
            "${App.safeText(r.text || '')}"
          </div>
          <div style="margin-top:10px;color:var(--text-muted);font-size:0.75rem">
            ${App.timeAgo(r.timestamp)}
          </div>
        </div>
      `
          )
          .join('')
      : `<div class="panel-muted">No reviews yet. Be the first to review!</div>`;

    container.innerHTML = `
      <div class="card" style="margin-top:24px">
        <div class="card-header">
          <div>
            <div class="card-title">Customer Reviews</div>
            <div class="card-subtitle">Top rated feedback from our customers</div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="PublicHome.openAllReviewsModal()">View All Reviews</button>
            <button class="btn btn-primary btn-sm" onclick="PublicHome.openAddReviewModal()">Write a Review</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">
          ${cards}
        </div>
      </div>
    `;
  },

  openAllReviewsModal() {
    const reviews = [...this.getFeedback()].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));

    const list = reviews.length
      ? reviews
          .map(
            (r) => `
        <div class="panel-muted" style="display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
            <strong>${App.safeText(r.name || 'Anonymous')}</strong>
            ${this.renderStars(r.rating)}
          </div>
          <div style="color:var(--text-secondary)">${App.safeText(r.text || '')}</div>
          <div class="text-soft">${App.timeAgo(r.timestamp)}</div>
        </div>
      `
          )
          .join('')
      : `<div class="empty-state"><p>No reviews yet</p></div>`;

    App.openModal(
      'All Customer Reviews',
      `<div class="modal-stack">${list}</div>`,
      `<button class="btn btn-secondary" onclick="App.closeModal()">Close</button>`
    );
  },

  openAddReviewModal() {
    this.reviewRating = 5;

    const body = `
      <div class="form-group">
        <label class="form-label">Your Name</label>
        <input class="form-input" id="publicReviewName" placeholder="Name (optional)">
      </div>

      <div class="form-group">
        <label class="form-label">Rating</label>
        <div id="publicReviewStars" style="display:flex;gap:6px;font-size:1.6rem;cursor:pointer">
          ${[1,2,3,4,5].map((n) => `<span data-star="${n}" onclick="PublicHome.setReviewRating(${n})">★</span>`).join('')}
        </div>
        <input type="hidden" id="publicReviewRating" value="5">
      </div>

      <div class="form-group">
        <label class="form-label">Comment</label>
        <textarea class="form-textarea" id="publicReviewText" rows="3" placeholder="Write your feedback..."></textarea>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="submitPublicReviewBtn" onclick="PublicHome.submitReview()">Submit</button>
    `;

    App.openModal('Write a Review', body, footer);
    this.setReviewRating(5);
  },

  setReviewRating(rating) {
    this.reviewRating = Math.max(1, Math.min(5, Number(rating || 5)));

    const hidden = this.byId('publicReviewRating');
    if (hidden) hidden.value = String(this.reviewRating);

    document.querySelectorAll('#publicReviewStars span').forEach((node) => {
      const star = Number(node.dataset.star || 0);
      node.style.color = star <= this.reviewRating ? 'var(--warning)' : 'var(--text-muted)';
    });
  },

  async submitReview() {
    const btn = this.byId('submitPublicReviewBtn');
    const name = (this.byId('publicReviewName')?.value || '').trim() || 'Anonymous';
    const rating = parseInt(this.byId('publicReviewRating')?.value || '5', 10);
    const text = (this.byId('publicReviewText')?.value || '').trim();

    if (!text) {
      App.toast('Please write a comment', 'warning');
      return;
    }

    App.setButtonLoading(btn, true, 'Submitting...', 'Submit');

    try {
      await Store.request('/feedback', {
        method: 'POST',
        body: JSON.stringify({ name, rating, text })
      });

      await Store.fetchFeedback();
      App.closeModal();
      this.renderReviewsSection();
      App.toast('Thanks for your review!', 'success');
    } catch (error) {
      App.toast(error.message || 'Failed to submit review', 'error');
    } finally {
      App.setButtonLoading(btn, false, 'Submitting...', 'Submit');
    }
  }
};