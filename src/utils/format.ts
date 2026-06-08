export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(i >= 2 ? 1 : 0)} ${units[i]}`
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatResolution(w: number, h: number): string {
  return `${w} × ${h}`
}

export function formatBitRate(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} Kbps`
  return `${bps} bps`
}

export function formatFrameRate(fps: number): string {
  return `${fps.toFixed(2)} fps`
}

export function formatStarRating(r: number): string {
  return '★'.repeat(r) + '☆'.repeat(5 - r)
}

export function generateId(filePath: string): string {
  let hash = 0
  for (let i = 0; i < filePath.length; i++) {
    hash = ((hash << 5) - hash) + filePath.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

export function formatAudioInfo(codec: string, sampleRate: number, channels: number): string {
  const chStr = channels === 1 ? '单声道' : channels === 2 ? '立体声' : `${channels}声道`
  return `${codec.toUpperCase()} ${(sampleRate / 1000).toFixed(0)}kHz ${chStr}`
}
