window.addEventListener("DOMContentLoaded", () => {
  if (window.Storefront && typeof window.Storefront.renderFeaturedProducts === "function") {
    window.Storefront.renderFeaturedProducts();
  }
});
