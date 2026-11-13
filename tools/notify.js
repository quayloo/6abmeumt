// Gửi nhắc nhở đẩy qua ntfy.sh — chạy bởi GitHub Actions (.github/workflows/nhac-nho.yml) mỗi ~20 phút.
// Đọc SCHED, DEADLINES, EXAM, NOTI, NTFY_TOPIC và hàm alertsFrom() ngay trong index.html → một nguồn dữ liệu duy nhất.
// Chạy tay:  node tools/notify.js            (gửi các nhắc đã đến giờ, chưa gửi)
//            node tools/notify.js --test     (gửi 1 thông báo thử)
//            node tools/notify.js --list     (in lịch nhắc 14 ngày tới, không gửi)
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const grab = name => { const m = html.match(new RegExp('const ' + name + '=([\\s\\S]*?);\\n')); if (!m) throw new Error('Không thấy ' + name); return Function('return ' + m[1])(); };
const code = html.slice(html.indexOf('/* ALERTS-START'), html.indexOf('/* ALERTS-END */'));
const { LV, alertsFrom } = Function(code + '\nreturn {LV, alertsFrom};')();
const short = {}; for (const m of html.matchAll(/\n (\w+):\{name:'([^']+)',short:'([^']+)'/g)) short[m[1]] = m[3];
const TOPIC = (html.match(/NTFY_TOPIC='([^']+)'/) || [])[1], SERVER = 'https://ntfy.sh';
const HOME = 'https://quayloo.github.io/6abmeumt/';
const A = alertsFrom({ SCHED: grab('SCHED'), DEADLINES: grab('DEADLINES'), EXAM: grab('EXAM'), NOTI: grab('NOTI'), short });
const now = Date.now(), WINDOW = 3 * 3600e3;   // nhắc trễ tối đa 3 giờ (GitHub có thể chạy chậm)
const vnStr = t => new Date(t + 7 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
const send = a => fetch(SERVER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
  topic: TOPIC, title: `${LV[a.lv].n} · ${a.title}`, message: a.msg, priority: LV[a.lv].p, tags: [LV[a.lv].tag],
  click: `${HOME}?n=${a.id}#${short[a.s] ? a.s + '-road' : 'home'}` }) }).then(r => { if (!r.ok) throw new Error('ntfy ' + r.status); });
(async () => {
  const arg = process.argv[2];
  if (arg === '--list') { A.filter(a => a.at > now && a.at < now + 14 * 864e5).forEach(a => console.log(vnStr(a.at), LV[a.lv].n.padEnd(10), a.title)); return; }
  if (arg === '--test') { await send({ id: 'test', lv: 2, s: 'home', title: 'Thông báo thử', msg: 'Sổ tay EMBA đã kết nối được với điện thoại. Mức Khẩn sẽ kêu và rung mạnh hơn.' }); console.log('Đã gửi thử'); return; }
  const due = A.filter(a => a.at <= now && a.at > now - WINDOW);
  if (!due.length) { console.log('Không có nhắc nào đến giờ.'); return; }
  // Chống gửi trùng: đọc tin đã gửi trong 12 giờ qua trên kênh (ntfy.sh lưu 12 giờ), so mã nhắc trong đường dẫn click
  const sent = new Set(); try { const t = await fetch(`${SERVER}/${TOPIC}/json?poll=1&since=12h`).then(r => r.text());
    t.split('\n').filter(Boolean).forEach(l => { try { const m = JSON.parse(l); const id = (String(m.click || '').match(/[?&]n=([a-z0-9]+)/) || [])[1]; if (id) sent.add(id); } catch (e) {} }); } catch (e) { console.log('Không đọc được lịch sử kênh:', e.message); }
  for (const a of due) { if (sent.has(a.id)) { console.log('Đã gửi trước đó:', a.title); continue; } await send(a); console.log('Đã gửi:', vnStr(a.at), LV[a.lv].n, a.title); }
})().catch(e => { console.error(e); process.exit(1); });
