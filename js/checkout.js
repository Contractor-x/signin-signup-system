/* ==========================================================================
   Checkout: delivery -> order -> sandbox payment -> receipt.
   Endpoints used:
     POST /api/store/orders
     GET  /api/store/orders/:id
     POST /api/store/orders/:id/pay
     POST /api/store/orders/:id/authenticate
     POST /api/store/orders/:id/simulate-settle
     POST /api/store/orders/:id/cancel
     GET  /sandbox/v1/test-cards
   ========================================================================== */

(() => {
  const $ = (id) => document.getElementById(id);
  const deliveryPanel = $('deliveryPanel');
  const paymentPanel = $('paymentPanel');
  const checkoutMain = $('checkoutMain');
  const checkoutGrid = $('checkoutGrid');
  const summary = $('summary');
  const deliveryForm = $('deliveryForm');
  const deliveryError = $('deliveryError');

  const state = {
    me: null,
    order: null,
    products: [],
    testData: null,
    method: 'card',
    selectedCard: null,
    fromCart: false,
    busy: false,
  };

  // Keep an early submit from doing a native reload while the page is still loading.
  deliveryForm?.addEventListener('submit', (event) => {
    if (!state.me) {
      event.preventDefault();
      toast('Checkout is still loading. Try again in a moment.');
    }
  });

  const FALLBACK_SCENARIOS = [
    { number: '4242424242424242', brand: 'visa', description: 'Approved payment' },
    { number: '4000000000009995', brand: 'visa', description: 'Insufficient funds' },
    { number: '4000000000003220', brand: 'visa', description: '3-D Secure / OTP challenge' },
    { number: '4000000000000069', brand: 'visa', description: 'Expired card' },
  ];

  const FALLBACK_WALLETS = [
    { phone: '+2348000000001', description: 'Instant approval' },
    { phone: '+2348000000002', description: 'Wallet has insufficient balance' },
    { phone: '+2348000000003', description: 'Pending approval — settle in the simulator' },
    { phone: '+2348000000004', description: 'Customer never responds (timeout)' },
  ];

  const setBusy = (button, busy) => {
    if (!button) return;
    button.disabled = busy;
    button.classList.toggle('is-loading', busy);
  };

  const setStep = (step) => {
    document.querySelectorAll('#steps .step').forEach((el) => {
      const n = Number(el.dataset.step);
      el.classList.toggle('is-active', n === step);
      el.classList.toggle('is-done', n < step);
    });
  };

  const orderNumber = (id) => `#${String(id || '').slice(-6).toUpperCase()}`;

  const productById = (id) => state.products.find((p) => p.id === id);

  function summaryHTML(lines, total, currency = 'NGN', editable = false) {
    const count = lines.reduce((sum, line) => sum + line.qty, 0);
    return `
      <div class="summary__head">
        <h2 class="summary__title">Order summary</h2>
        <span class="summary__count">${count} item${count === 1 ? '' : 's'}</span>
      </div>
      <div class="summary__items">
        ${lines.map((line) => `
          <div class="summary__line">
            <img src="${esc(line.image_url || FALLBACK_IMG)}" alt="" loading="lazy">
            <div>
              <p class="summary__name">${esc(line.name)}</p>
              <p class="summary__qty">Qty ${line.qty}</p>
            </div>
            <p class="summary__amount">${money(line.unit_minor * line.qty, currency)}</p>
          </div>`).join('')}
      </div>
      <div class="summary__totals">
        <div class="summary__row"><span>Subtotal</span><span>${money(total, currency)}</span></div>
        <div class="summary__row"><span>Shipping</span><span>Free</span></div>
        <div class="summary__row summary__row--total"><span>Total</span><span>${money(total, currency)}</span></div>
      </div>
      <p class="summary__note">
        Sandbox checkout. No real payment is taken and nothing ships.
      </p>
      ${editable ? '<a class="text-link summary__edit" href="store.html">Edit bag</a>' : ''}`;
  }

  function renderCartSummary() {
    const lines = ShopUI.lines().map(({ product, qty }) => ({
      name: product.name,
      image_url: product.image_url,
      unit_minor: product.price_minor,
      qty,
    }));
    const total = lines.reduce((sum, line) => sum + line.unit_minor * line.qty, 0);
    summary.innerHTML = summaryHTML(lines, total, 'NGN', true);
    ShopUI.wireImageFallbacks(summary);
  }

  function renderOrderSummary(order) {
    const lines = order.items.map((item) => ({
      name: item.name,
      image_url: productById(item.product_id)?.image_url,
      unit_minor: item.unit_minor,
      qty: item.quantity,
    }));
    summary.innerHTML = summaryHTML(lines, order.total_minor, order.currency);
    ShopUI.wireImageFallbacks(summary);
  }

  function showDeliveryError(message) {
    if (!deliveryError) return;
    deliveryError.hidden = false;
    deliveryError.textContent = message;
  }

  function clearDeliveryError() {
    if (!deliveryError) return;
    deliveryError.hidden = true;
    deliveryError.textContent = '';
  }

  function fieldError(input, errorEl, message) {
    input?.classList.toggle('is-invalid', Boolean(message));
    if (errorEl) errorEl.textContent = message || '';
  }

  function validateDelivery() {
    const name = $('shipName');
    const phone = $('shipPhone');
    const address = $('shipAddress');
    let ok = true;

    if (name.value.trim().length < 2) {
      fieldError(name, $('shipNameError'), 'Enter the full name');
      ok = false;
    } else fieldError(name, $('shipNameError'), '');

    if (!/^[+\d][\d\s()-]{6,19}$/.test(phone.value.trim())) {
      fieldError(phone, $('shipPhoneError'), 'Enter a valid phone number');
      ok = false;
    } else fieldError(phone, $('shipPhoneError'), '');

    if (address.value.trim().length < 5) {
      fieldError(address, $('shipAddressError'), 'Enter a delivery address');
      ok = false;
    } else fieldError(address, $('shipAddressError'), '');

    return ok;
  }

  function prefillDelivery() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('still_delivery_v1') || '{}'); } catch (_) {}

    $('shipName').value = saved.name || state.me?.username || '';
    $('shipPhone').value = saved.phone || '';
    $('shipAddress').value = saved.address || '';
  }

  const testScenarios = () => {
    const cards = state.testData?.cards;
    if (!Array.isArray(cards) || !cards.length) return FALLBACK_SCENARIOS;
    const preferred = FALLBACK_SCENARIOS.map((scenario) =>
      cards.find((card) => card.number === scenario.number)
    ).filter(Boolean);
    return preferred.length ? preferred : cards.slice(0, 4);
  };

  const testWallets = () => {
    const wallets = state.testData?.wallets;
    return Array.isArray(wallets) && wallets.length ? wallets : FALLBACK_WALLETS;
  };

  function renderPayment() {
    const order = state.order;
    if (!order) return;

    deliveryPanel.hidden = true;
    paymentPanel.hidden = false;
    setStep(2);
    state.method = state.method || 'card';
    state.selectedCard = state.selectedCard || testScenarios()[0]?.number || null;

    paymentPanel.innerHTML = `
      <div class="panel__head">
        <h2 class="panel__title">Payment</h2>
        <span class="panel__meta">${orderNumber(order.id)} · ${money(order.total_minor, order.currency)}</span>
      </div>

      <p class="notice">
        <strong>Sandbox payment.</strong> Use one of the test scenarios below.
        Real card numbers are rejected by the API.
      </p>

      <div class="pay-methods" role="group" aria-label="Payment method">
        <button type="button" class="pay-method" data-method="card" aria-pressed="${state.method === 'card'}">
          Card<small>Visa / Mastercard test numbers</small>
        </button>
        <button type="button" class="pay-method" data-method="wallet" aria-pressed="${state.method === 'wallet'}">
          Mobile wallet<small>USSD approval simulator</small>
        </button>
        <button type="button" class="pay-method" data-method="bank_transfer" aria-pressed="${state.method === 'bank_transfer'}">
          Bank transfer<small>Account number + simulator</small>
        </button>
      </div>

      <div id="payBody"></div>
      <div class="error-box" id="payError" hidden></div>

      <div class="actions-row">
        <button class="btn" type="button" id="payBtn">
          Pay ${money(order.total_minor, order.currency)} <span>→</span>
        </button>
        <button class="text-link" type="button" id="payLater">Pay later</button>
      </div>
      <div class="actions-row">
        <button class="text-link" type="button" id="cancelOrderBtn">Cancel this order</button>
      </div>`;

    paymentPanel.querySelectorAll('[data-method]').forEach((button) => {
      button.addEventListener('click', () => {
        state.method = button.dataset.method;
        paymentPanel.querySelectorAll('[data-method]').forEach((item) => {
          item.setAttribute('aria-pressed', String(item === button));
        });
        renderMethodBody();
        clearPayError();
      });
    });

    $('payBtn').addEventListener('click', pay);
    $('payLater').addEventListener('click', () => {
      location.href = 'orders.html';
    });
    $('cancelOrderBtn').addEventListener('click', cancelOrder);

    renderMethodBody();
    ShopUI.wireImageFallbacks(paymentPanel);
  }

  function renderMethodBody() {
    const body = $('payBody');
    if (!body) return;

    if (state.method === 'card') {
      const scenarios = testScenarios();
      if (!state.selectedCard) state.selectedCard = scenarios[0]?.number || '';

      body.innerHTML = `
        <div class="test-list" role="group" aria-label="Test card scenarios">
          ${scenarios.map((card, index) => `
            <button type="button" class="test-card" data-card="${esc(card.number)}"
              aria-pressed="${card.number === state.selectedCard}">
              <span class="test-card__name">${index === 0 ? 'Approved' : index === 1 ? 'Declined' : index === 2 ? '3-D Secure' : 'Expired'}</span>
              <span class="test-card__num">${esc(card.number.replace(/(\d{4})(?=\d)/g, '$1 '))}</span>
              <span class="test-card__desc">${esc(card.description)}</span>
            </button>`).join('')}
        </div>

        <div class="form-grid card-fields">
          <div class="field field--full">
            <label for="cardNumber">Card number</label>
            <input id="cardNumber" inputmode="numeric" autocomplete="cc-number" maxlength="19"
              value="${esc(formatCard(state.selectedCard || ''))}" placeholder="4242 4242 4242 4242">
          </div>
          <div class="field">
            <label for="cardExpiry">Expiry (MM/YY)</label>
            <input id="cardExpiry" inputmode="numeric" autocomplete="cc-exp" maxlength="5" value="12/30" placeholder="12/30">
          </div>
          <div class="field">
            <label for="cardCvc">CVC</label>
            <input id="cardCvc" inputmode="numeric" autocomplete="cc-csc" maxlength="4" value="123" placeholder="123">
          </div>
        </div>
        <p class="field__hint">Select a scenario above to fill a documented test card.</p>`;

      body.querySelectorAll('[data-card]').forEach((button) => {
        button.addEventListener('click', () => {
          state.selectedCard = button.dataset.card;
          renderMethodBody();
        });
      });

      $('cardNumber')?.addEventListener('input', (event) => {
        event.target.value = formatCard(event.target.value);
      });
      $('cardExpiry')?.addEventListener('input', (event) => {
        event.target.value = formatExpiry(event.target.value);
      });
      $('cardCvc')?.addEventListener('input', (event) => {
        event.target.value = event.target.value.replace(/\D/g, '').slice(0, 4);
      });
      return;
    }

    if (state.method === 'wallet') {
      body.innerHTML = `
        <div class="field">
          <label for="walletPhone">Sandbox wallet</label>
          <select id="walletPhone">
            ${testWallets().map((wallet) => `
              <option value="${esc(wallet.phone)}">${esc(wallet.phone)} — ${esc(wallet.description)}</option>
            `).join('')}
          </select>
          <span class="field__hint">Pending wallets can be settled with the simulator in the next step.</span>
        </div>`;
      return;
    }

    body.innerHTML = `
      <p class="field__hint">
        Continuing will create a sandbox bank-transfer instruction with an
        account number. You can then mark the transfer as received or failed.
      </p>`;
  }

  function clearPayError() {
    const box = $('payError');
    if (!box) return;
    box.hidden = true;
    box.textContent = '';
  }

  function showPayError(message) {
    const box = $('payError');
    if (!box) {
      toast(message, 'error');
      return;
    }
    box.hidden = false;
    box.textContent = message;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function formatCard(value) {
    return String(value).replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  function formatExpiry(value) {
    const digits = String(value).replace(/\D/g, '').slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  }

  function readCard() {
    const number = $('cardNumber')?.value.replace(/\D/g, '') || '';
    const expiry = $('cardExpiry')?.value || '';
    const cvc = $('cardCvc')?.value.replace(/\D/g, '') || '';
    const [month, year] = expiry.split('/');

    if (number.length < 15) {
      showPayError('Enter a test card number. Use the scenarios above.');
      return null;
    }
    if (!month || month.length !== 2 || !year || year.length !== 2) {
      showPayError('Enter the expiry as MM/YY.');
      return null;
    }
    if (cvc.length < 3) {
      showPayError('Enter the 3-digit CVC.');
      return null;
    }

    return {
      type: 'card',
      number,
      exp_month: Number(month),
      exp_year: 2000 + Number(year),
      cvc,
    };
  }

  async function pay() {
    if (!state.order || state.busy) return;
    clearPayError();

    let paymentMethod;
    if (state.method === 'card') {
      paymentMethod = readCard();
      if (!paymentMethod) return;
    } else if (state.method === 'wallet') {
      paymentMethod = { type: 'wallet', phone: $('walletPhone')?.value };
    } else {
      paymentMethod = { type: 'bank_transfer' };
    }

    const payButton = $('payBtn');
    state.busy = true;
    setBusy(payButton, true);

    try {
      const order = await api(`/api/store/orders/${encodeURIComponent(state.order.id)}/pay`, {
        method: 'POST',
        body: { payment_method: paymentMethod },
      });
      handleOrderState(order);
    } catch (err) {
      showPayError(err.message);
    } finally {
      state.busy = false;
      setBusy(payButton, false);
    }
  }

  function handleOrderState(order) {
    state.order = order;

    if (order.status === 'paid') {
      renderSuccess(order);
      return;
    }

    if (order.status === 'payment_failed') {
      renderPayment();
      showPayError(order.payment?.failure_message || 'Payment failed. Try another test card.');
      return;
    }

    if (order.payment?.status === 'requires_action') {
      renderOtp(order);
      return;
    }

    if (order.payment?.status === 'processing') {
      renderProcessing(order);
      return;
    }

    renderPayment();
    showPayError('The payment could not be completed. Try again.');
  }

  function renderOtp(order) {
    paymentPanel.hidden = false;
    summary.innerHTML = summaryHTML(
      order.items.map((item) => ({
        name: item.name,
        image_url: productById(item.product_id)?.image_url,
        unit_minor: item.unit_minor,
        qty: item.quantity,
      })),
      order.total_minor,
      order.currency
    );

    paymentPanel.innerHTML = `
      <div class="panel__head">
        <h2 class="panel__title">Verify it’s you</h2>
        <span class="panel__meta">3-D Secure · ${orderNumber(order.id)}</span>
      </div>
      <p class="notice">
        Sandbox 3-D Secure challenge. Enter <strong>123456</strong> to approve.
      </p>
      <div class="otp-box">
        <div class="field">
          <label for="otpInput">One-time code</label>
          <input id="otpInput" class="otp-input" inputmode="numeric" maxlength="6"
            autocomplete="one-time-code" placeholder="000000" aria-describedby="otpError">
        </div>
        <div class="error-box" id="otpError" hidden></div>
        <div class="actions-row">
          <button class="btn" type="button" id="otpVerify">Verify <span>→</span></button>
          <button class="text-link" type="button" id="otpBack">Use another card</button>
        </div>
      </div>`;

    $('otpInput').focus();
    $('otpVerify').addEventListener('click', async () => {
      const otp = $('otpInput').value.trim();
      if (otp.length !== 6) {
        $('otpError').hidden = false;
        $('otpError').textContent = 'Enter the 6-digit code.';
        return;
      }
      setBusy($('otpVerify'), true);
      try {
        const updated = await api(`/api/store/orders/${encodeURIComponent(order.id)}/authenticate`, {
          method: 'POST',
          body: { otp },
        });
        handleOrderState(updated);
      } catch (err) {
        $('otpError').hidden = false;
        $('otpError').textContent = err.message;
        setBusy($('otpVerify'), false);
      }
    });
    $('otpBack').addEventListener('click', () => renderPayment());
  }

  function renderProcessing(order) {
    const action = order.payment?.next_action || {};
    const isBank = order.payment?.payment_method?.type === 'bank_transfer';

    paymentPanel.hidden = false;
    paymentPanel.innerHTML = `
      <div class="panel__head">
        <h2 class="panel__title">${isBank ? 'Transfer instructions' : 'Approve the payment'}</h2>
        <span class="panel__meta">${orderNumber(order.id)}</span>
      </div>
      <div class="pending-box">
        <h3>${isBank ? 'Waiting for the transfer' : 'Waiting for wallet approval'}</h3>
        <p>
          ${isBank
            ? 'Use the sandbox account below, then simulate the bank’s confirmation.'
            : 'The wallet is waiting for the customer to approve the USSD prompt.'}
        </p>
        ${isBank && action.account_number ? `
          <div class="bank-details">
            <dl>
              <dt>Bank</dt><dd>${esc(action.bank_name || 'Sandbox Bank')}</dd>
              <dt>Account name</dt><dd>${esc(action.account_name || 'SANDBOX PAY LTD')}</dd>
              <dt>Account number</dt><dd>${esc(action.account_number)}</dd>
              <dt>Amount</dt><dd>${money(action.amount || order.total_minor, order.currency)}</dd>
            </dl>
          </div>` : ''}
        <div class="pending-actions">
          <button class="btn btn--small" type="button" id="settleOk">Simulate success</button>
          <button class="btn btn--ghost btn--small" type="button" id="settleFail">Simulate failure</button>
        </div>
        <div class="error-box" id="settleError" hidden></div>
      </div>
      <div class="actions-row">
        <button class="text-link" type="button" id="cancelOrderBtn">Cancel this order</button>
      </div>`;

    const settle = async (outcome) => {
      setBusy($('settleOk'), true);
      setBusy($('settleFail'), true);
      try {
        const updated = await api(`/api/store/orders/${encodeURIComponent(order.id)}/simulate-settle`, {
          method: 'POST',
          body: { outcome },
        });
        handleOrderState(updated);
      } catch (err) {
        const box = $('settleError');
        if (box) {
          box.hidden = false;
          box.textContent = err.message;
        }
        setBusy($('settleOk'), false);
        setBusy($('settleFail'), false);
      }
    };

    $('settleOk').addEventListener('click', () => settle('succeeded'));
    $('settleFail').addEventListener('click', () => settle('failed'));
    $('cancelOrderBtn').addEventListener('click', cancelOrder);
  }

  async function cancelOrder() {
    if (!state.order) return;
    if (!window.confirm('Cancel this order? Reserved stock will be released.')) return;
    try {
      const updated = await api(`/api/store/orders/${encodeURIComponent(state.order.id)}/cancel`, {
        method: 'POST',
      });
      renderCanceled(updated);
    } catch (err) {
      showPayError(err.message);
    }
  }

  function renderSuccess(order) {
    setStep(3);
    state.order = order;
    if (state.fromCart) ShopUI.clear();
    summary.hidden = true;
    checkoutGrid.style.gridTemplateColumns = '1fr';
    document.title = 'Receipt — STILL';

    checkoutMain.innerHTML = `
      <div class="success success--receipt">
        <div class="success__mark" aria-hidden="true">✓</div>
        <p class="eyebrow" style="justify-content:center">Payment complete</p>
        <h1>That’s yours.</h1>
        <p class="success__lede">
          Order ${orderNumber(order.id)} is paid. Your receipt is below.
        </p>

        ${ShopUI.receiptHTML(order, state.me)}

        <div class="success__actions">
          <button class="btn" type="button" data-print-receipt>Print receipt <span>↗</span></button>
          <a class="btn btn--ghost" href="orders.html">View your orders</a>
          <a class="btn btn--ghost" href="store.html">Continue shopping</a>
        </div>
      </div>`;

    checkoutMain.querySelector('[data-print-receipt]')?.addEventListener('click', () => window.print());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderCanceled(order) {
    setStep(3);
    state.order = order;
    summary.hidden = true;
    checkoutGrid.style.gridTemplateColumns = '1fr';
    checkoutMain.innerHTML = `
      <div class="success">
        <div class="success__mark" aria-hidden="true" style="background:var(--muted);border-color:var(--muted)">×</div>
        <p class="eyebrow" style="justify-content:center">Order canceled</p>
        <h1>Nothing owed.</h1>
        <p class="success__lede">
          Order ${orderNumber(order.id)} was canceled and its reserved stock has
          been released.
        </p>
        <div class="success__actions">
          <a class="btn" href="store.html">Back to the collection</a>
          <a class="btn btn--ghost" href="orders.html">View your orders</a>
        </div>
      </div>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderEmpty(message = 'Your bag is empty. Add an object before checking out.') {
    setStep(1);
    if (summary) summary.hidden = true;
    checkoutGrid.style.gridTemplateColumns = '1fr';
    checkoutMain.innerHTML = `
      <div class="empty">
        <h3>Nothing to check out.</h3>
        <p>${esc(message)}</p>
        <a class="btn" href="store.html">Browse the collection <span>→</span></a>
      </div>`;
  }

  async function loadOrder(orderId) {
    try {
      const order = await api(`/api/store/orders/${encodeURIComponent(orderId)}`);
      state.order = order;
      state.method = 'card';
      state.selectedCard = null;
      renderOrderSummary(order);

      if (order.status === 'paid' || order.status === 'refunded') renderSuccess(order);
      else if (order.status === 'canceled') renderCanceled(order);
      else {
        deliveryPanel.hidden = true;
        renderPayment();
      }
    } catch (err) {
      renderEmpty(err.message);
    }
  }

  async function init() {
    state.me = await ShopUI.init();
    if (!state.me) return;

    try {
      const catalogue = await api('/api/store/products', { auth: false });
      state.products = catalogue.data || [];
      ShopUI.hydrateProducts(state.products);
    } catch (err) {
      toast(err.message, 'error');
    }

    try {
      state.testData = await api('/sandbox/v1/test-cards', { auth: false });
    } catch (_) {
      state.testData = null;
    }

    ShopUI.wireImageFallbacks(document);

    document.querySelector('[data-open-cart]')?.addEventListener('click', () => {
      if (!document.getElementById('cartDrawer')) location.href = 'store.html';
    });

    const orderId = new URLSearchParams(location.search).get('order');
    if (orderId) {
      await loadOrder(orderId);
      return;
    }

    const lines = ShopUI.lines();
    if (!lines.length) {
      renderEmpty();
      return;
    }

    prefillDelivery();
    renderCartSummary();
    setStep(1);

    [
      ['shipName', 'shipNameError'],
      ['shipPhone', 'shipPhoneError'],
      ['shipAddress', 'shipAddressError'],
    ].forEach(([inputId, errorId]) => {
      $(inputId)?.addEventListener('input', () => fieldError($(inputId), $(errorId), ''));
    });

    deliveryForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearDeliveryError();
      if (!validateDelivery()) return;

      const button = $('placeOrderBtn');
      setBusy(button, true);

      const shipping = {
        name: $('shipName').value.trim(),
        phone: $('shipPhone').value.trim(),
        address: $('shipAddress').value.trim(),
      };

      try {
        const order = await api('/api/store/orders', {
          method: 'POST',
          body: {
            items: lines.map(({ product, qty }) => ({
              product_id: product.id,
              quantity: qty,
            })),
            shipping,
          },
        });

        state.fromCart = true;
        state.order = order;
        ShopUI.clear();
        try { localStorage.setItem('still_delivery_v1', JSON.stringify(shipping)); } catch (_) {}

        history.replaceState(null, '', `checkout.html?order=${encodeURIComponent(order.id)}`);
        renderOrderSummary(order);
        renderPayment();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        showDeliveryError(err.message);
      } finally {
        setBusy(button, false);
      }
    });
  }

  init();
})();
