# Docker Compose

[English](../en/docker.md) · [Documentação](README.md)

Use uma cópia nova do repositório e um volume de base de dados novo. Requisitos: Git, Node.js 24+ para o utilitário de ambiente, Docker Engine e plugin Docker Compose (2.20 ou posterior). O perfil opcional de tradução também precisa de Python 3 para obter os modelos e de espaço e memória suficientes para os executar.

## Primeira execução

```sh
git clone <YOUR-REPOSITORY-URL> news-radar
cd news-radar
node scripts/init-env.mjs
```

Reveja `.env`. Mantenha `APP_URL=http://localhost:8080` para a instalação local predefinida. Escolha `SEED_SOURCES=minimal`, `none` ou `all` antes de inicializar a base de dados; consulte as [fontes](sources.md). O utilitário só gera os segredos separados `PGPASSWORD` e `PGADMIN_PASSWORD` ao criar um novo `.env`. Não altera palavras-passe existentes. O Compose mantém o superutilizador de inicialização `radar_admin` e a sua palavra-passe apenas no serviço `db`. O script de inicialização cria `PGUSER` como proprietário da base, sem privilégios de superutilizador; migrações e serviços usam esse utilizador.

```sh
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
docker compose logs --tail=100 init api collector web
```

O serviço `init` aplica migrações e dados iniciais e termina. É normal aparecer terminado com código 0. `api` e `collector` usam PostgreSQL; `web` serve a interface compilada e encaminha pedidos à API e atualizações em direto. O PostgreSQL fica na rede interna do Compose. A porta web fica associada ao loopback do servidor por predefinição.

Abra http://localhost:8080. A primeira recolha pode demorar; é normal ver um painel vazio com `SEED_SOURCES=none`, fontes desativadas ou falhas dos fornecedores.

```sh
docker compose exec api node build/admin-cli.js
```

Abra o endereço apresentado em 15 minutos e escolha as credenciais de administração. Trate esse endereço como uma palavra-passe. Serve para criar a primeira conta; voltar a executá-lo não substitui um administrador existente.

## Várias instalações independentes

Use uma cópia do repositório e `.env` separados para cada instância. Defina um `COMPOSE_PROJECT_NAME` exclusivo, escolha `HTTP_PORT` livre e valores `COMPOSE_SUBNET`/`PROXY_ADDRESS` sem sobreposição. Ajuste `APP_URL` e gere segredos independentes. O nome do projeto separa volumes e serviços; partilhá-lo pode reutilizar recursos de outra instalação involuntariamente.

## Acesso remoto

Num servidor remoto, um túnel SSH mantém a associação ao loopback:

```sh
ssh -L 8080:127.0.0.1:8080 <USER>@<HOST>
```

Depois use http://localhost:8080 no navegador. Para acesso partilhado, configure deliberadamente o endereço de escuta e as redes autorizadas e coloque um proxy com TLS à frente da aplicação. Leia [segurança](security.md) antes de alterar qualquer limite de rede. O login administrativo não autentica o painel de leitura.

## Parar, atualizar e inspecionar

```sh
docker compose logs --tail=100 api collector
docker compose stop
docker compose up -d
```

Antes de atualizar, faça e verifique uma cópia de segurança, leia `CHANGELOG.md`, reveja novas opções em `.env.example` e obtenha a versão pretendida. Depois reconstrua:

```sh
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
```

As migrações não têm reversão automática. Guarde a versão anterior e uma cópia de segurança testada quando precisar de recuperação. `docker compose down` preserva os volumes nomeados; **`docker compose down -v` elimina-os**, incluindo a base de dados.

## Cópia de segurança e restauro

Com os nomes predefinidos:

```sh
mkdir -p backups
chmod 700 backups
docker compose exec -T db pg_dump -U newsradar -d newsradar -Fc > backups/newsradar.dump
chmod 600 backups/newsradar.dump
pg_restore --list backups/newsradar.dump
```

Ajuste `-U` e `-d` se alterou `PGUSER` ou `PGDATABASE`. `pg_restore --list` precisa de um cliente PostgreSQL compatível; inspeciona o arquivo, mas não prova que o restauro funciona. Verifique a recuperação numa base de dados descartável e separada. Guarde `.env` e a configuração de instalação separadamente, em armazenamento cifrado; nunca faça commit das cópias de segurança.

Para restaurar, crie primeiro uma base de dados nova e separada noutra instalação. Envie o arquivo para o respetivo `pg_restore`, ajustando os nomes:

```sh
docker compose exec -T db pg_restore -U newsradar -d newsradar --no-owner --exit-on-error < backups/newsradar.dump
```

O exemplo pressupõe uma base de dados vazia, sem tabelas já criadas pela inicialização. Pare os processos que escrevem nessa instalação durante o restauro, verifique os dados e inicie a versão correspondente da aplicação. Não execute este comando numa instalação de produção em funcionamento.

## Resolução de problemas

Consulte `docker compose ps`, o estado de saída de `init` e os registos dos serviços. Alterar `PGPASSWORD` ou `PGADMIN_PASSWORD` em `.env` não muda a palavra-passe do respetivo utilizador num volume PostgreSQL existente: atualize esse utilizador na administração PostgreSQL e recrie os serviços dependentes. O script que cria o utilizador da aplicação só executa com um diretório de dados vazio. Evite eliminar volumes para resolver erros de ligação. Para traduções, consulte o [guia de tradução](translation.md).

[Resultados e limites do ensaio do perfil predefinido](validation.md).
