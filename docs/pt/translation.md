# Tradução local opcional

[English](../en/translation.md) · [Documentação](README.md)

A tradução está desativada por predefinição. O painel, a API e o coletor funcionam sem modelos nem runtime Python. O worker opcional traduz títulos e resumos para português europeu no próprio servidor, mantendo o texto/ligação original para consulta. Não traduz a interface para inglês.

## Modelos e licenças

O manifesto com versões fixas é [`ops/translation-models.json`](../../ops/translation-models.json). O modelo inglês→português é `playto-mt/opus-mt-tc-big-en-pt-ct2`, derivado de Helsinki-NLP/OPUS-MT, sob **CC BY 4.0**. O modelo multilingue→inglês é `manancode/opus-mt-mul-en-ctranslate2-android`, derivado de Helsinki-NLP/OPUS-MT, sob **Apache 2.0**. Textos noutras línguas podem passar por inglês antes do português.

Estas licenças são distintas da licença MIT da aplicação. Leia o manifesto, as fichas dos modelos originais e os [avisos de terceiros](../../THIRD_PARTY_NOTICES.md) antes de aceitar ou distribuir modelos. Preserve a atribuição, os ficheiros de licença e as revisões fornecidos na obtenção. Os modelos são descarregados separadamente; não se incluem no repositório.

## Docker Compose

Na raiz do repositório, reveja primeiro as licenças e aceite-as explicitamente ao obter os modelos:

```sh
python3 scripts/provision-translation.py --models-dir ./models --accept-licenses
```

Este passo precisa de Internet. Em `.env`, defina:

```dotenv
TRANSLATION_ENABLED=true
COMPOSE_PROFILES=translation
```

Depois reconstrua/inicie o worker opcional:

```sh
docker compose up -d --build
docker compose logs --tail=100 translation
```

Se a instalação foi inicialmente criada sem tradução, ative-a também em **Administração → Sistema**. Os dados iniciais registam essa preferência uma única vez e preservam escolhas posteriores; alterar o ambiente ou repetir a inicialização não a repõe. Inspecione a opção e a fila. O ambiente e o worker têm de estar prontos; iniciar só o worker pode deixar a opção administrativa desativada, e as notícias elegíveis são processadas de forma assíncrona. Os modelos são montados a partir do diretório local configurado e a inferência é local; obter pacotes/modelos e recolher fontes continua a exigir rede.

Para parar, desative a tradução na administração, defina `TRANSLATION_ENABLED=false` e pare o serviço opcional. Retire `translation` de `COMPOSE_PROFILES` para futuras execuções:

```sh
docker compose --profile translation stop translation
```

## Instalação nativa

Use um ambiente virtual Python separado e o ficheiro de dependências fixadas fornecido com a configuração de tradução. Não instale no Python do sistema. Obtenha os modelos como utilizador do serviço ou garanta que esse utilizador consegue lê-los. Defina `TRANSLATION_PYTHON` com o caminho absoluto do Python do ambiente virtual e `TRANSLATION_MODELS` com o diretório absoluto dos modelos; depois defina `TRANSLATION_ENABLED=true`.

Em Debian, instale primeiro `python3-venv`. No diretório da aplicação, como utilizador do serviço (ajuste os caminhos absolutos do exemplo):

```sh
python3 -m venv .venv-translation
.venv-translation/bin/python -m pip install -r server/translation/requirements.txt
python3 scripts/provision-translation.py --models-dir ./models --accept-licenses
```

```dotenv
TRANSLATION_ENABLED=true
TRANSLATION_PYTHON=/srv/news-radar/.venv-translation/bin/python
TRANSLATION_MODELS=/srv/news-radar/models
```

```sh
npm run translation
```

Ative também a tradução em **Administração → Sistema**, sobretudo numa instalação existente criada sem ela. Execute este comando no diretório da aplicação para verificar arranque e diagnóstico. Para execução persistente, gere/reveja/instale a unidade nativa de tradução depois de configurar `.env`; ative-a só quando as dependências Python e os modelos estiverem prontos. O [guia nativo](native-install.md) explica o padrão de instalação dos serviços.

## Qualidade e operação

A inferência usa CPU e pode competir por memória e processamento com a recolha e a API. Meça no seu equipamento antes de ativar um histórico extenso. A tradução é assíncrona; inspecione erros da fila e registos do worker em vez de pressupor um problema de interface quando não aparece texto traduzido.

A deteção de língua, a tradução intermédia e a adaptação terminológica podem introduzir erros. O texto automático não é uma tradução verificada. Consulte os originais antes de confiar em nomes, citações, números ou informação com consequências relevantes. As licenças dos modelos não concedem direitos sobre conteúdos dos editores; consulte as [fontes](sources.md).
