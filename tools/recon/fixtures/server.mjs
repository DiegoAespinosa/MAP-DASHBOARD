/**
 * Servidor de pruebas que imita una plataforma con login por cookie y una SPA
 * que carga indicadores via fetch JSON. Solo para verificar la herramienta de
 * reconocimiento; NO representa la estructura real del MAP.
 */
import http from 'node:http';

const USER = 'tester';
const PASS = 'secret123';
const SESSION_VALUE = 'fixture-session-token-abc123';

function loginPage(message = '') {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Acceso al sistema</title></head>
<body><h1>Iniciar sesion</h1>${message ? `<p role="alert">${message}</p>` : ''}
<form method="post" action="/login">
  <label for="u">Usuario</label> <input id="u" name="username" type="text" autocomplete="username">
  <label for="p">Contrasena</label> <input id="p" name="password" type="password" autocomplete="current-password">
  <button type="submit">Iniciar sesion</button>
</form></body></html>`;
}

function appPage() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Indicadores institucionales</title></head>
<body><h1>Indicadores</h1><a href="/Exportar/Datos">Descargar Datos</a><div id="app">Cargando...</div>
<script>
  fetch('/api/profile').then(r => r.json());
  fetch('/api/config').then(r => r.json());
  fetch('/api/indicators?page=1&pageSize=20').then(r => r.json()).then(d => {
    const rows = d.data.map(i => '<tr><td>' + i.codigo + '</td><td>' + i.nombre + '</td><td>' + i.puntuacion + '</td><td>' + i.fecha_limite + '</td><td>' + i.estado + '</td></tr>').join('');
    document.getElementById('app').innerHTML = '<table><thead><tr><th>Codigo</th><th>Indicador</th><th>Puntuacion</th><th>Fecha limite</th><th>Estado</th></tr></thead><tbody>' + rows + '</tbody></table><nav class="pagination"><a href="#" rel="next">Siguiente</a></nav>';
  });
</script></body></html>`;
}

function indicators() {
  const data = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    codigo: `IND-${String(i + 1).padStart(3, '0')}`,
    nombre: `Indicador de ejemplo ${i + 1}`,
    puntuacion: 50 + i,
    meta: 100,
    fecha_limite: `2026-1${i % 2}-15`,
    estado: i % 3 === 0 ? 'Completado' : 'Pendiente',
  }));
  return { data, page: 1, pageSize: 20, total: 47, totalPages: 3 };
}

function hasSession(req) {
  return (req.headers.cookie || '').includes(`sid=${SESSION_VALUE}`);
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

export function startFixture(port = 0) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/login') return send(res, 200, loginPage(), { 'content-type': 'text/html; charset=utf-8' });
    if (req.method === 'POST' && url.pathname === '/login') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const form = new URLSearchParams(raw);
        if (form.get('username') === USER && form.get('password') === PASS) {
          return send(res, 302, '', { location: '/', 'set-cookie': `sid=${SESSION_VALUE}; HttpOnly; Path=/; SameSite=Lax` });
        }
        return send(res, 401, loginPage('Credenciales invalidas'), { 'content-type': 'text/html; charset=utf-8' });
      });
      return;
    }
    if (!hasSession(req)) {
      if (url.pathname.startsWith('/api/')) return send(res, 401, JSON.stringify({ error: 'unauthorized' }), { 'content-type': 'application/json' });
      return send(res, 302, '', { location: '/login' });
    }
    if (url.pathname === '/') return send(res, 200, appPage(), { 'content-type': 'text/html; charset=utf-8' });
    if (url.pathname === '/api/indicators') return send(res, 200, JSON.stringify(indicators()), { 'content-type': 'application/json; charset=utf-8' });
    if (url.pathname === '/api/profile') {
      return send(res, 200, JSON.stringify({ id: 1, name: 'Tester', email: 'tester@example.org', token: 'profile-token-must-be-redacted' }), { 'content-type': 'application/json' });
    }
    if (url.pathname === '/Exportar/Datos') {
      const rows = indicators().data.map((i) => `<tr><td>${i.id}</td><td>${i.codigo}</td><td>${i.nombre}</td><td>${i.puntuacion}</td></tr>`).join('');
      return send(res, 200, `Fecha de descarga: hoy
<div><table border="1"><tr><th>ID</th><th>CODIGO</th><th>INDICADOR</th><th>VALOR_ACTUAL</th></tr>${rows}</table></div>`, { 'content-type': 'application/vnd.ms-excel', 'content-disposition': 'attachment; filename=Datos.xls' });
    }
    if (url.pathname === '/api/config') return send(res, 200, JSON.stringify({ locale: 'es', version: '1.0.0' }), { 'content-type': 'application/json' });
    return send(res, 404, 'not found', { 'content-type': 'text/plain' });
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/`, credentials: { USER, PASS, SESSION_VALUE } }));
  });
}

if (process.argv[1] && process.argv[1].endsWith('server.mjs')) {
  startFixture(Number(process.env.PORT) || 3999).then(({ url }) => console.log(`fixture en ${url} (usuario ${USER})`));
}
