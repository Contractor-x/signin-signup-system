/* ==========================================================================
   Shared storefront shell: session, account menu, bag persistence and drawer.
   Depends on js/api.js.
   ========================================================================== */

const CART_KEY = 'still_bag_v1';

const FALLBACK_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='500'%3E%3Crect width='400' height='500' fill='%23e6e1d5'/%3E%3Ctext x='200' y='252' text-anchor='middle' font-family='Georgia,serif' font-size='34' fill='%236c6e64'%3ESTILL%3C/text%3E%3C/svg%3E";

const ROLE_LABELS = {
  customer: 'Customer',
  shop_owner: 'Shop owner',
  superuser: 'Superuser',
};

const STATUS_META = {
  pending_payment: { label: 'Awaiting payment', className: 'pending_payment' },
  payment_failed: { label: 'Payment failed', className: 'payment_failed' },
  paid: { label: 'Paid', className: 'paid' },
  canceled: { label: 'Canceled', className: 'canceled' },
  refunded: { label: 'Refunded', className: 'refunded' },
};

const ShopUI = (() => {
  const state = {
    me: null,
    products: [],
    drawerWired: false,
  };

  const readCart = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || '{}');
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
      return Object.fromEntries(
        Object.entries(raw)
          .map(([id, qty]) => [id, Math.max(0, Math.min(20, Number(qty) || 0))])
          .filter(([, qty]) => qty > 0)
      );
    } catch (_) {
      return {};
    }
  };

  const writeCart = (cart) => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (_) {
      /* storage can be unavailable in private mode; the UI still works for this view */
    }
    updateCounts();
  };

  const count = () => Object.values(readCart()).reduce((sum, qty) => sum + qty, 0);

  const updateCounts = () => {
    const total = count();
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = total;
    });
    const cartButton = document.querySelector('[data-open-cart]');
    if (cartButton) {
      cartButton.setAttribute('aria-label', `Open bag, ${total} item${total === 1 ? '' : 's'}`);
    }
  };

  function hydrateProducts(products) {
    state.products = Array.isArray(products) ? products : [];
    return state.products;
  }

  function lines() {
    const cart = readCart();
    const byId = new Map(state.products.map((p) => [p.id, p]));
    const result = [];
    let changed = false;

    Object.entries(cart).forEach(([id, qty]) => {
      const product = byId.get(id);
      if (!product || product.stock < 1) {
        delete cart[id];
        changed = true;
        return;
      }
      const safeQty = Math.min(qty, product.stock);
      if (safeQty !== qty) {
        cart[id] = safeQty;
        changed = true;
      }
      result.push({ product, qty: safeQty, total: product.price_minor * safeQty });
    });

    if (changed) writeCart(cart);
    return result;
  }

  const subtotal = () => lines().reduce((sum, line) => sum + line.total, 0);

  function add(product, qty = 1) {
    if (!product || product.stock < 1) return false;
    const cart = readCart();
    const next = Math.min((cart[product.id] || 0) + qty, product.stock, 20);
    cart[product.id] = next;
    writeCart(cart);
    return true;
  }

  function setQty(id, qty) {
    const product = state.products.find((p) => p.id === id);
    const cart = readCart();
    const next = Math.min(Math.max(0, qty), product?.stock ?? 20, 20);
    if (next < 1) delete cart[id];
    else cart[id] = next;
    writeCart(cart);
  }

  function remove(id) {
    const cart = readCart();
    delete cart[id];
    writeCart(cart);
  }

  function clear() {
    writeCart({});
  }

  function openCart() {
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('cartBackdrop');
    if (!drawer) return;
    renderCart();
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    backdrop?.classList.add('is-open');
    document.body.classList.add('no-scroll');
    document.getElementById('cartClose')?.focus();
  }

  function closeCart() {
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('cartBackdrop');
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    backdrop?.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
  }

  function renderCart() {
    const body = document.getElementById('cartBody');
    const totalEl = document.getElementById('cartTotal');
    const checkout = document.getElementById('cartCheckout');
    if (!body) return;

    const cartLines = lines();

    if (!cartLines.length) {
      body.innerHTML = `
        <div class="cart__empty">
          <p>Your bag is empty.</p>
          <button type="button" class="text-link" id="cartEmptyBrowse">Find something useful →</button>
        </div>`;
      document.getElementById('cartEmptyBrowse')?.addEventListener('click', () => {
        closeCart();
        document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' });
      });
      if (totalEl) totalEl.textContent = money(0);
      if (checkout) checkout.setAttribute('aria-disabled', 'true');
      return;
    }

    body.innerHTML = cartLines.map(({ product: p, qty, total }) => `
      <article class="cart-line">
        <img class="cart-line__img" src="${esc(p.image_url || FALLBACK_IMG)}" alt="" loading="lazy">
        <div>
          <p class="cart-line__cat">${esc(p.category || 'Object')}</p>
          <h3 class="cart-line__name">${esc(p.name)}</h3>
          <div class="cart-line__row">
            <div class="qty">
              <button type="button" data-dec="${esc(p.id)}" aria-label="Decrease quantity of ${esc(p.name)}">−</button>
              <output aria-label="Quantity">${qty}</output>
              <button type="button" data-inc="${esc(p.id)}" aria-label="Increase quantity of ${esc(p.name)}" ${qty >= p.stock ? 'disabled' : ''}>+</button>
            </div>
            <span class="cart-line__price">${money(p.price_minor, p.currency)}</span>
          </div>
        </div>
        <div class="cart-line__side">
          <span class="cart-line__total">${money(total, p.currency)}</span>
          <button type="button" class="cart-line__remove" data-remove="${esc(p.id)}">Remove</button>
        </div>
      </article>
    `).join('');

    const sum = cartLines.reduce((acc, line) => acc + line.total, 0);
    if (totalEl) totalEl.textContent = money(sum, cartLines[0]?.product.currency || 'NGN');
    if (checkout) checkout.removeAttribute('aria-disabled');
    wireImageFallbacks(body);
  }

  function wireDrawer() {
    if (state.drawerWired) return;
    state.drawerWired = true;

    document.querySelectorAll('[data-open-cart]').forEach((button) => {
      button.addEventListener('click', openCart);
    });
    document.getElementById('cartClose')?.addEventListener('click', closeCart);
    document.getElementById('cartContinue')?.addEventListener('click', closeCart);
    document.getElementById('cartBackdrop')?.addEventListener('click', closeCart);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeCart();
    });

    document.getElementById('cartBody')?.addEventListener('click', (event) => {
      const inc = event.target.closest('[data-inc]');
      const dec = event.target.closest('[data-dec]');
      const rm = event.target.closest('[data-remove]');

      if (inc) {
        const id = inc.dataset.inc;
        setQty(id, (readCart()[id] || 0) + 1);
        renderCart();
      }
      if (dec) {
        const id = dec.dataset.dec;
        setQty(id, (readCart()[id] || 0) - 1);
        renderCart();
      }
      if (rm) {
        remove(rm.dataset.remove);
        renderCart();
      }
    });
  }

  function roleLabel(role) {
    return ROLE_LABELS[role] || role || 'Account';
  }

  function statusMeta(status) {
    return STATUS_META[status] || { label: String(status || 'Unknown').replace(/_/g, ' '), className: 'canceled' };
  }

  function orderNumber(id) {
    return `#${String(id || '').slice(-6).toUpperCase()}`;
  }

  function paymentLabel(order) {
    const method = order?.payment?.payment_method;
    if (!method) return 'No payment yet';
    if (method.type === 'card') {
      const brand = method.brand ? method.brand[0].toUpperCase() + method.brand.slice(1) : 'Card';
      return `${brand} ···· ${method.last4 || '••••'}`;
    }
    if (method.type === 'wallet') return `Wallet ···· ${method.phone_last4 || '••••'}`;
    if (method.type === 'bank_transfer') return 'Bank transfer';
    return method.type || 'Payment';
  }

  function receiptDateTime(value) {
    if (!value) return { date: '—', time: '' };
    const raw = String(value);
    const date = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
    if (Number.isNaN(date.getTime())) return { date: raw, time: '' };
    return {
      date: new Intl.DateTimeFormat('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      }).format(date),
      time: new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(date),
    };
  }

  function receiptBarcode(id) {
    let seed = 2166136261;
    for (const char of String(id || '')) {
      seed ^= char.charCodeAt(0);
      seed = Math.imul(seed, 16777619) >>> 0;
    }
    let bars = '';
    for (let i = 0; i < 54; i += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const width = 1 + (seed % 3);
      const height = 28 + (seed % 15);
      bars += `<i style="width:${width}px;height:${height}px"></i>`;
    }
    return `<div class="paper-receipt__barcode" aria-hidden="true">${bars}</div>`;
  }

  /**
   * A thermal-printer style receipt, inspired by Receiptable's default layout.
   * Everything is local: no receipt API or external renderer is used.
   */
  function receiptHTML(order, me) {
    if (!order) return '';
    const shipping = order.shipping || {};
    const status = order.status;
    const isPaid = status === 'paid' || status === 'refunded';
    const isRefunded = status === 'refunded';
    const total = money(order.total_minor, order.currency);
    const paidAmount = isPaid ? total : money(0, order.currency);
    const balance = isPaid ? money(0, order.currency) : total;
    const dateTime = receiptDateTime(order.created_at);
    const itemRows = (order.items || []).map((item) => `
      <div class="paper-receipt__item">
        <span>${esc(item.quantity)} × ${esc(item.name)}</span>
        <span>${money(item.unit_minor * item.quantity, order.currency)}</span>
      </div>`).join('');
    const stars = '*'.repeat(42);

    return `
      <article class="paper-receipt" aria-label="Receipt for order ${esc(order.id)}">
        <header class="paper-receipt__store">
          <p class="paper-receipt__brand">STILL</p>
          <p>OBJECTS FOR LIVING</p>
          <p>Lagos, Nigeria</p>
          <p>still-sandbox.local</p>
        </header>

        <div class="paper-receipt__meta">
          <div><span>Order #:</span><span>${esc(String(order.id || '').toUpperCase())}</span></div>
          <div><span>Date:</span><span>${esc(dateTime.date)}</span></div>
          <div><span>Time:</span><span>${esc(dateTime.time)}</span></div>
          <div><span>Served by:</span><span>STILL / SANDBOX</span></div>
        </div>

        ${shipping.name ? `
          <div class="paper-receipt__customer">
            <p><strong>Customer:</strong></p>
            <p>${esc(shipping.name)}</p>
            ${me?.email ? `<p>Email: ${esc(me.email)}</p>` : ''}
            ${shipping.phone ? `<p>Tel: ${esc(shipping.phone)}</p>` : ''}
            ${shipping.address ? `<p>${esc(shipping.address)}</p>` : ''}
          </div>` : ''}

        <div class="paper-receipt__rule"></div>

        <div class="paper-receipt__columns">
          <span>Item</span>
          <span>Price</span>
        </div>

        <div class="paper-receipt__rule"></div>

        <div class="paper-receipt__items">
          ${itemRows || '<p class="paper-receipt__empty">No items</p>'}
        </div>

        <div class="paper-receipt__rule"></div>

        <div class="paper-receipt__totals">
          <div><span>Subtotal:</span><span>${total}</span></div>
          <div><span>Shipping:</span><span>Free</span></div>
          <div class="paper-receipt__stars">${stars}</div>
          <div class="paper-receipt__grand-total"><span>TOTAL:</span><span>${total}</span></div>
        </div>

        <div class="paper-receipt__payment">
          <div><span>Payment Method:</span><span>${esc(paymentLabel(order))}</span></div>
          <div><span>Amount Paid:</span><span>${paidAmount}</span></div>
          ${isRefunded
            ? `<div><span>Refunded:</span><span>${total}</span></div><div><span>Balance Due:</span><span>${money(0, order.currency)}</span></div>`
            : `<div><span>Balance Due:</span><span>${balance}</span></div>`}
          <div><span>Change Due:</span><span>${money(0, order.currency)}</span></div>
        </div>

        <div class="paper-receipt__stars paper-receipt__stars--footer">${stars}</div>

        <footer class="paper-receipt__footer">
          <p>Thank you for buying less, better.</p>
          <p>This is a sandbox receipt. No real money moved.</p>
          <p class="paper-receipt__footer-id">Receipt ID: ${esc(String(order.id || '').toUpperCase())}</p>
          ${receiptBarcode(order.id)}
          <p class="paper-receipt__barcode-value">${esc(String(order.id || '').toUpperCase())}</p>
        </footer>
      </article>`;
  }

  function wireImageFallbacks(root = document) {
    root.querySelectorAll('img').forEach((img) => {
      if (img.dataset.fallbackWired) return;
      img.dataset.fallbackWired = '1';
      img.addEventListener('error', () => {
        if (img.src === FALLBACK_IMG) return;
        img.src = FALLBACK_IMG;
      }, { once: true });
    });
  }

  async function signOut() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (_) { /* the local session is cleared regardless */ }
    clearToken();
    location.href = 'index.html';
  }

  async function init({ requireSession = true } = {}) {
    if (requireSession && !requireAuth()) return null;

    updateCounts();
    wireDrawer();

    document.querySelectorAll('[data-signout]').forEach((button) => {
      button.addEventListener('click', signOut);
    });

    document.addEventListener('click', (event) => {
      document.querySelectorAll('details.account[open]').forEach((details) => {
        if (!details.contains(event.target)) details.removeAttribute('open');
      });
    });

    try {
      const me = await api('/api/auth/me');
      state.me = me;
      document.querySelectorAll('[data-user-name]').forEach((el) => {
        el.textContent = me.username || 'Account';
      });
      document.querySelectorAll('[data-user-role]').forEach((el) => {
        el.textContent = roleLabel(me.role);
      });
      document.querySelectorAll('[data-user-email]').forEach((el) => {
        el.textContent = me.email || '';
      });
      document.querySelectorAll('[data-signout]').forEach((el) => { el.hidden = false; });
      document.querySelectorAll('[data-signin]').forEach((el) => { el.hidden = true; });
      return me;
    } catch (err) {
      if (err.status === 401) {
        clearToken();
        // Public storefront: no session is fine — just show the guest state.
        document.querySelectorAll('[data-user-name]').forEach((el) => { el.textContent = 'Guest'; });
        document.querySelectorAll('[data-user-role]').forEach((el) => { el.textContent = ''; });
        document.querySelectorAll('[data-user-email]').forEach((el) => { el.textContent = 'Browsing as guest'; });
        document.querySelectorAll('[data-signout]').forEach((el) => { el.hidden = true; });
        document.querySelectorAll('[data-signin]').forEach((el) => { el.hidden = false; });
        if (requireSession) {
          const page = location.pathname.split('/').pop() || 'index.html';
          location.replace(`signin.html?next=${encodeURIComponent(page + location.search)}`);
        }
      } else {
        toast(err.message, 'error');
      }
      return null;
    }
  }

  return {
    state,
    readCart,
    writeCart,
    count,
    updateCounts,
    hydrateProducts,
    lines,
    subtotal,
    add,
    setQty,
    remove,
    clear,
    openCart,
    closeCart,
    renderCart,
    roleLabel,
    statusMeta,
    orderNumber,
    paymentLabel,
    receiptHTML,
    wireImageFallbacks,
    signOut,
    init,
    updateCountsOnLoad: updateCounts,
  };
})();
