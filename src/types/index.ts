export interface VideoInfo {
  id: string
  filePath: string
  fileName: string
  folderPath: string
  fileSize: number
  duration: number
  width: number
  height: number
  codec: string
  frameRate: number
  bitRate: number
  audioCodec: string
  audioSampleRate: number
  audioChannels: number
  createdAt: string
  thumbnailPath: string
  thumbFrameCount: number
  thumbBasePath: string
  proxyPath: string
  starRating: number
  tags: number[]
  isDeleted: boolean
}

export interface Tag {
  id: number
  name: string
  color: string
  createdAt: string
}

export interface VideoFilter {
  starMin?: number
  starMax?: number
  starRating?: number
  includeUnrated?: boolean
  tagIds?: number[]
  folderPath?: string
  searchText?: string
}

export interface ExportOptions {
  sourceFolder: string
  outputPath: string
  videoIds: string[]
  operation: 'copy' | 'move'
  organizeBy: 'star' | 'tag' | 'flat'
}

export interface ScanProgress {
  current: number
  total: number
  fileName: string
}

export interface DeleteOptions {
  videoIds: string[]
  permanent: boolean
}

export const IPC_CHANNELS = {
  SCAN_FOLDER: 'scan-folder',
  SELECT_FOLDER: 'select-folder',
  FOLDER_CHANGED: 'folder-changed',
  GET_VIDEOS: 'get-videos',
  GET_VIDEO: 'get-video',
  UPDATE_RATING: 'update-rating',
  UPDATE_TAGS: 'update-tags',
  CREATE_TAG: 'create-tag',
  DELETE_TAG: 'delete-tag',
  DELETE_VIDEO: 'delete-video',
  RENAME_VIDEO: 'rename-video',
  EXPORT_VIDEOS: 'export-videos',
  OPEN_IN_FOLDER: 'open-in-folder',
  GET_VIDEO_STATS: 'get-video-stats',
  GET_ALL_TAGS: 'get-all-tags',
  GET_FOLDER_STRUCTURE: 'get-folder-structure',
  SCAN_PROGRESS: 'scan-progress',
  CHECK_FFMPEG: 'check-ffmpeg',
  GENERATE_PROXIES: 'generate-proxies',
  STOP_PROXIES: 'stop-proxies',
  PROXY_PROGRESS: 'proxy-progress',
} as const
