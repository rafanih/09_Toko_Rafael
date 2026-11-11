const amqp = require('amqplib');
const AMQP_URL = process.env.AMQP_URL || 'amqp://localhost';
const QUEUE = process.argv.slice(2).find(a => !a.startsWith('--')) || 'notification-queue';
const CRASH = process.argv.includes('--crash');
const DURABLE = process.argv.includes('--durable');
const STORE = `processed-${QUEUE}.json`;

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
  ch.prefetch(1);
  console.log(`[${QUEUE}] menunggu pesan...`);

  ch.consume(QUEUE, async (msg) => {
    if (!msg) return;
    let event;
    try { event = JSON.parse(msg.content.toString()); }
    catch { console.error('pesan rusak, dibuang'); return ch.nack(msg, false, false); }

    const id = msg.properties.messageId;
    if (processed.has(id)) { console.log('duplikat, dilewati:', id); return ch.ack(msg); }

    await new Promise(r => setTimeout(r, 1000));
    console.log(`[${QUEUE}] email terkirim: pesanan #${event.data.id} ${event.data.productName} x${event.data.qty}`);
    processed.add(id);

    if (CRASH) { console.log('crash sebelum ack!'); process.exit(1); }
    ch.ack(msg);
  });
}
main().catch(e => { console.error(e.message); process.exit(1); });
