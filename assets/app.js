(() => {
  const state = {
    items: [],
    filtered: [],
    filter: "all",
    query: "",
    visible: 30,
  };

  const feedEl = document.getElementById("feed");
  const highlightsEl = document.getElementById("highlights");
  const metaEl = document.getElementById("meta");
  const loadMore = document.getElementById("loadMore");
  const search = document.getElementById("search");
  const tabs = document.getElementById("tabs");

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function itemTime(item) {
    const raw = item.published_at || item.captured_at;
    const date = raw ? new Date(raw) : null;
    return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
  }

  function formatDate(value, long = false) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...(long ? {year: "numeric"} : {})
    }).format(date);
  }

  function displayTitle(item) {
    return item.display_title || item.title || item.original_title || "";
  }

  function itemBlob(item) {
    return `${item.kind} ${item.section} ${item.company} ${item.product} ${displayTitle(item)} ${item.summary} ${item.source} ${(item.tags || []).join(" ")}`;
  }

  function accentClass(item) {
    const blob = itemBlob(item);
    if (item.kind === "x") return "accent-x";
    if (item.kind === "youtube") return "accent-youtube";
    if (item.has_dell_mention) return "accent-dell";
    if (isDeal(item)) return "accent-deals";
    if (/competitor|apple|lenovo|hp|asus|acer|msi|framework|samsung|surface|positivo|lg/i.test(blob)) return "accent-competitor";
    if (/market|ecosystem|industry|signal|brief/i.test(blob)) return "accent-market";
    return "accent-default";
  }

  function isDeal(item) {
    return /deal|deals|offer|coupon|discount|promo|oferta|cupom|desconto/i.test(itemBlob(item));
  }

  function isBrief(item) {
    return item.score > 0 && item.score < 50 && !item.is_dell_story && !item.is_review && !item.is_sponsored;
  }

  function matchesFilter(item) {
    const blob = itemBlob(item);
    if (state.filter === "all") return true;
    if (state.filter === "dell") return Boolean(item.has_dell_mention);
    if (state.filter === "competitor") return /competitor|apple|lenovo|hp|asus|acer|msi|framework|samsung|surface|positivo|lg/i.test(blob);
    if (state.filter === "market") return /market|ecosystem|industry|signal|brief/i.test(blob) && !isDeal(item);
    if (state.filter === "deals") return isDeal(item);
    if (state.filter === "review") return Boolean(item.is_review);
    if (state.filter === "youtube") return item.kind === "youtube";
    if (state.filter === "x") return item.kind === "x";
    if (state.filter === "br") return item.country === "BR" || /tudocelular|adrenaline|tecmundo|canaltech|tecnoblog|olhar digital|mundo conectado|veja|exame|ti inside|showmetech/i.test(blob);
    return true;
  }

  function applyFilters() {
    const q = state.query.trim().toLowerCase();
    state.filtered = state.items.filter(item => {
      if (!matchesFilter(item)) return false;
      if (!q) return true;
      return itemBlob(item).toLowerCase().includes(q);
    }).sort((a, b) => itemTime(b) - itemTime(a));
    state.visible = 30;
    render();
  }

  function chip(label, cls = "", icon = "") {
    if (!label) return "";
    const img = icon ? `<img src="${escapeHtml(icon)}" alt="">` : "";
    return `<span class="chip ${cls}">${img}${escapeHtml(label)}</span>`;
  }

  function scoreText(item) {
    return item.score ? `<span class="score-text">Relevance ${escapeHtml(item.score)}</span>` : "";
  }

  function displaySummary(item) {
    const summary = (item.summary || "").trim();
    if (summary) return summary;
    if (item.kind === "x") return item.why_it_matters || "";
    return "Summary pending.";
  }

  function itemChips(item) {
    const parts = [];
    parts.push(chip(item.source || "Source", "source", item.source_icon));
    if (item.country) parts.push(chip(item.country));
    if (item.is_review) parts.push(chip("Review", "review"));
    if (item.is_sponsored) parts.push(chip("Sponsored", "sponsored"));
    if (item.is_short) parts.push(chip("Shorts", "short"));
    if (isDeal(item)) parts.push(chip("Deals", "deal"));
    const product = item.product || item.company;
    if (product) parts.push(chip(product));
    return parts.join("");
  }

  function youtubeThumb(item) {
    const image = item.thumbnail || item.source_icon || "";
    if (!image) return "";
    return `<div class="thumb media-thumb"><img src="${escapeHtml(image)}" alt=""></div>`;
  }

  function xCard(item) {
    return `<article class="card x-card accent-x">
      <div class="x-rail">X</div>
      <div class="body">
        <div class="chips">${chip(item.source || "X Watch", "source", item.source_icon)}</div>
        <h2><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.source || "X Watch post")}</a></h2>
        <div class="x-post">${escapeHtml(displaySummary(item) || displayTitle(item)).replace(/\n/g, "<br>")}</div>
        ${item.why_it_matters ? `<p class="x-reason">${escapeHtml(item.why_it_matters)}</p>` : ""}
        <div class="foot"><span>X Watch</span><span>${formatDate(item.published_at || item.captured_at, true)}</span>${scoreText(item)}</div>
      </div>
    </article>`;
  }

  function card(item) {
    if (item.kind === "x") return xCard(item);
    const compact = isDeal(item) || isBrief(item);
    const withThumb = item.kind === "youtube" && !compact;
    return `<article class="card ${accentClass(item)} ${compact ? "compact-card" : ""} ${withThumb ? "has-thumb" : "no-thumb"}">
      ${withThumb ? youtubeThumb(item) : ""}
      <div class="body">
        <div class="chips">${itemChips(item)}</div>
        <h2><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(displayTitle(item))}</a></h2>
        ${item.original_title && item.original_title !== displayTitle(item) ? `<div class="original-title">${escapeHtml(item.original_title)}</div>` : ""}
        <p>${escapeHtml(displaySummary(item))}</p>
        <div class="foot">
          <span>${escapeHtml(item.section || item.kind || "")}</span>
          <span>${formatDate(item.published_at || item.captured_at, true)}</span>
          ${scoreText(item)}
        </div>
      </div>
    </article>`;
  }

  function highlight(item) {
    const img = item.kind === "youtube" ? youtubeThumb(item) : "";
    return `<a class="highlight ${accentClass(item)} ${img ? "with-image" : ""}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">
      ${img}
      <div class="highlight-body">
        <div class="highlight-source">${chip(item.source || "Source", "source", item.source_icon)}</div>
        <div class="label">${escapeHtml(item.section || item.kind)}</div>
        <h2>${escapeHtml(displayTitle(item))}</h2>
        <p>${escapeHtml(displaySummary(item))}</p>
        <div class="foot"><span>${formatDate(item.published_at || item.captured_at, true)}</span>${scoreText(item)}</div>
      </div>
    </a>`;
  }

  function renderHighlights() {
    const now = Date.now();
    const recentWindow = 7 * 24 * 60 * 60 * 1000;
    const top = [...state.items]
      .filter(item => item.kind !== "x")
      .filter(item => itemTime(item) && now - itemTime(item) <= recentWindow)
      .filter(item => item.score >= 65 || item.is_dell_story || item.is_review)
      .sort((a, b) => (b.score || 0) - (a.score || 0) || itemTime(b) - itemTime(a))
      .slice(0, 3);
    highlightsEl.innerHTML = top.map(highlight).join("");
  }

  function render() {
    renderHighlights();
    const shown = state.filtered.slice(0, state.visible);
    feedEl.innerHTML = shown.length ? shown.map(card).join("") : `<div class="empty">No stories match this filter.</div>`;
    loadMore.style.display = state.visible < state.filtered.length ? "block" : "none";
  }

  function boot() {
    try {
      const data = window.MONITOR_HUB_DATA || {items: []};
      state.items = (data.items || []).sort((a, b) => itemTime(b) - itemTime(a));
      state.filtered = state.items;
      const updated = data.generated_at ? formatDate(data.generated_at, true) : "latest local export";
      metaEl.textContent = `Last updated ${updated}. Showing newsletter-ready Media Monitor, YouTube Monitor and X Watch signals in reverse chronological order.`;
      render();
    } catch (error) {
      feedEl.innerHTML = `<div class="empty">Could not load monitor data yet. Run the hub exporter once.</div>`;
      metaEl.textContent = "Waiting for export.";
    }
  }

  tabs.addEventListener("click", event => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    event.preventDefault();
    tabs.querySelectorAll("button").forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");
    state.filter = button.dataset.filter;
    applyFilters();
  });

  search.addEventListener("input", event => {
    state.query = event.target.value;
    applyFilters();
  });

  loadMore.addEventListener("click", () => {
    state.visible += 30;
    render();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.__monitorHubDebug = {state, applyFilters};
})();
