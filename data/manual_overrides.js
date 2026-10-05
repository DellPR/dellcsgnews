(function () {
  const feed = window.MONITOR_HUB_DATA;
  if (!feed || !Array.isArray(feed.items)) return;

  const icon = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  const dellCoverage = ({ id, source, domain, title, originalTitle, url, publishedAt, capturedAt, summary, score = 100 }) => ({
    id,
    kind: 'media',
    source,
    source_icon: icon(domain),
    country: 'BR',
    title,
    display_title: title,
    original_title: originalTitle,
    url,
    published_at: publishedAt,
    captured_at: capturedAt,
    section: 'Dell Coverage',
    is_deal: false,
    company: 'Dell',
    product: '',
    score,
    summary,
    why_it_matters: '',
    tags: [source, 'BR', 'Dell', 'Dell Coverage'],
    is_review: false,
    is_short: false,
    is_sponsored: false,
    is_dell_story: true,
    has_dell_mention: true,
    is_competitor_story: false,
    is_market_story: false,
    market_interest: 'high'
  });

  const overrides = [
    dellCoverage({
      id: 'media:590695',
      source: 'TudoCelular',
      domain: 'tudocelular.com',
      title: 'Dell XPS 13 begins sales in Brazil with local manufacturing and launch discount',
      originalTitle: 'Dell inicia vendas do novo XPS 13 feito no Brasil com desconto; veja os preços',
      url: 'https://www.tudocelular.com/dell/noticias/n264058/dell-inicia-vendas-novo-xps-13-fabricado-no-brasil.html',
      publishedAt: '2026-09-29T15:07:00+00:00',
      capturedAt: '2026-09-29 22:00:01',
      summary: 'TudoCelular reports that Dell has started selling the new nationally manufactured XPS 13 in Brazil, with an introductory discount and local pricing details for the Brazilian market.'
    }),
    dellCoverage({
      id: 'media:590876',
      source: 'Exame',
      domain: 'exame.com',
      title: 'Dell gives R$1,000 launch discount on Brazil-made XPS 13',
      originalTitle: 'Dell dá desconto de R$ 1.000 em novo notebook fabricado no Brasil',
      url: 'https://exame.com/tecnologia/dell-da-desconto-de-r-1-000-em-novo-notebook-fabricado-no-brasil/',
      publishedAt: '2026-09-29T17:43:31+00:00',
      capturedAt: '2026-09-29 22:00:03',
      summary: "Exame covers Dell's R$1,000 launch discount for the new XPS 13 manufactured in Brazil, bringing the entry configuration from R$8,999 to R$7,999 during the introductory offer."
    }),
    dellCoverage({
      id: 'media:590706',
      source: 'Adrenaline',
      domain: 'adrenaline.com.br',
      title: 'Dell XPS 13 starts Brazilian sales at R$7,999 in launch promotion',
      originalTitle: 'Dell XPS 13 começa a ser vendido no Brasil por R$ 7.999 em promoção',
      url: 'https://www.adrenaline.com.br/notebook/dell-xps-13-lancamento-preco/',
      publishedAt: '2026-09-29T21:07:51+00:00',
      capturedAt: '2026-09-29 22:00:01',
      summary: 'Adrenaline reports that the Dell XPS 13 is now being sold in Brazil from R$7,999 during a launch promotion, highlighting local manufacturing, the 13.4-inch 2.5K display, light 1 kg chassis, and claimed long battery life.'
    }),
    dellCoverage({
      id: 'media:612687',
      source: 'TudoCelular',
      domain: 'tudocelular.com',
      title: 'Dell launches Pro Rugged notebooks with Panther Lake and AI features',
      originalTitle: 'Dell lança novos notebooks Pro Rugged com Intel Panther Lake e IA para condições extremas',
      url: 'https://www.tudocelular.com/dell/noticias/n264270/dell-pro-rugged-14-13-extreme-lancamento-ficha.html',
      publishedAt: '2026-10-01T14:16:00+00:00',
      capturedAt: '2026-10-01 22:00:01',
      summary: "TudoCelular reports Dell's new Pro Rugged 14 and Pro Rugged 13 Extreme laptops with Intel Panther Lake chips, military-grade durability, and AI/security features for extreme work conditions."
    })
  ];

  const byId = new Map(feed.items.map((item) => [item.id, item]));
  overrides.forEach((item) => {
    if (byId.has(item.id)) Object.assign(byId.get(item.id), item);
    else feed.items.push(item);
  });
  feed.items.sort((a, b) => String(b.published_at || b.captured_at || '').localeCompare(String(a.published_at || a.captured_at || '')));
  feed.total = feed.items.length;
  feed.counts = feed.items.reduce((acc, item) => {
    const kind = item.kind || 'media';
    acc[kind] = (acc[kind] || 0) + 1;
    return acc;
  }, { media: 0, youtube: 0, x: 0 });

  const metrics = window.MONITOR_HUB_BRAND_METRICS;
  if (metrics && Array.isArray(metrics.items)) {
    const metricRows = overrides.map((item) => ({
      id: item.id,
      kind: 'media',
      source: item.source,
      source_icon: item.source_icon,
      country: 'BR',
      section: 'Dell Coverage',
      is_deal: false,
      deal_metric_only: false,
      title: item.title,
      url: item.url,
      published_at: item.published_at,
      score: item.score,
      is_review: false,
      is_sponsored: false,
      brand: 'Dell',
      family: 'Dell family',
      is_dell_story: true
    }));
    const metricById = new Map(metrics.items.map((item) => [item.id, item]));
    metricRows.forEach((row) => {
      if (metricById.has(row.id)) Object.assign(metricById.get(row.id), row);
      else metrics.items.push(row);
    });
    metrics.items.sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')));
    metrics.total_items = metrics.items.length;
    metrics.recent = metrics.items.slice(0, 250);
  }
})();
