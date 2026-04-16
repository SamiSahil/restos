const API_BASE = window.APP_CONFIG?.API_BASE || '';
const OFFLINE_QUEUE_KEY = 'restaurantos_offline_queue';
const TOKEN_STORAGE_KEY = 'restaurantos_token';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const Store = {
  _state: {
    menuItems: [],
    tables: [],
    orders: [],
    cart: [],
    feedback: [],
    staff: [],
    topItems: [], // ✅ NEW: public best-selling items

    currentPage: 'home',
    selectedTable: null,
    authUser: null,
    authToken: localStorage.getItem(TOKEN_STORAGE_KEY) || null,
    socketConnected: false,
    settings: {
      discountPercent: 0
    }
  },

  _listeners: [],
  socket: null,

  async init() {
    // Public-safe initial load (no orders/staff)
    await this.refreshAll();

    // Restore staff session if token exists
    if (this._state.authToken && navigator.onLine) {
      try {
        await this.fetchMe();
        // After auth restored, load staff-only data
        await this.fetchOrders();
      } catch (error) {
        console.warn('Failed to restore session, logging out:', error);
        this.logout();
      }
    }
  },

  async refreshAll() {
    if (!navigator.onLine) return;

    const tasks = [
      this.fetchMenuItems(),
      this.fetchTables(),
      this.fetchFeedback(false),
      this.fetchSettings(),
      this.fetchTopItemsPublic(10, 30) // ✅ NEW: best-selling items for public home
    ];

    // Staff-only: load orders only when authenticated
    if (this.isAuthenticated()) {
      tasks.push(this.fetchOrders());
    }

    await Promise.all(tasks);
  },

  get(key) {
    return this._state[key];
  },

  set(key, value) {
    this._state[key] = value;
    this._notify(key);
  },

  setLocal(key, value) {
    this.set(key, value);
  },

  subscribe(callback) {
    if (typeof callback === 'function') {
      this._listeners.push(callback);
    }
  },

  _notify(key) {
    this._listeners.forEach((fn) => {
      try {
        fn(key);
      } catch (error) {
        console.error('Store subscriber failed:', error);
      }
    });
  },

  getCurrentPage() {
    return this._state.currentPage;
  },

  setCurrentPage(page) {
    this.set('currentPage', page);
  },

  getDiscountPercent() {
    return Number(this._state.settings?.discountPercent || 0);
  },

  async fetchSettings() {
    const json = await this.request('/settings');
    this._state.settings = {
      discountPercent: Number(json.data?.discountPercent || 0)
    };
    this._notify('settings');
  },

  async updateDiscountPercent(percent) {
    let safePercent = Number(percent || 0);

    if (safePercent < 0) safePercent = 0;
    if (safePercent > 100) safePercent = 100;

    const json = await this.request('/settings/discount', {
      method: 'PUT',
      body: JSON.stringify({ discountPercent: safePercent })
    });

    this._state.settings = {
      discountPercent: Number(json.data?.discountPercent || 0)
    };

    this._notify('settings');
  },

  setToken(token) {
    this._state.authToken = token;

    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }

    this._notify('authToken');
  },

  setAuthUser(user) {
    this._state.authUser = user;
    this._notify('authUser');
  },

  logout() {
    this.setToken(null);
    this.setAuthUser(null);

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Reconnect socket as public
    this.connectSocket();
  },

  isAuthenticated() {
    return !!this._state.authToken && !!this._state.authUser;
  },

  setSocketConnected(value) {
    this.set('socketConnected', value);
  },

  connectSocket() {
    if (this.socket || typeof io === 'undefined' || !API_BASE) return;

    const socketBase = API_BASE.replace('/api', '');

    this.socket = io(socketBase, {
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('🔌 Socket connected:', this.socket.id);
      this.setSocketConnected(true);
      this.joinSocketRoom();
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      this.setSocketConnected(false);
    });

    this.socket.on('order:new', (order) => {
      console.log('📥 order:new', order);
      this.upsertOrder(order);
    });

    this.socket.on('order:updated', (order) => {
      console.log('📥 order:updated', order);
      this.upsertOrder(order);
    });

    this.socket.on('order:deleted', (payload) => {
      console.log('📥 order:deleted', payload);
      this.removeOrderByMongoId(payload._id);
    });

    this.socket.on('table:created', (table) => {
      console.log('📥 table:created', table);
      this.upsertTable(table);
    });

    this.socket.on('table:updated', (table) => {
      console.log('📥 table:updated', table);
      this.upsertTable(table);
    });

    this.socket.on('table:deleted', (payload) => {
      console.log('📥 table:deleted', payload);
      this.removeTableById(payload._id);
    });

    this.socket.on('stock:updated', (updates) => {
      console.log('📥 stock:updated', updates);
      this.applyStockUpdates(updates);
    });

    this.socket.on('settings:updated', (settings) => {
      console.log('📥 settings:updated', settings);
      this._state.settings = {
        ...this._state.settings,
        discountPercent: Number(settings.discountPercent || 0)
      };
      this._notify('settings');
    });
  },

  joinSocketRoom() {
    if (!this.socket) return;

    const user = this.get('authUser');
    if (user?.role) {
      this.socket.emit('join:role', { role: user.role });
    } else {
      this.socket.emit('join:public');
    }
  },

  // -----------------------
  // Mappers
  // -----------------------
  mapOrder(order) {
    return {
      mongoId: order._id || null,
      id: order.orderNumber,
      tableId: order.table?._id || (typeof order.table === 'string' ? order.table : null),
      table: order.table?.number || '',
      orderType: order.orderType || 'dine-in',
      customerName: order.customerName || '',
      customerPhone: order.customerPhone || '',
      deliveryAddress: order.deliveryAddress || '',
      paymentMethod: order.paymentMethod || 'cash',
      items: (order.items || []).map((it) => ({
        menuId: it.menuItem || it.menuId || null,
        name: it.name,
        qty: it.qty,
        price: it.price
      })),
      subtotal: order.subtotal || 0,
      tax: order.tax || 0,
      discountPercent: order.discountPercent || 0,
      discount: order.discount || 0,
      total: order.total || 0,
      status: order.status || 'pending',
      billingStatus: order.billingStatus || 'pending',
      paymentTransactionId: order.paymentTransactionId || '',
      billingCompletedAt: order.billingCompletedAt ? new Date(order.billingCompletedAt).getTime() : null,
      prepStartedAt: order.prepStartedAt ? new Date(order.prepStartedAt).getTime() : null,
      estimatedPrepMinutes: order.estimatedPrepMinutes || null,
      estimatedReadyAt: order.estimatedReadyAt ? new Date(order.estimatedReadyAt).getTime() : null,
      timestamp: new Date(order.createdAt || Date.now()).getTime(),
      offlineQueued: false
    };
  },

  mapTable(table) {
    return {
      id: table._id,
      number: table.number,
      seats: table.seats,
      status: table.status,
      offlineQueued: false
    };
  },

  mapMenuItem(item) {
    return {
      id: item._id,
      name: item.name,
      category: item.category,
      price: item.price,
      emoji: item.emoji || '🍽️',
      stock: item.stock || 0,
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      imagePublicId: item.imagePublicId || ''
    };
  },

  mapFeedback(feedback) {
    return {
      id: feedback._id,
      name: feedback.name,
      rating: feedback.rating,
      text: feedback.text,
      isHidden: !!feedback.isHidden,
      timestamp: new Date(feedback.createdAt).getTime(),
      offlineQueued: false
    };
  },

  // -----------------------
  // Upserts
  // -----------------------
  upsertOrder(order) {
    const mapped = this.mapOrder(order);
    const orders = [...this._state.orders];
    const existingIndex = orders.findIndex((o) => o.mongoId === mapped.mongoId || o.id === mapped.id);

    if (existingIndex >= 0) orders[existingIndex] = mapped;
    else orders.unshift(mapped);

    const deduped = orders.filter(
      (o, index, arr) =>
        index === arr.findIndex((x) => (x.mongoId && x.mongoId === o.mongoId) || x.id === o.id)
    );

    this.set('orders', deduped);
  },

  removeOrderByMongoId(mongoId) {
    const updated = this._state.orders.filter((o) => o.mongoId !== mongoId);
    this.set('orders', updated);
  },

  upsertTable(table) {
    const mapped = this.mapTable(table);
    const tables = [...this._state.tables];
    const existingIndex = tables.findIndex((t) => t.id === mapped.id);

    if (existingIndex >= 0) tables[existingIndex] = mapped;
    else tables.push(mapped);

    tables.sort((a, b) => a.number - b.number);
    this.set('tables', tables);
  },

  removeTableById(id) {
    const updated = this._state.tables.filter((t) => t.id !== id);
    this.set('tables', updated);
  },

  applyStockUpdates(updates = []) {
    if (!Array.isArray(updates) || !updates.length) return;

    const updatedItems = this._state.menuItems.map((item) => {
      const found = updates.find((u) => String(u.menuId) === String(item.id));
      return found ? { ...item, stock: found.stock } : item;
    });

    this.set('menuItems', updatedItems);
  },

  // -----------------------
  // Offline queue helpers
  // -----------------------
  getQueue() {
    try {
      return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY)) || [];
    } catch {
      return [];
    }
  },

  saveQueue(queue) {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  },

  addToQueue(item) {
    const queue = this.getQueue();
    queue.push({
      queueId: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
      retryCount: 0,
      lastTriedAt: null,
      syncError: null,
      ...item
    });
    this.saveQueue(queue);
  },

  removeQueueItem(queueId) {
    const queue = this.getQueue().filter((item) => item.queueId !== queueId);
    this.saveQueue(queue);
  },

  generateOfflineId(prefix = 'OFF') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  },

  async processQueue() {
    if (!navigator.onLine) return;

    const queue = this.getQueue();
    if (!queue.length) return;

    const remaining = [];
    const offlineIdMap = new Map();

    for (const item of queue) {
      try {
        await this.processQueueItem(item, offlineIdMap);
      } catch (error) {
        remaining.push({
          ...item,
          retryCount: (item.retryCount || 0) + 1,
          lastTriedAt: Date.now(),
          syncError: error.message
        });
      }
    }

    this.saveQueue(remaining);
    await this.refreshAll();
  },

  async processQueueItem(item, offlineIdMap = new Map()) {
    switch (item.type) {
      case 'CREATE_ORDER': {
        const payload = { ...item.payload };
        if (offlineIdMap.has(payload.tableId)) payload.tableId = offlineIdMap.get(payload.tableId);

        await this.request('/orders', { method: 'POST', body: JSON.stringify(payload) });
        return;
      }

      case 'UPDATE_ORDER_STATUS': {
        await this.request(`/orders/${item.mongoId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: item.status })
        });
        return;
      }

      case 'CREATE_FEEDBACK': {
        await this.request('/feedback', {
          method: 'POST',
          body: JSON.stringify(item.payload)
        });
        return;
      }

      case 'UPDATE_MENU_ITEM': {
        await this.request(`/menu/${item.itemId}`, {
          method: 'PUT',
          body: JSON.stringify(item.payload)
        });
        return;
      }

      case 'CREATE_TABLE': {
        const json = await this.request('/tables', { method: 'POST', body: JSON.stringify(item.payload) });
        if (item.offlineTableId && json?.data?._id) offlineIdMap.set(item.offlineTableId, json.data._id);
        return;
      }

      case 'UPDATE_TABLE': {
        let targetTableId = item.tableId;
        if (offlineIdMap.has(targetTableId)) targetTableId = offlineIdMap.get(targetTableId);
        if (String(targetTableId).startsWith('OFF-TABLE-')) throw new Error('Waiting for offline-created table to sync first');

        await this.request(`/tables/${targetTableId}`, { method: 'PUT', body: JSON.stringify(item.payload) });
        return;
      }

      case 'DELETE_TABLE': {
        let targetTableId = item.tableId;
        if (offlineIdMap.has(targetTableId)) targetTableId = offlineIdMap.get(targetTableId);
        if (String(targetTableId).startsWith('OFF-TABLE-')) return;

        await this.request(`/tables/${targetTableId}`, { method: 'DELETE' });
        return;
      }

      default:
        throw new Error(`Unsupported queue action: ${item.type}`);
    }
  },

  // -----------------------
  // Network request helper
  // -----------------------
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const maxRetries = 3;
    const retryDelay = 1000;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!navigator.onLine) throw new Error('You are offline');

        const headers = {
          ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
          ...(this._state.authToken ? { Authorization: `Bearer ${this._state.authToken}` } : {}),
          ...(options.headers || {})
        };

        const response = await fetch(url, {
          ...options,
          headers,
          cache: 'no-store'
        });

        const json = await response.json().catch(() => ({}));

        if (!response.ok || json.success === false) {
          if (response.status === 401) this.logout();
          throw new Error(json.message || `Request failed with status ${response.status}`);
        }

        return json;
      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === maxRetries;
        if (!isLastAttempt) await sleep(retryDelay * attempt);
      }
    }

    throw new Error(lastError?.message || 'Network request failed after retries');
  },

  // -----------------------
  // Auth
  // -----------------------
  async login(email, password) {
    const json = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    this.setToken(json.data.token);
    this.setAuthUser(json.data);

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectSocket();

    await this.fetchMe();
    await this.fetchOrders();

    return this.get('authUser');
  },

  async fetchMe() {
    const json = await this.request('/auth/me');
    this.setAuthUser(json.data);
    this.joinSocketRoom();
    return json.data;
  },

  // -----------------------
  // Fetchers
  // -----------------------
  async fetchStaff() {
    const json = await this.request('/staff');
    this.set('staff', json.data || []);
  },

  async fetchMenuItems() {
    const json = await this.request('/menu');
    const items = (json.data || []).map((item) => this.mapMenuItem(item));
    this.set('menuItems', items);
  },

  async fetchTables() {
    const json = await this.request('/tables');
    const backendTables = (json.data || []).map((table) => this.mapTable(table));
    const localOfflineTables = this._state.tables.filter((t) => t.offlineQueued);
    this.set('tables', [...localOfflineTables, ...backendTables]);
  },

  async fetchOrders() {
    const json = await this.request('/orders');
    const backendOrders = (json.data || []).map((order) => this.mapOrder(order));
    const localQueuedOrders = this._state.orders.filter((order) => order.offlineQueued);
    this.set('orders', [...localQueuedOrders, ...backendOrders]);
  },

  async fetchFeedback(includeHidden = false) {
    const q = includeHidden ? '?includeHidden=true' : '';
    const json = await this.request(`/feedback${q}`);
    const backendFeedback = (json.data || []).map((f) => this.mapFeedback(f));
    const localQueuedFeedback = this._state.feedback.filter((f) => f.offlineQueued);
    this.set('feedback', [...localQueuedFeedback, ...backendFeedback]);
  },

  // ✅ NEW: Public best-selling items
  async fetchTopItemsPublic(limit = 10, days = 30) {
    const json = await this.request(`/analytics/top-items?limit=${encodeURIComponent(limit)}&days=${encodeURIComponent(days)}`);
    this.set('topItems', json.data || []);
  }
};