// notification-service: consumer event "order.created" dari exchange "orders" (RabbitMQ).
// Pemakaian:
//   node notification-service.js                  -> antrean notification-queue
//   node notification-service.js audit-queue      -> antrean lain (pub/sub, langkah 06)
//   node notification-service.js --crash          -> mati sebelum ack (langkah 07)
//   node notification-service.js --durable        -> idempotensi tahan restart (bonus)
const amqp = require('amqplib');
const AMQP_URL = process.env.AMQP_URL || 'amqp://localhost';
const QUEUE = process.argv.slice(2).find(a => !a.startsWith('--')) || 'notification-queue';
const CRASH = process.argv.includes('--crash');   // dipakai di langkah 07
const DURABLE = process.argv.includes('--durable'); // opsional: simpan daftar "sudah diproses" ke file
const STORE = `processed-${QUEUE}.json`;

// Penyimpanan messageId yang sudah diproses.
// Default: memori (hilang saat proses mati, sesuai lab). --durable: file JSON (tahan restart).
// Di proyek nyata, ganti file ini dengan tabel database: PRIMARY KEY/UNIQUE(message_id).
function createStore() {
  const fs = require('fs');
  const set = new Set();
  if (DURABLE && fs.existsSync(STORE)) JSON.parse(fs.readFileSync(STORE, 'utf8')).forEach(i => set.add(i));
  return {
    has: id => set.has(id),
    add: id => { set.add(id); if (DURABLE) fs.writeFileSync(STORE, JSON.stringify([...set])); },
  };
}
const processed = createStore();

async function main() {
  const conn = await amqp.connect(AMQP_URL);
  const ch = await conn.createChannel();
  await ch.assertExchange('orders', 'fanout', { durable: true });
  await ch.assertQueue(QUEUE, { durable: true });
  await ch.bindQueue(QUEUE, 'orders', '');
  ch.prefetch(1);                                 // satu pesan per consumer pada satu waktu
  console.log(`[${QUEUE}] menunggu pesan...`);

  ch.consume(QUEUE, async (msg) => {
    if (!msg) return;
    let event;
    try { event = JSON.parse(msg.content.toString()); }
    catch { console.error('pesan rusak, dibuang'); return ch.nack(msg, false, false); }

    const id = msg.properties.messageId;
    if (processed.has(id)) { console.log('duplikat, dilewati:', id); return ch.ack(msg); }

    await new Promise(r => setTimeout(r, 1000)); // simulasi kirim email (1 detik)
    console.log(`[${QUEUE}] email terkirim: pesanan #${event.data.id} ${event.data.productName} x${event.data.qty}`);
    processed.add(id);

    if (CRASH) { console.log('crash sebelum ack!'); process.exit(1); }
    ch.ack(msg);                                  // beri tahu broker: selesai, boleh dihapus
  });
}
main().catch(e => { console.error(e.message); process.exit(1); });
