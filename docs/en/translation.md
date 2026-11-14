# Optional local translation

[Português](../pt/translation.md) · [Documentation](README.md)

Translation is disabled by default. The dashboard, API and collector work without model weights or a Python runtime. The optional worker translates titles and summaries into European Portuguese on your machine, with the original text/link available for checking. It does not translate the interface into English.

## Models and licences

The pinned model manifest is [`ops/translation-models.json`](../../ops/translation-models.json). The English→Portuguese model is `playto-mt/opus-mt-tc-big-en-pt-ct2`, derived from Helsinki-NLP/OPUS-MT, under **CC BY 4.0**. The multilingual→English model is `manancode/opus-mt-mul-en-ctranslate2-android`, derived from Helsinki-NLP/OPUS-MT, under **Apache 2.0**. Non-English text may pass through English before Portuguese.

These licences are separate from the application's MIT licence. Read the manifest, upstream model cards and [third-party notices](../../THIRD_PARTY_NOTICES.md) before accepting or distributing weights. Keep the attribution, licence files and revision information supplied by provisioning. Models are downloaded separately; no weights are included in the repository.

## Docker Compose

From the repository root, review the licence requirements first, then explicitly accept them when provisioning:

```sh
python3 scripts/provision-translation.py --models-dir ./models --accept-licenses
```

The provisioning step needs Internet access. In `.env`, set:

```dotenv
TRANSLATION_ENABLED=true
COMPOSE_PROFILES=translation
```

Then rebuild/start the optional worker:

```sh
docker compose up -d --build
docker compose logs --tail=100 translation
```

If this installation was first initialized with translation disabled, also enable translation under **Administration → System** (`Administração → Sistema` in the current Portuguese UI). The seed records this preference once and preserves subsequent administrator choices; changing the environment or rerunning initialization does not reset it. Inspect the setting and queue. Both the feature environment and worker must be ready; starting the worker alone can leave the administrative setting disabled, and eligible stories are processed asynchronously. The models are mounted from the configured local directory and inference runs locally; downloading packages/models and collecting sources still require network access.

To stop translation, disable the administrative translation setting, set `TRANSLATION_ENABLED=false`, and stop the optional service. Remove `translation` from `COMPOSE_PROFILES` for future starts:

```sh
docker compose --profile translation stop translation
```

## Native installation

Use a separate Python virtual environment and the pinned dependency file shipped with the translation deployment configuration. Do not install into the system Python. Run provisioning as the service user or ensure the resulting model files are readable by it. Set `TRANSLATION_PYTHON` to the virtual environment's absolute Python path and `TRANSLATION_MODELS` to the absolute model directory, then set `TRANSLATION_ENABLED=true`.

On Debian, install `python3-venv` first. From the application directory as the service user (adjust the example absolute paths if needed):

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

Enable translation under **Administration → System** as well, especially on an existing installation initialized without it. Run this command from the application directory to check startup and diagnostics. For persistent use, render/review/install the optional native translation unit after configuring `.env`; enable it only when the Python dependencies and models are ready. The [native guide](native-install.md) explains the service installation pattern.

## Quality and operation

Inference uses CPU and can compete with collection/API work for memory and CPU time. Measure on your hardware before enabling a large backlog. Translation is asynchronous; inspect queue failures and worker logs rather than assuming the absence of translated text is a frontend problem.

Language detection, pivot translation and European Portuguese terminology adaptation can all introduce errors. Automatic text is not a verified translation. Check preserved originals before relying on names, quotations, numerical details or consequential information. Model licences do not grant rights in publisher content; review [sources](sources.md).
