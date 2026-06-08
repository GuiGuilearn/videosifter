import type { VideoInfo, Tag, ExportOptions, VideoFilter, ScanProgress } from './index'

export interface ElectronAPI {
  checkFfmpeg: () => Promise<boolean>
  scanFolder: (folderPath: string) => Promise<{ total: number; processed: number }>
  selectFolder: () => Promise<string | null>
  getVideos: (filter?: VideoFilter) => Promise<VideoInfo[]>
  getVideo: (id: string) => Promise<VideoInfo | null>
  updateRating: (videoId: string, rating: number) => Promise<boolean>
  updateTags: (videoId: string, tagIds: number[]) => Promise<boolean>
  createTag: (name: string, color?: string) => Promise<Tag>
  deleteTag: (tagId: number) => Promise<boolean>
  getAllTags: () => Promise<Tag[]>
  deleteVideo: (videoId: string, permanent: boolean) => Promise<boolean>
  renameVideo: (videoId: string, newName: string) => Promise<boolean>
  exportVideos: (options: ExportOptions) => Promise<{ success: string[]; failed: string[] }>
  openInFolder: (filePath: string) => Promise<boolean>
  getVideoStats: () => Promise<{ total: number; totalSize: number; ratedCount: number; unratedCount: number }>
  getFolderStructure: () => Promise<{ path: string; count: number }[]>
  onScanProgress: (callback: (progress: ScanProgress) => void) => () => void
  onFolderChanged: (callback: (folderPath: string) => void) => () => void
  stopWatchingFolder: (folderPath: string) => Promise<void>
  generateProxies: () => Promise<{ stopped: boolean }>
  stopProxies: () => Promise<boolean>
  onProxyProgress: (callback: (progress: { current: number; total: number; fileName: string; id: string }) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
