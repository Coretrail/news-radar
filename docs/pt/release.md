# Revisão do template e publicação

[English](../en/release.md) · [Documentação](README.md)

Esta exportação pública está preparada para revisão pelo proprietário. Publicar, enviar para o GitHub, ativar a opção de template e publicar imagens/pacotes são ações separadas. Preparar estes ficheiros não cria um repositório GitHub nem ativa opções de template.

## Antes de qualquer envio público

- Reveja o código exportado, as duas línguas da documentação, predefinições, licenças, avisos de terceiros e capturas ilustrativas. Confirme a ausência de bases de dados operacionais, arquivos recolhidos de editores, modelos, `.env`, registos, cópias, endereços privados e URLs de configuração administrativa.
- Analise os ficheiros pretendidos e os objetos Git novos quanto a segredos e material privado. Uma árvore de trabalho limpa não prova que o histórico esteja limpo. Se um segredo foi divulgado, altere-o; excluir um ficheiro não o revoga.
- Parta da exportação limpa revista num **repositório novo com histórico novo**. Nunca envie o diretório `.git`, branches, tags, remotes ou objetos históricos de uma instalação privada. Inspecione os conteúdos preparados e o primeiro commit antes de acrescentar um remote público.
- Verifique a política de fontes/fornecedores e a atribuição dos modelos. Uma fonte tecnicamente acessível não concede licença de redistribuição. Mantenha os modelos separados e reveja as licenças antes de os obter ou distribuir.
- Execute as verificações exigidas com recursos de teste isolados e registe a revisão exata, comandos, resultados e limitações. Reveja alterações de configuração e migrações antes da instalação.
- Obtenha aprovação explícita de revisão pelo proprietário **antes do primeiro envio público**. O proprietário escolhe conta, nome, visibilidade e momento da publicação. O template não presume proprietário nem endereço de remote.

## Âmbito da validação desta exportação

A preparação local executou verificações unitárias/compilação, integração PostgreSQL e inicialização/migrações compiladas numa base nova com um utilizador da aplicação sem privilégios de superutilizador. A auditoria de dependências não identificou avisos conhecidos no momento da verificação. São observações da revisão e ambiente analisados; registe resultados novos ao preparar uma versão posterior.

A configuração Docker Compose foi validada. **Não se executaram a construção de imagens nem o arranque da instalação em contentores neste ambiente**, porque não existia um motor Docker e não se instalou um no servidor existente. O workflow CI incluído está preparado para construir/iniciar a instalação e verificar respostas HTTP num runner GitHub isolado após publicação aprovada. Existir um workflow não prova que uma execução GitHub tenha passado. Reveja os resultados reais antes de apresentar esse percurso como verificado.

## Depois da publicação aprovada

Crie ou escolha um repositório novo e vazio na conta do proprietário, confirme o endereço do remote e envie apenas o histórico novo revisto. Reveja novamente os ficheiros e o histórico públicos depois do envio. Não publique evidência de auditoria privada nem dados operacionais como anexos de versões.

A opção **Template repository** do GitHub tem de ser ativada pelo proprietário nas definições depois da aprovação/publicação. Esta preparação local não a ativou. Depois disso, os visitantes podem usar **Use this template** para criar o seu repositório. Devem clonar o respetivo endereço, gerar o seu `.env` e rever a instalação/fontes.

Ative a comunicação privada de vulnerabilidades GitHub quando disponível, verifique o percurso privado e mantenha `SECURITY.md` correto. Configure proteção de branches e verificações obrigatórias conforme o repositório. Execute o CI preparado, inspecione resultados e resolva falhas antes de criar uma versão/tag ou publicar imagens/pacotes.

Atualize `CHANGELOG.md` com a versão/data e comportamento verificado relevante. Anexe apenas arquivos de código revistos ou artefactos públicos pretendidos. Endereços de instalação, certificados, segredos, conteúdos dos editores e armazenamento de cópias continuam a ser responsabilidade do operador.
