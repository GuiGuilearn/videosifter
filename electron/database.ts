import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

let db: SqlJsDatabase | null = null
let initialized = false

export async function initDatabase(): Promise<void> {
  if (initialized) return

  // Pass locateFile so sql.js can find the .wasm binary at runtime
  const SQL = await initSqlJs({
    locateFile: (file: string) => {
      // In the built main.js, __dirname = dist-electron/
      // The wasm is at node_modules/sql.js/dist/
      const wasmPath = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file)
      if (fs.existsSync(wasmPath)) return wasmPath
      // Fallback for production builds: try alongside the main.js
      return path.join(__dirname, file)
    }
  })
  const dbPath = path.join(app.getPath('userData'), 'video-sifter.db')

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      folder_path TEXT NOT NULL,
      file_size INTEGER,
      duration REAL,
      width INTEGER,
      height INTEGER,
      codec TEXT,
      frame_rate REAL,
      bit_rate INTEGER,
      audio_codec TEXT,
      audio_sample_rate INTEGER,
      audio_channels INTEGER,
      created_at TEXT,
      thumbnail_path TEXT,
      star_rating INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#e8f5e9',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS video_tags (
      video_id TEXT NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (video_id, tag_id),
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_video_folder ON videos(folder_path);
    CREATE INDEX IF NOT EXISTS idx_video_star ON videos(star_rating);
    CREATE INDEX IF NOT EXISTS idx_video_deleted ON videos(is_deleted);
  `)

  // 迁移：添加多帧缩略图列（如果还不存在）
  try { db.run("ALTER TABLE videos ADD COLUMN thumb_frame_count INTEGER DEFAULT 0") } catch {}
  try { db.run("ALTER TABLE videos ADD COLUMN thumb_base_path TEXT") } catch {}
  try { db.run("ALTER TABLE videos ADD COLUMN proxy_path TEXT") } catch {}

  saveDatabase()
  initialized = true
}

function saveDatabase(): void {
  if (!db) return
  const dbPath = path.join(app.getPath('userData'), 'video-sifter.db')
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(dbPath, buffer)
}

function ensureDb(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function queryAll(sql: string, params: any[] = []): any[] {
  const d = ensureDb()
  const stmt = d.prepare(sql)
  if (params.length > 0) stmt.bind(params)
  const results: any[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results
}

export function queryOne(sql: string, params: any[] = []): any | null {
  const results = queryAll(sql, params)
  return results.length > 0 ? results[0] : null
}

export function execute(sql: string, params: any[] = []): void {
  const d = ensureDb()
  if (params.length > 0) {
    d.run(sql, params)
  } else {
    d.run(sql)
  }
  saveDatabase()
}

function executeTransaction(fn: () => void): void {
  const d = ensureDb()
  d.run('BEGIN')
  try {
    fn()
    d.run('COMMIT')
  } catch (e) {
    try { d.run('ROLLBACK') } catch {}
    throw e
  }
  saveDatabase()
}

export function getDatabase() { return db }

export function closeDatabase(): void {
  if (db) {
    saveDatabase()
    db.close()
    db = null
    initialized = false
  }
}

export function upsertVideo(video: any): void {
  const existing = queryOne('SELECT id FROM videos WHERE file_path = ?', [video.filePath])
  if (existing) {
    execute(`
      UPDATE videos SET file_size=?, duration=?, width=?, height=?, codec=?,
        frame_rate=?, bit_rate=?, audio_codec=?, audio_sample_rate=?,
        audio_channels=?, thumbnail_path=?, thumb_frame_count=?, thumb_base_path=?,
        proxy_path=?, is_deleted=0, updated_at=datetime('now','localtime')
      WHERE id=?
    `, [video.fileSize, video.duration, video.width, video.height, video.codec,
        video.frameRate, video.bitRate, video.audioCodec, video.audioSampleRate,
        video.audioChannels, video.thumbnailPath, video.thumbFrameCount || 0, video.thumbBasePath || null,
        video.proxyPath || null,
        video.id])
  } else {
    execute(`
      INSERT INTO videos (id, file_path, file_name, folder_path, file_size, duration,
        width, height, codec, frame_rate, bit_rate, audio_codec, audio_sample_rate,
        audio_channels, created_at, thumbnail_path, thumb_frame_count, thumb_base_path,
        proxy_path,
        star_rating, is_deleted, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,datetime('now','localtime'))
    `, [video.id, video.filePath, video.fileName, video.folderPath, video.fileSize,
        video.duration, video.width, video.height, video.codec, video.frameRate,
        video.bitRate, video.audioCodec, video.audioSampleRate, video.audioChannels,
        video.createdAt, video.thumbnailPath, video.thumbFrameCount || 0, video.thumbBasePath || null,
        video.proxyPath || null])
  }
}

export function getVideos(filter: any = {}): any[] {
  let sql = `SELECT v.* FROM videos v`
  const conditions: string[] = []
  const params: any[] = []

  if (!filter.includeDeleted) conditions.push('v.is_deleted = 0')
  if (filter.folderPath) { conditions.push('v.folder_path = ?'); params.push(filter.folderPath) }
  if (filter.starRating !== undefined && filter.starRating > 0) { conditions.push('v.star_rating = ?'); params.push(filter.starRating) }
  if (filter.starMin !== undefined) { conditions.push('v.star_rating >= ?'); params.push(filter.starMin) }
  if (filter.starRating === 0) conditions.push('(v.star_rating = 0 OR v.star_rating IS NULL)')
  if (filter.searchText) {
    conditions.push('(v.file_name LIKE ? OR v.folder_path LIKE ?)')
    const pattern = `%${filter.searchText}%`
    params.push(pattern, pattern)
  }
  if (filter.tagIds && filter.tagIds.length > 0) {
    sql += ` INNER JOIN video_tags vt ON v.id = vt.video_id`
    conditions.push(`vt.tag_id IN (${filter.tagIds.map(() => '?').join(',')})`)
    params.push(...filter.tagIds)
  }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ')
  sql += ' ORDER BY v.folder_path, v.file_name'

  const rows = queryAll(sql, params)
  return rows.map((row: any) => ({
    id: row.id,
    filePath: row.file_path,
    fileName: row.file_name,
    folderPath: row.folder_path,
    fileSize: row.file_size,
    duration: row.duration,
    width: row.width,
    height: row.height,
    codec: row.codec,
    frameRate: row.frame_rate,
    bitRate: row.bit_rate,
    audioCodec: row.audio_codec,
    audioSampleRate: row.audio_sample_rate,
    audioChannels: row.audio_channels,
    createdAt: row.created_at,
    thumbnailPath: row.thumbnail_path,
    thumbFrameCount: row.thumb_frame_count || 0,
    thumbBasePath: row.thumb_base_path || '',
    proxyPath: row.proxy_path || '',
    starRating: row.star_rating,
    tags: queryAll('SELECT tag_id FROM video_tags WHERE video_id = ?', [row.id]).map((t: any) => t.tag_id),
    isDeleted: !!row.is_deleted,
  }))
}

export function getVideo(id: string): any | null {
  const row = queryOne('SELECT * FROM videos WHERE id = ?', [id])
  if (!row) return null
  const tags = queryAll('SELECT tag_id FROM video_tags WHERE video_id = ?', [id]).map((t: any) => t.tag_id)
  return {
    id: row.id,
    filePath: row.file_path,
    fileName: row.file_name,
    folderPath: row.folder_path,
    fileSize: row.file_size,
    duration: row.duration,
    width: row.width,
    height: row.height,
    codec: row.codec,
    frameRate: row.frame_rate,
    bitRate: row.bit_rate,
    audioCodec: row.audio_codec,
    audioSampleRate: row.audio_sample_rate,
    audioChannels: row.audio_channels,
    createdAt: row.created_at,
    thumbnailPath: row.thumbnail_path,
    thumbFrameCount: row.thumb_frame_count || 0,
    thumbBasePath: row.thumb_base_path || '',
    proxyPath: row.proxy_path || '',
    starRating: row.star_rating,
    tags,
    isDeleted: !!row.is_deleted,
  }
}

export function updateStarRating(videoId: string, rating: number): void {
  execute("UPDATE videos SET star_rating = ?, updated_at = datetime('now','localtime') WHERE id = ?", [rating, videoId])
}

export function updateVideoTags(videoId: string, tagIds: number[]): void {
  const d = ensureDb()
  d.run('BEGIN')
  try {
    d.run('DELETE FROM video_tags WHERE video_id = ?', [videoId])
    for (const tagId of tagIds) {
      d.run('INSERT OR IGNORE INTO video_tags (video_id, tag_id) VALUES (?, ?)', [videoId, tagId])
    }
    d.run('COMMIT')
  } catch (e) {
    try { d.run('ROLLBACK') } catch {}
    throw e
  }
  saveDatabase()
}

export function markVideoDeleted(videoId: string, deleted: boolean): void {
  execute("UPDATE videos SET is_deleted = ?, updated_at = datetime('now','localtime') WHERE id = ?", [deleted ? 1 : 0, videoId])
}

export function createTag(name: string, color: string = '#e8f5e9'): any {
  execute('INSERT INTO tags (name, color) VALUES (?, ?)', [name, color])
  const row = queryOne('SELECT * FROM tags WHERE name = ?', [name])
  return row ? { id: row.id, name: row.name, color: row.color, createdAt: row.created_at } : null
}

export function deleteTag(tagId: number): void {
  execute('DELETE FROM video_tags WHERE tag_id = ?', [tagId])
  execute('DELETE FROM tags WHERE id = ?', [tagId])
}

export function getAllTags(): any[] {
  return queryAll('SELECT * FROM tags ORDER BY name')
}

export function getFolderStructure(): { path: string; count: number }[] {
  const rows = queryAll("SELECT folder_path, COUNT(*) as count FROM videos WHERE is_deleted = 0 GROUP BY folder_path ORDER BY folder_path")
  return rows.map((r: any) => ({ path: r.folder_path, count: r.count }))
}

export function getVideoStats(): any {
  const row = queryOne(`
    SELECT COUNT(*) as total, COALESCE(SUM(file_size), 0) as totalSize,
      SUM(CASE WHEN star_rating > 0 THEN 1 ELSE 0 END) as ratedCount,
      SUM(CASE WHEN star_rating = 0 OR star_rating IS NULL THEN 1 ELSE 0 END) as unratedCount
    FROM videos WHERE is_deleted = 0
  `)
  return row || { total: 0, totalSize: 0, ratedCount: 0, unratedCount: 0 }
}

export function getAllIds(): string[] {
  return queryAll('SELECT id FROM videos').map((r: any) => r.id)
}

export function removeVideoRecord(videoId: string): void {
  executeTransaction(() => {
    execute('DELETE FROM video_tags WHERE video_id = ?', [videoId])
    execute('DELETE FROM videos WHERE id = ?', [videoId])
  })
}

export function removeOrphanedVideos(folderPath: string, existingPaths: string[]): void {
  const d = ensureDb()
  const rows = queryAll("SELECT id, file_path FROM videos WHERE folder_path LIKE ? AND is_deleted = 0", [folderPath + '%'])
  const toDelete = rows.filter(r => !existingPaths.includes(r.file_path)).map(r => r.id)
  if (toDelete.length === 0) return

  d.run('BEGIN')
  try {
    for (const id of toDelete) {
      d.run('DELETE FROM video_tags WHERE video_id = ?', [id])
      d.run('DELETE FROM videos WHERE id = ?', [id])
    }
    d.run('COMMIT')
    saveDatabase()
  } catch (e) {
    try { d.run('ROLLBACK') } catch {}
    throw e
  }
}
