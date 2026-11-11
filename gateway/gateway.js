const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const PRODUCT_TARGET = process.env.PRODUCT_TARGET || 'http://localhost:3000';
const ORDER_TARGET = process.env.ORDER_TARGET || 'http://localhost:3001';

const DOC_SOURCES = [
  { prefix: '/product-service', url: process.env.PRODUCT_DOC_URL || 'http://localhost:3000/openapi.json' },
  { prefix: '/order-service',   url: process.env.ORDER_DOC_URL   || 'http://localhost:3001/openapi.json' },
];

async function buildSpec() {
  const merged = {
    openapi: '3.0.3',
    info: { title: 'Toko API (via Gateway)', version: '1.0.0' },
    servers: [{ url: '/' }],
    paths: {},
    components: { schemas: {} },
  };
  for (const s of DOC_SOURCES) {
    try {
      const spec = await fetch(s.url, { signal: AbortSignal.timeout(2000) }).then(r => r.json());
      for (const [path, ops] of Object.entries(spec.paths || {})) merged.paths[s.prefix + path] = ops;
      Object.assign(merged.components.schemas, (spec.components || {}).schemas);
    } catch (e) {
      console.warn('dokumentasi gagal diambil dari', s.url);
    }
  }
  return merged;
}

app.get('/openapi.json', async (req, res) => res.json(await buildSpec()));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(null, { swaggerOptions: { url: '/openapi.json' } }));

const makeProxy = (prefix, target, name) => createProxyMiddleware({
  pathFilter: prefix,
  target,
  changeOrigin: true,
  pathRewrite: { ['^' + prefix]: '' },
  on: {
    error: (err, req, res) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: name + ' tidak dapat dihubungi dari gateway' }));
    },
  },
});

app.use(makeProxy('/product-service', PRODUCT_TARGET, 'product-service'));
app.use(makeProxy('/order-service', ORDER_TARGET, 'order-service'));

app.get('/', (req, res) => res.json({ gateway: 'ok', docs: '/docs', routes: ['/product-service/*', '/order-service/*'] }));

app.listen(process.env.PORT || 8080, () => console.log('gateway di :' + (process.env.PORT || 8080)));
