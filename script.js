// ================= إعدادات الشركة – غيّرها من هنا بس =================
const CONFIG = {
  brand: "Moleva",            // اسم الشركة (بيتغير في الموقع كله تلقائيًا)
  domain: "moleva.com",       // الدومين – الإيميل بيتعمل منه: sales@الدومين
  phone: "+20 100 000 0000",  // رقم التليفون اللي بيظهر
  whatsapp: "201000000000",   // رقم الواتساب بالصيغة الدولية بدون + أو مسافات
};

// ================= التصنيفات =================
const CATS = {
  additives: ["Additives & Catalysts", "إضافات ومحفزات"],
  foam:      ["Foam Raw Materials", "خامات الفوم"],
  glycols:   ["Glycols & Glycol Ethers", "جلايكولات"],
  pigments:  ["Pigments & Fillers", "ملونات وفيلرز"],
  plast:     ["Plasticizers", "ملدّنات"],
  sbresin:   ["Solvent-based Resins", "خامات راتنجات مذيبة"],
  solvents:  ["Solvents", "مذيبات"],
  wbresin:   ["Water-based Resins", "خامات راتنجات مائية"],
};

// ================= المنتجات – زوّد أو امسح براحتك =================
const PRODUCTS = [
  ["Defoamers", "additives", "Silicone & mineral-oil defoamers", "مانعات رغوة سيليكون وزيت معدني"],
  ["Dispersing Agents", "additives", "For pigments in paints & inks", "لتشتيت الألوان في الدهانات والأحبار"],
  ["Paint Driers (Co / Zr / Ca)", "additives", "Metal driers for alkyd systems", "مجففات معدنية للألكيد"],
  ["DBTDL Catalyst", "additives", "Tin catalyst for PU systems", "محفز قصدير لأنظمة البولي يوريثان"],
  ["Methylene Diphenyl Diisocyanate (MDI)", "foam", "Polymeric MDI for rigid foam", "MDI بوليمري للفوم الجامد"],
  ["Toluene Diisocyanate (TDI 80/20)", "foam", "For flexible slabstock foam", "للفوم المرن (المراتب)"],
  ["Polyether Polyols (PPG, PEG)", "foam", "Flexible & rigid grades", "درجات للفوم المرن والجامد"],
  ["Polyester Polyols", "foam", "For PU foams, coatings & adhesives", "للفوم والدهانات واللواصق"],
  ["Triethylamine (TEA)", "foam", "Amine catalyst & intermediate", "محفز أميني ومادة وسيطة"],
  ["Silicone Surfactants", "foam", "Foam cell stabilizers", "مثبتات خلايا الفوم"],
  ["Monoethylene Glycol (MEG)", "glycols", "Fiber & antifreeze grade", "درجة ألياف ومانع تجمد"],
  ["Diethylene Glycol (DEG)", "glycols", "Resins & solvents", "للراتنجات والمذيبات"],
  ["Mono Propylene Glycol (MPG)", "glycols", "Industrial & USP grades", "درجة صناعية ودوائية"],
  ["Butyl Glycol (EB)", "glycols", "Coalescent & cleaner solvent", "مذيب للدهانات والمنظفات"],
  ["Titanium Dioxide (TiO₂)", "pigments", "Rutile & anatase grades", "درجات روتيل وأناتيز"],
  ["Calcium Carbonate", "pigments", "Coated & uncoated, various meshes", "مغلف وغير مغلف بمقاسات مختلفة"],
  ["Iron Oxide Pigments", "pigments", "Red, yellow & black", "أحمر وأصفر وأسود"],
  ["Talc", "pigments", "Paints, plastics & ceramics", "للدهانات والبلاستيك والسيراميك"],
  ["Carbon Black", "pigments", "For inks, rubber & plastics", "للأحبار والمطاط والبلاستيك"],
  ["DOP", "plast", "General-purpose plasticizer", "ملدّن متعدد الاستخدامات"],
  ["DOTP", "plast", "Phthalate-free plasticizer", "ملدّن خالي من الفثالات"],
  ["Epoxidized Soybean Oil (ESBO)", "plast", "Secondary plasticizer & stabilizer", "ملدّن ثانوي ومثبت"],
  ["Terephthalic Acid (TPA)", "sbresin", "For polyester resins", "لراتنجات البوليستر"],
  ["Phthalic Anhydride (PA)", "sbresin", "Alkyd & unsaturated polyester", "للألكيد والبوليستر غير المشبع"],
  ["Pentaerythritol (PENTA)", "sbresin", "Alkyd resins & rosin esters", "لراتنجات الألكيد"],
  ["Maleic Anhydride", "sbresin", "UPR & modified resins", "للراتنجات المعدلة"],
  ["Xylene", "solvents", "Paints & thinners", "للدهانات والتنر"],
  ["Toluene", "solvents", "Inks, adhesives & thinners", "للأحبار واللواصق والتنر"],
  ["Acetone", "solvents", "Fast-evaporating solvent", "مذيب سريع التطاير"],
  ["Butyl Acetate", "solvents", "PU & NC coatings", "لدهانات البولي يوريثان والنيترو"],
  ["Isopropyl Alcohol (IPA)", "solvents", "Inks, cleaning & pharma", "للأحبار والتنظيف والأدوية"],
  ["Acrylic Emulsions", "wbresin", "Pure & styrene-acrylic", "أكريليك نقي وستايرين أكريليك"],
  ["VAE Emulsion", "wbresin", "Adhesives & construction", "للواصق ومواد البناء"],
  ["HEC Thickener", "wbresin", "Cellulosic thickener for paints", "مكثف سليلوزي للدهانات"],
  ["AMP-95", "wbresin", "Multifunctional neutralizer", "معادل متعدد الوظائف"],
];

// ================= الكود – مش محتاج تعدّل فيه =================
let lang = "ar", activeCat = "all", showAll = false;
const PREVIEW = 8; // عدد المنتجات اللي بتظهر في "الكل" قبل "عرض المزيد"
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const L = () => (lang === "en" ? 0 : 1);
const email = () => `sales@${CONFIG.domain}`;

function applyConfig() {
  $$(".js-brand").forEach(e => (e.textContent = CONFIG.brand));
  $$(".js-email").forEach(e => (e.href = `mailto:${email()}`));
  $$(".js-email-text").forEach(e => (e.textContent = email()));
  $$(".js-phone").forEach(e => (e.href = `tel:${CONFIG.phone.replace(/\s/g, "")}`));
  $$(".js-phone-text").forEach(e => (e.textContent = CONFIG.phone));
  $("#waFloat").href = `https://wa.me/${CONFIG.whatsapp}`;
  $("#year").textContent = new Date().getFullYear();
}

function renderTabs() {
  const all = [["all", lang === "en" ? "All" : "الكل"], ...Object.entries(CATS).map(([k, v]) => [k, v[L()]])];
  $("#tabs").innerHTML = all.map(([k, t]) =>
    `<button data-cat="${k}" class="${k === activeCat ? "active" : ""}">${t}</button>`).join("");
}

function renderProducts() {
  const q = $("#search").value.trim().toLowerCase();
  const list = PRODUCTS.filter(([name, cat, en, ar]) =>
    (activeCat === "all" || cat === activeCat) &&
    [name, en, ar, ...CATS[cat]].join(" ").toLowerCase().includes(q));
  const limited = activeCat === "all" && !q && !showAll;
  const shown = limited ? list.slice(0, PREVIEW) : list;
  $("#moreBtn").hidden = !limited || list.length <= PREVIEW;
  $("#moreBtn").textContent = lang === "en" ? `View all ${list.length} products` : `عرض كل المنتجات (${list.length})`;
  $("#productGrid").innerHTML = shown.map(([name, cat, en, ar]) => `
    <div class="card">
      <span class="cat">${CATS[cat][L()]}</span>
      <h3>${name}</h3>
      <p>${lang === "en" ? en : ar}</p>
      <button data-product="${name}">${lang === "en" ? "Get Quote" : "اطلب سعر"}</button>
    </div>`).join("");
  $("#empty").hidden = list.length > 0;
}

function setLang(l) {
  lang = l;
  document.documentElement.lang = l;
  document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  $$("[data-en]").forEach(el => (el.textContent = el.dataset[l]));
  $$("[data-en-ph]").forEach(el => (el.placeholder = el.dataset[l + "Ph"]));
  $("#langBtn").textContent = l === "ar" ? "EN" : "ع";
  document.title = `${CONFIG.brand} | ${l === "en" ? "Chemical Solutions" : "حلول كيميائية"}`;
  try { localStorage.setItem("lang", l); } catch (e) {}
  renderTabs(); renderProducts();
}

$("#langBtn").onclick = () => setLang(lang === "ar" ? "en" : "ar");
$("#burger").onclick = () => $("#links").classList.toggle("open");
$$("#links a").forEach(a => (a.onclick = () => $("#links").classList.remove("open")));
$("#search").addEventListener("input", renderProducts);
$("#moreBtn").onclick = () => { showAll = true; renderProducts(); };
$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-cat]");
  if (!b) return;
  activeCat = b.dataset.cat; renderTabs(); renderProducts();
});
$("#productGrid").addEventListener("click", e => {
  const b = e.target.closest("button[data-product]");
  if (!b) return;
  $("#productField").value = b.dataset.product;
  $("#quote").scrollIntoView();
  setTimeout(() => $("#quoteForm [name=qty]").focus({ preventScroll: true }), 600);
});

let via = "email";
$$("#quoteForm button[data-via]").forEach(b => (b.onclick = () => (via = b.dataset.via)));
$("#quoteForm").addEventListener("submit", e => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  const T = lang === "en"
    ? ["Quote request", "Name", "Company", "Phone", "Product", "Quantity", "Notes"]
    : ["طلب عرض سعر", "الاسم", "الشركة", "الموبايل", "المنتج", "الكمية", "ملاحظات"];
  const body = [d.name, d.company, d.phone, d.product, d.qty, d.notes]
    .map((v, i) => `${T[i + 1]}: ${v || "-"}`).join("\n");
  if (via === "whatsapp") {
    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(T[0] + "\n" + body)}`, "_blank");
  } else {
    location.href = `mailto:${email()}?subject=${encodeURIComponent(`${T[0]} – ${d.product}`)}&body=${encodeURIComponent(body)}`;
  }
});

applyConfig();
let saved = "ar";
try { saved = localStorage.getItem("lang") || "ar"; } catch (e) {}
setLang(saved);
