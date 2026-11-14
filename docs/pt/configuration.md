# Configuração

[English](../en/configuration.md) · [Documentação](README.md)

Execute `node scripts/init-env.mjs` para criar `.env` a partir de `.env.example`. O utilitário gera palavras-passe independentes para a aplicação e a administração PostgreSQL e mantém um `.env` existente. Guarde o ficheiro real em privado. O exemplo é a lista de referência das opções suportadas; consulte-o ao atualizar.

| Opção | Significado |
| --- | --- |
| `APP_URL` | Origem usada no navegador, com protocolo e porta; predefinição `http://localhost:8080`. Usada nos endereços de configuração. |
| `HOST`, `PORT` | Endereço e porta da API. Predefinição nativa: `127.0.0.1:3001`; no Docker, os serviços escutam dentro do contentor. |
| `PGHOST`, `PGPORT` | Servidor/diretório de socket e porta PostgreSQL. O Compose usa `db:5432`; instalações nativas podem usar `/var/run/postgresql`. |
| `PGDATABASE`, `PGUSER`, `PGPASSWORD` | Base de dados, utilizador sem privilégios de superutilizador e segredo da aplicação. Nomes predefinidos: `newsradar`. |
| `PGADMIN_PASSWORD` | Palavra-passe Compose separada do superutilizador de inicialização `radar_admin`; fornecida apenas a `db`, nunca aos serviços da aplicação. Não é usada no exemplo nativo com autenticação peer. |
| `DATABASE_URL` | Ligação nativa alternativa; deixe vazio ao usar opções `PG*` separadas. Nunca partilhe URLs com credenciais. |
| `TRUST_PROXY` | IPs/CIDRs explícitos de proxies; `.env.example` confia no nginx nativo de loopback (`127.0.0.1,::1`). `false` significa sem proxies de confiança. O Compose usa `PROXY_ADDRESS`. A confiança irrestrita é rejeitada. |
| `COMPOSE_PROJECT_NAME` | Identidade do projeto Compose; predefinição `news-radar`. Escolha um nome exclusivo para cada instalação simultânea. |
| `HTTP_BIND`, `HTTP_PORT` | Escuta no servidor Compose; predefinição `127.0.0.1:8080`. |
| `COMPOSE_SUBNET`, `PROXY_ADDRESS` | Rede Compose e endereço do proxy web; predefinições `172.30.240.0/24` e `172.30.240.10`. Altere ambos de forma coerente se houver conflito com outra rede. |
| `ALLOWED_NETWORKS` | IPs/CIDRs de clientes autorizados, separados por espaços, usados no nginx. A predefinição `all` depende da escuta em loopback; restrinja-a antes de expor à LAN. |
| `APP_TIMEZONE` | Fuso horário de apresentação; predefinição `Europe/Lisbon`. Use um identificador IANA. |
| `LOCAL_REGION_NAME` | Nome legível da categoria local; predefinição `Notícias locais`. |
| `LOCAL_REGION_KEYWORDS` | Palavras-chave locais opcionais, separadas por vírgulas. Vazio significa sem palavras regionais específicas. |
| `LOCAL_CATEGORY_ID` | Identificador da categoria local; predefinição `local`. Escolha antes dos dados iniciais. |
| `SEED_SOURCES` | `minimal` (predefinição), `none` ou `all`; consulte a [política de fontes](sources.md). |
| `TRANSLATION_ENABLED` | `false` por predefinição; ativa a funcionalidade opcional. Reveja também a opção administrativa. |
| `TRANSLATION_PYTHON`, `TRANSLATION_MODELS` | Executável Python e diretório de modelos nativos; use caminhos absolutos nos serviços. O Compose fornece caminhos internos. |
| `COMPOSE_PROFILES` | Vazio por predefinição. Defina `translation` só depois de obter os modelos opcionais. |
| `NATIVE_INSTALL_DIR` | Diretório nativo da aplicação; exemplo/predefinição `/srv/news-radar`. |
| `NATIVE_USER`, `NATIVE_GROUP` | Identidade dedicada dos serviços; predefinição `newsradar`. |
| `NODE_BINARY` | Caminho absoluto do Node.js nos serviços nativos; predefinição `/usr/bin/node`. Confirme o seu. |
| `NATIVE_SERVER_NAME` | Nome do servidor nginx nos modelos nativos; predefinição `localhost`. |
| `NATIVE_LISTEN` | Endereço/porta nginx; predefinição `127.0.0.1:8080`. |

As fontes, contas monitorizadas, regras e opções de tradução também são geridas em `/admin`. A preferência inicial de tradução é registada uma única vez; inicializações posteriores preservam a escolha administrativa. Ao definir `TRANSLATION_ENABLED=true` e iniciar um worker depois da primeira instalação, também tem de ativar a tradução em Administração → Sistema. As opções de dados iniciais destinam-se a uma base nova; não garantem renomear, remover ou reconfigurar registos já geridos numa base existente.

## Região local

Defina os seus nomes antes da primeira inicialização, por exemplo:

```dotenv
APP_TIMEZONE=Europe/Lisbon
LOCAL_REGION_NAME="A minha região"
LOCAL_REGION_KEYWORDS="Vila Exemplo,Vale Exemplo"
LOCAL_CATEGORY_ID=local
```

O template não presume o município, domínio ou rede privada do operador. Teste as palavras com notícias representativas para evitar correspondências demasiado abrangentes. Alterar `LOCAL_CATEGORY_ID` depois da configuração inicial exige rever as referências a categorias existentes.

## Limites de rede

O endereço de escuta web, a lista de clientes nginx e a confiança em proxies do Fastify são opções distintas. Uma associação ao loopback limita as máquinas que conseguem ligar. `ALLOWED_NETWORKS` controla os clientes nginx. `TRUST_PROXY` determina que proxies podem fornecer a identificação de cliente à API; não concede acesso por si só.

No Docker, a API confia apenas no proxy web em `PROXY_ADDRESS`. Altere esse endereço e `COMPOSE_SUBNET` de forma coerente se a rede predefinida colidir. O NAT Docker pode alterar o endereço visto pelo nginx; inspecione o cliente observado antes de escolher CIDRs. `ALLOWED_NETWORKS=all` permite todos os clientes que alcançam o nginx, pelo que a associação ao loopback é o limite inicial de acesso. Ao acrescentar um proxy externo, determine os endereços dos pares e se o nginx vê o cliente original; enviar um cabeçalho HTTP não altera uma lista de IPs autorizados. Não use `TRUST_PROXY=true` para contornar um problema de configuração. Consulte [segurança](security.md).

Alterações ao ambiente Compose normalmente exigem recriar os serviços com `docker compose up -d`; alterar apenas `.env` não atualiza os processos. Alterações aos modelos nativos exigem gerar, rever e reinstalar os ficheiros afetados e recarregar/reiniciar os serviços correspondentes.
