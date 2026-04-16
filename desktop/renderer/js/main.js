// =====================================================
// Main bootstrap
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOMContentLoaded fired');

  await App.init();

  // ✅ remove startup loader AFTER App.init finishes
  document.body.classList.remove('app-loading');
  document.getElementById('appLoader')?.remove();

  setupNetworkIndicator();

  // ✅ Decide which single install button to show (async safe)
  await setupInstallExperience();

  // Connect socket after app is ready
  Store.connectSocket();

  if (navigator.onLine) {
    try {
      await Store.processQueue();
      if (typeof App.updateSyncQueueBadge === 'function') {
        App.updateSyncQueueBadge();
      }
    } catch (error) {
      console.error('Initial queue sync failed:', error);
    }
  }

  // =====================================================
  // Service Worker
  // - Electron (file://) => unregister + clear caches
  // - Web => register normally
  // =====================================================
  const isElectron = /electron/i.test(navigator.userAgent) || window.location.protocol === 'file:';

  if (isElectron && 'serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      regs.forEach((r) => r.unregister());
      if (window.caches?.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) {
      console.warn('SW cleanup (Electron) failed:', e?.message || e);
    }
  } else if ('serviceWorker' in navigator) {
    console.log('Service worker supported');

    try {
      console.log('Trying to register service worker...');
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });

      console.log('✅ Service Worker registered successfully:', registration);
      console.log('Scope:', registration.scope);

      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log('🔄 New version available, activating...');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            } else {
              console.log('✅ First service worker installed');
            }
          }
        });
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        console.log('🔄 New service worker active, reloading page...');
        window.location.reload();
      });
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  } else {
    console.log('Service worker not supported');
  }
});

// =====================================================
// Routing
// =====================================================
window.addEventListener('hashchange', () => {
  if (typeof App.handleRouteChange === 'function') {
    App.handleRouteChange();
  }
});

// =====================================================
// Re-render on resize
// =====================================================
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const page = Store._state.currentPage;

    if (page === 'home' && typeof PublicHome !== 'undefined') PublicHome.render();
    if (page === 'dashboard' && typeof Dashboard !== 'undefined') Dashboard.render();
    if (page === 'analytics' && typeof Analytics !== 'undefined') Analytics.render();
    if (page === 'sync' && typeof SyncCenter !== 'undefined') SyncCenter.render();
    if (page === 'staff' && typeof StaffPage !== 'undefined') StaffPage.render();
    if (page === 'kitchen' && typeof Kitchen !== 'undefined') Kitchen.render();
    if (page === 'billing' && typeof Billing !== 'undefined') Billing.render();
    if (page === 'floor' && typeof FloorMap !== 'undefined') FloorMap.render();
    if (page === 'pos' && typeof POS !== 'undefined') POS.render();
  }, 300);
});

// =====================================================
// Install button logic (ONE button at a time)
// =====================================================
let deferredPrompt = null;

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

function isWindows() {
  return /windows/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function hasWindowsExe() {
  return !!window.APP_CONFIG?.WINDOWS_EXE_URL;
}

function hasAndroidInstallUrl() {
  return !!window.APP_CONFIG?.ANDROID_INSTALL_URL;
}

/**
 * Optional: hides Android install button if Play app is installed.
 * Works only on some Android browsers (Chrome) AND only if manifest.json has related_applications.
 */
async function isRelatedAndroidAppInstalled() {
  if (!navigator.getInstalledRelatedApps) return false;
  try {
    const apps = await navigator.getInstalledRelatedApps();
    return apps.some((a) => a.platform === 'play' && (a.id === 'com.restos.app'));
  } catch {
    return false;
  }
}

/**
 * Show ONLY one install option:
 * - Installed PWA -> none
 * - iOS -> iOS hint only
 * - Android -> Android button only (Play link), else fallback to PWA if no link
 * - Windows -> Windows EXE button only
 * - Others -> PWA only if prompt exists
 */
async function setupInstallExperience() {
  const pwaBtn = document.getElementById('installPwaBtn');
  const iosBtn = document.getElementById('iosInstallHintBtn');
  const androidBtn = document.getElementById('androidInstallBtn');

  // Hide all first
  if (pwaBtn) pwaBtn.style.display = 'none';
  if (iosBtn) iosBtn.style.display = 'none';
  if (androidBtn) androidBtn.style.display = 'none';

  // If installed as PWA (standalone), hide everything
  if (isInStandaloneMode()) return;

  // iOS: show instructions only
  if (isIos()) {
    if (iosBtn) iosBtn.style.display = 'inline-flex';
    return;
  }

  // Android: show Play Store / Testing install only (if configured)
  if (isAndroid()) {
    if (hasAndroidInstallUrl() && androidBtn) {
      const alreadyInstalled = await isRelatedAndroidAppInstalled();
      if (!alreadyInstalled) androidBtn.style.display = 'inline-flex';
    } else {
      // fallback: show PWA prompt if available
      if (deferredPrompt && pwaBtn) {
        pwaBtn.style.display = 'inline-flex';
        pwaBtn.textContent = 'Install App on Device';
      }
    }
    return;
  }

  // Windows desktop browser: show EXE only
  if (isWindows() && hasWindowsExe() && pwaBtn) {
    pwaBtn.style.display = 'inline-flex';
    pwaBtn.textContent = 'Install on Windows';
    return;
  }

  // Other platforms: show PWA install if prompt exists
  if (deferredPrompt && pwaBtn) {
    pwaBtn.style.display = 'inline-flex';
    pwaBtn.textContent = 'Install App on Device';
  }
}

// Capture PWA install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Re-evaluate which single install button to show
  setupInstallExperience().catch(() => {});
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;

  // Hide install buttons
  setupInstallExperience().catch(() => {});

  if (typeof App !== 'undefined') {
    App.toast('RestaurantOS installed successfully!', 'success');
  }
});

// Button handler (your HTML uses onclick="installPWA()")
window.installPWA = async function () {
  // Windows: download EXE
  if (isWindows() && hasWindowsExe()) {
    const url = window.APP_CONFIG.WINDOWS_EXE_URL;

    // Optional confirmation
    App.openModal(
      'Install on Windows',
      `<div class="panel-info">This will download the Windows installer (.exe). Continue?</div>`,
      `
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="App.closeModal(); window.location.href='${url}'">Download</button>
      `
    );
    return;
  }

  // Normal PWA install flow
  if (!deferredPrompt) {
    App?.toast?.('Install option is not available right now.', 'warning');
    return;
  }

  deferredPrompt.prompt();
  await deferredPrompt.userChoice;

  deferredPrompt = null;
  await setupInstallExperience();
};

// Android confirmation modal -> open Play URL
window.confirmAndroidInstall = function () {
  const url = window.APP_CONFIG?.ANDROID_INSTALL_URL;
  if (!url) {
    App.toast('Android install link is not configured', 'warning');
    return;
  }

  App.openModal(
    'Install on Android',
    `
      <div class="modal-stack">
        <div class="panel-info">
          This will download the Android installer (.apk)<br>
          From there you can tap <strong>Download APK</strong>.
        </div>
      </div>
    `,
    `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="App.closeModal(); window.open('${url}', '_blank')">
        Download APK
      </button>
    `
  );
};

window.showIosInstallInstructions = function () {
  if (typeof App === 'undefined') return;

  App.openModal(
    'Install on iPhone / iPad',
    `
      <div style="display:flex;flex-direction:column;gap:14px;font-size:0.9rem;color:var(--text-secondary)">
        <div style="padding:12px;background:var(--bg-input);border-radius:var(--radius)">
          <strong style="color:var(--text-primary)">Step 1:</strong> Open this app in <strong>Safari</strong>
        </div>
        <div style="padding:12px;background:var(--bg-input);border-radius:var(--radius)">
          <strong style="color:var(--text-primary)">Step 2:</strong> Tap the <strong>Share</strong> button
        </div>
        <div style="padding:12px;background:var(--bg-input);border-radius:var(--radius)">
          <strong style="color:var(--text-primary)">Step 3:</strong> Tap <strong>Add to Home Screen</strong>
        </div>
        <div style="padding:12px;background:var(--accent-bg);border-radius:var(--radius);color:var(--accent)">
          After adding, RestaurantOS will open like a native app from your Home Screen.
        </div>
      </div>
    `,
    `<button class="btn btn-primary" onclick="App.closeModal()">Got it</button>`
  );
};

// =====================================================
// Network indicator
// =====================================================
function setupNetworkIndicator() {
  const indicator = document.getElementById('networkIndicator');
  const text = document.getElementById('networkText');

  const updateNetworkStatus = () => {
    if (!indicator || !text) return;

    if (navigator.onLine) {
      indicator.classList.remove('offline');
      indicator.classList.add('online');
      text.textContent = 'Online';
    } else {
      indicator.classList.remove('online');
      indicator.classList.add('offline');
      text.textContent = 'Offline';
    }
  };

  updateNetworkStatus();

  window.addEventListener('online', async () => {
    updateNetworkStatus();

    if (typeof App !== 'undefined') {
      App.toast('Back online. Syncing queued requests...', 'success');
    }

    try {
      await Store.processQueue();

      if (typeof App.updateSyncQueueBadge === 'function') {
        App.updateSyncQueueBadge();
      }

      if (Store._state.currentPage === 'sync' && typeof SyncCenter !== 'undefined') {
        SyncCenter.render();
      }
    } catch (error) {
      console.error('Queue sync failed:', error);
      if (typeof App !== 'undefined') {
        App.toast('Some queued changes could not be synced', 'warning');
      }
    }
  });

  window.addEventListener('offline', () => {
    updateNetworkStatus();
    if (typeof App !== 'undefined') {
      App.toast('You are offline', 'warning');
    }
  });
}