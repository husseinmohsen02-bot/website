// ===== إعدادات الشركة – غيّرها من هنا =====
const CONFIG = {
  email: "sales@kemora.com",
  whatsapp: "201000000000", // رقم الواتساب بالصيغة الدولية بدون + أو أصفار
};

// ===== المنتجات – زوّد أو عدّل براحتك =====
const PRODUCTS = [
  { name: "Caustic Soda (NaOH)", cat: ["Industrial", "صناعي"], desc: ["Flakes & pearls 99%", "قشور ولؤلؤ 99%"] },
  { name: "Soda Ash (Na₂CO₃)", cat: ["Industrial", "صناعي"], desc: ["Light & dense grades", "خفيف وثقيل"] },
  { name: "Sulfuric Acid (H₂SO₄)", cat: ["Industrial", "صناعي"], desc: ["98% technical grade", "تركيز 98% تقني"] },
  { name: "Hydrogen Peroxide", cat: ["Industrial", "صناعي"], desc: ["35% / 50%", "35% / 50%"] },
  { name: "Citric Acid", cat: ["Food Grade", "غذائي"], desc: ["Anhydrous & monohydrate", "لا مائي وأحادي التميؤ"] },
  { name: "Sodium Benzoate", cat: ["Food Grade", "غذائي"], desc: ["Preservative E211", "مادة حافظة E211"] },
  { name: "Xanthan Gum", cat: ["Food Grade", "غذائي"], desc: ["Food thickener", "مُكثّف غذائي"] },
  { name: "Poly Aluminium Chloride (PAC)", cat: ["Water Treatment", "معالجة مياه"], desc: ["Coagulant 30%", "مادة مُروّبة 30%"] },
  { name: "Calcium Hypochlorite", cat: ["Water Treatment", "معالجة مياه"], desc: ["Chlorine 65–70%", "كلور 65–70%"] },
  { name: "LABSA 96%", cat: ["Detergents", "منظفات"], desc: ["Linear alkyl benzene sulfonic acid", "حمض السلفونيك"] },
  { name: "SLES 70%", cat: ["Detergents", "منظفات"], desc: ["Sodium lauryl ether sulfate", "تكسابون"] },
  { name: "Titanium Dioxide (TiO₂)", cat: ["Paints", "دهانات"], desc: ["Rutile grade", "درجة روتيل"] },
];

let lang = "ar";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const i = () => (lang === "en" ? 0 : 1);

function renderProducts(filter = "") {
  const q = filter.trim().toLowerCase();
  const list = PRODUCTS.filter(p =>
    [p.name, ...p.cat, ...p.desc].join(" ").toLowerCase().includes(q)
  );
  $("#productGrid").innerHTML = list.map(p => `
    <div class="card">
      <span class="cat">${p.cat[i()]}</span>
      <h3>${p.name}</h3>
      <p>${p.desc[i()]}</p>
      <button data-product="${p.name}">${lang === "en" ? "Quote this" : "اطلب سعر"}</button>
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
  try { localStorage.setItem("lang", l); } catch (e) {}
  renderProducts($("#search").value);
}

// زر اللغة والقائمة
$("#langBtn").onclick = () => setLang(lang === "ar" ? "en" : "ar");
$("#burger").onclick = () => $("#links").classList.toggle("open");
$$("#links a").forEach(a => (a.onclick = () => $("#links").classList.remove("open")));

// البحث الذكي
$("#search").addEventListener("input", e => renderProducts(e.target.value));

// "اطلب سعر" من كارت المنتج يملا الفورم تلقائيًا
$("#productGrid").addEventListener("click", e => {
  const b = e.target.closest("button[data-product]");
  if (!b) return;
  $("#productField").value = b.dataset.product;
  $("#quote").scrollIntoView();
  setTimeout(() => $("#quoteForm [name=qty]").focus(), 500);
});

// إرسال الطلب بالإيميل أو الواتساب
let via = "email";
$$("#quoteForm button[data-via]").forEach(b => (b.onclick = () => (via = b.dataset.via)));
$("#quoteForm").addEventListener("submit", e => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  const L = lang === "en"
    ? ["Quote request", "Name", "Company", "Phone", "Product", "Quantity", "Notes"]
    : ["طلب عرض سعر", "الاسم", "الشركة", "الموبايل", "المنتج", "الكمية", "ملاحظات"];
  const body = [
    `${L[1]}: ${d.name}`, `${L[2]}: ${d.company}`, `${L[3]}: ${d.phone}`,
    `${L[4]}: ${d.product}`, `${L[5]}: ${d.qty}`, `${L[6]}: ${d.notes}`,
  ].join("\n");
  if (via === "whatsapp") {
    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(L[0] + "\n" + body)}`, "_blank");
  } else {
    location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent(L[0] + " – " + d.product)}&body=${encodeURIComponent(body)}`;
  }
});

$("#waFloat").href = `https://wa.me/${CONFIG.whatsapp}`;
$("#waFloat").target = "_blank";
$("#year").textContent = new Date().getFullYear();

let saved = "ar";
try { saved = localStorage.getItem("lang") || "ar"; } catch (e) {}
setLang(saved);
