// Sinh lich-emba.ics từ SCHED, DEADLINES, EXAM trong index.html.
// Chạy: node tools/build-ics.js   (mỗi khi sửa lịch học, hạn nộp, ngày thi)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const grab = name => { const m = html.match(new RegExp('const ' + name + '=([\\s\\S]*?);\\n')); if (!m) throw new Error('Không thấy ' + name); return Function('return ' + m[1])(); };
const SCHED = grab('SCHED'), DEADLINES = grab('DEADLINES'), EXAM = grab('EXAM');
const SUBJ = {}; for (const m of html.matchAll(/\n (\w+):\{name:'([^']+)',short:'([^']+)'/g)) SUBJ[m[1]] = { name: m[2], short: m[3] };
const tag = s => SUBJ[s] ? SUBJ[s].short : 'KTƯD + QTCL';
const pad = n => String(n).padStart(2, '0');
// Giờ Việt Nam (UTC+7) → UTC
const utc = (d, hh, mm) => { const t = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), hh - 7, mm); const x = new Date(t); return `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}00Z`; };
const day = d => d.replace(/-/g, '');
const nextDay = d => { const x = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + 1)); return `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}`; };
const esc = t => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
function fold(line) { const b = Buffer.from(line, 'utf8'); if (b.length <= 74) return line; const out = []; let cur = '', len = 0;
  for (const ch of line) { const l = Buffer.byteLength(ch); if (len + l > (out.length ? 73 : 74)) { out.push(cur); cur = ''; len = 0; } cur += ch; len += l; } out.push(cur); return out.join('\r\n '); }
function timeOf(t) { // trả về [giờ bắt đầu, phút, giờ kết thúc, phút] hoặc null (cả ngày)
  if (/cả ngày/i.test(t)) return [7, 30, 17, 0];
  const m = t.match(/(\d{1,2})h(\d{2})?/); if (m) return [+m[1], +(m[2] || 0), 21, 0];
  if (/tối/i.test(t)) return [18, 0, 21, 0];
  if (/sáng/i.test(t)) return [7, 30, 11, 30];
  if (/chiều/i.test(t)) return [13, 30, 17, 0];
  return null; }
const stamp = utc(new Date().toISOString().slice(0, 10), 7, 0);
const ev = [];
const h = t => { let x = 5381; for (const c of String(t)) x = ((x * 33) ^ c.codePointAt(0)) >>> 0; return x.toString(36); };
SCHED.forEach(x => {
  const room = (x.t.match(/S\d{3}/) || [])[0] || (/online/i.test(x.t) ? 'Online' : '');
  const main = x.d === EXAM && x.s === 'both', isThi = /^Thi /.test(x.x);
  const summary = main ? `THI: ${tag(x.s)} (dự kiến)` : isThi ? `THI: ${x.x.replace(/^Thi (học phần )?/, '')}` : `${tag(x.s)}: ${x.x}`;
  const tm = main ? null : timeOf(x.t);
  const L = ['BEGIN:VEVENT', `UID:emba6xd-${x.d}-${x.s}-${h(x.x)}@quayloo.github.io`, `DTSTAMP:${stamp}`];
  if (tm) L.push(`DTSTART:${utc(x.d, tm[0], tm[1])}`, `DTEND:${utc(x.d, tm[2], tm[3])}`); else L.push(`DTSTART;VALUE=DATE:${day(x.d)}`, `DTEND;VALUE=DATE:${nextDay(x.d)}`);
  L.push(`SUMMARY:${esc(summary)}`, `DESCRIPTION:${esc((SUBJ[x.s] ? SUBJ[x.s].name : 'Cả hai môn') + ' · ' + x.t + ' · ' + x.x)}`);
  if (room) L.push(`LOCATION:${esc(room)}`);
  L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(summary)}`, `TRIGGER:${tm ? '-PT1H' : '-PT15H'}`, 'END:VALARM', 'END:VEVENT');
  ev.push(...L);
});
DEADLINES.filter(x => x.d !== EXAM && !/^Thi /.test(x.t)).forEach(x => {
  const summary = `Hạn: ${tag(x.s)} – ${x.t}`;
  ev.push('BEGIN:VEVENT', `UID:emba6xd-dl-${x.d}-${x.s}-${h(x.t)}@quayloo.github.io`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day(x.d)}`, `DTEND;VALUE=DATE:${nextDay(x.d)}`,
    `SUMMARY:${esc(summary)}`, `DESCRIPTION:${esc(x.x)}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(summary)}`, 'TRIGGER:-PT15H', 'END:VALARM', 'END:VEVENT');
});
const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sổ tay EMBA 6XD//VI', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:EMBA 6XD', 'X-WR-TIMEZONE:Asia/Ho_Chi_Minh', 'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H', ...ev, 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
fs.writeFileSync(path.join(root, 'lich-emba.ics'), out);
console.log('Đã ghi lich-emba.ics:', SCHED.length, 'buổi/ngày thi,', DEADLINES.filter(x => x.d !== EXAM && !/^Thi /.test(x.t)).length, 'hạn nộp');
