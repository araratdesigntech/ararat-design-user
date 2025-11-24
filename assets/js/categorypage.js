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

  const els = {
    grid: document.getElementById('categoryProductGrid'),
    empty: document.getElementById('categoryEmptyState'),
    error: document.getElementById('categoryErrorState'),
    summary: document.getElementById('categorySummary'),
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
    const response = await fetch(`${API_BASE_URL}${path}`);
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
            <div class="d-flex align-items-center flex-wrap gap-2">
              <h4 class="price mb-0">${formatCurrency(product?.price || 0)}</h4>
              <span class="price-badge" title="Prices are negotiable and can be customized to suit your budget">
                <i class="ri-price-tag-3-line"></i>
                Negotiable
              </span>
            </div>
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
      return;
    }
    const start = (state.page - 1) * state.limit + 1;
    const end = start + currentCount - 1;
    els.summary.textContent = `Showing ${start}–${end} of ${total} products`;
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
    try {
      // Wait for Storefront API to be available, fallback to direct request
      let response;
      if (window.Storefront && window.Storefront.config && window.Storefront.config.apiRequest) {
        response = await window.Storefront.config.apiRequest('/categories?limit=50', { skipAuth: true });
      } else {
        // Fallback to direct request if Storefront not available yet
        response = await request('/categories?limit=50');
      }
      
      const categories = response?.data?.categories || [];
      
      if (categories.length === 0) {
        els.categoryList.innerHTML = '<p class="text-muted small mb-0">No categories available.</p>';
        return;
      }
      
      let markup = `<div class="form-check mb-2">
        <input class="form-check-input" type="radio" name="category-filter" id="category-all" value="" checked>
        <label class="form-check-label" for="category-all">All categories</label>
      </div>`;
      markup += categories
        .map(
          (category) => `<div class="form-check mb-2">
            <input class="form-check-input" type="radio" name="category-filter" id="category-${category._id}" value="${
            category._id
          }" data-label="${category.name}">
            <label class="form-check-label text-capitalize" for="category-${category._id}">${category.name}</label>
          </div>`
        )
        .join('');
      els.categoryList.innerHTML = markup;
    } catch (error) {
      console.error('Error loading categories', error);
      els.categoryList.innerHTML = '<p class="text-danger small mb-0">Unable to load categories. Please try again later.</p>';
    }
  };

  const resetQuickFilterChips = ({ sort = false, price = false } = {}) => {
    els.quickFilterChips?.forEach((chip) => {
      if (sort && chip.dataset.sort) chip.classList.remove('active');
      if (price && (chip.dataset.priceMax || chip.dataset.priceMin)) chip.classList.remove('active');
    });
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
        loadProducts();
      }
    });

    els.clearCategoryBtn?.addEventListener('click', () => {
      state.category = '';
      state.categoryLabel = '';
      const allOption = els.categoryList?.querySelector('#category-all');
      if (allOption) allOption.checked = true;
      state.page = 1;
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
  };

  const init = async () => {
    if (!els.grid) return;
    
    // Wait for Storefront to be available (it should load before this script)
    let retries = 0;
    while (!window.Storefront && retries < 20) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    
    bindEvents();
    await loadCategories();
    loadProducts();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded
    init();
  }
})();
