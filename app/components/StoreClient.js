"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const VARIANT_COLORS = {
  "Antique Gold": "#A9781E", Gold: "#B8873B", "Rose Gold": "#C08A6E", "Oxidised Silver": "#8A8A8A",
  Silver: "#9AA0A6", Coffee: "#6B4A33", Black: "#2B2320", Ruby: "#7A1F2B", Green: "#2F5D46"
};

function money(n) {
  return "Rs. " + Number(n).toLocaleString("en-PK");
}

function iconSVG(type, hex) {
  hex = hex || "#A9781E";
  const s = `stroke="${hex}"`;
  switch (type) {
    case "necklace": return `<svg viewBox="0 0 120 120" fill="none"><path d="M20 24 C20 60 45 78 60 78 C75 78 100 60 100 24" ${s} stroke-width="3"/><circle cx="60" cy="86" r="10" ${s} stroke-width="3"/><circle cx="34" cy="34" r="3" fill="${hex}"/><circle cx="86" cy="34" r="3" fill="${hex}"/><circle cx="44" cy="52" r="2.4" fill="${hex}"/><circle cx="76" cy="52" r="2.4" fill="${hex}"/></svg>`;
    case "earring": return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="26" r="8" ${s} stroke-width="3"/><path d="M60 34 L60 54" ${s} stroke-width="3"/><path d="M44 54 C44 80 52 96 60 96 C68 96 76 80 76 54Z" ${s} stroke-width="3"/><circle cx="60" cy="96" r="4" fill="${hex}"/></svg>`;
    case "bangle": return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="40" ${s} stroke-width="6"/><circle cx="60" cy="60" r="27" ${s} stroke-width="1.4" stroke-dasharray="3 5"/></svg>`;
    case "ring": return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="70" r="26" ${s} stroke-width="5"/><path d="M46 48 L60 26 L74 48Z" ${s} stroke-width="3" stroke-linejoin="round"/><circle cx="60" cy="40" r="5" fill="${hex}"/></svg>`;
    case "choker": return `<svg viewBox="0 0 120 120" fill="none"><path d="M18 40 C18 66 38 82 60 82 C82 82 102 66 102 40" ${s} stroke-width="5"/><path d="M40 50 C46 68 54 76 60 76 C66 76 74 68 80 50" ${s} stroke-width="2"/><circle cx="60" cy="76" r="4" fill="${hex}"/></svg>`;
    case "pendant": return `<svg viewBox="0 0 120 120" fill="none"><path d="M30 26 C30 26 90 26 90 26" ${s} stroke-width="3"/><path d="M30 26 C10 40 20 60 45 62 L45 96 L75 96 L75 62 C100 60 110 40 90 26" ${s} stroke-width="3" stroke-linejoin="round"/></svg>`;
    case "tikka": return `<svg viewBox="0 0 120 120" fill="none"><path d="M20 30 C40 20 80 20 100 30" ${s} stroke-width="3"/><path d="M60 30 L60 60" ${s} stroke-width="3"/><circle cx="60" cy="72" r="12" ${s} stroke-width="3"/><circle cx="60" cy="72" r="4" fill="${hex}"/></svg>`;
    default: return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="40" ${s} stroke-width="3"/></svg>`;
  }
}

function ProductMedia({ product, hex, className, style }) {
  if (product.image_url) {
    return (
      <img
        src={product.image_url}
        alt={product.name}
        className={className}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style }}
      />
    );
  }
  return <span className={className} dangerouslySetInnerHTML={{ __html: iconSVG(product.icon, hex) }} />;
}

function totalStock(p) {
  return p.variants.reduce((s, v) => s + v.stock, 0);
}

function loadCart() {
  try {
    const raw = localStorage.getItem("alhayat_cart");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveCart(cart) {
  try { localStorage.setItem("alhayat_cart", JSON.stringify(cart)); } catch {}
}

export default function StoreClient({ initialProducts, loadError }) {
  const router = useRouter();
  const products = initialProducts || [];
  const categories = useMemo(() => {
    const unique = Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort();
    return ["All", ...unique];
  }, [products]);

  const [activeCategory, setActiveCategory] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [activeProductId, setActiveProductId] = useState(null);
  const [activeVariant, setActiveVariant] = useState(null);
  const [pdQty, setPdQty] = useState(1);
  const [activeMedia, setActiveMedia] = useState("photo"); // "photo" | "video"
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payment, setPayment] = useState("cod");
  const [checkoutError, setCheckoutError] = useState("");
  const [placing, setPlacing] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => { setCart(loadCart()); }, []);
  useEffect(() => { saveCart(cart); }, [cart]);

  function showToast(msg) {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 2600);
  }

  function findProduct(id) { return products.find((p) => p.id === id) || null; }
  function findVariant(product, name) {
    if (!product) return null;
    return product.variants.find((v) => v.variant_name === name) || null;
  }

  const cartLines = useMemo(() => {
    return Object.entries(cart).map(([key, qty]) => {
      const [pid, variantName] = key.split("::");
      const product = findProduct(pid);
      if (!product) return null;
      const variant = findVariant(product, variantName);
      return { key, qty, product, variantName, variant };
    }).filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, products]);

  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const cartSubtotal = cartLines.reduce((s, l) => s + l.product.price * l.qty, 0);

  function addToCart(pid, variantName, qty) {
    const product = findProduct(pid);
    const variant = findVariant(product, variantName);
    if (!variant || variant.stock <= 0) { showToast("This colour is out of stock"); return; }
    const key = `${pid}::${variantName}`;
    setCart((prev) => {
      const next = Math.min((prev[key] || 0) + qty, variant.stock);
      return { ...prev, [key]: next };
    });
    showToast(`${product.name} added to cart`);
  }
  function setLineQty(key, qty) {
    const [pid, variantName] = key.split("::");
    const product = findProduct(pid);
    const variant = findVariant(product, variantName);
    const max = variant ? variant.stock : 99;
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[key];
      else next[key] = Math.min(qty, max);
      return next;
    });
  }
  function removeLine(key) {
    setCart((prev) => { const next = { ...prev }; delete next[key]; return next; });
  }
  function clearCart() { setCart({}); }

  const visibleProducts = useMemo(() => {
    let list = products.filter((p) => {
      const inCategory = activeCategory === "All" || p.category === activeCategory;
      const q = searchText.trim().toLowerCase();
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      return inCategory && matchesSearch;
    });
    if (sortBy === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sortBy === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    else if (sortBy === "name-asc") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, activeCategory, searchText, sortBy]);

  function openProduct(pid) {
    const product = findProduct(pid);
    if (!product) return;
    const first = product.variants.find((v) => v.stock > 0);
    setActiveProductId(pid);
    setActiveVariant(first ? first.variant_name : (product.variants[0] ? product.variants[0].variant_name : null));
    setPdQty(1);
    setActiveMedia("photo");
  }
  function closeProduct() { setActiveProductId(null); }
  const activeProduct = findProduct(activeProductId);
  const activeVariantObj = findVariant(activeProduct, activeVariant);

  function openCheckout() {
    if (cartLines.length === 0) { showToast("Your cart is empty"); return; }
    setCheckoutError("");
    setCheckoutOpen(true);
    setCartOpen(false);
  }

  async function placeOrder(e) {
    e.preventDefault();
    const form = e.target;
    const payload = {
      customer_name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      address: form.address.value.trim(),
      city: form.city.value.trim(),
      payment_method: payment,
      items: cartLines.map((l) => ({ product_id: l.product.id, variant_name: l.variantName, quantity: l.qty }))
    };
    if (!payload.customer_name || !payload.phone || !payload.address || !payload.city) {
      setCheckoutError("Please fill in all delivery details");
      return;
    }
    setPlacing(true);
    setCheckoutError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data.error || "Something went wrong. Please try again.");
        setPlacing(false);
        return;
      }
      clearCart();
      setConfirmedOrder({ ...data.order, city: payload.city, payment_method: payment });
      setCheckoutOpen(false);
      router.refresh(); // reload live stock from the server
    } catch (err) {
      setCheckoutError("Could not reach the server. Please try again.");
    }
    setPlacing(false);
  }

  const delivery = cartSubtotal >= 5000 || cartSubtotal === 0 ? 0 : 200;
  const total = cartSubtotal + delivery;

  return (
    <>
      <div className="announce">Free delivery across Pakistan on orders above Rs. 5,000 &nbsp;•&nbsp; Cash on Delivery available</div>
      {loadError && <div className="conn-banner">Could not load the catalog: {loadError}</div>}

      <header className="site">
        <div className="header-row">
          <div className="brand">
            <h1>Al Hayat</h1>
            <span>Handcrafted jewellery, delivered nationwide</span>
          </div>
          <div className="header-actions">
            <a className="admin-toggle" href="/admin">Manage Inventory</a>
            <button className="icon-btn" aria-label="Open cart" onClick={() => setCartOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 6h15l-1.5 9h-12z" /><path d="M6 6 4.5 2H2" />
                <circle cx="9.5" cy="20" r="1.4" fill="currentColor" stroke="none" />
                <circle cx="17.5" cy="20" r="1.4" fill="currentColor" stroke="none" />
              </svg>
              {cartCount > 0 && <span className="badge">{cartCount}</span>}
            </button>
          </div>
        </div>
        <nav className="chip-strip" aria-label="Categories">
          {categories.map((cat) => (
            <button key={cat} className={"chip" + (activeCategory === cat ? " active" : "")} onClick={() => setActiveCategory(cat)}>
              {cat}
            </button>
          ))}
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">The Autumn Edit</p>
            <h2>Where tradition meets everyday elegance</h2>
            <p className="sub">Antique gold finishes, kundan work and hand-set stones — designed with care, shipped across Pakistan with Cash on Delivery.</p>
            <div className="cta-row">
              <button className="btn btn-primary" onClick={() => { setActiveCategory("All"); document.getElementById("shopSection")?.scrollIntoView({ behavior: "smooth" }); }}>Shop the collection</button>
              <button className="btn btn-outline" onClick={() => { setActiveCategory(categories[1] || "All"); document.getElementById("shopSection")?.scrollIntoView({ behavior: "smooth" }); }}>Best sellers</button>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <svg viewBox="0 0 200 200" fill="none">
              <circle cx="100" cy="100" r="94" stroke="#A9781E" strokeWidth="1" />
              <path d="M100 40 C70 60 60 95 70 130 C78 155 100 168 100 168 C100 168 122 155 130 130 C140 95 130 60 100 40Z" stroke="#7A1F2B" strokeWidth="2" fill="none" />
              <circle cx="100" cy="88" r="14" stroke="#A9781E" strokeWidth="2" />
              <path d="M100 102 L100 150" stroke="#A9781E" strokeWidth="2" />
              <circle cx="100" cy="150" r="6" fill="#A9781E" />
              <path d="M40 60 Q100 20 160 60" stroke="#A9781E" strokeWidth="1.4" fill="none" />
            </svg>
          </div>
        </section>

        <div className="trust">
          <div className="trust-item"><strong>Free shipping</strong>On orders above Rs. 5,000</div>
          <div className="trust-item"><strong>Cash on Delivery</strong>Pay when your order arrives</div>
          <div className="trust-item"><strong>Google Pay</strong>Secure online checkout</div>
          <div className="trust-item"><strong>3-day exchange</strong>If it&apos;s not quite right</div>
        </div>

        <section className="section" id="shopSection">
          <div className="section-head" style={{ flexWrap: "wrap" }}>
            <h3>{activeCategory === "All" ? "All Jewellery" : activeCategory}</h3>
            <span className="muted">{visibleProducts.length} {visibleProducts.length === 1 ? "piece" : "pieces"}</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
            <input
              type="search" placeholder="Search jewellery…" value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ flex: 1, minWidth: 160, border: "1px solid var(--line)", borderRadius: 999, padding: "9px 16px", fontFamily: "inherit", fontSize: ".85rem", background: "var(--panel)", color: "var(--ink)" }}
            />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              style={{ border: "1px solid var(--line)", borderRadius: 999, padding: "9px 14px", fontFamily: "inherit", fontSize: ".85rem", background: "var(--panel)", color: "var(--ink)" }}>
              <option value="featured">Sort: Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name-asc">Name: A–Z</option>
            </select>
          </div>

          <div className="grid">
            {visibleProducts.length === 0 && <p className="empty-note">No pieces found.</p>}
            {visibleProducts.map((p) => {
              const stock = totalStock(p);
              const first = p.variants.find((v) => v.stock > 0);
              const hex = VARIANT_COLORS[first ? first.variant_name : (p.variants[0] && p.variants[0].variant_name)];
              return (
                <div className="card" key={p.id}>
                  <button className="card-media" onClick={() => openProduct(p.id)}>
                    {stock <= 0 && <span className="stock-tag out">Sold out</span>}
                    {stock > 0 && stock <= 3 && <span className="stock-tag">Only {stock} left</span>}
                    {p.video_url && <span className="stock-tag" style={{ left: "auto", right: 8 }}>▶ Video</span>}
                    <ProductMedia product={p} hex={hex} />
                  </button>
                  <div className="card-body">
                    <span className="cat">{p.category}</span>
                    <h4>{p.name}</h4>
                    <span className="price">{money(p.price)}</span>
                    <button
                      className="add-btn" disabled={stock <= 0}
                      onClick={() => { const v = p.variants.find((v) => v.stock > 0); if (v) addToCart(p.id, v.variant_name, 1); }}>
                      {stock <= 0 ? "Sold out" : "Add to cart"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer>
        <div className="foot-inner">
          <div className="foot-brand">
            <h1 style={{ fontSize: "1.3rem", color: "var(--maroon)", marginBottom: 8 }}>Al Hayat</h1>
            <p>Affordable artificial jewellery inspired by South Asian craftsmanship, made for everyday wear and bridal celebrations alike.</p>
          </div>
          <div><h5>Shop</h5><ul>{categories.filter((c) => c !== "All").map((c) => <li key={c}>{c}</li>)}</ul></div>
          <div><h5>Support</h5><ul><li>Shipping &amp; delivery</li><li>Exchange policy</li><li>Size guide</li><li>Contact us</li></ul></div>
          <div><h5>Payments</h5><ul><li>Cash on Delivery</li><li>Google Pay</li></ul></div>
        </div>
        <div className="foot-bottom">© 2026 Al Hayat Jewelry.</div>
      </footer>

      {/* Cart drawer */}
      <div className={"overlay-bg" + (cartOpen ? " show" : "")} onClick={() => setCartOpen(false)} />
      <aside className={"drawer" + (cartOpen ? " show" : "")} role="dialog" aria-label="Shopping cart">
        <div className="drawer-head"><h3>Your Cart</h3><button className="icon-btn" onClick={() => setCartOpen(false)}>✕</button></div>
        <div className="drawer-body">
          {cartLines.length === 0 && <p className="empty-note">Your cart is empty.</p>}
          {cartLines.map((l) => (
            <div className="cart-line" key={l.key}>
              <div className="thumb" style={{ position: "relative", overflow: "hidden" }}>
                <ProductMedia product={l.product} hex={VARIANT_COLORS[l.variantName]} />
              </div>
              <div className="info">
                <h5>{l.product.name}</h5>
                <div className="meta">{l.variantName} · {money(l.product.price)} each</div>
                <div className="qty-row">
                  <button onClick={() => setLineQty(l.key, l.qty - 1)}>−</button>
                  <span>{l.qty}</span>
                  <button onClick={() => setLineQty(l.key, l.qty + 1)}>+</button>
                </div>
                <button className="remove-link" onClick={() => removeLine(l.key)}>Remove</button>
              </div>
              <div className="line-total">{money(l.product.price * l.qty)}</div>
            </div>
          ))}
        </div>
        {cartLines.length > 0 && (
          <div className="drawer-foot">
            <div className="subtotal-row"><span>Subtotal</span><strong>{money(cartSubtotal)}</strong></div>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={openCheckout}>Proceed to checkout</button>
            {cartSubtotal < 5000
              ? <p style={{ fontSize: ".72rem", color: "var(--ink-soft)", marginTop: 8, textAlign: "center" }}>Add {money(5000 - cartSubtotal)} more for free delivery</p>
              : <p style={{ fontSize: ".72rem", color: "var(--ok)", marginTop: 8, textAlign: "center" }}>You qualify for free delivery</p>}
          </div>
        )}
      </aside>

      {/* Product modal */}
      <div className={"modal" + (activeProduct ? " show" : "")} onClick={(e) => { if (e.target === e.currentTarget) closeProduct(); }}>
        {activeProduct && (
          <div className="modal-card">
            <button className="modal-close" onClick={closeProduct}>✕</button>
            <div className="pd-grid">
              <div>
                <div className="pd-media">
                  {activeMedia === "video" && activeProduct.video_url ? (
                    <video
                      src={activeProduct.video_url}
                      controls autoPlay muted loop playsInline
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <ProductMedia product={activeProduct} hex={VARIANT_COLORS[activeVariant]} />
                  )}
                </div>
                {activeProduct.video_url && (
                  <div style={{ display: "flex", gap: 8, padding: "10px 22px 0" }}>
                    <button
                      onClick={() => setActiveMedia("photo")}
                      style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", position: "relative", border: activeMedia === "photo" ? "2px solid var(--maroon)" : "1px solid var(--line)", padding: 0, background: "var(--bg-alt)" }}
                    >
                      <ProductMedia product={activeProduct} hex={VARIANT_COLORS[activeVariant]} />
                    </button>
                    <button
                      onClick={() => setActiveMedia("video")}
                      style={{ width: 56, height: 56, borderRadius: 10, position: "relative", border: activeMedia === "video" ? "2px solid var(--maroon)" : "1px solid var(--line)", padding: 0, background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "1.2rem" }}
                      aria-label="Play video"
                    >
                      ▶
                    </button>
                  </div>
                )}
              </div>
              <div className="pd-info">
                <span className="cat">{activeProduct.category}</span>
                <h2>{activeProduct.name}</h2>
                <div className="price">{money(activeProduct.price)}</div>
                <p className="desc">{activeProduct.description}</p>
                <span className="label">Colour</span>
                <div className="swatch-row">
                  {activeProduct.variants.map((v) => (
                    <button key={v.variant_name} disabled={v.stock <= 0}
                      className={"swatch" + (v.variant_name === activeVariant ? " active" : "")}
                      onClick={() => { setActiveVariant(v.variant_name); setPdQty(1); }}>
                      {v.variant_name}{v.stock <= 0 ? " (out)" : ""}
                    </button>
                  ))}
                </div>
                {(!activeVariantObj || activeVariantObj.stock <= 0)
                  ? <p className="stock-note out">Out of stock in this colour</p>
                  : activeVariantObj.stock <= 3
                    ? <p className="stock-note low">Only {activeVariantObj.stock} left in this colour</p>
                    : <p className="stock-note">In stock</p>}
                <span className="label">Quantity</span>
                <div className="pd-qty-row">
                  <div className="qty-row">
                    <button onClick={() => setPdQty((q) => Math.max(1, q - 1))}>−</button>
                    <span>{pdQty}</span>
                    <button onClick={() => setPdQty((q) => Math.min(activeVariantObj ? activeVariantObj.stock : 99, q + 1))}>+</button>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ width: "100%" }}
                  disabled={!activeVariantObj || activeVariantObj.stock <= 0}
                  onClick={() => { addToCart(activeProduct.id, activeVariant, pdQty); closeProduct(); }}>
                  {(!activeVariantObj || activeVariantObj.stock <= 0) ? "Out of stock" : "Add to cart"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Checkout modal */}
      <div className={"modal" + (checkoutOpen || confirmedOrder ? " show" : "")} onClick={(e) => { if (e.target === e.currentTarget) { setCheckoutOpen(false); setConfirmedOrder(null); } }}>
        {confirmedOrder ? (
          <div className="modal-card">
            <div className="order-confirm">
              <div className="tick">✓</div>
              <h2>Order placed</h2>
              <p>Thank you — your order has been received and saved.</p>
              <p className="order-id">{confirmedOrder.order_number}</p>
              <p>Payment method: {confirmedOrder.payment_method === "gpay" ? "Google Pay (needs live gateway)" : "Cash on Delivery"}</p>
              <p>Estimated delivery to {confirmedOrder.city}: 2–4 business days</p>
              <button className="btn btn-outline" style={{ marginTop: 20 }} onClick={() => setConfirmedOrder(null)}>Continue shopping</button>
            </div>
          </div>
        ) : checkoutOpen && (
          <div className="modal-card">
            <button className="modal-close" onClick={() => setCheckoutOpen(false)}>✕</button>
            <form style={{ padding: "8px 24px 28px" }} onSubmit={placeOrder}>
              <h2 style={{ fontSize: "1.5rem", marginBottom: 18 }}>Checkout</h2>
              {checkoutError && <p className="error-note">{checkoutError}</p>}
              <div className="field"><label>Full name</label><input name="name" type="text" placeholder="Your name" /></div>
              <div className="field"><label>Phone number</label><input name="phone" type="tel" placeholder="03xx-xxxxxxx" /></div>
              <div className="field"><label>Delivery address</label><textarea name="address" rows={2} placeholder="House no, street, area" /></div>
              <div className="field"><label>City</label><input name="city" type="text" placeholder="e.g. Lahore" /></div>
              <span className="label">Payment method</span>
              <div className="pay-options">
                <label className={"pay-option" + (payment === "cod" ? " active" : "")}>
                  <input type="radio" name="pay" checked={payment === "cod"} onChange={() => setPayment("cod")} /> Cash on Delivery — pay when it arrives
                </label>
                <label className={"pay-option" + (payment === "gpay" ? " active" : "")}>
                  <input type="radio" name="pay" checked={payment === "gpay"} onChange={() => setPayment("gpay")} /> Google Pay — pay securely online
                </label>
              </div>
              {payment === "gpay" && <p className="pay-note">Google Pay needs a real payment-gateway account connected before live payments can be taken. Order will still be recorded.</p>}
              <div className="subtotal-row"><span>Subtotal</span><span>{money(cartSubtotal)}</span></div>
              <div className="subtotal-row"><span>Delivery</span><span>{delivery === 0 ? "Free" : money(delivery)}</span></div>
              <div className="subtotal-row"><strong>Total</strong><strong>{money(total)}</strong></div>
              <button className={"btn " + (payment === "gpay" ? "btn-gold" : "btn-primary")} style={{ width: "100%", marginTop: 6 }} disabled={placing} type="submit">
                {placing ? "Placing order…" : payment === "gpay" ? "Pay with Google Pay" : "Place order — Cash on Delivery"}
              </button>
            </form>
          </div>
        )}
      </div>

      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
    </>
  );
}
