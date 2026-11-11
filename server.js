// متجر البن التركي — سيرفر بسيط بدون أي مكتبات خارجية (Node.js >= 18)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// ---------- تحميل الإعدادات من ملف .env ----------
(function loadEnv() {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
})();

const CONFIG = {
  port: Number(process.env.PORT) || 3000,
  adminPassword: process.env.ADMIN_PASSWORD || 'change-me',
  storeName: process.env.STORE_NAME || 'حَبّة بُن',
  storeNameEn: process.env.STORE_NAME_EN || 'Habbet Bonn',
  storeWhatsapp: (process.env.STORE_WHATSAPP || '971553626134').replace(/\D/g, ''),
  shippingFee: Number(process.env.SHIPPING_FEE ?? 50),
  freeShippingOver: Number(process.env.FREE_SHIPPING_OVER ?? 0),
  // الطلبات اللي وزنها أكتر من كده شركة الشحن ممكن تضيف عليها مصاريف وزن زيادة
  overweightKg: Number(process.env.OVERWEIGHT_KG ?? 1),
  waToken: process.env.WHATSAPP_TOKEN || '',
  waPhoneId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  waTemplate: process.env.WHATSAPP_TEMPLATE_NAME || '',
  waTemplateLang: process.env.WHATSAPP_TEMPLATE_LANG || 'ar',
};

const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SHIPPING_FILE = path.join(DATA_DIR, 'shipping.json');

// اختيار "منطقة تانية" لو منطقة العميل مش في قايمة شركة الشحن
const OTHER_AREA = '__other__';

const STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];

// ---------- التخزين ----------
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJsonAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}
const getProducts = () => readJson(PRODUCTS_FILE, []);
// أسعار الشحن لكل محافظة ومنطقة، من data/shipping.json (بيتعمل من شيت شركة الشحن)
// الشكل: { "القاهرة": { "default": 80, "areas": { "المعادي": 80, ... } }, ... }
function getShipping() {
  const s = readJson(SHIPPING_FILE, {});
  const out = {};
  for (const [g, v] of Object.entries(s.governorates || {})) {
    const areas = {};
    for (const [a, price] of Object.entries(v.areas || {})) if (Number.isFinite(Number(price))) areas[a] = Number(price);
    const def = Number.isFinite(Number(v.default)) ? Number(v.default) : CONFIG.shippingFee;
    out[g] = { default: def, areas };
  }
  return out;
}
const getOrders = () => readJson(ORDERS_FILE, []);
const saveOrders = (orders) => writeJsonAtomic(ORDERS_FILE, orders);

function nextOrderNumber(orders) {
  const max = orders.reduce((m, o) => Math.max(m, Number(o.number) || 0), 1000);
  return max + 1;
}

// ---------- أدوات ----------
function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

function readBody(req, limit = 100_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}

const clean = (v, max = 300) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

// يحوّل الأرقام العربية لإنجليزية ويطبّع رقم الموبايل المصري لصيغة دولية 20xxxxxxxxxx
function normalizePhone(raw) {
  let p = String(raw || '')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/\D/g, '');
  if (p.startsWith('0020')) p = p.slice(2);
  if (p.startsWith('01') && p.length === 11) p = '2' + p;
  if (p.startsWith('1') && p.length === 10) p = '20' + p;
  return p;
}
const isValidEgyptMobile = (p) => /^201[0125]\d{8}$/.test(p);

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
const isAdmin = (req) => safeEqual(req.headers['x-admin-password'] || '', CONFIG.adminPassword);

function calcShipping(subtotal, governorate, area) {
  if (CONFIG.freeShippingOver > 0 && subtotal >= CONFIG.freeShippingOver) return 0;
  const g = getShipping()[governorate];
  if (!g) return CONFIG.shippingFee;
  return g.areas[area] ?? g.default;
}

// ---------- رسالة واتساب ----------
function orderMessage(order) {
  const lines = order.items.map((i) => `• ${i.name} (${i.weight}) × ${i.qty} = ${i.lineTotal} ج.م`);
  return [
    `أهلاً ${order.customer.name} 👋`,
    `تم استلام طلبك من ${CONFIG.storeName} بنجاح ☕`,
    '',
    `رقم الطلب: #${order.number}`,
    ...lines,
    `الشحن (${order.customer.governorate}): ${order.shipping} ج.م`,
    `الإجمالي: ${order.total} ج.م (الدفع عند الاستلام)`,
    ...(order.overweight ? ['⚖️ الطلب وزنه أكتر من كيلو، فممكن شركة الشحن تضيف مصاريف وزن زيادة بسيطة، وهنبلغك بيها قبل الشحن.'] : []),
    '',
    `العنوان: ${order.customer.governorate} - ${order.customer.city} - ${order.customer.address}`,
    '',
    'هنتواصل معاك قريب لتأكيد ميعاد التوصيل. شكراً لثقتك! 🤎',
  ].join('\n');
}

// إرسال تلقائي عبر WhatsApp Cloud API (اختياري)
async function sendWhatsAppConfirmation(order) {
  if (!CONFIG.waToken || !CONFIG.waPhoneId) return { sent: false, reason: 'not_configured' };
  const url = `https://graph.facebook.com/v21.0/${CONFIG.waPhoneId}/messages`;
  const payload = CONFIG.waTemplate
    ? {
        messaging_product: 'whatsapp',
        to: order.customer.phone,
        type: 'template',
        template: {
          name: CONFIG.waTemplate,
          language: { code: CONFIG.waTemplateLang },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: order.customer.name },
              { type: 'text', text: String(order.number) },
              { type: 'text', text: `${order.total} ج.م` },
            ],
          }],
        },
      }
    : {
        // الرسائل النصية الحرة تشتغل بس لو العميل كلمك خلال آخر 24 ساعة
        messaging_product: 'whatsapp',
        to: order.customer.phone,
        type: 'text',
        text: { body: orderMessage(order) },
      };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CONFIG.waToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { sent: false, reason: data?.error?.message || `HTTP ${r.status}` };
    return { sent: true, id: data?.messages?.[0]?.id };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}

// ---------- CSV لشركة الشحن ----------
function toCsv(orders) {
  const esc = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = "'" + s; // حماية من CSV injection في Excel
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ['رقم الطلب', 'التاريخ', 'الحالة', 'اسم العميل', 'الموبايل', 'موبايل إضافي',
    'المحافظة', 'المدينة/المنطقة', 'العنوان', 'المنتجات', 'عدد القطع', 'المنتجات (ج.م)',
    'الشحن', 'المبلغ المطلوب تحصيله', 'الوزن الصافي (كجم)', 'ملاحظات'];
  const rows = orders.map((o) => [
    o.number,
    new Date(o.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Cairo' }),
    o.status,
    o.customer.name,
    '0' + o.customer.phone.slice(2),
    o.customer.phone2 ? '0' + o.customer.phone2.slice(2) : '',
    o.customer.governorate,
    o.customer.city,
    o.customer.address,
    o.items.map((i) => `${i.name} ${i.weight} ×${i.qty}`).join(' | '),
    o.items.reduce((s, i) => s + i.qty, 0),
    o.subtotal,
    o.shipping,
    o.total,
    o.weightGrams ? (o.weightGrams / 1000).toFixed(2) : '',
    [o.customer.areaUnlisted ? '⚠️ منطقة مش في قايمة الشحن' : '', o.overweight ? '⚖️ وزن زيادة عن كيلو' : '', o.customer.notes].filter(Boolean).join(' — '),
  ]);
  // BOM عشان Excel يقرأ العربي صح
  return '﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}

// ---------- الملفات الثابتة ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon',
};
function serveStatic(req, res, pathname) {
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/admin') pathname = '/admin.html';
  const file = path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(pathname)));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(file).pipe(res);
  });
}

// ---------- معالجة الطلبات ----------
async function createOrder(req, res) {
  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: 'بيانات غير صالحة' }); }

  const c = body.customer || {};
  const customer = {
    name: clean(c.name, 80),
    phone: normalizePhone(c.phone),
    phone2: c.phone2 ? normalizePhone(c.phone2) : '',
    governorate: clean(c.governorate, 40),
    city: '',
    areaUnlisted: false,
    address: clean(c.address, 300),
    notes: clean(c.notes, 500),
  };

  const errors = [];
  if (customer.name.length < 3) errors.push('من فضلك اكتب الاسم بالكامل');
  if (!isValidEgyptMobile(customer.phone)) errors.push('رقم الموبايل غير صحيح (مثال: 01012345678)');
  if (customer.phone2 && !isValidEgyptMobile(customer.phone2)) errors.push('رقم الموبايل الإضافي غير صحيح');
  const shippingTable = getShipping();
  const gov = shippingTable[customer.governorate];
  const area = clean(c.area, 80);
  if (!gov) errors.push('اختار المحافظة');
  else if (area === OTHER_AREA) {
    customer.city = clean(c.areaOther, 80);
    customer.areaUnlisted = true;
    if (customer.city.length < 2) errors.push('اكتب اسم المنطقة');
  } else if (gov.areas[area] !== undefined) customer.city = area;
  else errors.push('اختار المنطقة');
  if (customer.address.length < 8) errors.push('اكتب العنوان بالتفصيل (شارع، عمارة، دور، شقة)');

  // الأسعار بتتحسب من السيرفر مش من المتصفح
  const products = new Map(getProducts().map((p) => [p.id, p]));
  const items = [];
  for (const it of Array.isArray(body.items) ? body.items.slice(0, 50) : []) {
    const p = products.get(String(it.id));
    const qty = Math.floor(Number(it.qty));
    if (!p || !p.available || !(qty >= 1 && qty <= 99)) continue;
    const existing = items.find((x) => x.id === p.id);
    if (existing) { existing.qty = Math.min(99, existing.qty + qty); existing.lineTotal = existing.qty * existing.price; continue; }
    items.push({ id: p.id, name: p.name, weight: p.weight, price: p.price, qty, lineTotal: p.price * qty, netWeight: Number(p.netWeight) || 0 });
  }
  if (!items.length) errors.push('السلة فاضية');
  if (errors.length) return send(res, 422, { error: errors.join('\n'), errors });

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const weightGrams = items.reduce((s, i) => s + i.netWeight * i.qty, 0);
  const overweight = weightGrams > CONFIG.overweightKg * 1000;
  const shipping = calcShipping(subtotal, customer.governorate, customer.areaUnlisted ? null : customer.city);
  const orders = getOrders();
  const order = {
    id: crypto.randomUUID(),
    number: nextOrderNumber(orders),
    createdAt: new Date().toISOString(),
    status: 'new',
    customer,
    items,
    subtotal,
    shipping,
    total: subtotal + shipping,
    weightGrams,
    overweight,
    payment: 'cod',
    whatsapp: null,
  };
  orders.push(order);
  saveOrders(orders);

  order.whatsapp = await sendWhatsAppConfirmation(order);
  const all = getOrders();
  const idx = all.findIndex((o) => o.id === order.id);
  if (idx >= 0) { all[idx].whatsapp = order.whatsapp; saveOrders(all); }
  if (order.whatsapp.reason && order.whatsapp.reason !== 'not_configured') {
    console.warn(`WhatsApp send failed for #${order.number}: ${order.whatsapp.reason}`);
  }

  const message = orderMessage(order);
  send(res, 201, {
    number: order.number,
    total: order.total,
    subtotal,
    shipping,
    items,
    whatsappSent: order.whatsapp.sent,
    message,
    // زرار احتياطي: العميل يبعت تفاصيل الأوردر لواتساب المتجر
    storeWhatsappLink: CONFIG.storeWhatsapp
      ? `https://wa.me/${CONFIG.storeWhatsapp}?text=${encodeURIComponent(`طلب جديد #${order.number}\n\n${message}`)}`
      : null,
  });
}

async function handleApi(req, res, url) {
  const p = url.pathname;

  if (req.method === 'GET' && p === '/api/config') {
    return send(res, 200, {
      storeName: CONFIG.storeName,
      storeNameEn: CONFIG.storeNameEn,
      storeWhatsapp: CONFIG.storeWhatsapp,
      shippingFee: CONFIG.shippingFee,
      freeShippingOver: CONFIG.freeShippingOver,
      overweightKg: CONFIG.overweightKg,
      shipping: getShipping(),
      otherArea: OTHER_AREA,
    });
  }
  if (req.method === 'GET' && p === '/api/products') {
    return send(res, 200, getProducts().filter((x) => x.available));
  }
  if (req.method === 'POST' && p === '/api/orders') return createOrder(req, res);

  // ----- الإدارة -----
  if (p.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return send(res, 401, { error: 'باسورد غلط' });

    if (req.method === 'GET' && p === '/api/admin/orders') {
      return send(res, 200, getOrders().slice().reverse());
    }
    if (req.method === 'GET' && p === '/api/admin/orders.csv') {
      const status = url.searchParams.get('status');
      const orders = getOrders().filter((o) => !status || o.status === status);
      return send(res, 200, toCsv(orders), {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      });
    }
    const m = p.match(/^\/api\/admin\/orders\/([\w-]+)$/);
    if (m && req.method === 'PATCH') {
      let body;
      try { body = await readBody(req); } catch { return send(res, 400, { error: 'بيانات غير صالحة' }); }
      const orders = getOrders();
      const o = orders.find((x) => x.id === m[1]);
      if (!o) return send(res, 404, { error: 'الطلب مش موجود' });
      if (body.status !== undefined) {
        if (!STATUSES.includes(body.status)) return send(res, 400, { error: 'حالة غير صالحة' });
        o.status = body.status;
      }
      if (body.trackingNumber !== undefined) o.trackingNumber = clean(body.trackingNumber, 60);
      if (body.adminNote !== undefined) o.adminNote = clean(body.adminNote, 500);
      o.updatedAt = new Date().toISOString();
      saveOrders(orders);
      return send(res, 200, o);
    }
  }
  return send(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    return serveStatic(req, res, url.pathname);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: 'حصل خطأ، حاول تاني' });
  }
});

if (!fs.existsSync(ORDERS_FILE)) writeJsonAtomic(ORDERS_FILE, []);
server.listen(CONFIG.port, () => {
  console.log(`☕ ${CONFIG.storeName} شغال على http://localhost:${CONFIG.port}`);
  console.log(`   لوحة الإدارة: http://localhost:${CONFIG.port}/admin`);
  if (CONFIG.adminPassword === 'change-me') console.warn('⚠️  غيّر ADMIN_PASSWORD في ملف .env');
});
