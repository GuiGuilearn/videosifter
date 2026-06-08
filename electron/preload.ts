import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../src/types'

const electronAPI = {
  checkFfmpeg: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.CHECK_FFMPEG),

  scanFolder: (folderPath: string): Promise<{ total: number; processed: number }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SCAN_FOLDER, folderPath),

  selectFolder: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.SELECT_FOLDER),

  getVideos: (filter?: unknown): Promise<unknown[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_VIDEOS, filter),

  getVideo: (id: string): Promise<unknown | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_VIDEO, id),

  updateRating: (videoId: string, rating: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_RATING, videoId, rating),

  updateTags: (videoId: string, tagIds: number[]): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_TAGS, videoId, tagIds),

  createTag: (name: string, color?: string): Promise<unknown> =>
    ipcRenderer.invoke(IPC_CHANNELS.CREATE_TAG, name, color),

  deleteTag: (tagId: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_TAG, tagId),

  getAllTags: (): Promise<unknown[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_ALL_TAGS),

  deleteVideo: (videoId: string, permanent: boolean): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_VIDEO, videoId, permanent),

  renameVideo: (videoId: string, newName: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.RENAME_VIDEO, videoId, newName),

  exportVideos: (options: unknown): Promise<{ success: string[]; failed: string[] }> =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_VIDEOS, options),

  openInFolder: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_IN_FOLDER, filePath),

  getVideoStats: (): Promise<unknown> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_VIDEO_STATS),

  getFolderStructure: (): Promise<unknown[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_FOLDER_STRUCTURE),

  onScanProgress: (
    callback: (progress: { current: number; total: number; fileName: string }) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: { current: number; total: number; fileName: string },
    ) => callback(progress)
    ipcRenderer.on(IPC_CHANNELS.SCAN_PROGRESS, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.SCAN_PROGRESS, handler)
    }
  },

  onFolderChanged: (
    callback: (folderPath: string) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      folderPath: string,
    ) => callback(folderPath)
    ipcRenderer.on(IPC_CHANNELS.FOLDER_CHANGED, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.FOLDER_CHANGED, handler)
    }
  },

  stopWatchingFolder: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.FOLDER_CHANGED, 'stop', folderPath),

  generateProxies: (): Promise<{ stopped: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.GENERATE_PROXIES),

  stopProxies: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.STOP_PROXIES),

  onProxyProgress: (
    callback: (progress: { current: number; total: number; fileName: string; id: string }) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: { current: number; total: number; fileName: string; id: string },
    ) => callback(progress)
    ipcRenderer.on(IPC_CHANNELS.PROXY_PROGRESS, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PROXY_PROGRESS, handler)
    }
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
