# Toko: Microservices dengan Dokumentasi API Otomatis (OpenAPI/Swagger)

Sistem toko sederhana yang terdiri dari product-service, order-service, dan gateway. Tiap service menghasilkan spesifikasi OpenAPI dari anotasi pada kodenya, lalu gateway menggabungkannya menjadi satu halaman Swagger UI. Event `order.created` dikirim ke RabbitMQ (opsional).

## Struktur
- `monolith/` : aplikasi awal satu proses (port 3000, jangan dijalankan bersamaan dengan product-service)
- `product-service/` : data produk dan stok (port 3000), dokumentasi di `:3000/docs`
- `order-service/` : pembuatan dan daftar pesanan (port 3001), dokumentasi di `:3001/docs`
- `gateway/` : reverse proxy dan dokumentasi gabungan (port 8080)
- `notification-service/` : consumer RabbitMQ untuk event `order.created` (opsional)
- `openapi.json` : spesifikasi gabungan hasil gateway
- `smoke-test.js` : uji end-to-end lewat gateway

## Persiapan (Node.js minimal 18)
```
cd product-service && npm install && cd ..
cd order-service && npm install && cd ..
cd gateway && npm install && cd ..
cd notification-service && npm install && cd ..
```

## Menjalankan (tiga terminal, urutan ini)
```
cd product-service && node product-service.js   # :3000
cd order-service   && node order-service.js     # :3001
cd gateway         && node gateway.js           # :8080
```
Uji cepat: `node smoke-test.js` dari akar repository.

Jika RabbitMQ tidak dijalankan, order-service hanya menampilkan peringatan di log dan tetap berfungsi.

## Dokumentasi API
- Gabungan (utama): http://localhost:8080/docs
- Spesifikasi gabungan: http://localhost:8080/openapi.json
- Per service: http://localhost:3000/docs dan http://localhost:3001/docs

## Variabel environment
| Variabel | Dipakai oleh | Bawaan |
|---|---|---|
| `PORT` | semua service | 3000 / 3001 / 8080 |
| `PRODUCT_SERVICE_URL` | order-service | http://localhost:3000 |
| `AMQP_URL` | order-service, notification-service | amqp://localhost |
| `PRODUCT_TARGET` | gateway (proxy) | http://localhost:3000 |
| `ORDER_TARGET` | gateway (proxy) | http://localhost:3001 |
| `PRODUCT_DOC_URL` | gateway (dokumentasi) | http://localhost:3000/openapi.json |
| `ORDER_DOC_URL` | gateway (dokumentasi) | http://localhost:3001/openapi.json |

## RabbitMQ (opsional)
```
docker run -d --name rabbit -p 5672:5672 -p 15672:15672 rabbitmq:3-management
cd notification-service && node notification-service.js
```
Jalankan notification-service sebelum order-service agar antrean sudah terikat.

## Memperbarui openapi.json
Dengan ketiga service menyala: `curl http://localhost:8080/openapi.json -o openapi.json`
