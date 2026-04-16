// frontend/js/config.js
(function () {
  const PROD_API = 'https://genuine-cat-production-7821.up.railway.app/api';
  const DEV_API = 'http://localhost:5000/api';

  const isCapacitor =
    window.location.protocol === 'capacitor:' ||
    !!window.Capacitor;

  const isElectron =
    /electron/i.test(navigator.userAgent) || window.location.protocol === 'file:';

  const isLocalDevBrowser =
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    window.location.port === '5500' &&
    !isCapacitor &&
    !isElectron;

  window.APP_CONFIG = {
    API_BASE: isLocalDevBrowser ? DEV_API : PROD_API,
    WINDOWS_EXE_URL: 'https://github.com/SamiSahil/rsos/releases/download/v1.0/RestOS.Setup.1.0.0.exe',
  
    TAX_RATE: 0.05,
    CURRENCY_SYMBOL: '৳',
    CURRENCY_CODE: 'BDT',
    CURRENCY_NAME: 'Taka',
    ONLINE_PAYMENTS: {
      bKash: { label: 'bKash', merchantNumber: '01903048550', qrImage: './qr/bkash.jpeg' },
      Nagad: { label: 'Nagad', merchantNumber: '01903048550', qrImage: './qr/nagad.png' },
      Rocket: { label: 'Rocket', merchantNumber: '01903048550', qrImage: './qr/rocket.png' }
    }
  };
})();