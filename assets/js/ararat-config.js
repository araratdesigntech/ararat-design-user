// Centralized runtime API base detection for Ararat Design
// Sets window.ARARAT_API_BASE_URL and window.Storefront.config.API_BASE_URL
(function (window, document) {
  window.Storefront = window.Storefront || {};
  window.Storefront.config = window.Storefront.config || {};

  const detect = () => {
    const hostname = (window.location && window.location.hostname) || '';
    const protocol = (window.location && window.location.protocol) || '';

    // Local development (file:// or common localhost hosts)
    if (protocol === 'file:' || hostname === '' || ['localhost', '127.0.0.1'].includes(hostname)) {
      // Use the same port the project currently uses in the repo (8000)
      return 'http://localhost:8000/api/v1';
    }

    // Production API
    return 'https://api.araratdesigns.org/api/v1';
  };

  // Allow server/HTML override by setting window.ARARAT_API_BASE_URL before this file runs
  const resolved = (window.ARARAT_API_BASE_URL && String(window.ARARAT_API_BASE_URL).replace(/\/$/, '')) || detect();

  // Expose for other scripts
  window.ARARAT_API_BASE_URL = resolved;
  window.Storefront.config.API_BASE_URL = resolved;

  // Also set body data attribute so legacy code reading it continues to work
  if (document && document.body) {
    try {
      document.body.dataset.apiBase = resolved;
    } catch (e) {
      // ignore
    }
  }
})(window, document);
