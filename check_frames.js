const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
(async () => {
  const SQL = await initSqlJs();
  const dbPath = path.join(process.env.APPDATA, 'video-sifter', 'video-sifter.db');
  const db = new SQL.Database(fs.readFileSync(dbPath));
  const r = db.exec('SELECT id, file_name, proxy_path FROM videos WHERE is_deleted=0 ORDER BY file_name');
  r[0].values.forEach(v => {
    const [id, name, proxy] = v;
    const exists = proxy ? fs.existsSync(proxy) : false;
    console.log((name||'').padEnd(38), 'proxy:', proxy ? (exists ? 'exists' : 'MISSING') : 'none');
  });
  db.close();
})();
