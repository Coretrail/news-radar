# Contributing / Contribuir

## English

Issues and pull requests in English or European Portuguese are welcome. For a bug, give the application revision, deployment method, runtime versions, expected behaviour and a small reproducible example. For a feature or new connector, explain the use case and discuss provider permissions before a large implementation.

Use your own fork or a repository created with **Use this template**. Develop against a fresh, isolated database. Follow the [development guide](docs/en/development.md); run `npm test` and `npm run build`, plus the relevant database/browser checks when changing those paths. Include the checks actually run and their results in your pull request. Do not claim checks that were not executed.

Keep changes focused. Update both documentation languages and `.env.example` when behaviour or configuration changes. Preserve the Portuguese-first interface unless the change explicitly adds a reviewed localization approach. New connectors need tests using controlled responses and a clear account of official access, terms, attribution, rate limits and failure behaviour.

Do not contribute `.env`, credentials, administrator setup URLs, private host/network details, backups, real user records, model weights or copied operational history. Use synthetic fixtures and reserved example domains. Third-party code/assets need compatible licences and retained notices. Publisher material is not covered by this project's MIT licence.

Report security vulnerabilities privately, following [SECURITY.md](SECURITY.md). Do not open a public issue containing exploit details or credentials. Be respectful and specific in reviews; explain the problem and evidence so others can reproduce it.

Maintainers preparing a public release should export only intended source/configuration examples, review the archive and newly created Git history for secrets/private material, verify licences and attribution, run the relevant checks in isolation, and update `CHANGELOG.md`. Do not publish an operational checkout or its private history. Repository publication, tagging and package/image publication are separate release actions performed by the repository owner.

## Português (Portugal)

Aceitam-se issues e pull requests em português europeu ou inglês. Para um erro, indique a revisão, método de instalação, versões dos runtimes, comportamento esperado e um exemplo mínimo reproduzível. Para funcionalidades ou conectores novos, explique a necessidade e discuta as permissões do fornecedor antes de uma implementação extensa.

Use o seu fork ou um repositório criado com **Use this template**. Desenvolva com uma base de dados nova e isolada. Siga o [guia de desenvolvimento](docs/pt/development.md); execute `npm test` e `npm run build`, além das verificações de base de dados/navegador relevantes. Indique na pull request os testes efetivamente executados e resultados. Não declare verificações que não executou.

Mantenha as alterações focadas. Atualize as duas línguas da documentação e `.env.example` ao mudar comportamento ou configuração. Preserve a interface orientada para português, salvo se a alteração acrescentar explicitamente uma abordagem de localização revista. Novos conectores precisam de testes com respostas controladas e de uma descrição clara do acesso oficial, condições, atribuição, limites e comportamento em caso de falha.

Não contribua `.env`, credenciais, endereços de configuração administrativa, detalhes de redes/servidores privados, cópias de segurança, dados reais, modelos ou histórico operacional copiado. Use dados sintéticos e domínios de exemplo reservados. Código/recursos de terceiros precisam de licenças compatíveis e avisos preservados. Os conteúdos dos editores não são abrangidos pela licença MIT do projeto.

Comunique vulnerabilidades em privado conforme [SECURITY.md](SECURITY.md). Não abra issues públicas com detalhes de exploração ou credenciais. Seja respeitoso e concreto nas revisões; explique o problema e a evidência para permitir a reprodução.

Na preparação de uma versão pública, os responsáveis devem exportar apenas código e exemplos pretendidos, rever o arquivo e o novo histórico Git quanto a segredos/material privado, verificar licenças e atribuição, executar os testes relevantes em isolamento e atualizar `CHANGELOG.md`. Não publique uma cópia operacional nem o seu histórico privado. Publicação do repositório, tags e publicação de pacotes/imagens são ações de lançamento separadas, realizadas pelo proprietário do repositório.
