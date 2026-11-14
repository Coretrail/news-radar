# Instalação nativa Debian 13 / LXC

[English](../en/native-install.md) · [Documentação](README.md)

Estas instruções descrevem uma **instalação nova e isolada**, usando `/srv/news-radar` como exemplo. Não atualizam nem reutilizam a base de dados ou serviços de uma instalação existente. O gerador de modelos escreve apenas no diretório de saída escolhido; não instala serviços automaticamente.

Use Debian 13 com systemd, PostgreSQL 17, nginx, Git e Node.js 24+. Em LXC, use um contentor com systemd funcional, DNS, HTTPS de saída, memória/espaço suficientes e acesso aos repositórios de pacotes. A instalação nativa não exige Docker aninhado. Defina separadamente o acesso de rede e as cópias de segurança do contentor.

Os comandos com `sudo` exigem administração; omita `sudo` numa sessão root. Se escolher outros caminhos ou nomes, substitua-os de forma coerente.

## Preparar o servidor

```sh
sudo apt update
sudo apt install git ca-certificates build-essential postgresql-17 postgresql-client-17 nginx
node --version
command -v node
```

Instale Node.js 24+ pelo método de distribuição mantido que preferir, se estiver ausente ou for antigo. Confirme o caminho real do executável; em Debian é frequente `/usr/bin/node`, mas gestores de versões podem usar outro caminho. O systemd precisa de um caminho absoluto disponível sem a configuração da sua sessão interativa.

Crie um utilizador e diretório dedicados:

```sh
sudo useradd --system --user-group --home-dir /srv/news-radar --shell /usr/sbin/nologin newsradar
sudo install -d -o newsradar -g newsradar -m 755 /srv/news-radar
sudo -u newsradar git clone <YOUR-REPOSITORY-URL> /srv/news-radar
```

Crie um utilizador PostgreSQL e uma base de dados novos:

```sh
sudo -u postgres createuser --no-superuser --no-createdb --no-createrole newsradar
sudo -u postgres createdb --owner=newsradar newsradar
```

O exemplo usa autenticação peer num socket Unix: o utilizador de sistema `newsradar` liga como o utilizador PostgreSQL com o mesmo nome. Confirme que `pg_hba.conf` permite essa ligação local; não o altere para confiança irrestrita. Para TCP ou base de dados remota, configure uma palavra-passe forte e regras de autenticação/rede restritas.

## Compilar e inicializar

Abra explicitamente uma shell como utilizador do serviço e execute nela:

```sh
sudo -u newsradar -H /bin/bash
cd /srv/news-radar
node scripts/init-env.mjs
```

Edite `.env` como esse utilizador. Para este exemplo, confirme:

```dotenv
APP_URL=http://localhost:8080
HOST=127.0.0.1
PORT=3001
PGHOST=/var/run/postgresql
PGPORT=5432
PGDATABASE=newsradar
PGUSER=newsradar
TRUST_PROXY=127.0.0.1,::1
NATIVE_INSTALL_DIR=/srv/news-radar
NATIVE_USER=newsradar
NATIVE_GROUP=newsradar
NODE_BINARY=/usr/bin/node
NATIVE_SERVER_NAME=localhost
NATIVE_LISTEN=127.0.0.1:8080
```

Os segredos gerados `PGPASSWORD` e `PGADMIN_PASSWORD` (este último só para Compose) não são usados neste exemplo nativo com autenticação peer; mantenha `.env` privado com modo `600` e não o publique. O diretório permite passagem para o nginx ler os recursos públicos em `dist/`; os segredos devem ficar em ficheiros privados. Escolha `SEED_SOURCES` e a região local antes dos dados iniciais. Reveja `ALLOWED_NETWORKS` para o percurso real dos clientes. Os comandos da aplicação leem `.env` do diretório de trabalho.

```sh
npm ci
npm run build
npm run migrate
npm run seed
node scripts/render-native.mjs --output ./native-generated
```

Leia todos os ficheiros gerados, sobretudo identidades, executáveis, caminhos, endereço nginx, redes autorizadas e proxies. A saída pode conter detalhes da instalação; não faça commit. Saia da shell do utilizador:

```sh
exit
```

## Instalar a configuração revista

Instale as unidades API/coletor e a configuração nginx de `native-generated`, usando os nomes fornecidos pelo gerador. Guarde qualquer configuração nginx existente antes de escolher o nome do site. Com os nomes deste template:

```sh
sudo install -m 644 /srv/news-radar/native-generated/news-radar-api.service /etc/systemd/system/news-radar-api.service
sudo install -m 644 /srv/news-radar/native-generated/news-radar-collector.service /etc/systemd/system/news-radar-collector.service
sudo install -m 644 /srv/news-radar/native-generated/news-radar.conf /etc/nginx/sites-available/news-radar.conf
sudo ln -s /etc/nginx/sites-available/news-radar.conf /etc/nginx/sites-enabled/news-radar.conf
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now news-radar-api news-radar-collector
sudo systemctl reload nginx
```

Se a ligação simbólica já existir, reveja o destino em vez de a substituir sem inspeção. Não instale o serviço de tradução opcional antes de preparar os [modelos e ambiente Python](translation.md).

Verifique o funcionamento e crie o administrador:

```sh
sudo systemctl status news-radar-api news-radar-collector --no-pager
sudo journalctl -u news-radar-api -u news-radar-collector -n 100 --no-pager
sudo -u newsradar -H /bin/bash
cd /srv/news-radar
npm run admin:setup
exit
```

Abra http://localhost:8080 diretamente ou pelo túnel SSH descrito no [guia Docker](docker.md#acesso-remoto). O endereço de configuração de utilização única é secreto e expira em 15 minutos. Defina `APP_URL` com a origem efetivamente usada no navegador se for diferente.

## Manutenção e cópias de segurança

Antes de atualizar, faça e teste uma cópia PostgreSQL e guarde a configuração em segurança. No diretório da aplicação, obtenha a versão escolhida, execute `npm ci` e `npm run build`, pare os processos de escrita antes das migrações se a versão o exigir, aplique migrações como utilizador do serviço e reinicie os serviços afetados. Volte a gerar e rever os modelos quando mudar o ambiente ou os próprios modelos.

Para um arquivo nativo com a autenticação peer do exemplo:

```sh
sudo install -d -o newsradar -g newsradar -m 700 /var/backups/news-radar
sudo -u newsradar /bin/bash
cd /srv/news-radar
BACKUP_DIR=/var/backups/news-radar node scripts/backup.mjs
exit
```

O utilitário cria um arquivo com data, formato personalizado e permissões restritas e remove saídas incompletas em caso de erro. Inspecione com `pg_restore --list <DUMP-PATH>` e teste o restauro numa base de dados nova e separada. Inspecionar o arquivo não testa a recuperação. Mantenha várias gerações na sua política de cópias. Mantenha cópias cifradas fora do servidor/contentor e inclua separadamente `.env` e a configuração TLS/proxy do operador. Leia [segurança](security.md) antes de alargar o acesso.

## Recuperação da administração

Este procedimento exige um operador autorizado do servidor e revoga **todas** as contas e sessões administrativas. Faça primeiro um backup, confirme a instalação de destino e suspenda o acesso administrativo durante a recuperação. O acesso de leitura ao dashboard não concede esta autorização.

Para o utilizador de serviço e base de dados do exemplo nativo:

```sh
sudo -u newsradar psql --dbname newsradar --set=ON_ERROR_STOP=1 --command='BEGIN; DELETE FROM sessions; DELETE FROM admins; DELETE FROM bootstrap; COMMIT;'
sudo -u newsradar -H /bin/bash
cd /srv/news-radar
npm run admin:setup
exit
```

Adapte o utilizador, base de dados e caminho à instalação revista. Abra o novo URL de utilização única em privado e defina novas credenciais. Não reutilize uma palavra-passe suspeita nem partilhe o URL de inicialização. Esta operação não altera as palavras-passe do sistema operativo ou da base de dados.
