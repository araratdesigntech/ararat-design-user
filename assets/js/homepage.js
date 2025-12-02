window.addEventListener("DOMContentLoaded", () => {
  if (window.Storefront && typeof window.Storefront.renderFeaturedProducts === "function") {
    window.Storefront.renderFeaturedProducts();
  }
  
  // Load and render categories carousel
  loadCategoriesCarousel();
});

/**
 * Load categories from API and render in carousel
 */
async function loadCategoriesCarousel() {
  const carouselContainer = document.getElementById('categories-carousel');
  if (!carouselContainer) return;

  try {
    // Wait for Storefront API to be available
    let retries = 0;
    while (!window.Storefront && retries < 20) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }

    if (!window.Storefront || !window.Storefront.config || !window.Storefront.config.apiRequest) {
      console.warn('Storefront API not available, skipping category carousel load');
      carouselContainer.innerHTML = '<p class="text-center text-muted">Categories will be available soon.</p>';
      return;
    }

    // Fetch categories from API
    const response = await window.Storefront.config.apiRequest('/categories?limit=50', {
      skipAuth: true
    });

    const categories = response?.data?.categories || [];
    
    if (categories.length === 0) {
      carouselContainer.innerHTML = '<p class="text-center text-muted">No categories available at the moment.</p>';
      return;
    }

    // Render categories
    renderCategoriesCarousel(categories, carouselContainer);

    // Initialize Slick carousel
    initializeCategoriesCarousel(carouselContainer);

  } catch (error) {
    console.error('Error loading categories carousel:', error);
    carouselContainer.innerHTML = '<p class="text-center text-danger">Unable to load categories. Please refresh the page.</p>';
  }
}

/**
 * Render categories in carousel format
 */
function renderCategoriesCarousel(categories, container) {
  if (!categories || categories.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No categories available.</p>';
    return;
  }

  let html = '';
  categories.forEach(category => {
    const categoryId = category._id || category.id;
    const categoryName = category.name || 'Unnamed Category';
    const categoryImage = category.image || './images/logo.jpg'; // Fallback image
    
    html += `
      <div class="category-card-circular">
        <a href="./category-page.html?category=${encodeURIComponent(categoryId)}">
          <div class="category-card-circular__image-wrapper">
            <img 
              src="${categoryImage}" 
              alt="${categoryName}" 
              class="category-card-circular__image img-fluid blur-up lazyload"
              loading="lazy"
            />
          </div>
          <div class="category-card-circular__label">${categoryName}</div>
        </a>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * Initialize Slick carousel for categories
 */
function initializeCategoriesCarousel(container) {
  // Wait for Slick to be available
  if (typeof jQuery === 'undefined' || typeof jQuery.fn.slick === 'undefined') {
    // Retry after a short delay
    setTimeout(() => {
      if (typeof jQuery !== 'undefined' && typeof jQuery.fn.slick !== 'undefined') {
        initSlick(container);
      }
    }, 500);
    return;
  }

  initSlick(container);
}

function initSlick(container) {
  // Check if already initialized
  if (jQuery(container).hasClass('slick-initialized')) {
    jQuery(container).slick('unslick');
  }

  jQuery(container).slick({
    dots: true,
    infinite: true,
    speed: 300,
    slidesToShow: 5,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    pauseOnHover: true,
    arrows: true,
    prevArrow: '<button type="button" class="slick-prev"><i class="ri-arrow-left-s-line"></i></button>',
    nextArrow: '<button type="button" class="slick-next"><i class="ri-arrow-right-s-line"></i></button>',
    responsive: [
      {
        breakpoint: 1200,
        settings: {
          slidesToShow: 4,
          slidesToScroll: 1
        }
      },
      {
        breakpoint: 992,
        settings: {
          slidesToShow: 3,
          slidesToScroll: 1
        }
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1
        }
      },
      {
        breakpoint: 576,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
          dots: true
        }
      }
    ]
  });
}
