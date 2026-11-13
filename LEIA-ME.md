# Vocab — vocabulário EN · ES · RU

App web instalável (PWA), feito primeiro para o celular. Funciona offline e guarda os dados no próprio aparelho (IndexedDB).

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | página única do app |
| `styles.css` | visual (claro/escuro) |
| `js/storage.js` | **único** módulo que lê e grava dados |
| `js/srs.js` | algoritmo SM-2 e montagem da fila de estudo (não toca em dados) |
| `js/app.js` | telas e interação |
| `sw.js` | service worker (funcionamento offline) |
| `manifest.webmanifest`, `icons/` | instalação na tela inicial |
| `serve.ps1` | servidor local para testar no Windows (não precisa ir para o GitHub) |

## Como usar

- **Adicionar → Colar vários**: uma linha por item, campos separados por `|`:
  ```
  idioma | item | definição | frase original | minha frase | vizinhas | fonte
  EN | make up my mind | decidir | I can't make up my mind. | I finally made up my mind to move. | decide | podcast
  RU | на всякий случай | por via das dúvidas | Возьми зонт на всякий случай. | | | aula
  ```
  O idioma é opcional (sem ele vale o idioma escolhido na tela). Campos vazios ficam em branco entre as barras. Linhas com erro continuam no campo para você corrigir; itens repetidos são ignorados.
- **Cartão de produção**: a frente mostra a definição ou a sua frase com lacuna. Para a lacuna aparecer, a "minha frase" precisa conter o item escrito exatamente igual.
- **Cartão de leitura (só russo)**: frente em cirílico; ao virar, toca a pronúncia. Se não tocar, instale a voz russa: Android → Configurações → Idioma e entrada → Saída de conversão de texto em voz; iPhone → Ajustes → Acessibilidade → Conteúdo Falado → Vozes → Русский.
- **Avaliação** (SM-2): Errei = 1, Difícil = 3, Bom = 4, Fácil = 5. "Errei" devolve o cartão para o fim da sessão.
- **Status**: começa em *Reconheço*; passa sozinho para *Produzi no estudo* quando você acerta um cartão de produção; *Usei espontâneo* só pelo botão ★ (no verso do cartão ou na tela do item).
- **Limite de novos por dia**: em Ajustes (padrão EN 8, ES 8, RU 2). Um item russo novo conta como 1, mesmo tendo dois cartões.
- **Backup**: Ajustes → Exportar backup. Faça isso de vez em quando: se você limpar os dados do navegador ou trocar de celular, só o backup salva seus itens. "Mesclar" junta com o que já existe; "Substituir tudo" apaga e restaura.

## Rodar no computador (para testar)

O app precisa ser aberto por um endereço `http://`, não com duplo clique no `index.html`.

1. Abra a pasta do projeto no Explorador de Arquivos.
2. Clique com o botão direito em `serve.ps1` → **Executar com o PowerShell**.
   (Ou, num terminal dentro da pasta: `powershell -ExecutionPolicy Bypass -File serve.ps1`)
3. Abra **http://localhost:8080** no Chrome ou Edge.
4. Para ver como no celular: F12 → ícone de celular (Ctrl+Shift+M).

> Durante testes, o service worker guarda os arquivos. Se uma mudança não aparecer, recarregue com Ctrl+Shift+R, ou aumente a versão em `sw.js`.

## Publicar de graça no GitHub Pages (pelo site, sem instalar nada)

1. Crie uma conta em **github.com** (se ainda não tiver).
2. Clique em **+** (canto superior direito) → **New repository**.
   - Nome: `vocab` (o endereço final será `https://SEU-USUARIO.github.io/vocab/`).
   - Marque **Public** (o Pages gratuito exige repositório público; seus *dados* não vão para lá, só o código).
   - Clique em **Create repository**.
3. Na página do repositório vazio, clique no link **uploading an existing file**.
4. Arraste para a janela: `index.html`, `styles.css`, `sw.js`, `manifest.webmanifest`, a pasta `js` e a pasta `icons` (arraste as pastas inteiras para manter a estrutura). Não precisa enviar `serve.ps1`, `LEIA-ME.md` nem `.claude`.
5. Clique em **Commit changes**.
6. Vá em **Settings** → **Pages** (menu à esquerda).
   - Em *Build and deployment* → *Source*: **Deploy from a branch**.
   - *Branch*: **main** e pasta **/ (root)** → **Save**.
7. Espere 1–2 minutos e recarregue a página de Settings → Pages: aparece o link **Your site is live at…**.

### Instalar no celular

- **Android (Chrome)**: abra o link → menu ⋮ → **Instalar app** (ou "Adicionar à tela inicial").
- **iPhone (Safari)**: abra o link → botão Compartilhar → **Adicionar à Tela de Início**.

Depois de aberto uma vez com internet, ele funciona offline.

### Publicar uma atualização

1. No GitHub, abra o arquivo alterado → ícone de lápis (ou faça upload de novo do arquivo; ele substitui).
2. **Sempre** edite também o `sw.js` e aumente a versão: `const VERSION = 'v2';` (depois `v3`, …). Sem isso o celular continua usando a versão guardada.
3. No celular, feche e abra o app duas vezes (na primeira ele baixa a versão nova, na segunda usa).

Os dados ficam no celular e não são afetados por atualizações.

## Trocar o armazenamento no futuro (ex.: Supabase)

Todo acesso a dados passa por `js/storage.js`, que exporta um objeto `storage` com estas funções (todas assíncronas):

| Função | O que faz |
|---|---|
| `init()` | prepara o armazenamento |
| `listItems()` | todos os itens |
| `getItem(id)` | um item ou `null` |
| `addItems(lista)` | cria itens; gera `id`, `createdAt`, `updatedAt` |
| `saveItem(item)` | grava um item existente; atualiza `updatedAt` |
| `deleteItem(id)` | apaga |
| `getSettings()` / `saveSettings(s)` | limites diários e tema |
| `exportBackup()` / `importBackup(dados, {mode})` | backup JSON |

Para usar Supabase, reescreva só esse arquivo mantendo os mesmos nomes e retornos (por exemplo, uma tabela `items` com as mesmas colunas e `cards` como `jsonb`, e uma tabela `settings`). O formato completo de um item está documentado no topo de `storage.js`. O resto do app não precisa mudar.
