// Gateway sederhana (reverse proxy) di depan product-service dan order-service.
// Catatan: JANGAN pasang express.json() sebelum middleware proxy, karena body request
// akan terbaca habis dan POST lewat gateway menggantung.
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const PRODUCT_TARGET = process.env.PRODUCT_TARGET || 'http://localhost:3000';
const ORDER_TARGET = process.env.ORDER_TARGET || 'http://localhost:3001';

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

app.get('/', (req, res) => res.json({ gateway: 'ok', routes: ['/product-service/*', '/order-service/*'] }));

app.listen(process.env.PORT || 8080, () => console.log('gateway di :8080'));
