# Desenvolvimento e verificações

[English](../en/development.md) · [Documentação](README.md) · [Contribuir](../../CONTRIBUTING.md)

Use Node.js 24+, npm e PostgreSQL 17. Trabalhe com uma base de dados de desenvolvimento nova e própria. A aplicação lê `.env` do diretório atual; os testes têm de usar configuração dedicada. Nunca ligue desenvolvimento ou verificações de integração à base de dados de produção.

## Arquitetura

| Caminho | Responsabilidade |
| --- | --- |
| `web/` | Interface React, apresentação e administração |
| `server/app.ts`, `server/main.ts` | Rotas Fastify, autenticação e arranque da API |
| `server/collector.ts`, `server/connectors.ts`, `server/jetstream.ts` | Recolha periódica e streaming opcional |
| `server/domain.ts`, `server/ingest.ts` | Classificação, normalização e persistência |
| `server/safe-fetch.ts` | Pedidos externos restritos |
| `server/migrations/` | Migrações da base de dados |
| `server/translation/`, `server/translation-worker.ts` | Tradução local e fila opcionais |
| `deploy/`, `scripts/` | Modelos de instalação e utilitários portáveis |
| `tests/` | Testes unitários, de base de dados, navegador e fontes em direto opcionais |

A interface compilada fica em `dist/`; o servidor compilado em `build/`. O servidor de desenvolvimento Vite encaminha `/api` para `127.0.0.1:3001`. Execute o coletor separadamente quando precisar de recolha real; testes e fixtures não devem depender da disponibilidade de editores.

## Desenvolvimento local

Crie `.env`, configure a sua base de dados nova e inicialize-a conforme o [guia nativo](native-install.md) ou uma instância PostgreSQL isolada. Depois:

```sh
npm ci
npm run migrate
npm run seed
npm run api
```

Em terminais separados, no mesmo diretório:

```sh
npm run dev
```

```sh
npm run collector
```

Use o endereço local apresentado pelo Vite. Mantenha a porta da API coerente com `vite.config.ts`. Para configurar o administrador, defina `APP_URL` com a origem usada no navegador antes de `npm run admin:setup`.

## Verificações

```sh
npm test
npm run build
```

Os testes com base de dados exigem uma **base separada chamada `newsradar_test`**, acessível ao utilizador de teste configurado. Para o exemplo nativo, crie-a como administrador PostgreSQL:

```sh
sudo -u postgres createdb --owner=newsradar newsradar_test
```

No exemplo nativo com autenticação peer, abra primeiro uma shell com o utilizador de sistema correspondente; definir `PGUSER` não altera a identidade do sistema:

```sh
sudo -u newsradar -H /bin/bash
cd /srv/news-radar
```

Inicialize e execute os testes nessa shell, escolhendo explicitamente o socket, utilizador e base de teste:

```sh
NODE_ENV=test DATABASE_URL= PGHOST=/var/run/postgresql PGPORT=5432 PGUSER=newsradar PGDATABASE=newsradar_test npm run migrate
NODE_ENV=test DATABASE_URL= PGHOST=/var/run/postgresql PGPORT=5432 PGUSER=newsradar PGDATABASE=newsradar_test SEED_SOURCES=none npm run seed
NODE_ENV=test DATABASE_URL= PGHOST=/var/run/postgresql PGPORT=5432 PGUSER=newsradar PGDATABASE=newsradar_test npm run test:integration
```

Saia dessa shell com `exit` no fim. Para um servidor de teste TCP separado, use o respetivo `PGHOST`, `PGPORT`, `PGUSER` e autenticação exclusiva de teste. `NODE_ENV=test` não lê `.env`, pelo que deve fornecer explicitamente as variáveis de ligação de teste. Os testes nunca devem herdar ligações de produção. Consulte `package.json` para os comandos exatos e testes opcionais de tradução.

Os testes no navegador precisam de Chromium local compatível e de uma aplicação isolada em funcionamento com notícias de teste controladas. Indique explicitamente o endereço portável:

```sh
NODE_ENV=test DATABASE_URL= PGHOST=/var/run/postgresql PGPORT=5432 PGUSER=newsradar PGDATABASE=newsradar_test TEST_URL=http://localhost:8080 npm run test:browser
```

Nos testes com base de dados e autenticação peer nativa, use a mesma identidade de sistema `newsradar` acima. Definir `TEST_URL` não altera a base de dados usada pela aplicação em execução; inicie essa aplicação com configuração explícita de teste isolado. Reveja os requisitos de cada script de navegador/administração/fontes em direto antes de o executar. Algumas verificações criam dados ou alteram opções. Os testes opcionais de fontes em direto dependem da rede/fornecedores e não são testes unitários sem rede. Um teste local bem-sucedido é evidência para esse ambiente e revisão, não uma garantia de todas as instalações.

## Documentação e dados de teste

Atualize os guias inglês e português em conjunto ao mudar comandos ou comportamento. Mantenha os textos de interface coerentes com a aplicação orientada para português. As capturas em `docs/screenshots/` têm de usar notícias de demonstração claramente identificadas e excluir utilizadores operacionais, endereços privados, segredos ou textos de editores copiados sem autorização.

Use domínios de exemplo reservados, identidades sintéticas e uma base local nova nas reproduções. Não copie registos, exportações de base de dados ou histórico Git de uma instalação privada para uma contribuição.
