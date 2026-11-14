# Fontes e integrações

[English](../en/sources.md) · [Documentação](README.md)

O News Radar recolhe ligações e metadados de feeds/APIs. Os editores e autores mantêm os seus direitos. Um URL acessível, uma resposta bem-sucedida, um feed RSS ou uma conta social pública não dão autorização geral para guardar, traduzir, redistribuir ou apresentar comercialmente os conteúdos. Reveja as condições atuais do fornecedor para a sua utilização, atribuição e conservação antes de ativar uma fonte. A licença MIT da aplicação abrange o código, não os conteúdos dos editores.

## Modos de fontes iniciais

Defina `SEED_SOURCES` antes da primeira inicialização:

| Modo | Comportamento inicial |
| --- | --- |
| `minimal` | Ativa apenas Hacker News e BBC World. É a predefinição, não uma aprovação jurídica de qualquer utilização. |
| `none` | Cria categorias/regras sem fontes; acrescente na administração as fontes que reviu. |
| `all` | Inclui o catálogo opcional de exemplos; fontes além do conjunto mínimo ficam desativadas até revisão pelo operador. |

Os dados iniciais não substituem a gestão de uma base de dados existente. Inspecione as fontes ativas em `/admin` depois da configuração. Não existem contas Bluesky monitorizadas por predefinição.

## Conectores

| Integração | Estado e trabalho do operador |
| --- | --- |
| RSS / Atom | Recolha implementada para URLs de feeds. Verifique as condições e limites do editor; configure categoria e intervalo. |
| Hacker News | Conector API implementado. Mantenha ligações e atribuição; respeite a API e os direitos dos artigos originais. |
| Bluesky Jetstream | Conector de streaming implementado e opcional. Ative/configure a fonte e acrescente as contas pretendidas. As publicações públicas continuam a ter autores e condições aplicáveis. |
| Avisos IPMA | Leitura JSON especializada disponível como exemplo opcional. Reveja as condições atuais dos dados abertos e a atribuição. Esta aplicação não é um serviço oficial de alertas. |
| Reddit | Apenas um marcador. Exige desenvolver uma integração e obter autorização/permissões oficiais da API; acrescentar um token não ativa um conector funcional. |
| Facebook | Apenas um marcador. Exige desenvolver uma integração e obter as permissões/revisões oficiais aplicáveis. |
| X | Apenas um marcador. Exige desenvolver uma integração e obter acesso/permissões oficiais atuais da API. |

Uma entrada desativada ou indisponível não prova que exista uma API gratuita ou autorização do fornecedor. Não substitua o acesso oficial por scraping ou proxies de terceiros para contornar restrições.

## Disponibilidade observada do catálogo

Uma verificação limitada de endpoints públicos em **14 de novembro de 2026** encontrou feeds válidos com publicações em **16 dos 21** exemplos RSS. Foi uma verificação HTTP/leitura, sem ingestão nem acesso a base de dados. É uma observação técnica datada, não uma autorização, recomendação de fontes ou garantia de recolha futura. Todas as entradas opcionais continuam a exigir revisão antes de ativar.

| Fonte de exemplo | Observação |
| --- | --- |
| [RTP](https://www.rtp.pt/noticias/rss) | Feed válido |
| [Observador](https://observador.pt/feed/) | Feed válido |
| [ECO](https://eco.sapo.pt/feed/) | Feed válido |
| [BBC World](https://feeds.bbci.co.uk/news/world/rss.xml) | Feed válido |
| [The Guardian](https://www.theguardian.com/world/rss) | Feed válido |
| [Pplware](https://pplware.sapo.pt/feed/) | Feed válido |
| [SAPO TEK](https://tek.sapo.pt/feed/) | Feed válido |
| [Ars Technica](https://feeds.arstechnica.com/arstechnica/index) | Feed válido |
| [TechCrunch](https://techcrunch.com/feed/) | Feed válido |
| [The Hacker News](https://feeds.feedburner.com/TheHackersNews) | Feed válido; distinto da API Hacker News |
| [BleepingComputer](https://www.bleepingcomputer.com/feed/) | Feed válido |
| [NASA](https://www.nasa.gov/feed/) | Feed válido |
| [Rádio Covilhã](https://radio-covilha.pt/feed/) | Feed válido |
| [Rádio Castelo Branco](https://www.radiocastelobranco.sapo.pt/feed/) | Ligação recusada |
| [Beira Baixa TV](https://www.beirabaixatv.pt/feed) | Feed válido |
| [CISA](https://www.cisa.gov/cybersecurity-advisories/all.xml) | Excedeu o limite de resposta de 3 MiB do coletor |
| [CNCS](https://www.cncs.gov.pt/pt/feed/) | HTTP 404 |
| [Jornal de Negócios](https://www.jornaldenegocios.pt/rss) | Feed válido; codificação de caracteres a rever |
| [Reconquista](https://www.reconquista.pt/PT/rss/rss-reconquista/./xclusiv) | RSS válido, sem publicações |
| [Público](https://feeds.feedburner.com/PublicoRSS) | Feed válido; mantém-se desativado até rever as condições |
| [ESA](https://www.esa.int/rssfeed/Our_Activities/Space_Science) | HTTP 404 |

O resultado CISA descreve o limite de tamanho do coletor, não prova que o feed seja inválido. O feed Jornal de Negócios declara ISO-8859-1, mas o percurso atual de pedidos descodifica UTF-8; conseguir ler o feed não prova que os acentos estejam corretos. Não se inferiram feeds alternativos nem formas de contornar acesso a partir destas falhas.

A lista Hacker News e uma publicação de amostra devolveram JSON válido. O endpoint de avisos IPMA devolveu um array JSON. A resolução de perfis públicos Bluesky e uma ligação Jetstream tiveram sucesso; não chegou uma publicação nessa observação curta, pelo que não se verificou a ingestão de streaming completa. O template público não cria contas Bluesky monitorizadas.

Para rever fornecedores, consulte a [documentação da API Hacker News](https://github.com/HackerNews/API), [condições BBC](https://www.bbc.co.uk/usingthebbc/terms/), [orientações de feeds Guardian](https://www.theguardian.com/help/feeds), [condições API IPMA](https://api.ipma.pt/), [orientações de conteúdos NASA](https://www.nasa.gov/nasa-brand-center/images-and-media/), [condições Bluesky](https://bsky.social/about/support/tos) e [documentação Jetstream](https://github.com/bluesky-social/jetstream). Confirme as condições atuais da sua utilização; licenças da documentação API não relicenciam artigos nem publicações de utilizadores.

## Acrescentar uma fonte

Reveja as condições e acrescente na administração o URL HTTPS público e canónico do feed. Escolha um intervalo prudente, categoria e estado de ativação. Verifique ligações originais, formatação de títulos/resumos, atribuição e datas. Acompanhe o estado e os erros nas primeiras recolhas. Reveja os destinos de redirecionamentos e evite feeds com informação privada ou pessoal.

O coletor pode rejeitar endereços privados, feeds inválidos, respostas excessivas ou XML inseguro. Um feed pode mudar ou desaparecer. Os exemplos do repositório são exemplos de configuração, não uma garantia de disponibilidade nem um relatório de validação em direto.

A tradução opcional não altera os direitos do texto original. Consulte [tradução](translation.md) para atribuição e limites dos modelos. Mantenha a ligação original visível e cumpra as exigências de crédito de cada editor na sua instalação.
