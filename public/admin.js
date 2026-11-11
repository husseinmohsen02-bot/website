(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => `${Number(n).toLocaleString('ar-EG')} ج.م`;
  const localPhone = (p) => (p ? '0' + String(p).slice(2) : '');
  const STATUS = { new: 'جديد', confirmed: 'مؤكَّد', shipped: 'اتشحن', delivered: 'اتسلّم', cancelled: 'ملغي' };
  const KEY = 'coffee_admin_pw';

  let password = sessionStorage.getItem(KEY) || '';
  let orders = [];
  let storeName = 'المتجر';
  fetch('/api/config').then((r) => r.json()).then((c) => { storeName = c.storeName; }).catch(() => {});

  async function api(path, opts = {}) {
    const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', 'x-admin-password': password, ...(opts.headers || {}) } });
    if (res.status === 401) { logout(); throw new Error('باسورد غلط'); }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'خطأ');
    return res;
  }

  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  function logout() {
    password = ''; sessionStorage.removeItem(KEY);
    $('#panel').hidden = true; $('#logout').hidden = true; $('#loginBox').hidden = false;
  }

  async function load() {
    orders = await (await api('/api/admin/orders')).json();
    $('#loginBox').hidden = true; $('#panel').hidden = false; $('#logout').hidden = false;
    render();
  }

  function render() {
    const today = new Date().toDateString();
    const active = orders.filter((o) => o.status !== 'cancelled');
    $('#stats').innerHTML = [
      ['طلبات جديدة', orders.filter((o) => o.status === 'new').length],
      ['طلبات النهارده', orders.filter((o) => new Date(o.createdAt).toDateString() === today).length],
      ['مستني الشحن', orders.filter((o) => o.status === 'confirmed').length],
      ['إجمالي المبيعات', money(active.reduce((s, o) => s + o.total, 0))],
    ].map(([l, v]) => `<div class="stat"><b>${typeof v === 'number' ? v.toLocaleString('ar-EG') : v}</b><span>${l}</span></div>`).join('');

    const st = $('#statusFilter').value;
    const q = $('#search').value.trim().toLowerCase();
    const list = orders.filter((o) => (!st || o.status === st) && (!q
      || String(o.number).includes(q) || o.customer.name.toLowerCase().includes(q)
      || o.customer.phone.includes(q.replace(/^0/, '')) ));

    if (!list.length) { $('#orders').innerHTML = '<p class="muted">مفيش طلبات.</p>'; return; }
    $('#orders').innerHTML = list.map((o) => `
      <article class="order" data-id="${esc(o.id)}">
        <div class="order-head">
          <h3>#${esc(o.number)} — ${esc(o.customer.name)}</h3>
          <span class="pill st-${esc(o.status)}">${STATUS[o.status] || esc(o.status)}</span>
          <span class="muted">${new Date(o.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</span>
        </div>
        <div class="order-grid">
          <div>
            <div>📞 <a href="tel:${esc(localPhone(o.customer.phone))}" dir="ltr">${esc(localPhone(o.customer.phone))}</a>
              ${o.customer.phone2 ? ` / <span dir="ltr">${esc(localPhone(o.customer.phone2))}</span>` : ''}</div>
            <div>📍 ${esc(o.customer.governorate)} — ${esc(o.customer.city)}${o.customer.areaUnlisted ? ' <b style="color:var(--danger)">⚠️ منطقة مش في قايمة الشحن، اتأكد من السعر</b>' : ''}</div>
            <div>${esc(o.customer.address)}</div>
            ${o.customer.notes ? `<div>📝 ${esc(o.customer.notes)}</div>` : ''}
            <div class="wa-tag">${o.whatsapp?.sent ? '✅ اتبعت تأكيد واتساب تلقائي' : '— تأكيد الواتساب التلقائي غير مفعّل'}</div>
          </div>
          <div>
            <ul>${o.items.map((i) => `<li>${esc(i.name)} (${esc(i.weight)}) × ${i.qty} = ${money(i.lineTotal)}</li>`).join('')}</ul>
            <div>الشحن: ${money(o.shipping)} — <b>المطلوب تحصيله: ${money(o.total)}</b></div>
            ${o.weightGrams ? `<div class="muted">الوزن التقريبي: ${(o.weightGrams / 1000).toFixed(2)} كجم${o.overweight ? ' <b style="color:var(--danger)">⚖️ أكتر من كيلو، ممكن يتضاف وزن زيادة</b>' : ''}</div>` : ''}
          </div>
        </div>
        <div class="order-actions">
          <select data-status>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <input data-tracking placeholder="رقم البوليصة" value="${esc(o.trackingNumber || '')}">
          <button class="btn btn-dark btn-sm" data-save>حفظ</button>
          <a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="https://wa.me/${esc(o.customer.phone)}?text=${encodeURIComponent(waText(o))}">كلّم العميل واتساب</a>
        </div>
      </article>`).join('');
  }

  function waText(o) {
    return `أهلاً ${o.customer.name}، معاك ${storeName} بخصوص طلبك رقم #${o.number} بإجمالي ${o.total} ج.م.`
      + (o.trackingNumber ? `\nرقم بوليصة الشحن: ${o.trackingNumber}` : '\nممكن تأكدلنا العنوان وميعاد التوصيل المناسب؟');
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    password = e.target.elements.password.value;
    $('#loginError').textContent = '';
    try { await load(); sessionStorage.setItem(KEY, password); }
    catch (err) { $('#loginError').textContent = err.message; }
  });
  $('#logout').addEventListener('click', logout);
  $('#refresh').addEventListener('click', () => load().then(() => toast('اتحدّث ✓')).catch(() => {}));
  $('#statusFilter').addEventListener('change', render);
  $('#search').addEventListener('input', render);

  $('#exportCsv').addEventListener('click', async () => {
    try {
      const st = $('#statusFilter').value;
      const res = await api(`/api/admin/orders.csv${st ? `?status=${st}` : ''}`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `orders-${st || 'all'}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) { toast(err.message); }
  });

  $('#orders').addEventListener('click', async (e) => {
    if (!e.target.matches('[data-save]')) return;
    const card = e.target.closest('.order');
    try {
      const updated = await (await api(`/api/admin/orders/${card.dataset.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: card.querySelector('[data-status]').value, trackingNumber: card.querySelector('[data-tracking]').value }),
      })).json();
      orders = orders.map((o) => (o.id === updated.id ? updated : o));
      render(); toast('اتحفظ ✓');
    } catch (err) { toast(err.message); }
  });

  if (password) load().catch(logout);
})();
