/**
 * Hands the APK to a phone on the same Wi-Fi. Serves exactly one file on the
 * local network and nothing else — no directory listing, no other paths.
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const APK = path.join(os.homedir(), 'Downloads', 'deadrun-1.0.0.apk');
const PORT = 8770;

if (!fs.existsSync(APK)) {
  console.error('No APK at ' + APK);
  process.exit(1);
}
const size = fs.statSync(APK).size;

const page =
  '<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">' +
  '<style>body{background:#05070A;color:#E6EDF1;font:16px/1.6 system-ui;' +
  'display:grid;place-content:center;min-height:100vh;margin:0;text-align:center;gap:18px}' +
  'a{background:#7CFF4F;color:#05070A;padding:16px 28px;border-radius:14px;' +
  'text-decoration:none;font-weight:700;letter-spacing:2px}p{color:#7B8A94;font-size:13px}</style>' +
  '<h1>DEADRUN 1.0.0</h1><a href="/deadrun-1.0.0.apk">DOWNLOAD APK</a>' +
  '<p>' + (size / 1024 / 1024).toFixed(1) + ' MB<br>Tap the file once it lands to install.</p>';

http
  .createServer((req, res) => {
    if (req.url === '/deadrun-1.0.0.apk') {
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': size,
        'Content-Disposition': 'attachment; filename="deadrun-1.0.0.apk"',
      });
      fs.createReadStream(APK).pipe(res);
      console.log('serving APK to ' + req.socket.remoteAddress);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page);
  })
  .listen(PORT, '0.0.0.0', () => {
    const nets = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(nets)) {
      for (const n of nets[name] || []) {
        if (n.family === 'IPv4' && !n.internal) ips.push({ name, ip: n.address });
      }
    }
    console.log('\nOpen one of these in the phone browser:\n');
    for (const { name, ip } of ips) console.log('   http://' + ip + ':' + PORT + '   (' + name + ')');
    console.log('\nCtrl+C here, or ask me, to stop it.\n');
  });
