(function () {
  "use strict";

  const DAY_MS = 24 * 60 * 60 * 1000;
  let commandBuckets = {
    dell: [],
    alienware: [],
    dellReviews: [],
    alienwareReviews: []
  };

  function itemTime(item) {
    const raw = item && (item.published_at || item.captured_at);
    const date = raw ? new Date(raw) : null;
    return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
  }

  function relativeAge(raw) {
    const date = raw ? new Date(raw) : null;
    if (!date || Number.isNaN(date.getTime())) return "Latest export ready";
    const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    if (minutes < 1) return "Updated just now";
    if (minutes < 60) return `Updated ${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `Updated ${hours}h ago`;
    return `Updated ${Math.round(hours / 24)}d ago`;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  function itemText(item) {
    const parts = [
      item && item.brand,
      item && item.company,
      item && item.product,
      item && item.section,
      item && item.title,
      item && item.summary
    ];
    if (item && Array.isArray(item.tags)) parts.push(item.tags.join(" "));
    return parts.filter(Boolean).join(" ");
  }

  function uniqueItems(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = item && (item.id || item.url || `${item.source || ""}:${item.title || ""}:${item.published_at || ""}`);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function isAlienwareItem(item) {
    const text = itemText(item);
    return /\balienware\b|\baw\d{3,5}[a-z]{0,3}\b/i.test(text);
  }

  function primaryCompetitorBrand(item) {
    const value = String((item && (item.company || item.brand)) || "").toLowerCase();
    const competitors = ["lenovo", "asus", "hp", "acer", "apple", "msi", "framework", "samsung", "microsoft", "lg", "razer", "positivo"];
    return competitors.includes(value);
  }

  function isDellItem(item) {
    if (isAlienwareItem(item)) return false;
    const company = String((item && (item.company || item.brand)) || "").toLowerCase();
    const product = String((item && item.product) || "").toLowerCase();
    const title = String((item && (item.display_title || item.title)) || "").toLowerCase();
    const explicitDell = item && (
      company === "dell" ||
      (item.is_dell_story && !primaryCompetitorBrand(item))
    );
    const productDell = /\b(dell|xps|latitude|inspiron|precision|optiplex|ultrasharp|dell pro|dell 14s|dell 16s)\b/i.test(product);
    const titleDell = !primaryCompetitorBrand(item) && /\b(dell|xps|latitude|inspiron|precision|optiplex|ultrasharp|dell pro|dell 14s|dell 16s)\b/i.test(title);
    return Boolean(explicitDell || productDell || titleDell);
  }

  const SHARE_BRANDS = new Set([
    "dell",
    "alienware",
    "apple",
    "lenovo",
    "asus",
    "acer",
    "hp",
    "samsung",
    "microsoft",
    "framework",
  ]);

  function metricBrand(item) {
    return String((item && (item.brand || item.company)) || "").trim();
  }

  function isShareBrand(item) {
    return SHARE_BRANDS.has(metricBrand(item).toLowerCase());
  }

  function metricBrandRowEligible(item) {
    const brand = metricBrand(item).toLowerCase();
    if (brand !== "dell" && brand !== "alienware") return true;
    const blob = `${(item && item.title) || ""} ${(item && item.summary) || ""} ${(item && item.url) || ""}`;
    return Boolean(item && item.is_dell_story) || /\b(?:dell|alienware|xps|latitude|inspiron|precision|optiplex|dell pro|aurora|aw\d|alienware aw)\b/i.test(blob);
  }

  function computeDellShare() {
    const metrics = window.MONITOR_HUB_BRAND_METRICS || {};
    const metricItems = Array.isArray(metrics.items) && metrics.items.length
      ? metrics.items
      : (Array.isArray(metrics.recent) ? metrics.recent : []);
    const cutoff = Date.now() - DAY_MS;
    const last24 = metricItems.filter(item => itemTime(item) >= cutoff);
    const brandItems = last24.filter(metricBrandRowEligible).filter(isShareBrand);
    if (!brandItems.length) return 0;
    const dellItems = brandItems.filter(item => metricBrand(item).toLowerCase() === "dell");
    return Math.round((dellItems.length / brandItems.length) * 100);
  }

  function setCommandCenter() {
    const data = window.MONITOR_HUB_DATA || {items: []};
    const items = uniqueItems(Array.isArray(data.items) ? data.items : []);
    const newestTime = items.reduce((latest, item) => Math.max(latest, itemTime(item)), 0);
    const referenceTime = Math.max(Date.now(), newestTime);
    const last24 = items.filter(item => itemTime(item) >= referenceTime - DAY_MS);
    const dellStories = last24.filter(isDellItem);
    const alienwareStories = last24.filter(isAlienwareItem);
    const dellReviews = dellStories.filter(item => item.is_review);
    const alienwareReviews = alienwareStories.filter(item => item.is_review);
    const dellShare = computeDellShare();
    commandBuckets = {
      dell: dellStories,
      alienware: alienwareStories,
      dellReviews,
      alienwareReviews
    };

    setText("betaDellStories", dellStories.length);
    setText("betaAlienwareStories", alienwareStories.length);
    setText("betaDellReviews", dellReviews.length);
    setText("betaAlienwareReviews", alienwareReviews.length);
    setText("betaDellShare", `${dellShare}%`);
    setText("betaHeaderUpdated", relativeAge(data.generated_at));

    const sectionCounts = new Map();
    last24.forEach(item => {
      const section = item.section || "Coverage";
      sectionCounts.set(section, (sectionCounts.get(section) || 0) + 1);
    });
    const leadingSection = [...sectionCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const totalDellFamilyReviews = dellReviews.length + alienwareReviews.length;
    const pulse = totalDellFamilyReviews
      ? `<strong>${totalDellFamilyReviews} new Dell-family review${totalDellFamilyReviews === 1 ? "" : "s"}</strong> appeared in the latest 24-hour window.`
      : dellStories.length || alienwareStories.length
        ? `<strong>${dellStories.length + alienwareStories.length} new Dell-family stor${dellStories.length + alienwareStories.length === 1 ? "y" : "ies"}</strong> appeared in the latest 24-hour window.`
      : leadingSection
        ? `<strong>${leadingSection[0]}</strong> is the most active coverage stream in the latest 24 hours.`
        : "The latest coverage export is ready for review.";
    const pulseEl = document.getElementById("betaPulseText");
    if (pulseEl) pulseEl.innerHTML = pulse;
  }

  function clickOne(selector) {
    const el = document.querySelector(selector);
    if (el) el.click();
    return el;
  }

  function setSearch(value) {
    const search = document.getElementById("search");
    if (!search) return;
    search.value = value || "";
    search.dispatchEvent(new Event("input", {bubbles: true}));
  }

  function showFeed(filter) {
    clickOne('#viewSwitch button[data-view="feed"]');
    window.setTimeout(() => clickOne(`#tabs button[data-filter="${filter}"]`), 0);
  }

  function showExactCommandBucket(bucketName, label) {
    const rows = commandBuckets[bucketName] || [];
    if (window.__monitorHubDebug && typeof window.__monitorHubDebug.showExactItems === "function") {
      window.__monitorHubDebug.showExactItems(rows, `${label} - last 24h`);
      return true;
    }
    return false;
  }

  function updateCommandVisibility() {
    const metricsButton = document.querySelector('#viewSwitch button[data-view="metrics"]');
    const outletsButton = document.querySelector('#viewSwitch button[data-view="outlets"]');
    const allButton = document.querySelector('#tabs button[data-filter="all"]');
    const search = document.getElementById("search");
    const command = document.getElementById("betaCommandCenter");
    const nonFeed = Boolean(
      (metricsButton && metricsButton.classList.contains("active")) ||
      (outletsButton && outletsButton.classList.contains("active"))
    );
    const filteredFeed = Boolean(
      allButton && !allButton.classList.contains("active") ||
      search && search.value.trim()
    );
    if (command) command.hidden = nonFeed || filteredFeed;
  }

  function updateBottomNav(mode) {
    document.querySelectorAll("[data-beta-nav]").forEach(button => {
      button.classList.toggle("active", button.dataset.betaNav === mode);
    });
  }

  function wireCommandCenter() {
    const command = document.getElementById("betaCommandCenter");
    if (!command) return;
    command.addEventListener("click", event => {
      const button = event.target.closest("[data-command-filter]");
      if (!button) return;
      const target = button.dataset.commandFilter;
      if (target === "dell") {
        if (showExactCommandBucket("dell", "New Dell stories")) return;
      }
      if (target === "alienware") {
        if (showExactCommandBucket("alienware", "New Alienware stories")) return;
      }
      if (target === "dell-reviews") {
        if (showExactCommandBucket("dellReviews", "New Dell reviews")) return;
      }
      if (target === "alienware-reviews") {
        if (showExactCommandBucket("alienwareReviews", "New Alienware reviews")) return;
      }
      if (target === "dell-share") {
        showFeed("dell");
        window.setTimeout(() => {
          setSearch("");
          document.getElementById("feedHead")?.scrollIntoView({behavior: "smooth", block: "start"});
        }, 20);
        return;
      }
      if (target === "dell" || target === "dell-reviews") {
        showFeed(target === "dell-reviews" ? "review" : "dell");
        window.setTimeout(() => {
          setSearch(target === "dell-reviews" ? "dell" : "");
          document.getElementById("feedHead")?.scrollIntoView({behavior: "smooth", block: "start"});
        }, 20);
        return;
      }
      if (target === "alienware" || target === "alienware-reviews") {
        showFeed(target === "alienware-reviews" ? "review" : "dell");
        window.setTimeout(() => {
          setSearch("alienware");
          document.getElementById("feedHead")?.scrollIntoView({behavior: "smooth", block: "start"});
        }, 20);
        return;
      }
      showFeed(target || "all");
    });
  }

  function wireBottomNav() {
    const nav = document.querySelector(".beta-bottom-nav");
    if (!nav) return;
    nav.addEventListener("click", event => {
      const button = event.target.closest("[data-beta-nav]");
      if (!button) return;
      const target = button.dataset.betaNav;
      if (target === "feed") {
        showFeed("all");
        window.scrollTo({top: 0, behavior: "smooth"});
      } else if (target === "reviews") {
        showFeed("review");
        window.setTimeout(() => document.getElementById("feedHead")?.scrollIntoView({behavior: "smooth", block: "start"}), 10);
      } else if (target === "metrics") {
        clickOne('#viewSwitch button[data-view="metrics"]');
        window.scrollTo({top: 0, behavior: "smooth"});
      } else if (target === "outlets") {
        clickOne('#viewSwitch button[data-view="outlets"]');
        window.scrollTo({top: 0, behavior: "smooth"});
      } else if (target === "top") {
        showFeed("all");
        window.setTimeout(() => document.getElementById("topStoryHead")?.scrollIntoView({behavior: "smooth", block: "start"}), 10);
      }
      updateBottomNav(target === "top" ? "feed" : target);
    });
  }

  function wireViewState() {
    const viewSwitch = document.getElementById("viewSwitch");
    const tabs = document.getElementById("tabs");
    if (viewSwitch) {
      viewSwitch.addEventListener("click", event => {
        const button = event.target.closest("button[data-view]");
        if (!button) return;
        window.setTimeout(() => {
          updateCommandVisibility();
          updateBottomNav(button.dataset.view === "metrics" ? "metrics" : button.dataset.view === "outlets" ? "outlets" : "feed");
        }, 0);
      });
    }
    if (tabs) {
      tabs.addEventListener("click", event => {
        const button = event.target.closest("button[data-filter]");
        if (!button) return;
        updateBottomNav(button.dataset.filter === "review" ? "reviews" : "feed");
      });
    }
  }

  function bootBeta() {
    setCommandCenter();
    wireCommandCenter();
    wireBottomNav();
    wireViewState();
    updateCommandVisibility();
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootBeta);
  } else {
    bootBeta();
  }
})();
