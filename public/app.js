(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const money = (n) => `${Number(n).toLocaleString('ar-EG')} ج.م`;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CART_KEY = 'coffee_cart_v1';
  const CUSTOMER_KEY = 'coffee_customer_v1';

  let config = { shippingFee: 0, freeShippingOver: 0, governorates: [], shippingRates: {} };
  let governorate = '';
  let products = [];
  let cart = load(CART_KEY, {}); // { productId: qty }

  function load(k, fb) { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }

  const coffeeSvg = '<svg class="ph" viewBox="0 0 64 64" aria-hidden="true"><path fill="#f2c98a" d="M10 22h36v14a16 16 0 0 1-16 16h-4a16 16 0 0 1-16-16V22Zm36 4h3a7 7 0 0 1 0 14h-4.3a18 18 0 0 0 1.3-6v-8Zm0 4v2a12 12 0 0 1-.2 4H49a3 3 0 0 0 0-6h-3ZM6 56h44v3H6v-3Z"/><path fill="#fff7ec" opacity=".7" d="M20 6c3 3-3 6 0 10m8-10c3 3-3 6 0 10m8-10c3 3-3 6 0 10" stroke="#fff7ec" stroke-width="2.5" fill-opacity="0" stroke-linecap="round"/></svg>';

  // ---------- تحميل البيانات ----------
  async function init() {
    $('#year').textContent = new Date().getFullYear();
    try {
      const [c, p] = await Promise.all([fetch('/api/config').then((r) => r.json()), fetch('/api/products').then((r) => r.json())]);
      config = c; products = p;
    } catch {
      $('#productGrid').innerHTML = '<p class="muted">حصلت مشكلة في تحميل المنتجات. حدّث الصفحة.</p>';
      return;
    }
    document.querySelectorAll('#storeName, .store-name').forEach((el) => (el.textContent = config.storeName));
    if (config.storeNameEn) $('#storeNameEn').textContent = config.storeNameEn;
    document.title = `${config.storeName}${config.storeNameEn ? ` | ${config.storeNameEn}` : ''} — قهوة محمد أفندي التركي`;
    const rates = Object.values(config.shippingRates || {});
    const minRate = rates.length ? Math.min(...rates) : config.shippingFee;
    $('#shippingNote').textContent = `العرض لحد ما الكمية تخلص. مصاريف الشحن حسب المحافظة وبتبدأ من ${money(minRate)}`
      + (config.freeShippingOver > 0 ? `، والشحن مجاني للطلبات فوق ${money(config.freeShippingOver)}` : '');
    if (config.storeWhatsapp) {
      $('#footerWa').innerHTML = `للاستفسار: <a href="https://wa.me/${esc(config.storeWhatsapp)}" target="_blank" rel="noopener">واتساب</a>`;
    }
    $('#govSelect').insertAdjacentHTML('beforeend', config.governorates.map((g) => `<option>${esc(g)}</option>`).join(''));

    // شيل من السلة أي منتج مش متاح
    const ids = new Set(products.map((p) => p.id));
    for (const id of Object.keys(cart)) if (!ids.has(id)) delete cart[id];
    persist();
    renderProducts();
    renderCart();
  }

  // ---------- المنتجات ----------
  function renderProducts() {
    if (!products.length) { $('#productGrid').innerHTML = '<p class="muted">مفيش منتجات متاحة حالياً.</p>'; return; }
    $('#productGrid').innerHTML = products.map((p) => `
      <article class="card" data-id="${esc(p.id)}">
        <div class="card-media" data-open="${esc(p.id)}" role="button" tabindex="0" aria-label="تفاصيل ${esc(p.name)}">
          ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : coffeeSvg}
          ${p.tag ? `<span class="card-tag">${esc(p.tag)}</span>` : ''}
          ${p.oldPrice > p.price ? `<span class="card-off">خصم ${Math.round((1 - p.price / p.oldPrice) * 100).toLocaleString('ar-EG')}٪</span>` : ''}
        </div>
        <div class="card-body">
          <h3><button class="link" data-open="${esc(p.id)}">${esc(p.name)}</button></h3>
          ${p.images?.length > 1 ? `<button class="link more-photos" data-open="${esc(p.id)}">📷 ${p.images.length.toLocaleString('ar-EG')} صور</button>` : ''}
          <span class="weight">${esc(p.weight)}</span>
          <p>${esc(p.description)}</p>
          <div class="card-foot">
            <span class="prices">
              ${p.oldPrice > p.price ? `<span class="old-price">بدل <s>${money(p.oldPrice)}</s></span>` : ''}
              <span class="price">${Number(p.price).toLocaleString('ar-EG')} <small>ج.م</small></span>
            </span>
            <div class="card-action">${actionHtml(p.id)}</div>
          </div>
        </div>
      </article>`).join('');
  }

  function actionHtml(id) {
    const q = cart[id] || 0;
    return q > 0
      ? `<div class="qty"><button data-inc="${esc(id)}" aria-label="زيادة">+</button><span>${q.toLocaleString('ar-EG')}</span><button data-dec="${esc(id)}" aria-label="تقليل">−</button></div>`
      : `<button class="btn btn-dark" data-add="${esc(id)}">أضف للسلة</button>`;
  }

  function refreshCardAction(id) {
    const card = document.querySelector(`.card[data-id="${CSS.escape(id)}"] .card-action`);
    if (card) card.innerHTML = actionHtml(id);
    if (pm.id === id) $('#pmAction').innerHTML = actionHtml(id);
  }

  // ---------- صفحة المنتج + معرض الصور ----------
  const pm = { id: null, images: [], idx: 0 };
  function openProduct(id) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    closeAll();
    pm.id = id;
    pm.images = p.images?.length ? p.images : (p.image ? [p.image] : []);
    pm.idx = 0;
    $('#pmTitle').textContent = p.name;
    $('#pmWeight').textContent = p.weight;
    $('#pmDesc').textContent = p.description;
    $('#pmPrices').innerHTML = (p.oldPrice > p.price ? `<span class="old-price">بدل <s>${money(p.oldPrice)}</s></span>` : '')
      + `<span class="price">${Number(p.price).toLocaleString('ar-EG')} <small>ج.م</small></span>`;
    $('#pmAction').innerHTML = actionHtml(id);
    $('#pmThumbs').innerHTML = pm.images.length > 1
      ? pm.images.map((src, i) => `<button data-pm-go="${i}" aria-label="صورة ${i + 1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')
      : '';
    document.querySelectorAll('.pm-nav').forEach((b) => (b.hidden = pm.images.length < 2));
    showPmImage();
    $('#productModal').hidden = false;
    document.body.classList.add('locked');
  }
  function showPmImage() {
    const img = $('#pmImage');
    if (!pm.images.length) { img.hidden = true; return; }
    img.hidden = false;
    img.src = pm.images[pm.idx];
    img.alt = `${$('#pmTitle').textContent} — صورة ${pm.idx + 1}`;
    document.querySelectorAll('#pmThumbs button').forEach((b, i) => b.classList.toggle('active', i === pm.idx));
  }
  function stepPm(d) {
    if (pm.images.length < 2) return;
    pm.idx = (pm.idx + d + pm.images.length) % pm.images.length;
    showPmImage();
  }

  // ---------- السلة ----------
  function persist() { save(CART_KEY, cart); }

  function setQty(id, qty) {
    qty = Math.max(0, Math.min(99, qty));
    if (qty === 0) delete cart[id]; else cart[id] = qty;
    persist();
    refreshCardAction(id);
    renderCart();
  }

  function totals() {
    const lines = Object.entries(cart).map(([id, qty]) => {
      const p = products.find((x) => x.id === id);
      return p ? { ...p, qty, lineTotal: p.price * qty } : null;
    }).filter(Boolean);
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const free = config.freeShippingOver > 0 && subtotal >= config.freeShippingOver;
    // الشحن بيتحسب بس بعد ما العميل يختار المحافظة
    const shipping = !lines.length || free ? 0 : (governorate ? (config.shippingRates[governorate] ?? config.shippingFee) : null);
    return { lines, subtotal, shipping, free, total: subtotal + (shipping || 0), count: lines.reduce((s, l) => s + l.qty, 0) };
  }

  function renderCart() {
    const t = totals();
    const badge = $('#cartCount');
    badge.textContent = t.count.toLocaleString('ar-EG');
    badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump');

    if (!t.lines.length) {
      $('#cartItems').innerHTML = '<div class="empty"><div class="big">🛒</div><p>السلة فاضية</p><button class="btn btn-dark" data-close>تصفح المنتجات</button></div>';
      $('#cartFoot').hidden = true;
      return;
    }
    $('#cartFoot').hidden = false;
    $('#cartItems').innerHTML = t.lines.map((l) => `
      <div class="cart-item">
        <div><h4>${esc(l.name)}</h4><div class="meta">${esc(l.weight)} • ${money(l.price)}${l.oldPrice > l.price ? ` <s>${money(l.oldPrice)}</s>` : ''}</div></div>
        <div class="line">${money(l.lineTotal)}</div>
        <div class="qty"><button data-inc="${esc(l.id)}" aria-label="زيادة">+</button><span>${l.qty.toLocaleString('ar-EG')}</span><button data-dec="${esc(l.id)}" aria-label="تقليل">−</button></div>
        <button class="remove" data-remove="${esc(l.id)}">حذف</button>
      </div>`).join('');
    $('#cartSubtotal').textContent = money(t.subtotal);
    $('#cartShipping').textContent = t.free ? 'مجاني 🎉' : 'حسب المحافظة';
    $('#cartTotal').textContent = money(t.subtotal);
    const left = config.freeShippingOver - t.subtotal;
    $('#freeHint').textContent = config.freeShippingOver > 0 && left > 0 ? `فاضلك ${money(left)} وتاخد شحن مجاني!` : '';
  }

  // ---------- فتح وإغلاق ----------
  function openCart() {
    $('#cartDrawer').classList.add('open');
    $('#cartDrawer').setAttribute('aria-hidden', 'false');
    $('#overlay').hidden = false;
    document.body.classList.add('locked');
  }
  function closeAll() {
    $('#cartDrawer').classList.remove('open');
    $('#cartDrawer').setAttribute('aria-hidden', 'true');
    $('#overlay').hidden = true;
    $('#checkoutModal').hidden = true;
    $('#successModal').hidden = true;
    $('#productModal').hidden = true;
    pm.id = null;
    document.body.classList.remove('locked');
  }

  function renderSummary() {
    const t = totals();
    const ship = t.free ? 'مجاني' : t.shipping === null ? 'اختار المحافظة' : money(t.shipping);
    $('#checkoutSummary').innerHTML = t.lines.map((l) => `<div class="row"><span>${esc(l.name)} (${esc(l.weight)}) × ${l.qty.toLocaleString('ar-EG')}</span><span>${money(l.lineTotal)}</span></div>`).join('')
      + `<div class="row"><span>الشحن${governorate ? ` (${esc(governorate)})` : ''}</span><span>${ship}</span></div>`
      + `<div class="row total"><span>الإجمالي</span><b>${t.shipping === null && !t.free ? `${money(t.subtotal)} + الشحن` : money(t.total)}</b></div>`;
  }

  function openCheckout() {
    const t = totals();
    if (!t.lines.length) return;
    closeAll();
    // استرجاع بيانات العميل من آخر طلب
    const saved = load(CUSTOMER_KEY, {});
    const form = $('#checkoutForm');
    for (const [k, v] of Object.entries(saved)) if (form.elements[k] && !form.elements[k].value) form.elements[k].value = v;
    governorate = form.elements.governorate.value;
    renderSummary();
    $('#formError').textContent = '';
    $('#checkoutModal').hidden = false;
    document.body.classList.add('locked');
    setTimeout(() => form.elements.name.focus(), 50);
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // ---------- إرسال الطلب ----------
  const phoneOk = (v) => /^(\+?20|0)?1[0125]\d{8}$/.test(String(v).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[\s-]/g, ''));

  async function submitOrder(e) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form).entries());
    const errs = [];
    form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
    const bad = (name, msg) => { errs.push(msg); form.elements[name].classList.add('invalid'); };
    if ((data.name || '').trim().length < 3) bad('name', 'اكتب الاسم بالكامل');
    if (!phoneOk(data.phone)) bad('phone', 'رقم الموبايل غير صحيح (مثال: 01012345678)');
    if (data.phone2 && !phoneOk(data.phone2)) bad('phone2', 'الرقم الإضافي غير صحيح');
    if (!data.governorate) bad('governorate', 'اختار المحافظة');
    if ((data.city || '').trim().length < 2) bad('city', 'اكتب المدينة أو المنطقة');
    if ((data.address || '').trim().length < 8) bad('address', 'اكتب العنوان بالتفصيل');
    if (errs.length) { $('#formError').textContent = errs.join('\n'); return; }

    const btn = $('#submitOrder');
    btn.disabled = true; btn.textContent = 'جاري إرسال الطلب…';
    $('#formError').textContent = '';
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer: data, items: Object.entries(cart).map(([id, qty]) => ({ id, qty })) }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || 'حصل خطأ');

      const { notes, ...rememberMe } = data;
      save(CUSTOMER_KEY, rememberMe);
      cart = {}; persist(); renderProducts(); renderCart();
      form.elements.notes.value = '';
      showSuccess(out);
    } catch (err) {
      $('#formError').textContent = err.message || 'حصل خطأ في الاتصال، حاول تاني';
    } finally {
      btn.disabled = false; btn.textContent = 'تأكيد الطلب — الدفع عند الاستلام';
    }
  }

  function showSuccess(out) {
    closeAll();
    $('#orderNumber').textContent = `#${out.number}`;
    $('#successMsg').textContent = out.whatsappSent
      ? `بعتنالك رسالة تأكيد على واتساب بتفاصيل الطلب. الإجمالي ${money(out.total)} يُدفع عند الاستلام.`
      : `الإجمالي ${money(out.total)} يُدفع عند الاستلام. اضغط الزرار عشان تبعتلنا تأكيد الطلب على واتساب وتوصلك كل التحديثات.`;
    const wa = $('#waLink');
    if (out.storeWhatsappLink && !out.whatsappSent) { wa.href = out.storeWhatsappLink; wa.hidden = false; } else { wa.hidden = true; }
    $('#successModal').hidden = false;
    document.body.classList.add('locked');
  }

  // ---------- الأحداث ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a, .overlay, .modal, [data-open]');
    if (!t) return;
    if (t.dataset.open) { openProduct(t.dataset.open); return; }
    if (t.dataset.pmStep) { stepPm(Number(t.dataset.pmStep)); return; }
    if (t.dataset.pmGo) { pm.idx = Number(t.dataset.pmGo); showPmImage(); return; }
    if (t.dataset.add) { setQty(t.dataset.add, 1); toast('اتضاف للسلة ✓'); return; }
    if (t.dataset.inc) { setQty(t.dataset.inc, (cart[t.dataset.inc] || 0) + 1); return; }
    if (t.dataset.dec) { setQty(t.dataset.dec, (cart[t.dataset.dec] || 0) - 1); return; }
    if (t.dataset.remove) { setQty(t.dataset.remove, 0); return; }
    if (t.hasAttribute('data-close') || t.id === 'overlay' || (t.classList.contains('modal') && e.target === t)) { closeAll(); return; }
    if (t.id === 'openCart') { openCart(); return; }
    if (t.id === 'toCheckout') { openCheckout(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
    if (!$('#productModal').hidden && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) stepPm(e.key === 'ArrowLeft' ? 1 : -1);
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.card-media[data-open]')) { e.preventDefault(); openProduct(e.target.dataset.open); }
  });
  // سحب الصورة يمين وشمال على الموبايل
  let touchX = null;
  $('#pmImage').addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  $('#pmImage').addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX; touchX = null;
    if (Math.abs(dx) > 40) stepPm(dx > 0 ? 1 : -1);
  });
  $('#checkoutForm').addEventListener('submit', submitOrder);
  $('#govSelect').addEventListener('change', (e) => { governorate = e.target.value; renderSummary(); });

  init();
})();
