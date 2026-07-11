# Contra Pedido — LogLife 2026

UI estática (HTML/CSS/JS puro) hospedada no **GitHub Pages** que conversa com um **Worker Cloudflare** dedicado, com persistência em **D1**.

> Versão **2.0** (2026-07-11). A versão anterior era um app desktop Electron com persistência em `cp.json` + Excel. Tudo isso foi removido.

---

## Estrutura

```
Automation-ContraPedido/
├── public/                  # ← GitHub Pages serve isto
│   ├── index.html           # Tela principal (contra pedidos)
│   ├── base.html            # Tela de base de clientes
│   ├── api.js               # fetch wrapper → Worker CP
│   ├── app.js               # lógica do index.html
│   ├── base.js              # lógica do base.html
│   └── loglife_logo.png
├── package.json             # (opcional) só pra servir local com `npm start`
├── .gitignore
└── README.md
```

O arquivo **`WORKERCONTRAPEDIDO.txt`** (na pasta-pai `LOGLIFE-APP/CONTRA PEDIDO/`) é o código do Worker Cloudflare — fica separado, não faz parte deste repo.

---

## Como colocar no ar (passo a passo)

### 1. Subir o Worker CP no Cloudflare

1. Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Create Worker**.
2. Nome: `loglife-contrapedido` (ou qualquer outro).
3. Apaga o código de exemplo e cola o conteúdo de `WORKERCONTRAPEDIDO.txt`.
4. **Settings → Bindings** → **Add → D1 database**:
   - Variable name: **`DB`** (exatamente esse nome)
   - Database: cria um novo (ex: `loglife-contrapedido-db`).
5. **Settings → Variables and Secrets**: nada (sem auth, sem chaves).
6. **Save and Deploy**. Anota a URL (formato `https://loglife-contrapedido.<seu-subdominio>.workers.dev`).
7. (Opcional) **Settings → Triggers → Cron Triggers**: não precisa pra esse caso.

### 2. Apontar a UI pro Worker

Abre `public/api.js` e troca o placeholder:

```js
// antes:
const CP_WORKER_URL = 'https://CP_WORKER_URL';
// depois (exemplo):
const CP_WORKER_URL = 'https://loglife-contrapedido.seu-user.workers.dev';
```

Sem barra no final.

### 3. Subir pro GitHub

```bash
git add .
git commit -m "v2.0: migração para Worker CP + D1"
git push origin main
```

### 4. Ligar o GitHub Pages

1. GitHub → repo → **Settings** → **Pages**.
2. **Source**: `Deploy from a branch`.
3. **Branch**: `main`, **Folder**: `/ (root)`. (Não `/public` — porque a UI já espera os arquivos na raiz do site.)
4. Save. Espera 1-2 minutos.

A URL pública vai ser tipo:
```
https://so-tha.github.io/Automation-ContraPedido/
```

> ⚠️ O `index.html` precisa ficar **na raiz do site** (que é o mesmo que a raiz do repo, no nosso caso). Se você moveu os arquivos pra `public/`, ajusta o folder nas Pages pra `/public` e o site vai estar em `https://so-tha.github.io/Automation-ContraPedido/`.

---

## Endpoints do Worker CP

| Método | Path | O que faz |
|---|---|---|
| `GET` | `/cp/registros` | Lista todos os contra pedidos, agrupados por dia da semana |
| `POST` | `/cp/registros` | Cria um novo contra pedido |
| `PATCH` | `/cp/registros/:id/status` | Altera status (pendente/coletado/cancelado) |
| `PUT` | `/cp/registros/:id` | Edita campos parciais |
| `DELETE` | `/cp/registros/:id` | Remove |
| `GET` | `/cp/registros/filtro?dataInicio&dataFim&rota` | Filtro por data/rota |
| `GET` | `/cp/dia-semana/:data` | Badge "seg/ter/qua/qui/sex" enquanto digita a data |
| `GET` | `/cp/clientes?q=` | Lista/busca clientes da base |
| `POST` | `/cp/clientes` | Adiciona cliente |
| `PUT` | `/cp/clientes/:id` | Edita cliente |
| `DELETE` | `/cp/clientes/:id` | Remove cliente |
| `GET` | `/cp/clientes/buscar/:codigo` | Busca exata por código Pardini |
| `GET` | `/cp/clientes/sigla/:sigla` | Busca por parte da sigla |
| `GET` | `/cp/export` | Dump JSON de tudo (registros + clientes) |
| `GET` | `/cp/excel` | Gera `.xlsx` com 5 abas (SEGUNDA–SEXTA) |

**Auth**: nenhuma. O Worker é público (mesmo padrão do Worker principal do LogLife). Se quiser trancar depois, é só adicionar `x-api-key` no Worker + em `api.js`.

---

## Rodar localmente

```bash
npm start
# ou direto:
npx http-server public -p 8080
```

Abre `http://localhost:8080`. As chamadas vão pro Worker CP real (não tem mock local).

> Pra apontar pra um Worker local de dev, é só trocar `CP_WORKER_URL` em `public/api.js`.

---

## Unificar com o Worker principal (depois)

A ideia é: depois que esse Worker CP estiver estável, copiar as rotas `/cp/*` pra dentro do `Worker.txt` principal (em `APLICATIVO OK/Worker.txt`), bindar o D1 lá, desligar o Worker CP e trocar `CP_WORKER_URL` pra URL do Worker principal. Zero mudança no frontend.

O código do Worker CP foi escrito de forma modular justamente pra facilitar essa mescla (helpers no topo, handlers no `fetch` no final, mesmo padrão de `garantirTabelas` que o Worker principal já usa).

---

## Migração inicial (opcional)

Se você tem dados no antigo `cp.json` e/ou `base.csv`, dá pra popular o D1 com um one-shot. Coloca os arquivos de novo só pra leitura:

```bash
node -e "
const fs = require('fs');
const cp = JSON.parse(fs.readFileSync('cp.json'));
const WORKER = 'https://loglife-contrapedido.seu-user.workers.dev';
(async () => {
  for (const r of cp) {
    await fetch(WORKER + '/cp/registros', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(r)
    });
  }
  // (mesma coisa pro base.csv, com /cp/clientes)
})();
"
```

(Esse script fica fora do repo porque é uso único.)

---

## Verificação end-to-end

1. `curl https://<CP_WORKER_URL>/cp/registros` → `{"SEGUNDA":[],"TERCA":[],...}`
2. Abre o site no navegador. Adiciona um contra pedido. Recarrega — continua lá.
3. Em outra aba, abre `base.html`, cadastra um cliente. Volta no `index.html`, busca pelo código — tem que aparecer.
4. Clica "Baixar Excel" — abre o `.xlsx` no LibreOffice/Excel com 5 abas.
5. Clica "Exportar JSON" — vem um JSON com `cpRegistros` e `cpClientes`.

---

## Limites

- **D1 free tier**: 5M reads/dia, 100k writes/dia. Sobra.
- **GitHub Pages** só serve estático — a página é SPA (single-page app) com 2 rotas (`index.html`, `base.html`).
- **Sem auth**: o Worker é público. Se for produção com dados sensíveis, adicionar API key depois.
