// Only set ARARAT_API_BASE_URL if not already set (allows override from HTML)
if (!window.ARARAT_API_BASE_URL) {
  // Don't set a default - let the detection function handle it
  // This allows the detection logic to work properly in production
}

(function () {
  const detectApiBaseUrl = () => {
    const sanitize = (value) => value?.replace(/\/$/, '');
    const fromInlineConfig = () => {
      // Check for explicit configuration (set in HTML or by user)
      if (window.ARARAT_API_BASE_URL) {
        return sanitize(window.ARARAT_API_BASE_URL);
      }
      const metaContent = document.querySelector('meta[name="ararat-api-base"]')?.content;
      if (metaContent) {
        return sanitize(metaContent);
      }
      const bodyAttr = document.body?.dataset?.apiBase;
      // Only accept absolute URLs from body dataset to avoid accidentally
      // combining the frontend origin with an API path (which can point to
      // localhost when the frontend is served from a local dev host).
      if (bodyAttr && /^https?:\/\//i.test(bodyAttr)) {
        return sanitize(bodyAttr);
      }
      return null;
    };

    const inlineConfig = fromInlineConfig();
    if (inlineConfig) {
      return inlineConfig;
    }

    // If a centralized runtime config was injected earlier, prefer it
    if (window.Storefront && window.Storefront.config && window.Storefront.config.API_BASE_URL) {
      return sanitize(window.Storefront.config.API_BASE_URL);
    }

    // Fall back to legacy detection only when no centralized value is present
    if (window.location.protocol === 'file:' || window.location.hostname === '') {
      // Fall back to the centralized runtime config when available
      return sanitize(window.ARARAT_API_BASE_URL || window.Storefront?.config?.API_BASE_URL || '');
    }

    if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      return sanitize(window.ARARAT_API_BASE_URL || window.Storefront?.config?.API_BASE_URL || '');
    }

    // Production - prefer centralized config
    return sanitize(window.ARARAT_API_BASE_URL || window.Storefront?.config?.API_BASE_URL || '');
  };

  const API_BASE_URL = detectApiBaseUrl();
  
  // Debug: Log the detected API URL (remove in production if desired)
  console.log('[Storefront] Detected API Base URL:', API_BASE_URL);
  console.log('[Storefront] Current hostname:', window.location.hostname);
  
  const SESSION_KEY = 'ararat_session';

  const showAlert = (message, type = 'info') => {
    const container = document.createElement('div');
    container.className = `storefront-alert storefront-alert--${type}`;
    container.textContent = message;
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.padding = '12px 16px';
    container.style.zIndex = 9999;
    container.style.color = '#fff';
    container.style.borderRadius = '6px';
    container.style.backgroundColor =
      type === 'success' ? '#198754' : type === 'danger' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#0d6efd';
    document.body.appendChild(container);
    setTimeout(() => container.remove(), 4000);
  };

  const getSession = () => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  };

  const saveSession = (payload) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  };

  const clearSession = () => {
    localStorage.removeItem(SESSION_KEY);
  };

  // Prevent multiple simultaneous refresh token requests
  let refreshTokenPromise = null;
  let isRefreshing = false;

  const refreshAccessToken = async () => {
    const session = getSession();
    if (!session?.refreshToken) {
      return null;
    }

    // If already refreshing, wait for the existing refresh to complete
    if (isRefreshing && refreshTokenPromise) {
      return refreshTokenPromise;
    }

    // Start a new refresh attempt
    isRefreshing = true;
    refreshTokenPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data?.data?.user?.accessToken || !data?.data?.user?.refreshToken) {
          // Refresh token is invalid or expired - logout user
          console.warn('Refresh token failed - logging out user');
          clearSession();
          
          // Update header immediately after clearing session to reflect logged-out state
          // Use setTimeout to ensure DOM is ready, but also try immediately
          const updateHeader = () => {
            if (typeof updateHeaderAuth === 'function') {
              updateHeaderAuth();
            } else if (window.Storefront && typeof window.Storefront.updateHeaderAuth === 'function') {
              window.Storefront.updateHeaderAuth();
            }
          };
          
          // Try immediately
          updateHeader();
          
          // Also try after a short delay to ensure it runs
          setTimeout(updateHeader, 100);
          
          // Redirect to login if not already there
          if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
          }
          
          return null;
        }

        // Update session with new tokens
        const updatedSession = {
          ...session,
          accessToken: data.data.user.accessToken,
          refreshToken: data.data.user.refreshToken,
        };
        saveSession(updatedSession);
        
        // Update header if updateHeaderAuth is available (check both local and window object)
        const updateHeader = () => {
          if (typeof updateHeaderAuth === 'function') {
            updateHeaderAuth();
          } else if (window.Storefront && typeof window.Storefront.updateHeaderAuth === 'function') {
            window.Storefront.updateHeaderAuth();
          }
        };
        updateHeader();
        
        return updatedSession.accessToken;
      } catch (error) {
        console.error('Error refreshing access token:', error);
        // On error, logout user
        clearSession();
        
        // Update header immediately after clearing session to reflect logged-out state
        const updateHeader = () => {
          if (typeof updateHeaderAuth === 'function') {
            updateHeaderAuth();
          } else if (window.Storefront && typeof window.Storefront.updateHeaderAuth === 'function') {
            window.Storefront.updateHeaderAuth();
          }
        };
        
        // Try immediately
        updateHeader();
        
        // Also try after a short delay to ensure it runs
        setTimeout(updateHeader, 100);
        
        // Redirect to login if not already there
        if (!window.location.pathname.includes('login.html')) {
          window.location.href = 'login.html';
        }
        
        return null;
      } finally {
        isRefreshing = false;
        refreshTokenPromise = null;
      }
    })();

    return refreshTokenPromise;
  };

  const apiRequest = async (path, options = {}) => {
    const { method = 'GET', body, headers = {}, skipAuth = false, retryOn401 = true } = options;
    const session = getSession();
    const finalHeaders = { 'Content-Type': 'application/json', ...headers };
    let requestBody = body;

    if (body instanceof FormData) {
      delete finalHeaders['Content-Type'];
    } else if (body && typeof body !== 'string') {
      requestBody = JSON.stringify(body);
    }

    if (!skipAuth && session?.accessToken) {
      finalHeaders.Authorization = `Bearer ${session.accessToken}`;
    }

    const makeRequest = async (authToken) => {
      const reqHeaders = { ...finalHeaders };
      if (!skipAuth && authToken) {
        reqHeaders.Authorization = `Bearer ${authToken}`;
      }
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers: reqHeaders,
        body: requestBody,
      });
      const data = await response.json().catch(() => ({}));
      return { response, data };
    };

    let result = await makeRequest(session?.accessToken);

    // If 401 or 403 and retryOn401 is true, try to refresh token and retry once
    // 403 is returned when JWT is invalid/expired (from backend checkIsAuth middleware)
    // 401 is returned for other auth failures
    const isAuthError = (result.data?.status === 401 || result.response.status === 401) || 
                       (result.data?.status === 403 || result.response.status === 403);
    
    if (!result.response.ok && isAuthError && retryOn401 && !skipAuth) {
      const newAccessToken = await refreshAccessToken();
      if (newAccessToken) {
        // Retry the request with the new token
        result = await makeRequest(newAccessToken);
      } else {
        // Refresh failed - user has been logged out and redirected
        // Throw error to prevent further execution
        throw { status: 401, message: 'Session expired. Please login again.' };
      }
    }

    if (!result.response.ok) {
      throw result.data;
    }

    return result.data;
  };

  const formatCurrency = (value = 0) => {
    try {
      return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value);
    } catch (error) {
      return `₦${value}`;
    }
  };

  const ensureAuth = () => {
    const session = getSession();
    if (!session) {
      showAlert('Please login to continue.', 'warning');
      return false;
    }
    return true;
  };

  const protectPage = async () => {
    const session = getSession();
    if (!session) {
      window.location.href = 'login.html';
      return false;
    }

    // Try to verify the current access token by making a test request
    // apiRequest will automatically refresh token on 401, so we don't need to handle it separately
    try {
      await apiRequest('/auth/me', { retryOn401: true });
      return true;
    } catch (error) {
      // If we get here, either:
      // 1. The access token is invalid and refresh token is also expired/invalid
      // 2. Some other error occurred
      // In either case, clear session and redirect to login
      clearSession();
      showAlert('Your session has expired. Please login again.', 'warning');
      window.location.href = 'login.html';
      return false;
    }
  };

  const renderFeaturedProducts = async () => {
    const container = document.getElementById('special-product-container');
    const emptyState = document.getElementById('product-empty-state');
    const errorState = document.getElementById('product-error-state');
    if (!container) return;

    const setState = ({ empty = false, error = false }) => {
      if (emptyState) emptyState.classList.toggle('d-none', !empty);
      if (errorState) errorState.classList.toggle('d-none', !error);
    };

    const getSkeletonMarkup = () => {
      return Array.from({ length: 4 })
        .map(
          () => `<div class="col">
              <div class="basic-product theme-product-4 placeholder-wave storefront-card">
                <div class="storefront-card__image bg-light rounded"></div>
                <div class="product-detail mt-3">
                  <div class="placeholder col-9 mb-2"></div>
                  <div class="placeholder col-5"></div>
                </div>
              </div>
            </div>`
        )
        .join('');
    };

    setState({ empty: false, error: false });

    try {
      container.innerHTML = getSkeletonMarkup();
      const response = await apiRequest('/products?limit=8', { skipAuth: true });
      const products = response?.data?.products || [];
      if (!products.length) {
        container.innerHTML = '';
        setState({ empty: true, error: false });
        return;
      }
      container.innerHTML = '';
      products.forEach((product) => {
        const imageUrl = product?.productImages?.[0]?.url || '../assets/images/fashion-1/product/17.jpg';
        const rating = product?.ratings || 0;
        container.insertAdjacentHTML(
          'beforeend',
          `<div class="col">
            <div class="storefront-card">
              <div class="storefront-card__image">
                <a href="product-page(thumbnail).html?id=${product._id}">
                  <img src="${imageUrl}" class="img-fluid blur-up lazyload w-100" alt="${product.name}">
                </a>
                <div class="cart-info">
                  <button class="wishlist-icon" data-add-to-wishlist="${product._id}" title="Add to Wishlist" type="button">
                    <i class="ri-heart-line"></i>
                  </button>
                  <button title="Add to cart" data-add-to-cart="${product._id}" type="button">
                    <i class="ri-shopping-cart-line"></i>
                  </button>
                </div>
              </div>
              <div class="product-detail">
                <a class="product-title" href="product-page(thumbnail).html?id=${product._id}">
                  ${product.name}
                </a>
                <p class="text-muted small mb-1">${product?.stock || 'Made to order'}</p>
                <div class="d-flex justify-content-between align-items-center">
                  <h4 class="price mb-0">${formatCurrency(product.price)}</h4>
                  ${rating > 0 ? `<span class="badge bg-light text-dark">
                    <i class="ri-star-fill text-warning me-1"></i>${Number(rating).toFixed(1)}
                  </span>` : ''}
                </div>
              </div>
            </div>
          </div>`
        );
      });
    } catch (error) {
      container.innerHTML = '';
      setState({ empty: false, error: true });
    }
  };

  const refreshCartSummary = (items = []) => {
    const summary = document.querySelector('.cart_total .total span');
    if (!summary) return;
    const subtotal = items.reduce((acc, item) => acc + item.quantity * (item.product?.price || 0), 0);
    summary.textContent = formatCurrency(subtotal);
  };

  const updateCartCountBadge = async () => {
    const badges = document.querySelectorAll('.cart_qty_cls');
    if (!badges.length) return;
    
    const session = getSession();
    if (!session?.accessToken) {
      badges.forEach(badge => badge.textContent = '0');
      return;
    }

    try {
      const response = await apiRequest('/cart');
      const items = response?.data?.products || [];
      const totalQuantity = items.reduce((acc, item) => acc + (item.quantity || 0), 0);
      badges.forEach(badge => badge.textContent = totalQuantity.toString());
    } catch (error) {
      badges.forEach(badge => badge.textContent = '0');
    }
  };

  const initCartPage = async () => {
    const tableBodies = document.querySelectorAll('.cart-section .cart-table tbody');
    if (!tableBodies.length) return;
    const targetBody = tableBodies[0];
    tableBodies.forEach((body, index) => {
      if (index === 0) {
        body.innerHTML = '';
      } else {
        body.remove();
      }
    });

    // Check if user is authenticated - if not, protectPage will handle redirect
    const session = getSession();
    if (!session?.accessToken) {
      targetBody.innerHTML = `<tr><td colspan="6" class="text-center py-4">Please login to view your cart.</td></tr>`;
      updateCartTotalPrice(0);
      return;
    }

    try {
      const response = await apiRequest('/cart');
      const items = response?.data?.products || [];
      if (!items.length) {
        targetBody.innerHTML = `<tr><td colspan="6" class="text-center py-4">Your cart is empty.</td></tr>`;
        updateCartTotalPrice(0);
        return;
      }
      
      const totalPrice = items.reduce((sum, item) => sum + (item.quantity * (item.product?.price || 0)), 0);
      
      targetBody.innerHTML = '';
      items.forEach((item) => {
        const product = item.product || {};
        const imageUrl = product.productImages?.[0]?.url || '../assets/images/fashion-1/product/17.jpg';
        const price = product.price || 0;
        const quantity = item.quantity || 1;
        const itemTotal = price * quantity;
        
        targetBody.insertAdjacentHTML(
          'beforeend',
          `<tr>
            <td>
              <a href="product-page(thumbnail).html?id=${product._id}">
                <img src="${imageUrl}" class="img-fluid" alt="${product.name || 'Product'}">
              </a>
            </td>
            <td>
              <a href="product-page(thumbnail).html?id=${product._id}">${product.name || 'Product'}</a>
              <div class="mobile-cart-content row">
                <div class="col">
                  <div class="qty-box">
                    <div class="input-group qty-container">
                      <button class="btn qty-btn-minus" data-product-id="${product._id}" data-current-qty="${quantity}" type="button">
                        <i class="ri-arrow-left-s-line"></i>
                      </button>
                      <input type="number" readonly name="qty" class="form-control input-qty" value="${quantity}">
                      <button class="btn qty-btn-plus" data-product-id="${product._id}" type="button">
                        <i class="ri-arrow-right-s-line"></i>
                      </button>
                    </div>
                  </div>
                </div>
                <div class="col table-price">
                  <h2 class="td-color">${formatCurrency(price)}</h2>
                </div>
                <div class="col">
                  <h2 class="td-color">
                    <a href="#!" class="icon remove-btn" data-remove-cart="${product._id}">
                      <i class="ri-close-line"></i>
                    </a>
                  </h2>
                </div>
              </div>
            </td>
            <td class="table-price">
              <h2>${formatCurrency(price)}</h2>
            </td>
            <td>
              <div class="qty-box">
                <div class="input-group qty-container">
                  <button class="btn qty-btn-minus" data-product-id="${product._id}" data-current-qty="${quantity}" type="button">
                    <i class="ri-arrow-left-s-line"></i>
                  </button>
                  <input type="number" readonly name="qty" class="form-control input-qty" value="${quantity}">
                  <button class="btn qty-btn-plus" data-product-id="${product._id}" type="button">
                    <i class="ri-arrow-right-s-line"></i>
                  </button>
                </div>
              </div>
            </td>
            <td>
              <h2 class="td-color">${formatCurrency(itemTotal)}</h2>
            </td>
            <td>
              <a href="#!" class="icon remove-btn" data-remove-cart="${product._id}">
                <i class="ri-close-line"></i>
              </a>
            </td>
          </tr>`
        );
      });
      
      // Update total price in tfoot
      updateCartTotalPrice(totalPrice);
      
      // Bind quantity and remove button handlers
      bindCartPageQuantityButtons();
      bindCartPageRemoveButtons();
    } catch (error) {
      targetBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Unable to load cart. Please try again.</td></tr>`;
      updateCartTotalPrice(0);
    }
  };

  const updateCartTotalPrice = (total) => {
    const totalPriceElement = document.getElementById('cart-total-price');
    if (totalPriceElement) {
      totalPriceElement.textContent = formatCurrency(total);
    }
  };

  const bindCartPageQuantityButtons = () => {
    const minusBtns = document.querySelectorAll('.cart-section .qty-btn-minus');
    const plusBtns = document.querySelectorAll('.cart-section .qty-btn-plus');

    minusBtns.forEach((btn) => {
      btn.onclick = async () => {
        const productId = btn.getAttribute('data-product-id');
        const currentQty = parseInt(btn.getAttribute('data-current-qty') || '1');
        
        if (currentQty <= 1) {
          // Remove item if quantity is 1 or less
          try {
            await apiRequest('/cart/delete-item', {
              method: 'POST',
              body: { productId },
            });
            showAlert('Item removed from cart.', 'success');
            await initCartPage();
            updateCartCountBadge();
            // Refresh cart offcanvas if it's open
            const offcanvas = document.getElementById('cartOffcanvas');
            if (offcanvas && offcanvas.classList.contains('show')) {
              await renderCartOffcanvas();
            }
          } catch (error) {
            showAlert(error?.message || 'Unable to remove item.', 'danger');
          }
        } else {
          // For decreasing quantity, we need to remove and re-add with new quantity
          // This is a workaround until an update endpoint is available
          showAlert('Quantity update feature coming soon. Please remove and add again to change quantity.', 'info');
        }
      };
    });

    plusBtns.forEach((btn) => {
      btn.onclick = async () => {
        const productId = btn.getAttribute('data-product-id');
        try {
          await apiRequest('/cart', {
            method: 'POST',
            body: { productId },
          });
          showAlert('Quantity increased.', 'success');
          await initCartPage();
          updateCartCountBadge();
          // Refresh cart offcanvas if it's open
          const offcanvas = document.getElementById('cartOffcanvas');
          if (offcanvas && offcanvas.classList.contains('show')) {
            await renderCartOffcanvas();
          }
        } catch (error) {
          showAlert(error?.message || 'Unable to update quantity.', 'danger');
        }
      };
    });
  };

  const bindCartPageRemoveButtons = () => {
    const removeBtns = document.querySelectorAll('.cart-section [data-remove-cart]');
    removeBtns.forEach((btn) => {
      btn.onclick = async (e) => {
        e.preventDefault();
        const productId = btn.getAttribute('data-remove-cart');
        try {
          await apiRequest('/cart/delete-item', {
            method: 'POST',
            body: { productId },
          });
          showAlert('Item removed from cart.', 'success');
          await initCartPage();
          updateCartCountBadge();
          // Refresh cart offcanvas if it's open
          const offcanvas = document.getElementById('cartOffcanvas');
          if (offcanvas && offcanvas.classList.contains('show')) {
            await renderCartOffcanvas();
          }
        } catch (error) {
          showAlert(error?.message || 'Unable to remove item.', 'danger');
        }
      };
    });
  };

  const initWishlistPage = async () => {
    const tableBodies = document.querySelectorAll('.wishlist-section .cart-table tbody');
    if (!tableBodies.length) return;
    const targetBody = tableBodies[0];
    tableBodies.forEach((body, index) => {
      if (index === 0) {
        body.innerHTML = '';
      } else {
        body.remove();
      }
    });

    if (!ensureAuth()) {
      targetBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">Please login to view your wishlist.</td></tr>`;
      return;
    }

    try {
      const response = await apiRequest('/wishlist');
      const items = response?.data?.wishlist || [];
      if (!items.length) {
        targetBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">Your wishlist is empty.</td></tr>`;
        return;
      }
      targetBody.innerHTML = '';
      items.forEach((product) => {
        const productImage = product.productImages?.[0]?.url || product.images?.[0] || '../assets/images/fashion-1/product/17.jpg';
        const productName = product.name || 'Product';
        const productPrice = formatCurrency(product.price || 0);
        const productId = product._id || '';
        const productLink = productId ? `product-page(thumbnail).html?id=${productId}` : 'product-page(thumbnail).html';
        const stockStatus = product.stock && Number(product.stock) > 0 ? 'in stock' : 'out of stock';
        
        targetBody.insertAdjacentHTML(
          'beforeend',
          `<tr>
            <td>
              <a href="${productLink}">
                <img src="${productImage}" alt="${productName}" class="img-fluid">
              </a>
            </td>
            <td>
              <a href="${productLink}">${productName}</a>
              <div class="mobile-cart-content row">
                <div class="col">
                  <p>${stockStatus}</p>
                </div>
                <div class="col">
                  <h2 class="td-color">${productPrice}</h2>
                </div>
                <div class="col">
                  <h2 class="td-color">
                    <button class="btn btn-link text-danger p-0" data-remove-wishlist="${productId}" title="Remove">
                      <i class="ri-close-line"></i>
                    </button>
                    <button class="btn btn-link p-0" data-add-to-cart="${productId}" title="Add to cart">
                      <i class="ri-shopping-cart-line"></i>
                    </button>
                  </h2>
                </div>
              </div>
            </td>
            <td>
              <h2>${productPrice}</h2>
            </td>
            <td>
              <p>${stockStatus}</p>
            </td>
            <td>
              <div class="icon-box d-flex gap-2 justify-content-center">
                <button class="btn btn-link text-danger p-0" data-remove-wishlist="${productId}" title="Remove">
                  <i class="ri-close-line"></i>
                </button>
                <button class="btn btn-link p-0" data-add-to-cart="${productId}" title="Add to cart">
                  <i class="ri-shopping-cart-line"></i>
                </button>
              </div>
            </td>
          </tr>`
        );
      });
    } catch (error) {
      targetBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Unable to load wishlist.</td></tr>`;
    }
  };

  const initCheckoutForm = async () => {
    const checkoutContainer = document.querySelector('.checkout-form');
    if (!checkoutContainer) return;

    // Check if this is a custom checkout page (has #checkout-cart-items)
    // Don't replace the HTML if custom checkout structure exists
    if (document.querySelector('#checkout-cart-items') || window.__ARARAT_CUSTOM_CHECKOUT) {
      return; // Skip - custom checkout page already has its own structure
    }

    if (!ensureAuth()) {
      checkoutContainer.innerHTML = '<p>Please login to checkout.</p>';
      return;
    }

    checkoutContainer.innerHTML = `
      <div class="checkout-app-card">
        <h4 class="mb-3">Shipping Information</h4>
        <form id="checkout-form" class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Full Name</label>
            <input type="text" name="fullName" class="form-control" placeholder="Jane Doe" required>
          </div>
          <div class="col-md-6">
            <label class="form-label">Phone Number</label>
            <input type="text" name="phoneNo" class="form-control" placeholder="+2348012345678" required>
          </div>
          <div class="col-12">
            <label class="form-label">Address</label>
            <input type="text" name="address" class="form-control" placeholder="1234 Street Name" required>
          </div>
          <div class="col-md-6">
            <label class="form-label">City</label>
            <input type="text" name="city" class="form-control" placeholder="Lagos" required>
          </div>
          <div class="col-md-3">
            <label class="form-label">Country</label>
            <input type="text" name="country" class="form-control" placeholder="Nigeria" required>
          </div>
          <div class="col-md-3">
            <label class="form-label">Zip Code</label>
            <input type="text" name="zipCode" class="form-control" placeholder="100001" required>
          </div>
          <div class="col-12">
            <label class="form-label">Delivery Notes (Optional)</label>
            <textarea name="notes" class="form-control" rows="3" placeholder="Landmark or delivery instruction"></textarea>
          </div>
          <div class="col-12 d-flex justify-content-between align-items-center">
            <small class="text-muted">Payment is completed offline after invoice confirmation.</small>
            <button type="submit" class="btn btn-solid">Place Order</button>
          </div>
        </form>
        <div id="checkout-result" class="mt-4"></div>
      </div>
    `;

    const resultContainer = checkoutContainer.querySelector('#checkout-result');
    const form = checkoutContainer.querySelector('#checkout-form');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const fullName = formData.get('fullName') || '';
      const [name = '', surname = ''] = fullName.toString().split(' ');
      const payload = {
        shippingInfo: {
          address: formData.get('address'),
          phoneNo: formData.get('phoneNo'),
          zipCode: formData.get('zipCode'),
          status: 'pending',
          street: formData.get('address'),
          city: formData.get('city'),
          country: formData.get('country'),
        },
        paymentMethod: 'bank-transfer',
        shippingAmount: 0,
        textAmount: 0,
      };

      try {
        resultContainer.innerHTML = '<p>Creating order...</p>';
        const response = await apiRequest('/orders', {
          method: 'POST',
          body: payload,
        });
        const invoice = response?.data?.invoice;
        resultContainer.innerHTML = `
          <div class="alert alert-success">
            <h5>Order Created</h5>
            <p>Invoice Number: <strong>${invoice?.invoiceNumber || 'N/A'}</strong></p>
            <div class="d-flex gap-3 flex-wrap mt-2">
              ${
                invoice?.downloadUrl
                  ? `<a class="btn btn-outline-primary btn-sm" href="${invoice.downloadUrl}" target="_blank">Download Invoice</a>`
                  : ''
              }
              ${
                invoice?.whatsappUrl
                  ? `<a class="btn btn-solid btn-sm" href="${invoice.whatsappUrl}" target="_blank">Message Admin on WhatsApp</a>`
                  : ''
              }
            </div>
          </div>
        `;
        initCartPage();
      } catch (error) {
        const message = error?.message || 'Unable to create order.';
        resultContainer.innerHTML = `<p class="text-danger">${message}</p>`;
      }
    });
  };

  const syncAdminContact = async () => {
    try {
      const response = await apiRequest('/settings/public', { skipAuth: true });
      const phone = response?.data?.adminWhatsappNumber;
      if (!phone) return;
      document.querySelectorAll('.header-contact li').forEach((item) => {
        if (item.textContent.includes('Call Us')) {
          item.innerHTML = `<i class="ri-phone-fill"></i>Call Us: ${phone}`;
        }
      });
    } catch (error) {
      // ignore sync errors
    }
  };

  const updateHeaderAuth = () => {
    const session = getSession();
    const accountDropdowns = document.querySelectorAll('.mobile-account');
    
    accountDropdowns.forEach((dropdown) => {
      const dropdownMenu = dropdown.querySelector('.onhover-show-div');
      if (!dropdownMenu) return;

      // Find the welcome text in the same top-header
      const topHeader = dropdown.closest('.top-header');
      const welcomeText = topHeader?.querySelector('.header-contact li:first-child');

      if (session?.user && session?.accessToken) {
        // User is authenticated - show user menu
        const userName = session.user.name || session.user.firstName || session.user.surname || 'User';
        const fullName = session.user.name || 
                        (session.user.firstName && session.user.surname 
                          ? `${session.user.firstName} ${session.user.surname}` 
                          : session.user.firstName || session.user.surname || 'User');
        
        // Update welcome text
        if (welcomeText) {
          welcomeText.textContent = `Welcome, ${fullName}!`;
        }
        
        // Update dropdown menu
        dropdownMenu.innerHTML = `
          <li><a href="dashboard.html">Dashboard</a></li>
          <li><a href="profile.html">My Profile</a></li>
          <li><a href="wishlist.html">Wishlist</a></li>
          <li><a href="cart.html">My Cart</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a href="#!" data-user-logout>Logout</a></li>
        `;
        
        // Update account text to show user name
        const icon = dropdown.querySelector('i');
        // Remove all text nodes after the icon
        let nextNode = icon.nextSibling;
        while (nextNode) {
          if (nextNode.nodeType === Node.TEXT_NODE) {
            const toRemove = nextNode;
            nextNode = nextNode.nextSibling;
            toRemove.remove();
          } else {
            break;
          }
        }
        // Add user name as text
        icon.after(` ${fullName}`);
      } else {
        // User is not authenticated - show login/register menu
        // Restore welcome text
        if (welcomeText) {
          welcomeText.textContent = 'Welcome to Our store Ararat Design';
        }
        
        // Restore dropdown menu
        dropdownMenu.innerHTML = `
          <li><a href="login.html">Login</a></li>
          <li><a href="register.html">register</a></li>
        `;
        
        // Restore account text
        const icon = dropdown.querySelector('i');
        // Remove all text nodes after the icon
        let nextNode = icon.nextSibling;
        while (nextNode) {
          if (nextNode.nodeType === Node.TEXT_NODE) {
            const toRemove = nextNode;
            nextNode = nextNode.nextSibling;
            toRemove.remove();
          } else {
            break;
          }
        }
        // Add "My Account" as text
        icon.after(' My Account');
      }
    });
  };

  const handleLoginForm = () => {
    const form = document.getElementById('customer-login-form');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = form.querySelector('input[name="email"]')?.value?.trim();
      const password = form.querySelector('input[name="password"]')?.value;
      if (!email || !password) {
        showAlert('Please provide both email and password.', 'warning');
        return;
      }
      try {
        const response = await apiRequest('/auth/login', {
          method: 'POST',
          body: { email, password },
          skipAuth: true,
        });
        saveSession({
          accessToken: response?.data?.accessToken,
          refreshToken: response?.data?.refreshToken,
          user: response?.data?.user,
        });
        updateHeaderAuth();
        showAlert('Login successful.', 'success');
        window.location.href = 'index.html';
      } catch (error) {
        const message = error?.message || 'Unable to login.';
        showAlert(message, 'danger');
      }
    });
  };

  const handleRegisterForm = () => {
    const form = document.getElementById('customer-register-form');
    if (!form) return;
    const submitBtn = form.querySelector('button[type="submit"]');
    const profileImageInput = form.querySelector('input[name="profileImage"]');
    const previewWrapper = document.getElementById('registerPreviewWrapper');
    const previewImage = document.getElementById('registerPreviewImage');

    const initProfilePreview = () => {
      if (!profileImageInput || !previewWrapper || !previewImage) return;
      profileImageInput.addEventListener('change', () => {
        const file = profileImageInput.files?.[0];
        if (!file) {
          previewWrapper.classList.add('d-none');
          previewImage.removeAttribute('src');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          previewImage.src = reader.result;
          previewWrapper.classList.remove('d-none');
        };
        reader.readAsDataURL(file);
      });
    };

    initProfilePreview();

    const toggleButtonState = (isSubmitting) => {
      if (!submitBtn) return;
      submitBtn.disabled = isSubmitting;
      submitBtn.textContent = isSubmitting ? 'Creating account…' : 'Create account';
    };
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const firstName = form.querySelector('input[name="firstName"]')?.value?.trim();
      const lastName = form.querySelector('input[name="lastName"]')?.value?.trim();
      const email = form.querySelector('input[name="email"]')?.value?.trim();
      const phone = form.querySelector('input[name="phone"]')?.value?.trim();
      const password = form.querySelector('input[name="password"]')?.value;
      const confirmPassword = form.querySelector('input[name="confirmPassword"]')?.value;
      const acceptTerms = form.querySelector('input[name="acceptTerms"]')?.checked;

      if (!firstName || !lastName || !email || !password || !confirmPassword) {
        showAlert('Please complete all required fields.', 'warning');
        return;
      }
      if (password !== confirmPassword) {
        showAlert('Passwords do not match.', 'warning');
        return;
      }
      if (!profileImageInput?.files?.length) {
        showAlert('Please upload a profile photo.', 'warning');
        return;
      }
      if (!acceptTerms) {
        showAlert('Please accept the terms to continue.', 'warning');
        return;
      }

      const payload = new FormData();
      payload.append('name', firstName);
      payload.append('surname', lastName);
      payload.append('email', email);
      payload.append('password', password);
      payload.append('confirmPassword', confirmPassword);
      payload.append('acceptTerms', 'true');
      payload.append('jobTitle', 'Customer');
      payload.append('bio', `${firstName} ${lastName} - Ararat customer`);
      if (phone) payload.append('mobileNumber', phone);
      payload.append('profileImage', profileImageInput.files[0]);

      try {
        toggleButtonState(true);
        const response = await apiRequest('/auth/signup', {
          method: 'POST',
          body: payload,
          skipAuth: true,
        });
        // Save session if tokens are provided (user can use app while email verification is pending)
        if (response?.data?.user?.accessToken && response?.data?.user?.refreshToken) {
          saveSession({
            accessToken: response.data.user.accessToken,
            refreshToken: response.data.user.refreshToken,
            user: { email, name: firstName, surname: lastName },
          });
          updateHeaderAuth();
          // Update cart count badge if on homepage
          if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
            updateCartCountBadge();
          }
        }
        showAlert('Account created successfully! Welcome to Ararat Design.', 'success');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1500);
      } catch (error) {
        const message = error?.message || 'Unable to create account.';
        showAlert(message, 'danger');
      } finally {
        toggleButtonState(false);
      }
    });
  };

  const initCartOffcanvas = async () => {
    const offcanvas = document.getElementById('cartOffcanvas');
    if (!offcanvas) return;

    // Listen for Bootstrap offcanvas show event to refresh cart when opened
    offcanvas.addEventListener('show.bs.offcanvas', async () => {
      await renderCartOffcanvas();
    });

    // Initial render if offcanvas is already visible
    if (offcanvas.classList.contains('show')) {
      await renderCartOffcanvas();
    }
  };

  const renderCartOffcanvas = async () => {
    const offcanvasTitle = document.querySelector('#cartOffcanvas .offcanvas-title');
    const cartProductList = document.querySelector('#cartOffcanvas .cart-product');
    const cartTotalList = document.querySelector('#cartOffcanvas .cart_total');
    const clearCartBtn = document.querySelector('#cartOffcanvas .sidebar-title a');
    const preTextBox = document.querySelector('#cartOffcanvas .pre-text-box');

    if (!cartProductList || !cartTotalList) return;

    const session = getSession();
    if (!session?.accessToken) {
      offcanvasTitle.textContent = 'My Cart (0)';
      cartProductList.innerHTML = '<li class="text-center py-4"><p class="text-muted">Please login to view your cart.</p><a href="login.html" class="btn btn-sm btn-solid">Login</a></li>';
      cartTotalList.innerHTML = `
        <li>
          <div class="total">
            <h5>Sub Total : <span>${formatCurrency(0)}</span></h5>
          </div>
        </li>
        <li>
          <div class="buttons">
            <a href="cart.html" class="btn view-cart">View Cart</a>
            <a href="checkout.html" class="btn checkout">Check Out</a>
          </div>
        </li>
      `;
      if (preTextBox) preTextBox.style.display = 'none';
      return;
    }

    try {
      const response = await apiRequest('/cart');
      const items = response?.data?.products || [];
      const totalQuantity = items.reduce((acc, item) => acc + (item.quantity || 0), 0);
      const subtotal = items.reduce((acc, item) => acc + item.quantity * (item.product?.price || 0), 0);

      // Update title
      if (offcanvasTitle) {
        offcanvasTitle.textContent = `My Cart (${totalQuantity})`;
      }

      // Render cart items
      if (!items.length) {
        cartProductList.innerHTML = '<li class="text-center py-4"><p class="text-muted">Your cart is empty.</p><a href="category-page.html" class="btn btn-sm btn-solid">Continue Shopping</a></li>';
        if (preTextBox) preTextBox.style.display = 'none';
      } else {
        cartProductList.innerHTML = items
          .map((item) => {
            const product = item.product || {};
            const imageUrl = product.productImages?.[0]?.url || '../assets/images/fashion-1/product/17.jpg';
            const price = product.price || 0;
            const quantity = item.quantity || 1;
            const itemTotal = price * quantity;

            return `
              <li>
                <div class="media">
                  <a href="product-page(thumbnail).html">
                    <img src="${imageUrl}" class="img-fluid" alt="${product.name || 'Product'}" />
                  </a>
                  <div class="media-body">
                    <a href="product-page(thumbnail).html">
                      <h4>${product.name || 'Product'}</h4>
                    </a>
                    <h4 class="quantity">
                      <span>${quantity} x ${formatCurrency(price)}</span>
                    </h4>

                    <div class="qty-box">
                      <div class="input-group qty-container">
                        <button class="btn qty-btn-minus" data-product-id="${product._id}" data-current-qty="${quantity}" type="button">
                          <i class="ri-subtract-line"></i>
                        </button>
                        <input
                          type="number"
                          readonly
                          name="qty"
                          class="form-control input-qty"
                          value="${quantity}"
                        />
                        <button class="btn qty-btn-plus" data-product-id="${product._id}" type="button">
                          <i class="ri-add-line"></i>
                        </button>
                      </div>
                    </div>

                    <div class="close-circle">
                      <button class="close_button delete-button" data-remove-cart="${product._id}" type="button" title="Remove item">
                        <i class="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            `;
          })
          .join('');

        if (preTextBox) preTextBox.style.display = 'block';
        
        // Bind quantity buttons
        bindCartQuantityButtons();
        // Bind remove buttons
        bindCartRemoveButtons();
      }

      // Update total
      cartTotalList.innerHTML = `
        <li>
          <div class="total">
            <h5>Sub Total : <span>${formatCurrency(subtotal)}</span></h5>
          </div>
        </li>
        <li>
          <div class="buttons">
            <a href="cart.html" class="btn view-cart">View Cart</a>
            <a href="checkout.html" class="btn checkout">Check Out</a>
          </div>
        </li>
      `;

      // Bind clear cart button
      if (clearCartBtn && items.length > 0) {
        clearCartBtn.onclick = async (e) => {
          e.preventDefault();
          if (!confirm('Are you sure you want to clear your cart?')) return;
          try {
            await apiRequest('/cart/clear-cart', { method: 'DELETE' });
            showAlert('Cart cleared.', 'success');
            await renderCartOffcanvas();
            updateCartCountBadge();
            initCartPage();
          } catch (error) {
            showAlert(error?.message || 'Unable to clear cart.', 'danger');
          }
        };
      }
    } catch (error) {
      cartProductList.innerHTML = '<li class="text-center py-4 text-danger"><p>Unable to load cart items.</p></li>';
      if (preTextBox) preTextBox.style.display = 'none';
    }
  };

  const bindCartQuantityButtons = () => {
    const minusBtns = document.querySelectorAll('#cartOffcanvas .qty-btn-minus');
    const plusBtns = document.querySelectorAll('#cartOffcanvas .qty-btn-plus');

    minusBtns.forEach((btn) => {
      btn.onclick = async () => {
        const productId = btn.getAttribute('data-product-id');
        const currentQty = parseInt(btn.getAttribute('data-current-qty') || '1');
        
        if (currentQty <= 1) {
          // Remove item if quantity is 1 or less
          try {
            await apiRequest('/cart/delete-item', {
              method: 'POST',
              body: { productId },
            });
            showAlert('Item removed from cart.', 'success');
            await renderCartOffcanvas();
            updateCartCountBadge();
            initCartPage();
          } catch (error) {
            showAlert(error?.message || 'Unable to remove item.', 'danger');
          }
        } else {
          // For now, since there's no update endpoint, we'll remove and re-add with new quantity
          // This is not ideal but works with the current API
          showAlert('Quantity update feature coming soon. Please use the cart page to update quantities.', 'info');
        }
      };
    });

    plusBtns.forEach((btn) => {
      btn.onclick = async () => {
        const productId = btn.getAttribute('data-product-id');
        try {
          await apiRequest('/cart', {
            method: 'POST',
            body: { productId },
          });
          showAlert('Quantity increased.', 'success');
          await renderCartOffcanvas();
          updateCartCountBadge();
          initCartPage();
        } catch (error) {
          showAlert(error?.message || 'Unable to update quantity.', 'danger');
        }
      };
    });
  };

  const bindCartRemoveButtons = () => {
    const removeBtns = document.querySelectorAll('#cartOffcanvas [data-remove-cart]');
    removeBtns.forEach((btn) => {
      btn.onclick = async () => {
        const productId = btn.getAttribute('data-remove-cart');
        try {
          await apiRequest('/cart/delete-item', {
            method: 'POST',
            body: { productId },
          });
          showAlert('Item removed from cart.', 'success');
          await renderCartOffcanvas();
          updateCartCountBadge();
          initCartPage();
        } catch (error) {
          showAlert(error?.message || 'Unable to remove item.', 'danger');
        }
      };
    });
  };

  const handleGlobalActions = () => {
    document.addEventListener('click', async (event) => {
      const addCartBtn = event.target.closest('[data-add-to-cart]');
      if (addCartBtn) {
        if (!ensureAuth()) return;
        const productId = addCartBtn.getAttribute('data-add-to-cart');
        try {
          await apiRequest('/cart', {
            method: 'POST',
            body: { productId },
          });
          showAlert('Added to cart.', 'success');
          initCartPage();
          updateCartCountBadge();
          // Refresh cart offcanvas if it's open
          const offcanvas = document.getElementById('cartOffcanvas');
          if (offcanvas && offcanvas.classList.contains('show')) {
            await renderCartOffcanvas();
          }
        } catch (error) {
          showAlert(error?.message || 'Unable to add to cart.', 'danger');
        }
      }

      const addWishlistBtn = event.target.closest('[data-add-to-wishlist]');
      if (addWishlistBtn) {
        if (!ensureAuth()) return;
        const productId = addWishlistBtn.getAttribute('data-add-to-wishlist');
        try {
          await apiRequest(`/wishlist/${productId}`, {
            method: 'POST',
          });
          showAlert('Added to wishlist.', 'success');
          initWishlistPage();
        } catch (error) {
          showAlert(error?.message || 'Unable to add to wishlist.', 'danger');
        }
      }

      const removeCartBtn = event.target.closest('[data-remove-cart]');
      // Only handle remove buttons outside the offcanvas and cart-section (handled separately)
      if (removeCartBtn && !removeCartBtn.closest('#cartOffcanvas') && !removeCartBtn.closest('.cart-section')) {
        const productId = removeCartBtn.getAttribute('data-remove-cart');
        try {
          await apiRequest('/cart/delete-item', {
            method: 'POST',
            body: { productId },
          });
          showAlert('Item removed from cart.', 'success');
          initCartPage();
          updateCartCountBadge();
          // Refresh cart offcanvas if it's open
          const offcanvas = document.getElementById('cartOffcanvas');
          if (offcanvas && offcanvas.classList.contains('show')) {
            await renderCartOffcanvas();
          }
        } catch (error) {
          showAlert(error?.message || 'Unable to remove item.', 'danger');
        }
      }

      const removeWishlistBtn = event.target.closest('[data-remove-wishlist]');
      if (removeWishlistBtn) {
        const productId = removeWishlistBtn.getAttribute('data-remove-wishlist');
        try {
          await apiRequest(`/wishlist/${productId}`, {
            method: 'DELETE',
          });
          showAlert('Removed from wishlist.', 'success');
          initWishlistPage();
        } catch (error) {
          showAlert(error?.message || 'Unable to remove item.', 'danger');
        }
      }

      // Handle logout clicks
      const logoutBtn = event.target.closest('[data-user-logout]');
      if (logoutBtn) {
        event.preventDefault();
        if (confirm('Are you sure you want to logout?')) {
          if (window.Storefront && window.Storefront.logout) {
            window.Storefront.logout();
          } else {
            clearSession();
            updateHeaderAuth();
            window.location.href = 'login.html';
          }
        }
      }
    });
  };

  document.addEventListener('DOMContentLoaded', async () => {
    handleLoginForm();
    handleRegisterForm();
    syncAdminContact();
    updateHeaderAuth();
    
    // Check if this is a protected page (has protectPage called on it)
    const isProtectedPage = window.location.pathname.includes('cart.html') ||
                            window.location.pathname.includes('checkout.html') ||
                            window.location.pathname.includes('wishlist.html') ||
                            window.location.pathname.includes('profile.html') ||
                            window.location.pathname.includes('dashboard.html');
    
    // For protected pages, wait a bit to ensure protectPage runs first
    // protectPage will redirect if auth fails, so if we get here, auth is valid
    if (isProtectedPage) {
      // Small delay to ensure protectPage completes first
      await new Promise(resolve => setTimeout(resolve, 100));
      // If still on the page (protectPage didn't redirect), continue initialization
      if (!window.location.pathname.includes('login.html')) {
        initCartPage();
        initWishlistPage();
        initCheckoutForm();
      }
    } else {
      // Not a protected page, run initialization normally
      initCartPage();
      initWishlistPage();
      initCheckoutForm();
    }
    
    initCartOffcanvas();
    handleGlobalActions();
    // Update cart count badge on homepage
    updateCartCountBadge();
  });

  // Expose handleAddToCart and handleAddToWishlist functions
  const handleAddToCart = async (productId, quantity = 1) => {
    if (!ensureAuth()) return;
    try {
      await apiRequest('/cart', {
        method: 'POST',
        body: { productId, quantity },
      });
      showAlert('Added to cart.', 'success');
      initCartPage();
      updateCartCountBadge();
      // Refresh cart offcanvas if it's open
      const offcanvas = document.getElementById('cartOffcanvas');
      if (offcanvas && offcanvas.classList.contains('show')) {
        await renderCartOffcanvas();
      }
    } catch (error) {
      showAlert(error?.message || 'Unable to add to cart.', 'danger');
      throw error;
    }
  };

  const handleAddToWishlist = async (productId) => {
    if (!ensureAuth()) return;
    try {
      await apiRequest(`/wishlist/${productId}`, {
        method: 'POST',
      });
      showAlert('Added to wishlist.', 'success');
      initWishlistPage();
    } catch (error) {
      showAlert(error?.message || 'Unable to add to wishlist.', 'danger');
      throw error;
    }
  };

  window.Storefront = {
    config: {
      API_BASE_URL,
      apiRequest,
    },
    renderFeaturedProducts,
    getSession,
    protectPage,
    refreshAccessToken,
    showAlert,
    handleAddToCart,
    handleAddToWishlist,
    logout: () => {
      clearSession();
      updateHeaderAuth();
      showAlert('You have been logged out.', 'info');
      window.location.href = 'login.html';
    },
    updateHeaderAuth,
  };
})();

