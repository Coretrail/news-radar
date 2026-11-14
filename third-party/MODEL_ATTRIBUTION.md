# Translation model attribution

These models are downloaded separately. They are not relicensed under NEWS RADAR's MIT license. The exact converter revisions below are declared in `ops/translation-models.json`. Preserve the appropriate license, attribution and supplied upstream notices when redistributing model material.

| Role | Converted model and revision | Upstream | License |
|---|---|---|---|
| English → Portuguese | [playto-mt/opus-mt-tc-big-en-pt-ct2](https://huggingface.co/playto-mt/opus-mt-tc-big-en-pt-ct2), `86bd3fee2b37851b8eb86747c1078b885f5808fd` | [Helsinki-NLP/opus-mt-tc-big-en-pt](https://huggingface.co/Helsinki-NLP/opus-mt-tc-big-en-pt) | [CC-BY-4.0](licenses/common/CC-BY-4.0.txt) |
| Multilingual → English | [manancode/opus-mt-mul-en-ctranslate2-android](https://huggingface.co/manancode/opus-mt-mul-en-ctranslate2-android), `9184bc32db5a9a61eac5801d61bc9eb030362251` | [Helsinki-NLP/opus-mt-mul-en](https://huggingface.co/Helsinki-NLP/opus-mt-mul-en) | [Apache-2.0](licenses/common/Apache-2.0.txt) |

Credit: Helsinki-NLP / the OPUS-MT project for the upstream models; the respective `playto-mt` and `manancode` repository publishers for the CTranslate2 conversions. Both converter cards describe INT8 quantization and format conversion of the upstream model. The English-to-Portuguese card describes Portuguese (Brazilian); NEWS RADAR applies explicit European Portuguese terminology/construction adaptation in application code. This is separate from retraining or modification of model weights.

Pinned model cards: [en→pt](https://huggingface.co/playto-mt/opus-mt-tc-big-en-pt-ct2/raw/86bd3fee2b37851b8eb86747c1078b885f5808fd/README.md), [multilingual→en](https://huggingface.co/manancode/opus-mt-mul-en-ctranslate2-android/raw/9184bc32db5a9a61eac5801d61bc9eb030362251/README.md). These identify the source models and conversion changes; the application manifest does not separately identify the upstream model revision used by each converter. Do not imply that these upstream projects endorse NEWS RADAR.

The CC-BY model's attribution applies to shared licensed model material, including supplied attribution/copyright/license notices and indication of changes. Preserve supplied Apache notices for the multilingual model and identify modifications where applicable. No claim is made that model licensing grants permission to republish protected news inputs or that every translation inherits the weights' license. Preserve the original source and rights notices for news material independently.
