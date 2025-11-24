/**
 * Categories Loader
 * Loads categories from API and populates navbar dropdown and side panel
 */

(function() {
  'use strict';

  /**
   * Load categories from API
   */
  async function loadCategories() {
    try {
      // Wait for Storefront to be available
      let retries = 0;
      while (!window.Storefront && retries < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }

      if (!window.Storefront || !window.Storefront.config || !window.Storefront.config.apiRequest) {
        console.warn('Storefront API not available, skipping category load');
        return;
      }

      // Fetch categories from API
      const response = await window.Storefront.config.apiRequest('/categories?limit=50', {
        skipAuth: true
      });

      const categories = response?.data?.categories || [];
      
      if (categories.length === 0) {
        console.warn('No categories found');
        return;
      }

      // Populate navbar dropdown
      populateNavbarDropdown(categories);
      
      // Populate side panel
      populateSidePanel(categories);

    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  /**
   * Populate navbar dropdown with categories
   */
  function populateNavbarDropdown(categories) {
    // Find all Categories dropdowns in navbar
    const dropdownIds = ['navbar-categories-dropdown', 'navbar-categories-dropdown-mobile'];
    const dropdowns = [];
    
    dropdownIds.forEach(id => {
      const ul = document.getElementById(id);
      if (ul) dropdowns.push(ul);
    });
    
    // If not found by ID, try to find by text content
    if (dropdowns.length === 0) {
      const navbarMenus = [
        document.querySelector('.sm-horizontal'),
        document.querySelector('#main-menu'),
        document.querySelector('nav ul.sm-horizontal')
      ].filter(Boolean);
      
      navbarMenus.forEach(navbarMenu => {
        const categoriesLi = Array.from(navbarMenu.querySelectorAll('li')).find(li => {
          const link = li.querySelector('a');
          return link && link.textContent.trim().toLowerCase() === 'categories';
        });

        if (categoriesLi) {
          let categoriesUl = categoriesLi.querySelector('ul');
          if (!categoriesUl) {
            categoriesUl = document.createElement('ul');
            categoriesLi.appendChild(categoriesUl);
          }
          dropdowns.push(categoriesUl);
        }
      });
    }

    if (dropdowns.length === 0) {
      console.warn('Navbar categories dropdown not found');
      return;
    }

    // Populate all found dropdowns
    dropdowns.forEach(categoriesUl => {
      // Clear loading state
      categoriesUl.innerHTML = '';
      
      // Add categories to dropdown
      categories.forEach(category => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `./category-page.html?category=${encodeURIComponent(category._id)}`;
        a.textContent = category.name;
        li.appendChild(a);
        categoriesUl.appendChild(li);
      });
    });
  }

  /**
   * Populate side panel with categories
   */
  function populateSidePanel(categories) {
    // Find the side panel menu
    const sidePanel = document.getElementById('sub-menu');
    if (!sidePanel) {
      console.warn('Side panel menu not found');
      return;
    }

    // Find and remove loading spinner
    const loadingLi = sidePanel.querySelector('li .spinner-border');
    if (loadingLi) {
      const loadingParent = loadingLi.closest('li');
      if (loadingParent) {
        loadingParent.remove();
      }
    }

    // Remove any existing dummy categories that aren't "Shop"
    const existingItems = Array.from(sidePanel.querySelectorAll('li'));
    existingItems.forEach(li => {
      const link = li.querySelector('a');
      if (link) {
        const text = link.textContent.trim().toLowerCase();
        // Keep "Shop" link, remove everything else that's not a category from API
        if (text !== 'shop' && !link.href.includes('category-page.html?category=')) {
          li.remove();
        }
      }
    });

    // Add categories to side panel
    categories.forEach(category => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `./category-page.html?category=${encodeURIComponent(category._id)}`;
      a.textContent = category.name;
      li.appendChild(a);
      sidePanel.appendChild(li);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCategories);
  } else {
    // DOM already loaded
    loadCategories();
  }
})();

