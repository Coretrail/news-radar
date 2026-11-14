# Segurança e instalação

[English](../en/security.md) · [Documentação](README.md) · [Comunicar vulnerabilidades](../../SECURITY.md)

O painel de leitura não tem autenticação. A autenticação administrativa protege a administração, não o feed, a pesquisa, os conteúdos ou outros endpoints de leitura. Use o template numa máquina/rede local de confiança, salvo se tiver avaliado e configurado toda a instalação para um acesso mais amplo.

## Acesso e TLS

Mantenha o PostgreSQL privado e exponha apenas a entrada web. Os exemplos Compose e nativo escutam em `127.0.0.1:8080`. Uma firewall e uma lista explícita de clientes nginx são úteis ao alargar o acesso. Não pressuponha que portas publicadas pelo Docker herdam todas as regras da firewall do servidor.

Para HTTPS, termine TLS num proxy inverso gerido pelo operador e encaminhe para o endereço web de loopback. Defina `APP_URL` com a origem HTTPS final. Preserve o servidor e protocolo originais e permita a ligação de atualizações em direto. Limite a confiança aos IPs/CIDRs reais dos proxies. Reveja o endereço efetivo do cliente e a lista de acesso nginx ao acrescentar um proxy; caso contrário, o seu endereço pode ocultar todos os clientes.

O template não fornece domínio, certificados, túnel ou gateway de autenticação para a Internet. Se os leitores precisarem de autenticação, acrescente um gateway no limite da instalação e verifique páginas, API e ligações em direto. Teste o login administrativo e os cookies de sessão no endereço HTTPS final.

## Segredos e contas

- Mantenha `.env`, cópias da base de dados, caches de modelos, registos e ficheiros de instalação gerados fora do controlo de versões.
- O endereço de configuração administrativa é um segredo de utilização única válido durante 15 minutos. Gere-o na instância pretendida e abra-o apenas por uma ligação de confiança.
- Use uma palavra-passe administrativa exclusiva. Proteja a administração PostgreSQL e as cópias cifradas com o mesmo cuidado.
- Alterar `PGPASSWORD` ou o segredo de inicialização Compose `PGADMIN_PASSWORD` em `.env` não altera a palavra-passe do respetivo utilizador PostgreSQL. Coordene a alteração na base de dados com a configuração e reinicie os processos dependentes.
- Se uma credencial chegar a um repositório público, revogue-a/altere-a. Remover o ficheiro do último commit não basta.

Não se distribui uma palavra-passe administrativa predefinida nem uma base de dados operacional. A aplicação usa um utilizador de base de dados dedicado e deve usar um utilizador de sistema dedicado nas instalações nativas.

## Conteúdos e integrações externos

Trate feeds, títulos, resumos e endereços como dados não fiáveis. Reveja os novos conectores quanto a HTML, validação de URLs, pedidos a redes privadas, redirecionamentos, limites de resposta e autenticação do fornecedor. Não enfraqueça restrições de pedidos apenas para fazer funcionar uma fonte indisponível. Guarde só o conteúdo necessário, mantendo a atribuição e os endereços originais.

As prioridades são classificações automáticas, não avisos de emergência oficiais. As traduções automáticas podem conter erros. Para decisões urgentes, de segurança ou com consequências relevantes, consulte as fontes oficiais originais.

## Manutenção

Atualize o sistema e o runtime, reveja dependências e imagens, inspecione falhas de recolha/tradução e teste periodicamente a recuperação de cópias. Reveja quem consegue aceder a `/admin` e à API de leitura depois de alterações de rede. Não exponha registos ou informação de diagnóstico que contenham segredos.

Ao pedir apoio, forneça versões e passos de reprodução expurgados. Exclua endereços de configuração, cookies de sessão, palavras-passe, nomes/IPs privados, URLs de fontes privadas e dados reais. Comunique vulnerabilidades em privado conforme [SECURITY.md](../../SECURITY.md).
