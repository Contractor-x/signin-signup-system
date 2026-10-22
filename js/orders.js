/* ==========================================================================
   Orders: list, filter, detail dialog and pending-payment actions.
   Endpoints:
     GET  /api/store/orders
     GET  /api/store/orders/:id
     POST /api/store/orders/:id/cancel
   ========================================================================== */

(() => {
  const $ = (id) => document.getElementById(id);
  const list = $('ordersList');
  const empty = $('ordersEmpty');
  const errorBox = $('ordersError');
  const errorText = $('ordersErrorText');
  const countEl = $('orderCount');
  const filters = $('orderFilters');
  const dialog = $('orderDialog');
  const dialogBody = $('orderDialogBody');

  const state = {
    orders: [],
    products: [],
    filter: 'all',
    loading: true,
  };

  const productById = (id) => state.products.find((product) => product.id === id);
  const orderNumber = (id) => ShopUI.orderNumber(id);
  const statusMeta = (status) => ShopUI.statusMeta(status);

  function statusPill(status) {
    const meta = statusMeta(status);
    return `<span class="status status--${esc(meta.className)}">${esc(meta.label)}</span>`;
  }

  function productImage(item) {
    return productById(item.product_id)?.image_url || FALLBACK_IMG;
  }

  function filterOrders() {
    if (state.filter === 'all') return state.orders;
    if (state.filter === 'pending') {
      return state.orders.filter((order) =>
        ['pending_payment', 'payment_failed'].includes(order.status)
      );
    }
    return state.orders.filter((order) => order.status === state.filter);
  }

  function actionsHTML(order) {
    const pending = ['pending_payment', 'payment_failed'].includes(order.status);
    return `
      ${pending
        ? `<a class="btn btn--small" href="checkout.html?order=${encodeURIComponent(order.id)}">Complete payment</a>
           <button class="btn btn--ghost btn--small" type="button" data-cancel="${esc(order.id)}">Cancel</button>`
        : ''}
      <button class="btn btn--ghost btn--small" type="button" data-view="${esc(order.id)}">Details</button>`;
  }

  function orderCard(order) {
    const itemTotal = order.items.reduce((sum, item) => sum + item.quantity, 0);
    return `
      <article class="order-card">
        <div>
          <div class="order-card__top">
            <span class="order-card__id">${orderNumber(order.id)}</span>
            ${statusPill(order.status)}
            <span class="order-card__date">${esc(formatDate(order.created_at))}</span>
          </div>
          <div class="order-card__items">
            ${order.items.map((item) => `
              <div class="order-item">
                <img src="${esc(productImage(item))}" alt="" loading="lazy">
                <div>
                  <p class="order-item__name">${esc(item.name)}</p>
                  <p class="order-item__qty">Qty ${item.quantity} · ${money(item.unit_minor, order.currency)}</p>
                </div>
              </div>`).join('')}
          </div>
        </div>
        <div class="order-card__side">
          <div>
            <p class="order-card__total">${money(order.total_minor, order.currency)}</p>
            <p class="order-card__payment">${esc(ShopUI.paymentLabel(order))} · ${itemTotal} item${itemTotal === 1 ? '' : 's'}</p>
          </div>
          <div class="order-card__actions">${actionsHTML(order)}</div>
        </div>
      </article>`;
  }

  function render() {
    if (state.loading) return;
    errorBox.hidden = true;

    const visible = filterOrders();
    const all = state.orders.length;
    countEl.textContent = all
      ? `${all} order${all === 1 ? '' : 's'} · ${visible.length} shown`
      : 'No orders yet';

    if (!visible.length) {
      list.innerHTML = '';
      list.hidden = true;
      empty.hidden = false;
      empty.querySelector('h3').textContent = all ? 'Nothing in this filter.' : 'No orders yet.';
      empty.querySelector('p').textContent = all
        ? 'Try another status, or view all orders.'
        : 'When you buy something, the receipt and payment state live here.';
      return;
    }

    empty.hidden = true;
    list.hidden = false;
    list.innerHTML = visible.map(orderCard).join('');
    ShopUI.wireImageFallbacks(list);
  }

  function findOrder(id) {
    return state.orders.find((order) => order.id === id);
  }

  function openDetails(order) {
    const pending = ['pending_payment', 'payment_failed'].includes(order.status);
    const shipping = order.shipping || {};
    const payment = order.payment || {};
    const meta = statusMeta(order.status);

    dialogBody.innerHTML = `
      <p class="eyebrow">Order detail ${statusPill(order.status)}</p>
      <h2 id="orderDialogTitle">${orderNumber(order.id)}</h2>
      <p class="order-detail__meta">
        Placed ${esc(formatDate(order.created_at))} · ${esc(meta.label)}
      </p>

      <div class="order-detail__list">
        ${order.items.map((item) => `
          <div class="order-detail__line">
            <span>${esc(item.name)}</span>
            <span>Qty ${item.quantity} × ${money(item.unit_minor, order.currency)}</span>
            <strong>${money(item.unit_minor * item.quantity, order.currency)}</strong>
          </div>`).join('')}
      </div>

      <div class="order-detail__grid">
        <div>
          <h3>Delivery</h3>
          <p>
            ${esc(shipping.name || '—')}<br>
            ${esc(shipping.address || '—')}<br>
            ${esc(shipping.phone || '')}
          </p>
        </div>
        <div>
          <h3>Payment</h3>
          <p>
            ${esc(ShopUI.paymentLabel(order))}<br>
            ${esc(payment.status || order.status)}<br>
            ${money(order.total_minor, order.currency)}
          </p>
        </div>
      </div>

      <div class="order-detail__foot">
        <span class="order-detail__total">${money(order.total_minor, order.currency)}</span>
        <div class="order-card__actions">
          ${pending
            ? `<a class="btn btn--small" href="checkout.html?order=${encodeURIComponent(order.id)}">Complete payment</a>
               <button class="btn btn--ghost btn--small" type="button" data-cancel="${esc(order.id)}">Cancel order</button>`
            : ''}
          <button class="btn btn--ghost btn--small" type="button" data-close-detail>Close</button>
        </div>
      </div>`;

    if (!dialog.open) dialog.showModal();
    ShopUI.wireImageFallbacks(dialogBody);
  }

  async function cancelOrder(id) {
    const order = findOrder(id);
    if (!order) return;
    if (!window.confirm(`Cancel order ${orderNumber(order.id)}? Reserved stock will be released.`)) return;

    try {
      await api(`/api/store/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
      toast(`Order ${orderNumber(order.id)} canceled.`, 'success');
      if (dialog.open) dialog.close();
      await load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function wire() {
    filters?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      state.filter = button.dataset.filter;
      filters.querySelectorAll('[data-filter]').forEach((item) => {
        item.setAttribute('aria-pressed', String(item === button));
      });
      render();
    });

    list.addEventListener('click', (event) => {
      const view = event.target.closest('[data-view]');
      const cancel = event.target.closest('[data-cancel]');
      if (view) {
        const order = findOrder(view.dataset.view);
        if (order) openDetails(order);
      }
      if (cancel) cancelOrder(cancel.dataset.cancel);
    });

    dialogBody.addEventListener('click', (event) => {
      const cancel = event.target.closest('[data-cancel]');
      if (cancel) cancelOrder(cancel.dataset.cancel);
      if (event.target.closest('[data-close-detail]')) dialog.close();
    });

    $('orderDialogClose')?.addEventListener('click', () => dialog.close());
    dialog?.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    $('retryOrders')?.addEventListener('click', load);

    document.querySelector('[data-open-cart]')?.addEventListener('click', () => {
      if (!document.getElementById('cartDrawer')) location.href = 'store.html';
    });
  }

  async function load() {
    state.loading = true;
    errorBox.hidden = true;
    countEl.textContent = 'Loading…';

    try {
      const [ordersResponse, catalogue] = await Promise.all([
        api('/api/store/orders'),
        api('/api/store/products', { auth: false }).catch(() => ({ data: [] })),
      ]);
      state.orders = ordersResponse.data || [];
      state.products = catalogue.data || [];
      ShopUI.hydrateProducts(state.products);
      state.loading = false;
      render();
    } catch (err) {
      state.loading = false;
      list.hidden = true;
      empty.hidden = true;
      errorBox.hidden = false;
      errorText.textContent = err.message;
      countEl.textContent = 'Could not load';
    }
  }

  async function init() {
    const me = await ShopUI.init();
    if (!me) return;
    wire();
    await load();
  }

  init();
})();
