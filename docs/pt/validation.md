# Validação da instalação Docker

[English](../en/validation.md) · [Documentação](README.md)

A instalação Docker predefinida foi ensaiada em 14 de novembro de 2026 num ambiente Linux descartável, com daemon Docker, rede e volume de dados separados. Não se utilizaram instalações de produção. Este documento regista uma configuração testada; não garante todos os servidores nem versões futuras das imagens.

## Ponto de partida

O teste usou um arquivo limpo do código destinado ao repositório público. Não se copiaram `.env` operacional, base de dados, certificados, logs ou histórico Git privado. Não se ensaiou o clone GitHub porque a publicação ainda não estava autorizada. O código executável correspondeu ao commit público inicial preparado; as alterações de validação posteriores foram apenas documentais.

Com os pré-requisitos do README instalados, executaram-se os seguintes comandos sem alterar as predefinições do `.env` gerado:

```sh
node scripts/init-env.mjs
docker compose up -d --build --wait --wait-timeout 180
```

O utilitário gerou palavras-passe independentes e privadas para os utilizadores da base de dados. As imagens foram construídas, as migrações e os dados iniciais concluídos e o `init` terminou com código 0. Não foram necessárias chaves API, endereços pessoais de rede ou modelos de tradução.

Ambiente testado: Linux amd64, Node.js 24.22.3, Docker Engine 29.1.3, Compose 5.0.0, PostgreSQL 17.12 e nginx 1.30.6. As tags das imagens podem mudar; estas foram as versões observadas. O ambiente descartável tinha limites de dois CPUs e 3 GiB de memória; esses limites não são um benchmark nem requisitos mínimos suportados.

## Resultados

| Verificação | Resultado |
| --- | --- |
| Frontend através do nginx e backend `/api/health` | Passou |
| Três migrações PostgreSQL e utilizador da aplicação sem privilégios de superutilizador | Passou |
| Recolha real predefinida | BBC: 27 publicações; Hacker News: 80 publicações; ambas operacionais no ensaio |
| Dashboard num navegador real | Feed visível, apresentação desktop/mobile, sem overflow horizontal e temas claro/escuro |
| Favoritos | Guardados pela interface e mantidos depois de recarregar |
| Transporte SSE | Notificação PostgreSQL → API → nginx → navegador recebida; a notificação controlada referiu uma notícia existente |
| Administração | Endpoint protegido, configuração por utilização única, login, categorias e rejeição de origem externa |
| Reinício dos contentores | Base/API/collector/web reiniciados; notícias, favoritos, administrador e sessão preservados |
| Recriação dos contentores | `docker compose down` seguido de `up` preservou o volume nomeado e os dados |
| Licenças e fronteira das imagens | Avisos legais presentes; imagem da aplicação sem `.env`; API/web sem root e com sistema de ficheiros de leitura |

A contagem persistida final foi de 107 notícias. A disponibilidade das fontes é uma observação daquele momento; obter os dados não concede direitos adicionais sobre os conteúdos dos editores.

## Limites

- Ensaiou-se apenas o perfil predefinido. Não se construiu/iniciou neste ensaio a imagem opcional de tradução, nem se descarregaram os modelos, ativou a monitorização Bluesky ou validaram todas as fontes/plataformas opcionais.
- Os testes de navegador demonstram as interações indicadas. As capturas ilustrativas do README usam dados e contagens sintéticos separados; não são capturas deste ensaio nem prova da disponibilidade das fontes.
- O ensaio usou Docker dentro de um contentor descartável dedicado. Não certifica todos os sistemas operativos, arquiteturas, drivers de armazenamento, proxies TLS externos ou cenários de perda de energia.
- Clone GitHub, Actions, publicação, visibilidade e opção Template continuam a ser ações separadas controladas pelo proprietário. Um teste local aprovado não é um resultado GitHub Actions.
- As instruções nativas Debian/LXC têm as suas verificações anteriores; este ensaio Docker não reinstalou nem reiniciou uma instalação nativa de produção.

Não inclua credenciais geradas, volumes de dados, logs, estado do navegador ou relatórios privados nos commits e arquivos de publicação. Antes de publicar uma revisão alterada, repita as verificações e a auditoria de segredos com histórico descritas no [guia de publicação](release.md).
