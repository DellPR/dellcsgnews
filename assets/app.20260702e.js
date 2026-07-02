(() => {
  const state = {
    items: [],
    filtered: [],
    filter: "all",
    productFilter: "all",
    competitorFilter: "all",
    query: "",
    visible: 30,
    generatedAt: "",
    refreshing: false,
  };

  const feedEl = document.getElementById("feed");
  const highlightsEl = document.getElementById("highlights");
  const topStoryHead = document.getElementById("topStoryHead");
  const metaEl = document.getElementById("meta");
  const loadMore = document.getElementById("loadMore");
  const search = document.getElementById("search");
  const tabs = document.getElementById("tabs");
  const refreshFeed = document.getElementById("refreshFeed");
  const productFilter = document.getElementById("productFilter");
  const competitorFilter = document.getElementById("competitorFilter");
  const controlsEl = document.querySelector(".controls");

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

  function formatRelativeTime(value, prefix = "Published") {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 0) return `${prefix} just now`;

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;

    if (diffMs < minute) return `${prefix} just now`;
    if (diffMs < hour) {
      const minutes = Math.max(1, Math.round(diffMs / minute));
      return `${prefix} ${minutes}m ago`;
    }
    if (diffMs < day) {
      const hours = Math.max(1, Math.round(diffMs / hour));
      return `${prefix} ${hours}h ago`;
    }
    if (diffMs < week) {
      const days = Math.max(1, Math.round(diffMs / day));
      return `${prefix} ${days}d ago`;
    }
    const weeks = Math.max(1, Math.round(diffMs / week));
    return `${prefix} ${weeks}w ago`;
  }

  function displayTitle(item) {
    return item.display_title || item.title || item.original_title || "";
  }

  function itemBlob(item) {
    return `${item.kind} ${item.section} ${item.company} ${item.product} ${displayTitle(item)} ${item.summary} ${item.source} ${(item.tags || []).join(" ")}`;
  }

  function normalizedSection(item) {
    return String(item.section || "").trim().toLowerCase();
  }

  function isCompetitorStory(item) {
    return Boolean(item.is_competitor_story) || normalizedSection(item) === "competitor coverage";
  }

  function isMarketStory(item) {
    const section = normalizedSection(item);
    return Boolean(item.is_market_story) || section === "market trends" || section === "ecosystem";
  }

  function accentClass(item) {
    if (item.kind === "x") return "accent-x";
    if (item.has_dell_mention) return "accent-dell";
    if (isDeal(item)) return "accent-deals";
    if (isCompetitorStory(item)) return "accent-competitor";
    if (isMarketStory(item)) return "accent-market";
    if (item.kind === "youtube") return "accent-youtube";
    return "accent-default";
  }

  function dellProductFamily(item) {
    const blob = itemBlob(item).toLowerCase();
    const product = String(item.product || "").toLowerCase();
    if (/\bxps\b/.test(blob)) return "xps";
    if (/\balienware\b/.test(blob)) {
      if (/\b(monitor|display|oled|qd-oled|hz|aw\d{4}|aw272|aw322|aw34|aw27|aw32|aw38)\b/.test(blob)) return "alienware-monitors";
      if (/\b(desktop|aurora|area-51|tower|r16|r17)\b/.test(blob)) return "alienware-desktops";
      return "alienware-laptops";
    }
    if (/\b(latitude|inspiron|precision|vostro|dell pro|dell plus|dell 14|dell 15|dell 16|notebook|laptop)\b/.test(product) ||
        (/\bdell\b/.test(blob) && /\b(laptop|notebook|ultrabook)\b/.test(blob))) {
      return "dell-laptops";
    }
    return "other";
  }

  function matchesDellProductFilter(item) {
    if (state.filter !== "dell" || state.productFilter === "all") return true;
    return dellProductFamily(item) === state.productFilter;
  }

  function competitorBrand(item) {
    const blob = itemBlob(item).toLowerCase();
    const company = String(item.company || "").toLowerCase();
    const checks = [
      ["hp", /\b(hp|omnibook|elitebook|probook|omen|victus|zbook)\b/],
      ["lenovo", /\b(lenovo|thinkpad|thinkbook|ideapad|yoga|legion|loq)\b/],
      ["apple", /\b(apple|macbook|mac studio|mac mini|imac|mac pro)\b/],
      ["asus", /\b(asus|rog|zenbook|vivobook|proart|tuf)\b/],
      ["acer", /\b(acer|swift|aspire|predator|nitro)\b/],
      ["msi", /\b(msi|prestige|summit|katana|stealth|raider)\b/],
      ["framework", /\bframework\b/],
      ["samsung", /\b(samsung|galaxy book)\b/],
      ["microsoft", /\b(microsoft|surface)\b/],
      ["lg", /\b(lg|gram pro|lg gram)\b/],
      ["razer", /\b(razer|blade)\b/],
      ["positivo", /\bpositivo\b/],
    ];
    for (const [brand, pattern] of checks) {
      if (company === brand || pattern.test(blob)) return brand;
    }
    return "other";
  }

  function matchesCompetitorBrandFilter(item) {
    if (state.filter !== "competitor" || state.competitorFilter === "all") return true;
    return competitorBrand(item) === state.competitorFilter;
  }

  function updateProductFilterVisibility() {
    const showDell = state.filter === "dell";
    const showCompetitors = state.filter === "competitor";
    if (controlsEl) {
      controlsEl.classList.toggle("show-product-filter", showDell);
      controlsEl.classList.toggle("show-competitor-filter", showCompetitors);
    }
    if (productFilter) {
      productFilter.hidden = !showDell;
      productFilter.style.display = showDell ? "flex" : "none";
      productFilter.setAttribute("aria-hidden", showDell ? "false" : "true");
      if (!showDell && state.productFilter !== "all") {
        state.productFilter = "all";
        productFilter.querySelectorAll("button[data-product-filter]").forEach(btn => {
          btn.classList.toggle("active", btn.dataset.productFilter === "all");
        });
      }
    }
    if (competitorFilter) {
      competitorFilter.hidden = !showCompetitors;
      competitorFilter.style.display = showCompetitors ? "flex" : "none";
      competitorFilter.setAttribute("aria-hidden", showCompetitors ? "false" : "true");
      if (!showCompetitors && state.competitorFilter !== "all") {
        state.competitorFilter = "all";
        competitorFilter.querySelectorAll("button[data-competitor-filter]").forEach(btn => {
          btn.classList.toggle("active", btn.dataset.competitorFilter === "all");
        });
      }
    }
  }

  function isDeal(item) {
    const url = String(item.url || "");
    const blob = itemBlob(item);
    return /\/deals?\b|\/offers?\b|\/coupons?\b/i.test(url)
      || /\b(deal|deals|offer|offers|coupon|coupons|discount|discounts|promo|promos|sale|sales|oferta|ofertas|cupom|cupons|desconto|descontos)\b/i.test(blob);
  }

  function isBrief(item) {
    return item.score > 0 && item.score < 50 && !item.is_dell_story && !item.is_review && !item.is_sponsored;
  }

  function isMiniSignal(item) {
    return Number(item.score || 0) < 50;
  }

  function matchesFilter(item) {
    const blob = itemBlob(item);
    if (state.filter === "all") return true;
    if (state.filter === "dell") return Boolean(item.has_dell_mention);
    if (state.filter === "competitor") return isCompetitorStory(item);
    if (state.filter === "market") return isMarketStory(item) && !isDeal(item);
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
      if (!matchesDellProductFilter(item)) return false;
      if (!matchesCompetitorBrandFilter(item)) return false;
      if (!q) return true;
      return itemBlob(item).toLowerCase().includes(q);
    }).sort((a, b) => itemTime(b) - itemTime(a));
    state.visible = 30;
    updateProductFilterVisibility();
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
    if (item.kind === "youtube") parts.push(chip("YouTube", "youtube"));
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
        <div class="foot"><span>X Watch</span><span>${formatRelativeTime(item.published_at || item.captured_at, "Posted")}</span>${scoreText(item)}</div>
      </div>
    </article>`;
  }

  function card(item) {
    if (item.kind === "x") return xCard(item);
    const compact = isDeal(item) || isBrief(item);
    const mini = isMiniSignal(item);
    const withThumb = item.kind === "youtube" && !compact;
    return `<article class="card ${accentClass(item)} ${compact ? "compact-card" : ""} ${mini ? "mini-card" : ""} ${withThumb ? "has-thumb" : "no-thumb"}">
      ${withThumb ? youtubeThumb(item) : ""}
      <div class="body">
        <div class="chips">${itemChips(item)}</div>
        <h2><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(displayTitle(item))}</a></h2>
        ${mini ? "" : `<p>${escapeHtml(displaySummary(item))}</p>`}
        <div class="foot">
          <span>${escapeHtml(item.section || item.kind || "")}</span>
          <span>${formatRelativeTime(item.published_at || item.captured_at)}</span>
          ${scoreText(item)}
        </div>
      </div>
    </article>`;
  }

  function highlight(item, topStory = false) {
    const img = item.kind === "youtube" ? youtubeThumb(item) : "";
    const sourceChips = [
      chip(item.source || "Source", "source", item.source_icon),
      item.kind === "youtube" ? chip("YouTube", "youtube") : "",
      item.country ? chip(item.country) : "",
      item.is_review ? chip("Review", "review") : "",
      item.is_sponsored ? chip("Sponsored", "sponsored") : "",
      item.is_short ? chip("Shorts", "short") : "",
    ].join("");
    return `<a class="highlight ${topStory ? "top-story-card" : ""} ${accentClass(item)} ${img ? "with-image" : ""}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">
      ${img}
      <div class="highlight-body">
        <div class="highlight-source">${sourceChips}</div>
        <div class="label">${escapeHtml(item.section || item.kind)}</div>
        <h2>${escapeHtml(displayTitle(item))}</h2>
        <p>${escapeHtml(displaySummary(item))}</p>
        <div class="foot"><span>${formatRelativeTime(item.published_at || item.captured_at)}</span>${scoreText(item)}</div>
      </div>
    </a>`;
  }

  function renderHighlights() {
    if (state.filter !== "all" || state.query.trim()) {
      highlightsEl.innerHTML = "";
      if (topStoryHead) topStoryHead.style.display = "none";
      return;
    }
    if (topStoryHead) topStoryHead.style.display = "";
    const topStory = [...state.items]
      .filter(item => item.kind !== "x")
      .filter(item => Number(item.score || 0) >= 90)
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || itemTime(b) - itemTime(a))[0];
    highlightsEl.innerHTML = topStory ? highlight(topStory, true) : "";
  }

  function render() {
    renderHighlights();
    const shown = state.filtered.slice(0, state.visible);
    feedEl.innerHTML = shown.length ? shown.map(card).join("") : `<div class="empty">No stories match this filter.</div>`;
    loadMore.style.display = state.visible < state.filtered.length ? "block" : "none";
  }

  function setData(data, source = "local export") {
    state.items = (data.items || []).sort((a, b) => itemTime(b) - itemTime(a));
    state.generatedAt = data.generated_at || "";
    const updated = data.generated_at ? formatRelativeTime(data.generated_at, "Updated") : source;
    metaEl.textContent = `${updated}. Showing newsletter-ready Media Monitor, YouTube Monitor and X Watch signals in reverse chronological order.`;
    applyFilters();
  }

  function hardRefreshPage() {
    if (state.refreshing) return;
    state.refreshing = true;
    refreshFeed.disabled = true;
    refreshFeed.textContent = "Refreshing";
    const url = new URL(window.location.href);
    url.searchParams.set("fresh", String(Date.now()));
    window.location.replace(url.toString());
  }

  async function refreshLatest() {
    if (state.refreshing) return;
    state.refreshing = true;
    refreshFeed.disabled = true;
    refreshFeed.textContent = "Refreshing";
    const previousMeta = metaEl.textContent;
    metaEl.textContent = "Checking for latest export...";
    try {
      const response = await fetch(`data/feed.json?ts=${Date.now()}`, {cache: "no-store"});
      if (!response.ok) throw new Error(`Feed request failed: ${response.status}`);
      const data = await response.json();
      setData(data, "latest export");
    } catch (error) {
      metaEl.textContent = previousMeta || "Could not refresh yet. Try again in a moment.";
    } finally {
      state.refreshing = false;
      refreshFeed.disabled = false;
      refreshFeed.textContent = "Refresh";
    }
  }

  function boot() {
    try {
      const data = window.MONITOR_HUB_DATA || {items: []};
      setData(data, "latest local export");
      refreshLatest();
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
    if (state.filter !== "dell") state.productFilter = "all";
    if (state.filter !== "competitor") state.competitorFilter = "all";
    applyFilters();
  });

  if (productFilter) {
    productFilter.addEventListener("click", event => {
      const button = event.target.closest("button[data-product-filter]");
      if (!button) return;
      event.preventDefault();
      productFilter.querySelectorAll("button[data-product-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      state.productFilter = button.dataset.productFilter;
      applyFilters();
    });
  }

  if (competitorFilter) {
    competitorFilter.addEventListener("click", event => {
      const button = event.target.closest("button[data-competitor-filter]");
      if (!button) return;
      event.preventDefault();
      competitorFilter.querySelectorAll("button[data-competitor-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      state.competitorFilter = button.dataset.competitorFilter;
      applyFilters();
    });
  }

  search.addEventListener("input", event => {
    state.query = event.target.value;
    applyFilters();
  });

  loadMore.addEventListener("click", () => {
    state.visible += 30;
    render();
  });

  refreshFeed.addEventListener("click", hardRefreshPage);

  let touchStartY = 0;
  let pullStartedAtTop = false;
  window.addEventListener("touchstart", event => {
    touchStartY = event.touches[0]?.clientY || 0;
    pullStartedAtTop = window.scrollY <= 4;
  }, {passive: true});

  window.addEventListener("touchend", event => {
    if (!pullStartedAtTop || state.refreshing) return;
    const endY = event.changedTouches[0]?.clientY || 0;
    if (endY - touchStartY > 85) hardRefreshPage();
  }, {passive: true});

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.__monitorHubDebug = {state, applyFilters};
})();
