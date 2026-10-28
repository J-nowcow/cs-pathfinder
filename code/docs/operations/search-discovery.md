# Public search discovery

This implements crawlable, source-backed discovery for CS and the native learning library. It does not establish indexing, rich-result eligibility, ranking or AI citations. No external console property, DNS record, paid service, analytics tracker, API key or recurring crawl job is created.

## Content contract

`npm run build:seo` creates the small `data/learning-search.json` index from reviewed course sources and the native PMP editorial overlay. It contains only public titles, summaries and routes: 74 PMP lessons, three connected cases, 24 engineering topics, 16 certificate lessons and six public indexes. Source content, quiz identities, records and backup formats are unchanged. Metadata titles distinguish PMP, information-processing engineer and professional-engineer lessons.

The index drives page descriptions, self-referential canonical and social URLs, Article/CollectionPage JSON-LD, visible breadcrumbs, sitemap entries and optional AI-readable links. Run the generator after source changes and run the coverage tests before publishing. `learning-content/seo-editorial.json` may contain reviewed title/description overrides; regenerate the index after editing it. Never put private answers, notes, search terms or session data in this index.

The main `/sitemap.xml` retains its existing CS catalog read and cache policy and adds the public learning routes. `/learn/sitemap.xml` is separately generated as static XML and performs no DB read or seed; robots advertises both. No fabricated `lastmod` or publication dates are emitted. `/learn/library`, `/learn/progress`, `/me` and native PMP search are noindex pages and are absent from public discovery indexes. Their HTML remains crawlable so bots can see noindex. Noindex is not authorization: server-session ownership and private API cache controls remain separate and unchanged.

Legacy CS explanations use Article markup, since users do not publicly submit alternative answers. They do not claim QAPage/FAQ rich results. Their canonical UUID URLs match the existing catalog, sitemap and AI text index; numeric reader URLs remain usable aliases. No author identity, rating, educational accreditation, completion or paid offer is invented.

The optional `/llms.txt` and `/llms-full.txt` add native learning links and summaries; the latter remains a full transcript only for the legacy CS explanation section. Native full content is available at its canonical HTML URLs. Neither file is an AI-search ranking requirement. Native lessons remain server-rendered and readable without JavaScript. Existing wildcard bot access is retained for Google, Bing, Yeti, OAI-SearchBot and PerplexityBot; no training-policy expansion or WAF/IP bypass is configured. A successful request with a bot user agent is a synthetic accessibility check, not proof of a provider crawl or citation.

## Operator steps after deployment

1. Use the existing production domain in Google Search Console, Bing Webmaster Tools and Naver Search Advisor. Inspect existing verification before creating a duplicate property. DNS verification may already exist; absence of a meta tag alone proves nothing. If meta verification is selected, the production build accepts `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION` (`msvalidate.01`) and `NAVER_SITE_VERIFICATION`. These are issuer-provided verification values; do not invent them or commit credentials.
2. Submit `/sitemap.xml` and `/learn/sitemap.xml` in the verified consoles. Inspect a PMP lesson, certificate lesson, engineering topic and a legacy CS explanation. Confirm Google-selected canonical, rendered content, crawl status and actual indexing. Use Rich Results Test for supported structured-data types; local JSON parsing is not a provider validation result.
3. Track real impressions, clicks, indexed/excluded pages and crawl errors. Inspect available Google AI-search and Bing AI Performance reports in the authorized accounts. Preserve the report date/range/provider when reporting results. Field Core Web Vitals, actual AI citations and search traffic require real data; build success or agent browser checks cannot substitute for those metrics.
4. Keep page titles, definitions, examples, limitations and source references accurate. Do not add fake FAQ/QA markup, hidden keyword text, fabricated freshness dates, artificial mentions or crawls that keep Neon awake. Recheck discovery when the source corpus, production domain or routing changes.

## Primary references checked 2026-10-28

- Google AI search: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Canonical URLs: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Sitemaps and truthful dates: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Article: https://developers.google.com/search/docs/appearance/structured-data/article
- Breadcrumb: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
- QAPage restrictions: https://developers.google.com/search/docs/appearance/structured-data/qapage
- Noindex and crawl access: https://developers.google.com/search/docs/crawling-indexing/block-indexing
- OpenAI crawlers: https://developers.openai.com/api/docs/bots
- Perplexity crawlers: https://docs.perplexity.ai/docs/resources/perplexity-crawlers
- Naver canonical/robots/sitemaps: https://searchadvisor.naver.com/guide/seo-basic-create
- Bing ownership verification: https://learn.microsoft.com/en-us/bingwebmaster/verifying-wordpress
- Bing AI performance: https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/
