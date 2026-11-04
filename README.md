# Toko: dari Monolit ke Dua Service, lalu Event lewat RabbitMQ

Proyek praktik Lab 09 (microservices sinkron lewat HTTP) dan Lab 10 (komunikasi asinkron lewat message queue).

## Struktur
- `monolith/` : aplikasi awal (satu proses, port 3000)
- `product-service/` : pemilik data produk dan stok (port 3000)
- `order-service/` : pemilik data pesanan, memanggil product-service lewat HTTP (port 3001)
- `gateway/` : API gateway (port 8080)
- `notification-service/` : consumer RabbitMQ untuk event `order.created` (Lab 10)
- `docs/arsitektur-lab10.png` : diagram arsitektur terbaru
- `smoke-test.js` : uji end-to-end lewat gateway

## Persiapan (Node.js minimal 18)
```
cd monolith && npm install && cd ..
cd product-service && npm install && cd ..
cd order-service && npm install && cd ..
cd gateway && npm install && cd ..
cd notification-service && npm install && cd ..
```

## Menjalankan monolit (langkah 01)
```
cd monolith && node monolith.js
```
Hentikan dengan Ctrl+C sebelum menjalankan product-service, karena keduanya memakai port 3000.

## Menjalankan versi dua service (langkah 03 sampai 05)
Buka empat terminal:
```
cd product-service && node product-service.js   # :3000
cd order-service   && node order-service.js     # :3001
cd gateway         && node gateway.js           # :8080
node smoke-test.js                              # dijalankan dari folder toko
```
Hasil yang diharapkan: jumlah produk 3, status order 201, stok produk 1 menjadi 8.

## Uji kegagalan (langkah 06)
1. Matikan product-service, lalu `POST /order-service/orders` dengan body `{"productId":1,"qty":2}`: hasilnya 503.
2. `GET /order-service/orders` tetap 200.
3. Nyalakan lagi product-service dan ulangi POST: hasilnya 201 (stok kembali ke data awal karena disimpan di memori).

## Catatan
Gateway memakai `http-proxy-middleware`. Jangan pasang `express.json()` sebelum middleware proxy, karena POST lewat gateway akan menggantung.

## Lab 10: komunikasi asinkron (RabbitMQ)
Arsitektur: `order-service` menerbitkan event `order.created` ke exchange `orders` (fanout); `notification-service` mengonsumsinya dari `notification-queue`. Diagram: `docs/arsitektur-lab10.png`.

```
docker run -d --name rabbit -p 5672:5672 -p 15672:15672 rabbitmq:3-management
# dashboard: http://localhost:15672  (guest / guest)
```
Urutan menjalankan (terminal terpisah): RabbitMQ, `notification-service` (consumer dulu agar antrean sudah terikat), `product-service`, `order-service`, `gateway`, lalu `node smoke-test.js`.

Alamat broker dibaca dari environment variable `AMQP_URL` (bawaan `amqp://localhost`). Jangan commit kredensial.

Opsi `notification-service.js`:
- `node notification-service.js` : antrean `notification-queue`
- `node notification-service.js audit-queue` : antrean lain, terikat ke exchange yang sama (pub/sub)
- `--crash` : proses mati setelah "kirim email" tetapi sebelum `ack` (uji pengiriman ulang)
- `--durable` : catatan messageId yang sudah diproses disimpan ke file `processed-<antrean>.json`, sehingga duplikat tetap terdeteksi setelah restart (di proyek nyata, ganti dengan tabel database)
