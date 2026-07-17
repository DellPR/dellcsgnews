(() => {
  const state = {
    items: [],
    filtered: [],
    filter: "all",
    productFilter: "all",
    competitorFilter: "all",
    youtubeBrandFilter: "all",
    query: "",
    visible: 30,
    generatedAt: "",
    refreshing: false,
    view: "feed",
    metricWindow: "all",
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
  const youtubeBrandFilter = document.getElementById("youtubeBrandFilter");
  const RAW_FEED_URL = "https://raw.githubusercontent.com/DellPR/dellcsgnews/main/data/feed.json";
  const RAW_BRAND_METRICS_URL = "https://raw.githubusercontent.com/DellPR/dellcsgnews/main/data/brand_metrics.json";
  const TOP_STORY_URL = "https://www.youtube.com/watch?v=XyuWntBXxhs";
  const controlsEl = document.querySelector(".controls");
  const viewSwitch = document.getElementById("viewSwitch");
  const metricsView = document.getElementById("metricsView");
  const brandMetricsEl = document.getElementById("brandMetrics");
  const feedHead = document.getElementById("feedHead");
  const metricWindow = document.getElementById("metricWindow");

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
    const focused = `${item.title || ""} ${item.product || ""} ${item.summary || ""}`.toLowerCase();
    if (/\bxps\b/.test(blob)) return "xps";
    if (/\balienware\b/.test(blob)) {
      const monitorSignal = /\b(monitor|monitors|ultrawide|oled monitor|qd-oled monitor|gaming monitor|refresh rate|aw\d{2,5}[a-z0-9-]*)\b/.test(focused);
      const desktopSignal = /\b(desktop|aurora|tower|r16|r17|area-51 desktop)\b/.test(focused);
      const laptopSignal = /\b(laptop|notebook|mobile workstation|gaming laptop|alienware\s+(?:x|m)?\d{2}|m16|m18|x14|x16|area-51m|area-51\s+(?:laptop|notebook)|alienware\s+16|alienware\s+18)\b/.test(focused);
      if (monitorSignal) return "alienware-monitors";
      if (desktopSignal) return "alienware-desktops";
      if (laptopSignal) return "alienware-laptops";
      return "other";
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

  function canonicalBrand(item) {
    const blob = itemBlob(item).toLowerCase();
    const company = String(item.company || "").toLowerCase();
    if (/\balienware\b/.test(blob)) return "alienware";
    if (company === "dell" || /\b(dell|xps|latitude|precision|inspiron|optiplex|ultrasharp)\b/.test(blob)) return "dell";
    const comp = competitorBrand(item);
    if (comp !== "other") return comp;
    if (/\b(nvidia|geforce|rtx)\b/.test(blob)) return "nvidia";
    if (/\b(amd|radeon|ryzen)\b/.test(blob)) return "amd";
    if (/\b(intel|core ultra|arc)\b/.test(blob)) return "intel";
    if (/\b(qualcomm|snapdragon)\b/.test(blob)) return "qualcomm";
    if (/\b(valve|steam machine|steamos)\b/.test(blob)) return "valve";
    return "other";
  }

  function matchesYoutubeBrandFilter(item) {
    if (state.filter !== "youtube" || state.youtubeBrandFilter === "all") return true;
    return canonicalBrand(item) === state.youtubeBrandFilter;
  }

  function updateProductFilterVisibility() {
    const showDell = state.filter === "dell";
    const showCompetitors = state.filter === "competitor";
    const showYoutube = state.filter === "youtube";
    if (controlsEl) {
      controlsEl.classList.toggle("show-product-filter", showDell);
      controlsEl.classList.toggle("show-competitor-filter", showCompetitors);
      controlsEl.classList.toggle("show-youtube-filter", showYoutube);
    }
    if (productFilter) {
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
      competitorFilter.style.display = showCompetitors ? "flex" : "none";
      competitorFilter.setAttribute("aria-hidden", showCompetitors ? "false" : "true");
      if (!showCompetitors && state.competitorFilter !== "all") {
        state.competitorFilter = "all";
        competitorFilter.querySelectorAll("button[data-competitor-filter]").forEach(btn => {
          btn.classList.toggle("active", btn.dataset.competitorFilter === "all");
        });
      }
    }
    if (youtubeBrandFilter) {
      youtubeBrandFilter.style.display = showYoutube ? "flex" : "none";
      youtubeBrandFilter.setAttribute("aria-hidden", showYoutube ? "false" : "true");
      if (!showYoutube && state.youtubeBrandFilter !== "all") {
        state.youtubeBrandFilter = "all";
        youtubeBrandFilter.querySelectorAll("button[data-youtube-brand-filter]").forEach(btn => {
          btn.classList.toggle("active", btn.dataset.youtubeBrandFilter === "all");
        });
      }
    }
  }

  function looksEditorialReview(item) {
    const text = `${item.title || ""} ${item.display_title || ""} ${item.original_title || ""} ${item.summary || ""}`.toLowerCase();
    const hasReviewWord = /\b(review|reviews|reviewed|hands-on|hands on|tested|test-drive|comparison review)\b/i.test(text)
      || /\b(an[aá]lise|testamos|testei)\b/i.test(text);
    const hasProductSignal = /\b(laptop|notebook|desktop|workstation|monitor|display|chromebook|macbook|surface|thinkpad|ideapad|yoga|legion|omnibook|elitebook|zenbook|vivobook|rog|aspire|swift|framework|xps|latitude|precision|inspiron|optiplex|alienware|ultrasharp)\b/i.test(text);
    return Boolean(item.is_review) || (hasReviewWord && hasProductSignal);
  }

  function explicitDealText(item) {
    const title = `${item.title || ""} ${item.display_title || ""} ${item.original_title || ""}`.toLowerCase();
    const url = String(item.url || "").toLowerCase();
    const section = normalizedSection(item);

    if (/\/(?:deals?|offers?|coupons?)(?:\/|$|[?#-])/i.test(url)) return true;
    if (section === "deals" || section === "deals & roundups") return true;

    const directCommerce = [
      /\bbest deals?\b/i,
      /\bdeal alert\b/i,
      /\bdaily deals?\b/i,
      /\bshopping deals?\b/i,
      /\bdiscounts?\b/i,
      /\bcoupons?\b/i,
      /\bpromo code\b|\bpromos?\b|\bpromotion\b/i,
      /\bon sale\b|\bjuly 4 sale\b|\bholiday sale\b/i,
      /\bprice drop\b|\bprice cut\b|\bslashed\b/i,
      /\bsave\s+(?:\$|up to|\d)/i,
      /\b\d+\s*%\s*off\b/i,
      /\bunder\s+\$\d+/i,
      /\bprime day\b|\bblack friday\b|\bcyber monday\b/i,
      /\bofertas?\b|\bdescontos?\b|\bcupom\b|\bcupons\b|\bpromo[cç][aã]o\b/i,
      /\bnotebooks? em oferta\b/i,
    ];
    if (directCommerce.some(pattern => pattern.test(title))) return true;

    if (!looksEditorialReview(item)) {
      const listicleCommerce = [
        /\bbuying guide\b/i,
        /\broundup\b/i,
        /\bbest laptops?\b/i,
        /\bbest monitors?\b/i,
        /\bbest gaming laptops?\b/i,
        /\bmelhores notebooks\b/i,
      ];
      if (listicleCommerce.some(pattern => pattern.test(title))) return true;
    }

    return /\b(?:laptop|monitor|pc|gaming pc|chromebook|notebook)\s+deals?\b/i.test(title)
      || /\bdeals?\s+(?:on|for)\s+(?:laptops?|monitors?|pcs?|chromebooks?|notebooks?)\b/i.test(title);
  }

  function isDeal(item) {
    const directDealsUrl = /\/(?:deals?|offers?|coupons?)(?:\/|$|[?#-])/i.test(String(item.url || ""));
    if (looksEditorialReview(item) && !directDealsUrl) return false;
    return explicitDealText(item);
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
      if (!matchesYoutubeBrandFilter(item)) return false;
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
          <span class="section-chip">${escapeHtml(item.section || item.kind || "")}</span>
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
        <div class="label section-chip">${escapeHtml(item.section || item.kind)}</div>
        <h2>${escapeHtml(displayTitle(item))}</h2>
        <p>${escapeHtml(displaySummary(item))}</p>
        <div class="foot"><span>${formatRelativeTime(item.published_at || item.captured_at)}</span>${scoreText(item)}</div>
      </div>
    </a>`;
  }


  function metricNumber(value) {
    return new Intl.NumberFormat("en-US").format(Number(value || 0));
  }

  function brandColor(brand) {
    const key = String(brand || "").toLowerCase();
    if (key === "dell") return "#0672cb";
    if (key === "alienware") return "#5b2c83";
    if (key === "apple") return "#111827";
    if (key === "lenovo") return "#c8102e";
    if (key === "hp") return "#0072ce";
    if (key === "asus") return "#b7791f";
    if (key === "microsoft") return "#107c10";
    if (key === "samsung") return "#1428a0";
    return "#2f6f4e";
  }

  function brandMetricsData() {
    return window.MONITOR_HUB_BRAND_METRICS || {brands: [], months: [], recent: [], items: [], total_items: 0};
  }

  function metricItemTime(item) {
    const raw = item.published_at || item.captured_at;
    const date = raw ? new Date(raw) : null;
    return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
  }

  function metricWindowLabel() {
    if (state.metricWindow === "24h") return "last 24h";
    if (state.metricWindow === "7d") return "last 7 days";
    if (state.metricWindow === "30d") return "last 30 days";
    return "all time";
  }

  function metricWindowRows(data) {
    const rows = data.items && data.items.length ? data.items : (data.recent || []);
    if (state.metricWindow === "all") return rows;
    const windows = {"24h": 24, "7d": 24 * 7, "30d": 24 * 30};
    const hours = windows[state.metricWindow];
    if (!hours) return rows;
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return rows.filter(item => metricItemTime(item) >= cutoff);
  }

  function summarizeMetricRows(rows) {
    const byBrand = {};
    rows.forEach(item => {
      const brand = item.brand || "Other";
      const metric = byBrand[brand] || {
        brand,
        family: item.family || "Other",
        total: 0,
        media: 0,
        youtube: 0,
        reviews: 0,
        sponsored: 0,
        deals: 0,
        dell_stories: 0,
        score_sum: 0,
        top_sources: {},
        source_icons: {},
        sections: {},
      };
      metric.total += 1;
      if (item.kind === "youtube") metric.youtube += 1;
      else metric.media += 1;
      metric.reviews += item.is_review ? 1 : 0;
      metric.sponsored += item.is_sponsored ? 1 : 0;
      metric.deals += metricIsDeal(item) ? 1 : 0;
      metric.dell_stories += item.is_dell_story ? 1 : 0;
      metric.score_sum += Number(item.score || 0);
      if (item.source) {
        metric.top_sources[item.source] = (metric.top_sources[item.source] || 0) + 1;
        if (item.source_icon) metric.source_icons[item.source] = item.source_icon;
      }
      if (item.section) metric.sections[item.section] = (metric.sections[item.section] || 0) + 1;
      byBrand[brand] = metric;
    });
    return Object.values(byBrand).map(metric => {
      metric.avg_score = metric.total ? Math.round((metric.score_sum / metric.total) * 10) / 10 : 0;
      metric.top_sources = Object.entries(metric.top_sources)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 8)
        .map(([source, count]) => ({source, count, icon: metric.source_icons[source] || ""}));
      metric.sections = Object.entries(metric.sections)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 8)
        .map(([section, count]) => ({section, count}));
      delete metric.score_sum;
      delete metric.source_icons;
      return metric;
    }).sort((a, b) => Number(b.total || 0) - Number(a.total || 0) || a.brand.localeCompare(b.brand));
  }

  function renderBar(label, value, max, color) {
    const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
    return `<div class="metric-bar-row">
      <div class="metric-bar-label">${escapeHtml(label)}</div>
      <div class="metric-bar-track"><span style="width:${pct}%;background:${color}"></span></div>
      <div class="metric-bar-value">${metricNumber(value)}</div>
    </div>`;
  }

  function polarToCartesian(cx, cy, radius, angle) {
    const radians = (angle - 90) * Math.PI / 180;
    return {
      x: cx + radius * Math.cos(radians),
      y: cy + radius * Math.sin(radians),
    };
  }

  function pieSlicePath(cx, cy, radius, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, radius, endAngle);
    const end = polarToCartesian(cx, cy, radius, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
  }

  function metricWeekStart(raw) {
    const date = raw ? new Date(raw) : null;
    if (!date || Number.isNaN(date.getTime())) return "";
    const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() - day + 1);
    return utc.toISOString().slice(0, 10);
  }

  function metricWeekLabel(weekStart) {
    const date = new Date(`${weekStart}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return weekStart;
    return date.toLocaleDateString("en-US", {month: "short", day: "numeric", timeZone: "UTC"});
  }

  function renderWeeklyShareChart(rows) {
    const tracked = ["Apple", "Dell", "Lenovo", "Asus", "Acer", "Samsung", "Alienware"];
    const trackedKeys = new Set(tracked.map(brand => brand.toLowerCase()));
    const weeks = {};
    rows.forEach(item => {
      const week = metricWeekStart(item.published_at || item.captured_at);
      if (!week) return;
      const brand = item.brand || "Other";
      const slot = weeks[week] || {total: 0, brands: {}};
      slot.total += 1;
      if (trackedKeys.has(String(brand).toLowerCase())) {
        slot.brands[brand] = (slot.brands[brand] || 0) + 1;
      }
      weeks[week] = slot;
    });
    const weekKeys = Object.keys(weeks).sort();
    if (weekKeys.length < 2) {
      return `<section class="metric-panel line-chart-panel"><h3>Week-to-week share of voice</h3><div class="empty mini-empty">Not enough weekly history yet.</div></section>`;
    }
    const width = 760;
    const height = 250;
    const pad = {left: 46, right: 18, top: 18, bottom: 44};
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const allValues = [];
    const series = tracked.map(brand => {
      const points = weekKeys.map((week, index) => {
        const total = weeks[week].total || 1;
        const value = ((weeks[week].brands[brand] || 0) / total) * 100;
        allValues.push(value);
        const x = pad.left + (weekKeys.length === 1 ? chartW / 2 : (index / (weekKeys.length - 1)) * chartW);
        return {week, value, x};
      });
      return {brand, points, color: brandColor(brand)};
    });
    const maxValue = Math.max(10, Math.ceil(Math.max(...allValues) / 5) * 5);
    series.forEach(line => {
      line.points.forEach(point => {
        point.y = pad.top + chartH - (point.value / maxValue) * chartH;
      });
    });
    const grid = [0, .25, .5, .75, 1].map(step => {
      const y = pad.top + chartH - step * chartH;
      const value = Math.round(step * maxValue);
      return `<g><line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#e5edf4" stroke-width="1"></line><text x="8" y="${y + 4}" fill="#7b8797" font-size="11" font-weight="700">${value}%</text></g>`;
    }).join("");
    const weekLabels = weekKeys.map((week, index) => {
      const x = pad.left + (weekKeys.length === 1 ? chartW / 2 : (index / (weekKeys.length - 1)) * chartW);
      return `<text x="${x}" y="${height - 16}" fill="#7b8797" font-size="11" font-weight="700" text-anchor="middle">${escapeHtml(metricWeekLabel(week))}</text>`;
    }).join("");
    const paths = series.map(line => {
      const d = line.points.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
      const dots = line.points.map(point => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.2" fill="${line.color}"><title>${escapeHtml(line.brand)} ${metricWeekLabel(point.week)}: ${point.value.toFixed(1)}%</title></circle>`).join("");
      return `<path d="${d}" fill="none" stroke="${line.color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path>${dots}`;
    }).join("");
    const legend = tracked.map(brand => `<button type="button" class="line-legend-item brand-jump" data-brand-jump="${brand.toLowerCase()}" data-metric-key="total"><i style="background:${brandColor(brand)}"></i>${escapeHtml(brand)}</button>`).join("");
    return `<section class="metric-panel line-chart-panel">
      <h3>Week-to-week share of voice</h3>
      <p class="metric-note">Weekly share among all brand-coded stories in the current metrics window.</p>
      <div class="line-chart-wrap">
        <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Week-to-week share of voice for Apple, Dell, Lenovo, Asus, Acer, Samsung and Alienware">
          ${grid}
          ${paths}
          ${weekLabels}
        </svg>
      </div>
      <div class="line-legend">${legend}</div>
    </section>`;
  }

  function renderPieChart(title, brands, valueKey, emptyLabel, pinnedBrands = []) {
    const pinnedKeys = new Set(pinnedBrands.map(brand => String(brand || "").toLowerCase()));
    const rows = brands
      .map(b => ({brand: b.brand, value: Number(b[valueKey] || 0), color: brandColor(b.brand)}))
      .filter(row => row.value > 0)
      .sort((a, b) => b.value - a.value);
    const top = rows.slice(0, 6);
    const selected = [...top];
    rows.forEach(row => {
      const key = String(row.brand || "").toLowerCase();
      if (pinnedKeys.has(key) && !selected.some(item => String(item.brand || "").toLowerCase() === key)) {
        selected.push(row);
      }
    });
    const selectedKeys = new Set(selected.map(row => String(row.brand || "").toLowerCase()));
    const otherValue = rows
      .filter(row => !selectedKeys.has(String(row.brand || "").toLowerCase()))
      .reduce((sum, row) => sum + row.value, 0);
    const slices = otherValue > 0 ? [...selected, {brand: "Other", value: otherValue, color: "#94a3b8"}] : selected;
    const total = slices.reduce((sum, row) => sum + row.value, 0);
    if (!total) {
      return `<section class="metric-panel pie-panel"><h3>${escapeHtml(title)}</h3><div class="empty mini-empty">${escapeHtml(emptyLabel)}</div></section>`;
    }
    const sortedSlices = [...slices].sort((a, b) => b.value - a.value || a.brand.localeCompare(b.brand));
    let angle = 0;
    const paths = sortedSlices.map(row => {
      const end = angle + (row.value / total) * 360;
      const path = pieSlicePath(50, 50, 46, angle, end);
      angle = end;
      return `<path d="${path}" fill="${row.color}" stroke="#fff" stroke-width="1.4"><title>${escapeHtml(row.brand)} ${Math.round((row.value / total) * 100)}%</title></path>`;
    }).join("");
    const leader = sortedSlices[0];
    const leaderPct = Math.round((leader.value / total) * 100);
    const legend = sortedSlices.map(row => {
      const pct = Math.round((row.value / total) * 100);
      const brandKey = String(row.brand || "").toLowerCase();
      const jump = brandKey === "other" ? "" : ` data-brand-jump="${escapeHtml(brandKey)}" data-metric-key="${escapeHtml(valueKey)}"`;
      return `<li><button type="button" class="brand-jump"${jump} ${jump ? "" : "disabled"}><span><i style="background:${row.color}"></i>${escapeHtml(row.brand)}</span><b>${pct}%</b></button></li>`;
    }).join("");
    return `<section class="metric-panel pie-panel">
      <h3>${escapeHtml(title)}</h3>
      <div class="pie-wrap">
        <div class="pie-visual">
          <svg class="pie-chart" viewBox="0 0 100 100" role="img" aria-label="${escapeHtml(title)}">${paths}<circle cx="50" cy="50" r="29" fill="#fff"></circle></svg>
        </div>
        <ul class="pie-legend">${legend}</ul>
      </div>
    </section>`;
  }

  function metricIsDeal(item) {
    return isDeal(item);
  }

  function renderBrandMetrics() {
    if (!brandMetricsEl) return;
    const data = brandMetricsData();
    const rows = metricWindowRows(data).sort((a, b) => metricItemTime(b) - metricItemTime(a));
    const brands = summarizeMetricRows(rows);
    const brazilBrands = summarizeMetricRows(rows.filter(item => String(item.country || "").toUpperCase() === "BR"));
    const selected = brands.slice(0, 14);
    const maxTotal = Math.max(1, ...selected.map(b => Number(b.total || 0)));
    const brandByName = name => brands.find(b => String(b.brand || "").toLowerCase() === name) || {};
    const dellBrand = brandByName("dell");
    const alienwareBrand = brandByName("alienware");
    const dellStories = Number(dellBrand.total || 0);
    const alienwareStories = Number(alienwareBrand.total || 0);
    const competitors = brands.filter(b => b.family === "PC competitors").reduce((sum, b) => sum + Number(b.total || 0), 0);
    const reviews = brands.reduce((sum, b) => sum + Number(b.reviews || 0), 0);
    const deals = brands.reduce((sum, b) => sum + Number(b.deals || 0), 0);
    const dellReviews = Number(dellBrand.reviews || 0);
    const alienwareReviews = Number(alienwareBrand.reviews || 0);
    const topSources = {};
    const topSourceIcons = {};
    brands.forEach(b => (b.top_sources || []).forEach(s => {
      topSources[s.source] = (topSources[s.source] || 0) + Number(s.count || 0);
      if (s.icon) topSourceIcons[s.source] = s.icon;
    }));
    const topSourceRows = Object.entries(topSources)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([source, count]) => {
        const icon = topSourceIcons[source] ? `<img src="${escapeHtml(topSourceIcons[source])}" alt="">` : "";
        return `<li><span>${icon}${escapeHtml(source)}</span><b>${metricNumber(count)}</b></li>`;
      })
      .join("");
    const empty = !rows.length ? `<div class="empty">No brand-coded coverage found for ${metricWindowLabel()}.</div>` : "";
    brandMetricsEl.innerHTML = `
      <div class="metrics-intro">
        <h3>Brand coverage intelligence</h3>
        <p>Newsletter-ready Media Monitor and YouTube Monitor coverage, normalized by brand for PR planning and share-of-voice tracking. Current view: <strong>${metricWindowLabel()}</strong>.</p>
      </div>
      ${empty}
      <div class="metric-kpis">
        <button type="button" class="metric-kpi" data-brand-jump="dell" data-metric-key="total"><span>Dell stories</span><strong>${metricNumber(dellStories)}</strong></button>
        <button type="button" class="metric-kpi" data-brand-jump="alienware" data-metric-key="total"><span>Alienware stories</span><strong>${metricNumber(alienwareStories)}</strong></button>
        <button type="button" class="metric-kpi" data-kpi-filter="competitor"><span>Competitor stories</span><strong>${metricNumber(competitors)}</strong></button>
        <button type="button" class="metric-kpi" data-kpi-filter="review"><span>Reviews</span><strong>${metricNumber(reviews)}</strong></button>
        <button type="button" class="metric-kpi" data-kpi-filter="deals"><span>Deals</span><strong>${metricNumber(deals)}</strong></button>
        <button type="button" class="metric-kpi" data-brand-jump="dell" data-metric-key="reviews"><span>Dell reviews</span><strong>${metricNumber(dellReviews)}</strong></button>
        <button type="button" class="metric-kpi" data-brand-jump="alienware" data-metric-key="reviews"><span>Alienware reviews</span><strong>${metricNumber(alienwareReviews)}</strong></button>
      </div>
      <div class="metrics-grid">
        <section class="metric-panel metric-panel-wide">
          <h3>Publication volume by brand</h3>
          <div class="metric-bars">
            ${selected.map(b => renderBar(b.brand, b.total, maxTotal, brandColor(b.brand))).join("")}
          </div>
        </section>
        <section class="metric-panel">
          <h3>Top PR sources</h3>
          <ul class="metric-list">${topSourceRows || "<li><span>No sources in this period</span><b>0</b></li>"}</ul>
        </section>
      </div>
      <div class="metrics-grid pie-grid">
        ${renderPieChart("Share of voice", brands, "total", "No brand coverage in this period.", ["Dell", "Alienware"])}
        ${renderPieChart("YouTube share of voice", brands, "youtube", "No YouTube brand coverage in this period.", ["Dell", "Alienware"])}
        ${renderPieChart("Share of product reviews", brands, "reviews", "No product reviews in this period.", ["Dell", "Alienware"])}
        ${renderPieChart("Share of deals", brands, "deals", "No deals coverage in this period.", ["Dell", "Alienware"])}
      </div>
      <h3 class="metric-section-title">Brazil only</h3>
      <div class="metrics-grid pie-grid">
        ${renderPieChart("Share of voice (Brazil only)", brazilBrands, "total", "No Brazil brand coverage in this period.", ["Dell", "Alienware"])}
        ${renderPieChart("YouTube share of voice (Brazil only)", brazilBrands, "youtube", "No Brazil YouTube brand coverage in this period.", ["Dell", "Alienware"])}
        ${renderPieChart("Share of product reviews (Brazil only)", brazilBrands, "reviews", "No Brazil product reviews in this period.", ["Dell", "Alienware"])}
        ${renderPieChart("Share of deals (Brazil only)", brazilBrands, "deals", "No Brazil deals coverage in this period.", ["Dell", "Alienware"])}
      </div>
      ${renderWeeklyShareChart(rows)}
      <section class="metric-panel">
        <h3>Brand table</h3>
        <div class="metric-table-wrap"><table class="metric-table">
          <thead><tr><th>Brand</th><th>Total</th><th>Media</th><th>YouTube</th><th>Reviews</th><th>Deals</th><th>Avg score</th></tr></thead>
          <tbody>${brands.slice(0, 30).map(b => `<tr>
            <td><span class="brand-dot" style="background:${brandColor(b.brand)}"></span>${escapeHtml(b.brand)}</td>
            <td>${metricNumber(b.total)}</td>
            <td>${metricNumber(b.media)}</td>
            <td>${metricNumber(b.youtube)}</td>
            <td>${metricNumber(b.reviews)}</td>
            <td>${metricNumber(b.deals)}</td>
            <td>${escapeHtml(b.avg_score)}</td>
          </tr>`).join("")}</tbody>
        </table></div>
      </section>`;
  }

  function renderView() {
    const isMetrics = state.view === "metrics";
    if (metricsView) metricsView.hidden = !isMetrics;
    if (topStoryHead) topStoryHead.hidden = isMetrics;
    if (highlightsEl) highlightsEl.hidden = isMetrics;
    if (feedHead) feedHead.hidden = isMetrics;
    if (feedEl) feedEl.hidden = isMetrics;
    if (loadMore) loadMore.hidden = isMetrics;
    if (controlsEl) controlsEl.classList.toggle("metrics-mode", isMetrics);
    if (isMetrics) renderBrandMetrics();
  }

  function renderHighlights() {
    if (state.filter !== "all" || state.query.trim()) {
      highlightsEl.innerHTML = "";
      if (topStoryHead) topStoryHead.style.display = "none";
      return;
    }
    if (topStoryHead) topStoryHead.style.display = "";
    const forcedTopStory = state.items.find(item => item.url === TOP_STORY_URL);
    const topStory = forcedTopStory || [...state.items]
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
    renderView();
  }

  function setData(data, source = "local export") {
    state.items = (data.items || []).sort((a, b) => itemTime(b) - itemTime(a));
    state.generatedAt = data.generated_at || "";
    if (data.brand_metrics_data) window.MONITOR_HUB_BRAND_METRICS = data.brand_metrics_data;
    const updated = data.generated_at ? formatRelativeTime(data.generated_at, "Updated") : source;
    metaEl.textContent = `${updated}. Showing newsletter-ready Media Monitor, YouTube Monitor and X Watch signals in reverse chronological order.`;
    applyFilters();
  }


  function reloadWholeApp() {
    const url = new URL(window.location.href);
    url.searchParams.set("fresh", String(Date.now()));
    window.location.replace(url.toString());
  }

  async function refreshLatest(options = {}) {
    if (state.refreshing) return;
    state.refreshing = true;
    refreshFeed.disabled = true;
    refreshFeed.textContent = "Refreshing";
    const previousMeta = metaEl.textContent;
    metaEl.textContent = "Checking for latest export...";
    try {
      const bust = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const urls = [
        `${RAW_FEED_URL}?ts=${bust}`,
        `data/feed.json?ts=${bust}`
      ];
      let data = null;
      let lastError = null;
      for (const url of urls) {
        try {
          const response = await fetch(url, {
            cache: "no-store",
            headers: {"Cache-Control": "no-cache", "Pragma": "no-cache"}
          });
          if (!response.ok) throw new Error(`Feed request failed: ${response.status}`);
          data = await response.json();
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!data) throw lastError || new Error("Feed request failed");
      try {
        const metricsUrls = [
          `${RAW_BRAND_METRICS_URL}?ts=${bust}`,
          `data/brand_metrics.json?ts=${bust}`
        ];
        for (const metricsUrl of metricsUrls) {
          const metricsResponse = await fetch(metricsUrl, {
            cache: "no-store",
            headers: {"Cache-Control": "no-cache", "Pragma": "no-cache"}
          });
          if (metricsResponse.ok) {
            window.MONITOR_HUB_BRAND_METRICS = await metricsResponse.json();
            break;
          }
        }
      } catch (metricsError) {
        // Keep current metrics if a refresh races GitHub Pages propagation.
      }
      setData(data, "latest export");
      metaEl.textContent = `${formatRelativeTime(data.generated_at, "Updated") || "Updated just now"}. Showing latest hub export from GitHub Pages.`;
    } catch (error) {
      metaEl.textContent = previousMeta || "Could not refresh yet. Try again in a moment.";
      if (options.forcePageRefresh) {
        const url = new URL(window.location.href);
        url.searchParams.set("fresh", String(Date.now()));
        window.location.replace(url.toString());
        return;
      }
    } finally {
      state.refreshing = false;
      refreshFeed.disabled = false;
      refreshFeed.textContent = "Refresh";
    }
  }


  function hideSplash() {
    const splash = document.getElementById("splashScreen");
    if (!splash) return;
    splash.classList.add("is-hidden");
    setTimeout(() => splash.remove(), 450);
  }

  function boot() {
    try {
      const data = window.MONITOR_HUB_DATA || {items: []};
      setData(data, "latest local export");
      hideSplash();
      refreshLatest();
    } catch (error) {
      feedEl.innerHTML = `<div class="empty">Could not load monitor data yet. Run the hub exporter once.</div>`;
      metaEl.textContent = "Waiting for export.";
      hideSplash();
    }
  }

  function activateMainFilter(name) {
    state.filter = name;
    tabs.querySelectorAll("button[data-filter]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.filter === name);
    });
  }

  function jumpToBrandFeed(brand, metricKey) {
    const normalized = String(brand || "").toLowerCase();
    state.view = "feed";
    if (viewSwitch) viewSwitch.querySelectorAll("button[data-view]").forEach(btn => btn.classList.toggle("active", btn.dataset.view === "feed"));
    search.value = "";
    state.query = "";
    state.productFilter = "all";
    state.competitorFilter = "all";
    state.youtubeBrandFilter = "all";
    if (metricKey === "youtube") {
      activateMainFilter("youtube");
      state.youtubeBrandFilter = normalized;
      if (youtubeBrandFilter) youtubeBrandFilter.querySelectorAll("button[data-youtube-brand-filter]").forEach(btn => btn.classList.toggle("active", btn.dataset.youtubeBrandFilter === normalized));
    } else if (metricKey === "reviews") {
      activateMainFilter("review");
      state.query = normalized;
      search.value = normalized;
    } else if (metricKey === "deals") {
      activateMainFilter("deals");
      state.query = normalized;
      search.value = normalized;
    } else if (normalized === "dell" || normalized === "alienware") {
      activateMainFilter("dell");
      if (normalized === "alienware") {
        state.query = "alienware";
        search.value = "alienware";
      }
    } else if (["hp","lenovo","apple","asus","acer","msi","framework","samsung","microsoft","lg","razer","positivo"].includes(normalized)) {
      activateMainFilter("competitor");
      state.competitorFilter = normalized;
      if (competitorFilter) competitorFilter.querySelectorAll("button[data-competitor-filter]").forEach(btn => btn.classList.toggle("active", btn.dataset.competitorFilter === normalized));
    } else {
      activateMainFilter("all");
      state.query = normalized;
      search.value = normalized;
    }
    applyFilters();
    document.getElementById("feedHead")?.scrollIntoView({behavior: "smooth", block: "start"});
  }

  function jumpToKpiFilter(filterName) {
    state.view = "feed";
    if (viewSwitch) viewSwitch.querySelectorAll("button[data-view]").forEach(btn => btn.classList.toggle("active", btn.dataset.view === "feed"));
    search.value = "";
    state.query = "";
    state.productFilter = "all";
    state.competitorFilter = "all";
    state.youtubeBrandFilter = "all";
    activateMainFilter(filterName);
    applyFilters();
    document.getElementById("feedHead")?.scrollIntoView({behavior: "smooth", block: "start"});
  }

  if (brandMetricsEl) {
    brandMetricsEl.addEventListener("click", event => {
      const brandBtn = event.target.closest("[data-brand-jump]");
      if (brandBtn) {
        jumpToBrandFeed(brandBtn.dataset.brandJump, brandBtn.dataset.metricKey);
        return;
      }
      const kpiBtn = event.target.closest("[data-kpi-filter]");
      if (kpiBtn) jumpToKpiFilter(kpiBtn.dataset.kpiFilter);
    });
  }

  if (youtubeBrandFilter) {
    youtubeBrandFilter.addEventListener("click", event => {
      const btn = event.target.closest("button[data-youtube-brand-filter]");
      if (!btn) return;
      state.youtubeBrandFilter = btn.dataset.youtubeBrandFilter;
      youtubeBrandFilter.querySelectorAll("button[data-youtube-brand-filter]").forEach(b => b.classList.toggle("active", b === btn));
      applyFilters();
    });
  }

  if (viewSwitch) {
    viewSwitch.addEventListener("click", event => {
      const button = event.target.closest("button[data-view]");
      if (!button) return;
      event.preventDefault();
      viewSwitch.querySelectorAll("button").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      state.view = button.dataset.view;
      renderView();
    });
  }

  if (metricWindow) {
    metricWindow.addEventListener("click", event => {
      const button = event.target.closest("button[data-metric-window]");
      if (!button) return;
      event.preventDefault();
      metricWindow.querySelectorAll("button").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      state.metricWindow = button.dataset.metricWindow;
      renderBrandMetrics();
    });
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

  refreshFeed.addEventListener("click", reloadWholeApp);

  let touchStartY = 0;
  let pullStartedAtTop = false;
  window.addEventListener("touchstart", event => {
    touchStartY = event.touches[0]?.clientY || 0;
    pullStartedAtTop = window.scrollY <= 4;
  }, {passive: true});

  window.addEventListener("touchend", event => {
    if (!pullStartedAtTop || state.refreshing) return;
    const endY = event.changedTouches[0]?.clientY || 0;
    if (endY - touchStartY > 85) refreshLatest();
  }, {passive: true});

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.__monitorHubDebug = {state, applyFilters};
})();
