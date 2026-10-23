/* ==========================================================================
   Storefront: catalogue, filters, quick view and bag interactions.
   Depends on js/api.js and js/shop-ui.js.
   ========================================================================== */

(() => {
  const grid = document.getElementById('productGrid');
  const filters = document.getElementById('filters');
  const search = document.getElementById('search');
  const sort = document.getElementById('sort');
  const resultCount = document.getElementById('resultCount');
  const emptyState = document.getElementById('emptyState');
  const loadError = document.getElementById('loadError');
  const loadErrorText = document.getElementById('loadErrorText');
  const retry = document.getElementById('retryLoad');
  const clearFilters = document.getElementById('clearFilters');
  const quickView = document.getElementById('quickView');

  const state = {
    allProducts: [],
    products: [],
    categories: [],
    category: 'All',
    q: '',
    sort: 'featured',
    controller: null,
    quickProduct: null,
    quickQty: 1,
    loadedOnce: false,
  };

  const skeletons = () => {
    if (!grid) return;
    grid.innerHTML = Array.from({ length: 6 }, () => `
      <div class="skeleton-card" aria-hidden="true">
        <div class="skeleton skeleton--media"></div>
        <div class="skeleton skeleton--line"></div>
        <div class="skeleton skeleton--line skeleton--short"></div>
      </div>`).join('');
  };

  const showError = (message) => {
    if (!loadError) return;
    loadError.hidden = false;
    loadErrorText.textContent = message;
    if (grid) grid.innerHTML = '';
    if (emptyState) emptyState.hidden = true;
    if (resultCount) resultCount.textContent = 'Catalogue unavailable';
  };

  const clearError = () => {
    if (loadError) loadError.hidden = true;
  };

  const renderFilters = () => {
    if (!filters) return;
    const total = state.categories.reduce((sum, item) => sum + item.count, 0);
    const items = [{ category: 'All', count: total }, ...state.categories];

    filters.innerHTML = items.map(({ category, count }) => `
      <button type="button" class="filter" data-category="${esc(category)}"
        aria-pressed="${category === state.category}">
        ${esc(category)}<span class="filter__n">${count}</span>
      </button>`).join('');
  };

  const renderProducts = () => {
    if (!grid) return;

    if (!state.products.length) {
      grid.innerHTML = '';
      if (emptyState) emptyState.hidden = false;
      resultCount.textContent = 'No objects found';
      return;
    }

    if (emptyState) emptyState.hidden = true;
    resultCount.textContent = state.q || state.category !== 'All'
      ? `${state.products.length} of ${state.allProducts.length} objects`
      : `${state.products.length} objects`;

    grid.innerHTML = state.products.map((p) => {
      const soldOut = p.stock < 1;
      const low = !soldOut && p.stock <= 3;
      return `
        <article class="product ${soldOut ? 'is-soldout' : ''}">
          <div class="product__media">
            <img src="${esc(p.image_url || FALLBACK_IMG)}" alt="${esc(p.name)}" loading="lazy">
            ${soldOut ? '<span class="product__tag product__tag--sold">Sold out</span>' : ''}
            ${low ? `<span class="product__tag">Only ${p.stock} left</span>` : ''}
            <button type="button" class="product__quick" data-quick="${esc(p.id)}"
              aria-label="Quick view: ${esc(p.name)}">↗</button>
          </div>
          <div class="product__body">
            <p class="product__cat">${esc(p.category || 'Object')}</p>
            <h3 class="product__name">${esc(p.name)}</h3>
            <p class="product__price">${money(p.price_minor, p.currency)}</p>
            <p class="product__stock">${soldOut ? 'Currently unavailable' : `${p.stock} in stock`}</p>
            <button type="button" class="product__add" data-add="${esc(p.id)}" ${soldOut ? 'disabled' : ''}>
              ${soldOut ? 'Sold out' : 'Add to bag'} <span>${soldOut ? '—' : '+'}</span>
            </button>
          </div>
        </article>`;
    }).join('');

    ShopUI.wireImageFallbacks(grid);
  };

  async function loadProducts({ firstLoad = false } = {}) {
    state.controller?.abort();
    state.controller = new AbortController();
    clearError();
    skeletons();

    const params = new URLSearchParams({ sort: state.sort });
    if (state.q) params.set('q', state.q);
    if (state.category !== 'All') params.set('category', state.category);

    try {
      const requests = [
        api(`/api/store/products?${params}`, { auth: false, signal: state.controller.signal }),
      ];
      if (!state.loadedOnce) {
        requests.push(api('/api/store/categories', { auth: false, signal: state.controller.signal }));
        requests.push(api('/api/store/products', { auth: false, signal: state.controller.signal }));
      }

      const [catalogue, categories, everything] = await Promise.all(requests);

      if (categories) state.categories = categories.data || [];
      if (everything) {
        state.allProducts = everything.data || [];
        ShopUI.hydrateProducts(state.allProducts);
      }

      state.products = catalogue.data || [];
      state.loadedOnce = true;

      renderFilters();
      renderProducts();
    } catch (err) {
      if (err.name === 'AbortError') return;
      showError(err.message);
    }
  }

  function openQuick(product) {
    if (!quickView || !product) return;
    state.quickProduct = product;
    state.quickQty = product.stock > 0 ? 1 : 0;

    document.getElementById('quickImage').src = product.image_url || FALLBACK_IMG;
    document.getElementById('quickImage').alt = product.name;
    document.getElementById('quickCategory').textContent = product.category || 'Object';
    document.getElementById('quickName').textContent = product.name;
    document.getElementById('quickPrice').textContent = money(product.price_minor, product.currency);
    document.getElementById('quickDesc').textContent = product.description || '';
    document.getElementById('quickQty').textContent = state.quickQty;

    const stock = document.getElementById('quickStock');
    stock.textContent = product.stock > 0 ? `${product.stock} in stock` : 'Currently unavailable';
    stock.classList.toggle('is-out', product.stock < 1);

    const add = document.getElementById('quickAdd');
    add.disabled = product.stock < 1;
    add.innerHTML = product.stock < 1 ? 'Sold out' : 'Add to bag <span>+</span>';

    document.getElementById('quickMinus').disabled = state.quickQty <= 1;
    document.getElementById('quickPlus').disabled = state.quickQty >= product.stock;

    quickView.showModal();
  }

  function changeQuickQty(delta) {
    const product = state.quickProduct;
    if (!product) return;
    state.quickQty = Math.max(1, Math.min(product.stock, state.quickQty + delta));
    document.getElementById('quickQty').textContent = state.quickQty;
    document.getElementById('quickMinus').disabled = state.quickQty <= 1;
    document.getElementById('quickPlus').disabled = state.quickQty >= product.stock;
  }

  if (!grid) return;

  ShopUI.init({ requireSession: false }).then(() => {
    loadProducts({ firstLoad: true });
  });

  filters?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.category = button.dataset.category;
    renderFilters();
    loadProducts();
  });

  sort?.addEventListener('change', () => {
    state.sort = sort.value;
    loadProducts();
  });

  let searchTimer;
  search?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = search.value.trim();
      loadProducts();
    }, 280);
  });

  clearFilters?.addEventListener('click', () => {
    state.q = '';
    state.category = 'All';
    state.sort = 'featured';
    if (search) search.value = '';
    if (sort) sort.value = 'featured';
    renderFilters();
    loadProducts();
  });

  retry?.addEventListener('click', () => loadProducts({ firstLoad: !state.loadedOnce }));

  grid.addEventListener('click', (event) => {
    const quick = event.target.closest('[data-quick]');
    if (quick) {
      const product = state.products.find((p) => p.id === quick.dataset.quick)
        || state.allProducts.find((p) => p.id === quick.dataset.quick);
      openQuick(product);
      return;
    }

    const add = event.target.closest('[data-add]');
    if (add) {
      const product = state.allProducts.find((p) => p.id === add.dataset.add)
        || state.products.find((p) => p.id === add.dataset.add);
      if (!product) return;
      if (ShopUI.add(product, 1)) {
        toast(`Added to bag — ${product.name}`);
      } else {
        toast('That object is currently unavailable.', 'error');
      }
    }
  });

  document.getElementById('quickClose')?.addEventListener('click', () => quickView.close());
  quickView?.addEventListener('click', (event) => {
    if (event.target === quickView) quickView.close();
  });
  document.getElementById('quickMinus')?.addEventListener('click', () => changeQuickQty(-1));
  document.getElementById('quickPlus')?.addEventListener('click', () => changeQuickQty(1));
  document.getElementById('quickAdd')?.addEventListener('click', () => {
    if (!state.quickProduct) return;
    if (ShopUI.add(state.quickProduct, state.quickQty)) {
      toast(`Added to bag — ${state.quickProduct.name}`);
      quickView.close();
    }
  });

  document.getElementById('cartCheckout')?.addEventListener('click', (event) => {
    if (!ShopUI.lines().length) {
      event.preventDefault();
      toast('Your bag is empty.', 'error');
      return;
    }
    ShopUI.closeCart();
  });

  ShopUI.wireImageFallbacks(document);
})();
