(function () {
  "use strict";

  const DAY_MS = 24 * 60 * 60 * 1000;
  const LAST_VISIT_KEY = "343-monitor-beta-last-visit";

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

  function setCommandCenter() {
    const data = window.MONITOR_HUB_DATA || {items: []};
    const items = Array.isArray(data.items) ? data.items : [];
    const newestTime = items.reduce((latest, item) => Math.max(latest, itemTime(item)), 0);
    const referenceTime = Math.max(Date.now(), newestTime);
    const last24 = items.filter(item => itemTime(item) >= referenceTime - DAY_MS);
    const reviews = last24.filter(item => item.is_review);
    const highSignal = last24.filter(item => Number(item.score || 0) >= 90);

    setText("betaNewCount", last24.length);
    setText("betaReviewCount", reviews.length);
    setText("betaHighCount", highSignal.length);
    setText("betaHeaderUpdated", relativeAge(data.generated_at));

    const previousVisit = Number(localStorage.getItem(LAST_VISIT_KEY) || 0);
    const sinceVisit = previousVisit > 0 ? items.filter(item => itemTime(item) > previousVisit).length : last24.length;
    setText("betaSinceVisit", previousVisit > 0 ? `${sinceVisit} new since last visit` : "First beta visit");
    localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));

    const dellReviews = reviews.filter(item => item.is_dell_story || item.has_dell_mention || /\b(dell|alienware|xps)\b/i.test(`${item.company || ""} ${item.product || ""} ${item.title || ""}`));
    const sectionCounts = new Map();
    last24.forEach(item => {
      const section = item.section || "Coverage";
      sectionCounts.set(section, (sectionCounts.get(section) || 0) + 1);
    });
    const leadingSection = [...sectionCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const pulse = dellReviews.length
      ? `<strong>${dellReviews.length} new Dell or Alienware review${dellReviews.length === 1 ? "" : "s"}</strong> appeared in the latest 24-hour window.`
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

  function showFeed(filter) {
    clickOne('#viewSwitch button[data-view="feed"]');
    window.setTimeout(() => clickOne(`#tabs button[data-filter="${filter}"]`), 0);
  }

  function updateCommandVisibility() {
    const metricsButton = document.querySelector('#viewSwitch button[data-view="metrics"]');
    const command = document.getElementById("betaCommandCenter");
    if (command) command.hidden = Boolean(metricsButton && metricsButton.classList.contains("active"));
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
      if (target === "high") {
        showFeed("all");
        window.setTimeout(() => document.getElementById("topStoryHead")?.scrollIntoView({behavior: "smooth", block: "start"}), 10);
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
          updateBottomNav(button.dataset.view === "metrics" ? "metrics" : "feed");
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
