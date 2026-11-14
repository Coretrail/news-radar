# Sources and integrations

[Português](../pt/sources.md) · [Documentation](README.md)

News Radar collects links and feed/API metadata. Source publishers and authors retain their rights. An accessible URL, successful response, RSS feed or public social account is not a blanket permission to store, translate, redistribute or commercially display its contents. Review current provider terms for your intended deployment, attribution and retention before enabling a source. The application's MIT licence covers its code, not publisher content.

## Initial source modes

Set `SEED_SOURCES` before the first initialization:

| Mode | Initial behaviour |
| --- | --- |
| `minimal` | Enables Hacker News and BBC World only. This is the default, not a legal endorsement of every use. |
| `none` | Creates categories/rules without sources; add the sources you have reviewed through administration. |
| `all` | Includes the optional example catalogue; sources beyond the minimal set start disabled pending operator review. |

Seed operations initialize records and are not a substitute for administering an existing database. Inspect enabled sources in `/admin` after setup. No Bluesky accounts are monitored by default.

## Connector support

| Integration | Status and operator work |
| --- | --- |
| RSS / Atom | Implemented collector for feed URLs. Check the publisher's terms and rate limits; configure your category and interval. |
| Hacker News | Implemented API connector. Keep links and attribution; respect the API and underlying article rights. |
| Bluesky Jetstream | Implemented streaming connector, opt-in. Enable/configure the source and add the accounts you intend to monitor. Public posts still have authors and applicable terms. |
| IPMA warnings | Specialized JSON parsing is available as an optional source example. Review current open-data terms and attribution. This application is not an official alerting service. |
| Reddit | Placeholder only. Requires integration development and official API authorization/permissions; adding a token does not activate a working connector. |
| Facebook | Placeholder only. Requires integration development and applicable official API permissions/review. |
| X | Placeholder only. Requires integration development and current official API access/permissions. |

A disabled or unavailable entry is not evidence that a provider offers a free API or has granted permission. Do not replace official access with scraping or a third-party proxy to bypass restrictions.

## Catalogue availability snapshot

A bounded public-endpoint check on **14 November 2026** found **16 of 21** example RSS endpoints returned parseable, nonempty feeds. This was an HTTP/parser check without ingestion or database access. It is a dated technical observation, not a permission grant, source endorsement or guarantee of future collection. All optional catalogue entries still require operator review before enabling.

| Example source | Observation |
| --- | --- |
| [RTP](https://www.rtp.pt/noticias/rss) | Feed parsed |
| [Observador](https://observador.pt/feed/) | Feed parsed |
| [ECO](https://eco.sapo.pt/feed/) | Feed parsed |
| [BBC World](https://feeds.bbci.co.uk/news/world/rss.xml) | Feed parsed |
| [The Guardian](https://www.theguardian.com/world/rss) | Feed parsed |
| [Pplware](https://pplware.sapo.pt/feed/) | Feed parsed |
| [SAPO TEK](https://tek.sapo.pt/feed/) | Feed parsed |
| [Ars Technica](https://feeds.arstechnica.com/arstechnica/index) | Feed parsed |
| [TechCrunch](https://techcrunch.com/feed/) | Feed parsed |
| [The Hacker News](https://feeds.feedburner.com/TheHackersNews) | Feed parsed; distinct from Hacker News API |
| [BleepingComputer](https://www.bleepingcomputer.com/feed/) | Feed parsed |
| [NASA](https://www.nasa.gov/feed/) | Feed parsed |
| [Rádio Covilhã](https://radio-covilha.pt/feed/) | Feed parsed |
| [Rádio Castelo Branco](https://www.radiocastelobranco.sapo.pt/feed/) | Connection refused |
| [Beira Baixa TV](https://www.beirabaixatv.pt/feed) | Feed parsed |
| [CISA](https://www.cisa.gov/cybersecurity-advisories/all.xml) | Exceeded 3 MiB collector response limit |
| [CNCS](https://www.cncs.gov.pt/pt/feed/) | HTTP 404 |
| [Jornal de Negócios](https://www.jornaldenegocios.pt/rss) | Feed parsed; character encoding needs review |
| [Reconquista](https://www.reconquista.pt/PT/rss/rss-reconquista/./xclusiv) | RSS parsed, no items |
| [Público](https://feeds.feedburner.com/PublicoRSS) | Feed parsed; remains disabled pending terms review |
| [ESA](https://www.esa.int/rssfeed/Our_Activities/Space_Science) | HTTP 404 |

The CISA result describes the collector's size limit, not proof that its feed is malformed. The Jornal de Negócios feed declares ISO-8859-1 while the current fetch path decodes UTF-8; a successful parse does not prove correct accents. No replacement feeds or access workarounds were inferred from these failures.

The separate Hacker News list and a sample item returned valid JSON. IPMA's warning endpoint returned a JSON array. Bluesky public profile resolution and one Jetstream handshake succeeded; no post arrived in that short observation, so end-to-end streaming ingestion was not established by that check. The public template seeds no monitored Bluesky accounts.

For provider review, consult the [Hacker News API documentation](https://github.com/HackerNews/API), [BBC terms](https://www.bbc.co.uk/usingthebbc/terms/), [Guardian feed guidance](https://www.theguardian.com/help/feeds), [IPMA API terms](https://api.ipma.pt/), [NASA media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/), [Bluesky terms](https://bsky.social/about/support/tos) and [Jetstream documentation](https://github.com/bluesky-social/jetstream). Check the currently applicable conditions for your use; API documentation licences do not relicense linked articles or user posts.

## Adding a source

Review its terms, then add its canonical public HTTPS feed URL in administration. Choose a conservative polling interval, category and enabled state. Verify original links, title/summary formatting, attribution and timestamps. Watch the source status and errors during the first collection. Review redirect destinations and avoid feeds that expose private or personal information.

The collector may reject private addresses, malformed feeds, excessive responses or unsafe XML. An upstream feed can change or disappear. Repository examples are configuration examples, not an uptime commitment or a live feed validation report.

Optional translations do not change the rights in the original text. See [translation](translation.md) for model attribution and limitations. Keep the original link visible and follow any publisher-specific credit requirements in your installation.
