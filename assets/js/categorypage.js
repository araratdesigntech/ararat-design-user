(() => {
  const detectApiBase = () => {
    // Prefer centrally configured runtime value if available
    if (window.ARARAT_API_BASE_URL) {
      return String(window.ARARAT_API_BASE_URL).replace(/\/$/, '');
    }
    if (window.Storefront?.config?.API_BASE_URL) {
      return window.Storefront.config.API_BASE_URL.replace(/\/$/, '');
    }
    const bodyAttr = document.body?.dataset?.apiBase;
    if (bodyAttr) {
      if (/^https?:\/\//i.test(bodyAttr)) {
        return bodyAttr.replace(/\/$/, '');
      }
      return `${window.location.origin.replace(/\/$/, '')}/${bodyAttr.replace(/^\//, '')}`;
    }
    if (window.location.protocol === 'file:' || !window.location.origin) {
      return String(window.ARARAT_API_BASE_URL || window.Storefront?.config?.API_BASE_URL || '');
    }
    if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      return String(window.ARARAT_API_BASE_URL || window.Storefront?.config?.API_BASE_URL || '');
    }
    // Production API URL (prefer central config)
    return String(window.ARARAT_API_BASE_URL || window.Storefront?.config?.API_BASE_URL || '');
  };

  const API_BASE_URL = detectApiBase();

  const state = {
    page: 1,
    limit: 12,
    sort: '-createdAt',
    search: '',
    category: '',
    categoryLabel: '',
    priceMin: '',
    priceMax: '',
  };

  // Store categories data globally for minimum amount calculations
  let categoriesData = [];

  const els = {
    grid: document.getElementById('categoryProductGrid'),
    empty: document.getElementById('categoryEmptyState'),
    error: document.getElementById('categoryErrorState'),
    summary: document.getElementById('categorySummary'),
    heroTitle: document.getElementById('categoryHeroTitle'),
    heroSubtitle: document.getElementById('categoryHeroSubtitle'),
    breadcrumbCategoryLabel: document.getElementById('breadcrumbCategoryLabel'),
    pagination: document.getElementById('categoryPagination'),
    sortSelect: document.getElementById('sortSelect'),
    limitSelect: document.getElementById('limitSelect'),
    searchInput: document.getElementById('categorySearchInput'),
    searchBtn: document.getElementById('categorySearchBtn'),
    categoryList: document.getElementById('categoryFilterList'),
    clearCategoryBtn: document.getElementById('clearCategoryFilter'),
    priceMinInput: document.getElementById('priceMinInput'),
    priceMaxInput: document.getElementById('priceMaxInput'),
    applyPriceBtn: document.getElementById('applyPriceFilterBtn'),
    resetAllBtn: document.getElementById('resetAllFiltersBtn'),
    quickFilterChips: document.querySelectorAll('#quickFilterChips .filter-chip'),
    activeFilters: document.getElementById('activeFilters'),
    openFiltersBtn: document.getElementById('openFiltersBtn'),
    closeFiltersBtn: document.getElementById('closeFiltersBtn'),
    filterOverlay: document.querySelector('.filter-overlay'),
    categoryMinimumAmount: document.getElementById('categoryMinimumAmount'),
    categoryMinimumAmountValue: document.getElementById('categoryMinimumAmountValue'),
  };

  const formatCurrency = (value = 0) => {
    try {
      return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(
        value
      );
    } catch (error) {
      return `₦${value}`;
    }
  };

  const skeletonMarkup = () => {
    return Array.from({ length: 6 })
      .map(
        () => `<div class="col-md-4 col-6">
        <div class="storefront-card placeholder-wave">
          <div class="storefront-card__image bg-light"></div>
          <div class="product-detail mt-3">
            <div class="placeholder col-9 mb-2"></div>
            <div class="placeholder col-6"></div>
          </div>
        </div>
      </div>`
      )
      .join('');
  };

  const request = async (path) => {
    if (!API_BASE_URL) {
      throw new Error('API_BASE_URL is not configured');
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw data;
    }
    return data;
  };

  const toggleStateBlocks = ({ loading = false, empty = false, error = false }) => {
    if (loading) {
      els.grid.innerHTML = skeletonMarkup();
    }
    els.empty?.classList.toggle('d-none', !empty);
    els.error?.classList.toggle('d-none', !error);
    els.grid?.classList.toggle('d-none', empty || error);
  };

  const buildParams = () => {
    const params = new URLSearchParams();
    params.set('page', String(state.page));
    params.set('limit', String(state.limit));
    if (state.sort) params.set('sort', state.sort);
    if (state.search) params.set('search', state.search.trim());
    if (state.category) params.set('category', state.category);
    if (state.priceMin) params.set('price[gte]', state.priceMin);
    if (state.priceMax) params.set('price[lte]', state.priceMax);
    return params.toString();
  };

  const buildProductCard = (product) => {
    const imageUrl = product?.productImages?.[0]?.url || '../assets/images/fashion-1/product/17.jpg';
    const rating = product?.ratings || 0;
    const productName = product?.name || 'this product';
    const productId = product?._id || '';
    const whatsappMessage = encodeURIComponent(
      `Hello Ararat, I'm interested in "${productName}" (${productId}). Please share current options and availability.`
    );
    const whatsappLink = `https://wa.me/2340000000000?text=${whatsappMessage}`;

    return `<div class="col-xl-4 col-md-6 col-6">
      <div class="storefront-card">
        <div class="storefront-card__image">
          <a href="product-page(thumbnail).html?id=${product._id}">
            <img src="${imageUrl}" alt="${product?.name || 'Product'}" class="img-fluid blur-up lazyload w-100" />
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
          <a class="product-title text-capitalize" href="product-page(thumbnail).html?id=${product._id}">${product?.name || 'Product'}</a>
          <p class="text-muted small mb-1">${product?.stock || 'Made to order'}</p>
          <div class="d-flex justify-content-between align-items-center">
            <a
              href="${whatsappLink}"
              target="_blank"
              rel="noopener"
              class="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-2 storefront-card__whatsapp"
              title="Chat on WhatsApp to negotiate this product"
            >
              <i class="ri-whatsapp-line"></i>
              <span class="small">Chat to negotiate</span>
            </a>
            ${rating > 0 ? `<span class="badge bg-light text-dark">
              <i class="ri-star-fill text-warning me-1"></i>${Number(rating).toFixed(1)}
            </span>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  };

  const updateSummary = (payload) => {
    if (!els.summary) return;
    const total = payload?.totalDocs || 0;
    const currentCount = payload?.products?.length || 0;
    if (!currentCount) {
      els.summary.textContent = 'No products available for the selected filters.';
      if (els.heroTitle) els.heroTitle.textContent = state.categoryLabel || 'No products available';
      if (els.heroSubtitle) {
        els.heroSubtitle.textContent =
          'Try selecting another category or resetting your filters to view more pieces.';
      }
      return;
    }
    const start = (state.page - 1) * state.limit + 1;
    const end = start + currentCount - 1;
    els.summary.textContent = `Showing ${start}–${end} of ${total} products`;

    // Update hero and breadcrumb text
    const categoryName = state.categoryLabel || 'All products';
    if (els.heroTitle) {
      els.heroTitle.textContent = categoryName;
    }
    if (els.heroSubtitle) {
      els.heroSubtitle.textContent =
        state.categoryLabel
          ? 'You\'re viewing pieces from this category. Add favourites to your cart and negotiate details on WhatsApp.'
          : 'Browse all available pieces. Use the filters on the left to narrow down by category or other preferences.';
    }
    if (els.breadcrumbCategoryLabel) {
      els.breadcrumbCategoryLabel.textContent = categoryName;
    }
  };

  const renderProducts = (payload) => {
    const products = payload?.products || [];
    if (!products.length) {
      els.grid.innerHTML = '';
      toggleStateBlocks({ empty: true });
      updateSummary(payload);
      return;
    }
    els.grid.classList.remove('d-none');
    els.empty.classList.add('d-none');
    els.error.classList.add('d-none');
    els.grid.innerHTML = products.map(buildProductCard).join('');
    updateSummary(payload);
    
    // Update WhatsApp links in dynamically loaded products
    if (window.Storefront && typeof window.Storefront.syncAdminContact === 'function') {
      window.Storefront.syncAdminContact();
    }
  };

  const renderPagination = (payload) => {
    if (!els.pagination) return;
    const totalPages = payload?.totalPages || 1;
    const currentPage = payload?.currentPage?.page || 1;
    if (totalPages <= 1) {
      els.pagination.innerHTML = '';
      return;
    }
    const items = [];
    if (currentPage > 1) {
      items.push(
        `<li class="page-item"><a class="page-link" href="#!" data-page="${currentPage - 1}"><i class="ri-arrow-left-s-line"></i></a></li>`
      );
    }
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i += 1) {
      items.push(
        `<li class="page-item ${i === currentPage ? 'active' : ''}">
          <a class="page-link" href="#!" data-page="${i}">${i}</a>
        </li>`
      );
    }
    if (currentPage < totalPages) {
      items.push(
        `<li class="page-item"><a class="page-link" href="#!" data-page="${currentPage + 1}"><i class="ri-arrow-right-s-line"></i></a></li>`
      );
    }
    els.pagination.innerHTML = `<ul class="pagination pagination-rounded">${items.join('')}</ul>`;
  };

  const updateActiveFilters = () => {
    if (!els.activeFilters) return;
    const filters = [];
    if (state.search) {
      filters.push({ key: 'search', label: `Search: ${state.search}` });
    }
    if (state.category && state.categoryLabel) {
      filters.push({ key: 'category', label: `Category: ${state.categoryLabel}` });
    }
    if (state.priceMin || state.priceMax) {
      const minLabel = state.priceMin ? formatCurrency(state.priceMin) : 'Any';
      const maxLabel = state.priceMax ? formatCurrency(state.priceMax) : 'Any';
      filters.push({ key: 'price', label: `Price: ${minLabel} - ${maxLabel}` });
    }
    if (!filters.length) {
      els.activeFilters.innerHTML = '';
      return;
    }
    els.activeFilters.innerHTML = filters
      .map(
        (filter) => `<span class="badge rounded-pill d-flex align-items-center gap-2">
        ${filter.label}
        <button class="btn btn-link btn-sm p-0 text-danger" data-remove-filter="${filter.key}">
          <i class="ri-close-line"></i>
        </button>
      </span>`
      )
      .join('');
  };

  const handleActiveFilterRemoval = (key) => {
    switch (key) {
      case 'search':
        state.search = '';
        if (els.searchInput) els.searchInput.value = '';
        break;
      case 'category':
        state.category = '';
        state.categoryLabel = '';
        const checkedInput = els.categoryList?.querySelector('input[name="category-filter"]:checked');
        if (checkedInput) checkedInput.checked = false;
        const allOption = els.categoryList?.querySelector('input[name="category-filter"][value=""]');
        if (allOption) allOption.checked = true;
        break;
      case 'price':
        state.priceMin = '';
        state.priceMax = '';
        if (els.priceMinInput) els.priceMinInput.value = '';
        if (els.priceMaxInput) els.priceMaxInput.value = '';
        els.quickFilterChips?.forEach((chip) => {
          if (chip.dataset.priceMax || chip.dataset.priceMin) {
            chip.classList.remove('active');
          }
        });
        break;
      default:
        break;
    }
    state.page = 1;
    updateActiveFilters();
    loadProducts();
  };

  const loadProducts = async () => {
    if (!els.grid) return;
    toggleStateBlocks({ loading: true });
    try {
      const params = buildParams();
      const response = await request(`/products?${params}`);
      const payload = response?.data || {};
      renderProducts(payload);
      renderPagination(payload);
      updateActiveFilters();
    } catch (error) {
      console.error('Error loading products', error);
      toggleStateBlocks({ error: true });
      els.summary.textContent = 'Unable to load products.';
    }
  };

  const loadCategories = async () => {
    if (!els.categoryList) return;
    
    // Show loading state
    els.categoryList.innerHTML = `
      <div class="placeholder-wave">
        <div class="placeholder col-10 mb-2"></div>
        <div class="placeholder col-8 mb-2"></div>
        <div class="placeholder col-6 mb-2"></div>
      </div>
    `;
    
    try {
      let response;
      
      // Try using Storefront API first (preferred method)
      if (window.Storefront && typeof window.Storefront.apiRequest === 'function') {
        response = await window.Storefront.apiRequest('/categories?limit=50', { skipAuth: true });
      } else if (window.Storefront && window.Storefront.config && typeof window.Storefront.config.apiRequest === 'function') {
        response = await window.Storefront.config.apiRequest('/categories?limit=50', { skipAuth: true });
      } else {
        // Fallback to direct request
        response = await request('/categories?limit=50');
      }
      
      // Handle different response structures
      const categories = response?.data?.categories || response?.categories || [];
      
      // Store categories data globally
      categoriesData = categories;
      
      if (!Array.isArray(categories) || categories.length === 0) {
        els.categoryList.innerHTML = '<p class="text-muted small mb-0">No categories available.</p>';
        return;
      }
      
      // Build category filter markup
      let markup = `<div class="form-check mb-2">
        <input class="form-check-input" type="radio" name="category-filter" id="category-all" value="" checked>
        <label class="form-check-label" for="category-all">All categories</label>
      </div>`;
      
      markup += categories
        .map(
          (category) => {
            const categoryId = category._id || category.id || '';
            const categoryName = category.name || 'Unnamed Category';
            const minimumAmount = category.minimumAmount || 0;
            return `<div class="form-check mb-2">
              <input class="form-check-input" type="radio" name="category-filter" id="category-${categoryId}" value="${categoryId}" data-label="${categoryName}" data-minimum="${minimumAmount}">
              <label class="form-check-label text-capitalize" for="category-${categoryId}">${categoryName}</label>
            </div>`;
          }
        )
        .join('');
      
      els.categoryList.innerHTML = markup;
      
      // Re-bind category change event listeners after DOM update
      els.categoryList.querySelectorAll('input[name="category-filter"]').forEach(input => {
        if (!input.hasAttribute('data-listener-bound')) {
          input.setAttribute('data-listener-bound', 'true');
        }
      });
      
      // Apply category from URL if present
      applyCategoryFromUrl();
      
      // Update minimum amount display and price filter after categories are loaded
      updateMinimumAmountDisplay();
      updatePriceFilterMinimum();
      
    } catch (error) {
      console.error('Error loading categories:', error);
      els.categoryList.innerHTML = `
        <p class="text-danger small mb-2">Unable to load categories.</p>
        <button class="btn btn-sm btn-outline-primary" onclick="location.reload()">Retry</button>
      `;
    }
  };

  const resetQuickFilterChips = ({ sort = false, price = false } = {}) => {
    els.quickFilterChips?.forEach((chip) => {
      if (sort && chip.dataset.sort) chip.classList.remove('active');
      if (price && (chip.dataset.priceMax || chip.dataset.priceMin)) chip.classList.remove('active');
    });
  };

  /**
   * Get minimum amount from all categories
   */
  const getAllCategoriesMinimumAmount = () => {
    if (!categoriesData || categoriesData.length === 0) return 0;
    const amounts = categoriesData
      .map(cat => cat.minimumAmount || 0)
      .filter(amount => amount > 0);
    return amounts.length > 0 ? Math.min(...amounts) : 0;
  };

  /**
   * Get minimum amount for selected category
   */
  const getSelectedCategoryMinimumAmount = () => {
    if (!els.categoryList) return null;
    const selectedInput = els.categoryList.querySelector(`input[name="category-filter"]:checked`);
    if (!selectedInput) return null;
    
    // If "All categories" is selected (empty value), return null
    if (!selectedInput.value || selectedInput.value === '') return null;
    
    const minimumAmount = selectedInput.dataset.minimum;
    return minimumAmount && minimumAmount !== '0' && minimumAmount !== '' ? Number(minimumAmount) : null;
  };

  /**
   * Update minimum amount display in hero section
   */
  const updateMinimumAmountDisplay = () => {
    if (!els.categoryMinimumAmount || !els.categoryMinimumAmountValue) {
      console.warn('[CategoryPage] Minimum amount display elements not found');
      return;
    }
    
    const selectedCategoryMin = getSelectedCategoryMinimumAmount();
    
    if (selectedCategoryMin && selectedCategoryMin > 0) {
      // Show minimum amount for selected category
      els.categoryMinimumAmountValue.textContent = formatCurrency(selectedCategoryMin);
      els.categoryMinimumAmount.style.display = 'block';
      console.log('[CategoryPage] Displaying minimum amount:', selectedCategoryMin);
    } else {
      // Hide if no category selected or no minimum amount
      els.categoryMinimumAmount.style.display = 'none';
      console.log('[CategoryPage] Hiding minimum amount display');
    }
  };

  /**
   * Update price filter minimum input based on selected category or all categories
   */
  const updatePriceFilterMinimum = () => {
    if (!els.priceMinInput) {
      console.warn('[CategoryPage] Price min input element not found');
      return;
    }
    
    const selectedCategoryMin = getSelectedCategoryMinimumAmount();
    let minimumPrice = 0;
    
    if (selectedCategoryMin && selectedCategoryMin > 0) {
      // Use selected category's minimum amount
      minimumPrice = selectedCategoryMin;
      console.log('[CategoryPage] Using selected category minimum:', minimumPrice);
    } else {
      // Use minimum of all categories
      minimumPrice = getAllCategoriesMinimumAmount();
      console.log('[CategoryPage] Using all categories minimum:', minimumPrice);
    }
    
    // Only update if there's a valid minimum and the input is empty or has a lower value
    if (minimumPrice > 0) {
      const currentValue = Number(els.priceMinInput.value) || 0;
      if (currentValue === 0 || currentValue < minimumPrice) {
        els.priceMinInput.value = minimumPrice;
        els.priceMinInput.setAttribute('min', minimumPrice.toString());
        // Update state if it was empty
        if (!state.priceMin || Number(state.priceMin) < minimumPrice) {
          state.priceMin = minimumPrice.toString();
        }
        console.log('[CategoryPage] Updated price filter minimum to:', minimumPrice);
      }
    } else {
      // Reset min attribute if no minimum
      els.priceMinInput.setAttribute('min', '0');
      console.log('[CategoryPage] No minimum price found, resetting to 0');
    }
  };

  const bindEvents = () => {
    els.sortSelect?.addEventListener('change', () => {
      state.sort = els.sortSelect.value;
      state.page = 1;
      resetQuickFilterChips({ sort: true });
      loadProducts();
    });

    els.limitSelect?.addEventListener('change', () => {
      state.limit = Number(els.limitSelect.value) || 12;
      state.page = 1;
      loadProducts();
    });

    const submitSearch = () => {
      state.search = els.searchInput?.value?.trim() || '';
      state.page = 1;
      loadProducts();
    };

    els.searchBtn?.addEventListener('click', submitSearch);
    els.searchInput?.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitSearch();
      }
    });

    els.categoryList?.addEventListener('change', (event) => {
      const target = event.target;
      if (target && target.matches('input[name="category-filter"]')) {
        state.category = target.value;
        state.categoryLabel = target.dataset.label || '';
        state.page = 1;
        
        // Update minimum amount display and price filter
        updateMinimumAmountDisplay();
        updatePriceFilterMinimum();
        
        loadProducts();
      }
    });

    els.clearCategoryBtn?.addEventListener('click', () => {
      state.category = '';
      state.categoryLabel = '';
      const allOption = els.categoryList?.querySelector('#category-all');
      if (allOption) allOption.checked = true;
      state.page = 1;
      
      // Update minimum amount display and price filter
      updateMinimumAmountDisplay();
      updatePriceFilterMinimum();
      
      loadProducts();
    });

    els.applyPriceBtn?.addEventListener('click', () => {
      state.priceMin = els.priceMinInput?.value || '';
      state.priceMax = els.priceMaxInput?.value || '';
      resetQuickFilterChips({ price: true });
      state.page = 1;
      loadProducts();
    });

    els.resetAllBtn?.addEventListener('click', () => {
      state.page = 1;
      state.limit = 12;
      state.sort = '-createdAt';
      state.search = '';
      state.category = '';
      state.categoryLabel = '';
      state.priceMin = '';
      state.priceMax = '';
      if (els.searchInput) els.searchInput.value = '';
      if (els.priceMinInput) els.priceMinInput.value = '';
      if (els.priceMaxInput) els.priceMaxInput.value = '';
      if (els.sortSelect) els.sortSelect.value = '-createdAt';
      if (els.limitSelect) els.limitSelect.value = '12';
      const allOption = els.categoryList?.querySelector('#category-all');
      if (allOption) allOption.checked = true;
      resetQuickFilterChips({ sort: true, price: true });
      
      // Update minimum amount display and price filter
      updateMinimumAmountDisplay();
      updatePriceFilterMinimum();
      
      updateActiveFilters();
      loadProducts();
    });

    els.quickFilterChips?.forEach((chip) => {
      chip.addEventListener('click', () => {
        const { sort, priceMax, priceMin } = chip.dataset;
        let shouldReload = false;
        if (sort) {
          const isActive = !chip.classList.contains('active');
          resetQuickFilterChips({ sort: true });
          if (isActive) {
            chip.classList.add('active');
            state.sort = sort;
            if (els.sortSelect) els.sortSelect.value = sort;
          } else {
            state.sort = '-createdAt';
            if (els.sortSelect) els.sortSelect.value = '-createdAt';
          }
          shouldReload = true;
        }
        if (priceMax || priceMin) {
          const isActive = !chip.classList.contains('active');
          resetQuickFilterChips({ price: true });
          if (isActive) {
            chip.classList.add('active');
            state.priceMax = priceMax || '';
            state.priceMin = priceMin || '';
            if (els.priceMaxInput) els.priceMaxInput.value = state.priceMax;
            if (els.priceMinInput) els.priceMinInput.value = state.priceMin;
          } else {
            state.priceMax = '';
            state.priceMin = '';
            if (els.priceMaxInput) els.priceMaxInput.value = '';
            if (els.priceMinInput) els.priceMinInput.value = '';
          }
          shouldReload = true;
        }
        if (shouldReload) {
          state.page = 1;
          loadProducts();
        }
      });
    });

    els.pagination?.addEventListener('click', (event) => {
      const target = event.target.closest('[data-page]');
      if (!target) return;
      event.preventDefault();
      const page = Number(target.getAttribute('data-page'));
      if (!Number.isNaN(page) && page !== state.page) {
        state.page = page;
        loadProducts();
      }
    });

    els.activeFilters?.addEventListener('click', (event) => {
      const target = event.target.closest('[data-remove-filter]');
      if (!target) return;
      event.preventDefault();
      const key = target.getAttribute('data-remove-filter');
      handleActiveFilterRemoval(key);
    });

    // Mobile filter open/close
    const openFilters = () => {
      document.body.classList.add('filters-open');
    };

    const closeFilters = () => {
      document.body.classList.remove('filters-open');
    };

    els.openFiltersBtn?.addEventListener('click', openFilters);
    els.closeFiltersBtn?.addEventListener('click', closeFilters);
    els.filterOverlay?.addEventListener('click', closeFilters);
  };

  /**
   * Get category from URL parameter and set it in state
   */
  const getCategoryFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const categoryId = urlParams.get('category');
    if (categoryId) {
      state.category = categoryId;
      // Update URL without reload
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }
  };

  /**
   * Set category filter after categories are loaded
   */
  const applyCategoryFromUrl = () => {
    if (!state.category || !els.categoryList) return;
    
    // Find the category input and check it
    const categoryInput = els.categoryList.querySelector(`input[value="${state.category}"]`);
    if (categoryInput) {
      categoryInput.checked = true;
      // Get category label from the input's dataset or label
      const labelElement = categoryInput.closest('.form-check')?.querySelector('label');
      if (labelElement) {
        state.categoryLabel = labelElement.textContent.trim();
      }
      
      // Update minimum amount display and price filter
      updateMinimumAmountDisplay();
      updatePriceFilterMinimum();
    }
  };

  /**
   * Load categories into the side navigation menu
   */
  const loadSideMenuCategories = async () => {
    const sideMenu = document.getElementById('sub-menu');
    if (!sideMenu) return;

    // Show loading state
    sideMenu.innerHTML = `
      <li class="category-loading">
        <a href="#!" class="text-muted">
          <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          Loading categories...
        </a>
      </li>
    `;

    try {
      let response;
      
      // Try using Storefront API first (preferred method)
      if (window.Storefront && typeof window.Storefront.apiRequest === 'function') {
        response = await window.Storefront.apiRequest('/categories?limit=50', { skipAuth: true });
      } else if (window.Storefront && window.Storefront.config && typeof window.Storefront.config.apiRequest === 'function') {
        response = await window.Storefront.config.apiRequest('/categories?limit=50', { skipAuth: true });
      } else {
        // Fallback to direct request
        response = await request('/categories?limit=50');
      }
      
      // Handle different response structures
      const categories = response?.data?.categories || response?.categories || [];
      
      if (!Array.isArray(categories) || categories.length === 0) {
        sideMenu.innerHTML = `
          <li>
            <a href="category-page.html" class="text-muted">All Categories</a>
          </li>
          <li>
            <a href="#!" class="text-muted small">No categories available</a>
          </li>
        `;
        return;
      }
      
      // Build menu items
      let markup = '';
      
      // Add "All Categories" option first
      markup += `<li>
        <a href="category-page.html">All Categories</a>
      </li>`;
      
      // Add each category
      markup += categories
        .map(
          (category) => {
            const categoryId = category._id || category.id || '';
            const categoryName = category.name || 'Unnamed Category';
            return `<li>
              <a href="category-page.html?category=${categoryId}">${categoryName}</a>
            </li>`;
          }
        )
        .join('');
      
      sideMenu.innerHTML = markup;
      
    } catch (error) {
      console.error('Error loading side menu categories:', error);
      sideMenu.innerHTML = `
        <li>
          <a href="category-page.html">All Categories</a>
        </li>
        <li>
          <a href="#!" class="text-danger small">Unable to load categories</a>
        </li>
      `;
    }
  };

  const init = async () => {
    if (!els.grid) return;
    
    // Get category from URL first
    getCategoryFromUrl();
    
    // Wait for Storefront to be available (it should load before this script)
    let retries = 0;
    const maxRetries = 30; // Increased retries for slower connections
    while (!window.Storefront && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    
    if (retries >= maxRetries) {
      console.warn('[CategoryPage] Storefront not available after waiting, proceeding with direct API calls');
    }
    
    bindEvents();
    
    // Load categories first, then products
    try {
      await Promise.all([
        loadCategories(),
        loadSideMenuCategories() // Load side menu categories in parallel
      ]);
      // Apply category filter after categories are loaded
      applyCategoryFromUrl();
    } catch (error) {
      console.error('[CategoryPage] Failed to load categories:', error);
    }
    
    // Load products regardless of category loading status
    loadProducts();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded
    init();
  }
})();
