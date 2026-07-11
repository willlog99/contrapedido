// =====================================================================
// api.js — wrapper único de fetch pro Worker CP
// =====================================================================
// ⚠️  TROCAR pela URL real do Worker CP após o deploy no Cloudflare
//     (Settings → Workers → seu-worker → "*.workers.dev" URL).
//     Formato esperado: https://<nome>.<subdominio>.workers.dev
//     (sem barra no final)
const CP_WORKER_URL = 'https://CP_WORKER_URL';

async function call(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let r;
  try {
    r = await fetch(`${CP_WORKER_URL}${path}`, opts);
  } catch (e) {
    // Erro de rede (offline, DNS, CORS pré-flight bloqueado).
    const err = new Error(`Sem conexão com o servidor: ${e.message}`);
    err.status = 0;
    throw err;
  }

  // /cp/excel é binário — caso especial
  if (path === '/cp/excel') {
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      const err = new Error(txt || `HTTP ${r.status}`);
      err.status = r.status;
      throw err;
    }
    return r.blob();
  }

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || `HTTP ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return data;
}

window.api = {
  get:    (p)    => call('GET', p),
  post:   (p, b) => call('POST', p, b),
  put:    (p, b) => call('PUT', p, b),
  patch:  (p, b) => call('PATCH', p, b),
  delete: (p)    => call('DELETE', p),
};

window.CP_WORKER_URL = CP_WORKER_URL;
