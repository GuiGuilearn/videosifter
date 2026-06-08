import { ipcMain, app, dialog } from 'electron'
import { IPC_CHANNELS, ExportOptions } from '../src/types'
import * as database from './database'
import * as ffmpeg from './ffmpeg'
import * as filesystem from './file-system'
import { generateId } from '../src/utils/format'
import path from 'path'
import fs from 'fs'

// ── 文件夹监听 ──
const folderWatchers = new Map<string, { watcher: fs.FSWatcher; timer: NodeJS.Timeout | null }>()

function stopFolderWatcher(folderPath: string) {
  const entry = folderWatchers.get(folderPath)
  if (entry) {
    entry.watcher.close()
    if (entry.timer) clearTimeout(entry.timer)
    folderWatchers.delete(folderPath)
  }
}

function startFolderWatcher(folderPath: string, sender: Electron.WebContents) {
  // 先关闭旧的
  stopFolderWatcher(folderPath)

  try {
    const watcher = fs.watch(folderPath, { recursive: true }, async (eventType, filename) => {
      if (!filename) return
      const name = typeof filename === 'string' ? filename : filename.toString()
      // 只处理视频文件
      if (!filesystem.isVideoFile(name)) return

      // 防抖 2 秒
      const entry = folderWatchers.get(folderPath)
      if (entry && entry.timer) clearTimeout(entry.timer)

      const timer = setTimeout(async () => {
        try {
          console.log(`[watcher] ${folderPath} changed, auto-rescanning...`)
          const thumbnailDir = filesystem.getThumbnailCacheDir(app.getPath('userData'))
          const files = filesystem.scanDirectory(folderPath)
          const existingPaths: string[] = []

          for (const filePath of files) {
            const existing = database.queryOne('SELECT file_size, is_deleted, thumb_frame_count, id, file_name, folder_path, proxy_path, thumbnail_path FROM videos WHERE file_path = ?', [filePath])
            if (existing) {
              const stat = fs.statSync(filePath)
              if (stat && existing.file_size === stat.size) {
                existingPaths.push(filePath)
                if (existing.is_deleted === 1) {
                  database.execute("UPDATE videos SET is_deleted = 0, updated_at = datetime('now','localtime') WHERE file_path = ?", [filePath])
                }
                // 检查主缩略图是否存在，缺失则重新生成
                const origThumbPath = path.join(thumbnailDir, 'thumbnails', existing.id + '.jpg')
                if (!fs.existsSync(origThumbPath)) {
                  try {
                    console.log(`[scan] Regenerating main thumbnail for ${existing.file_name}`)
                    const thumbPath = await ffmpeg.generateThumbnail(filePath, thumbnailDir, existing.id)
                    database.execute("UPDATE videos SET thumbnail_path = ? WHERE id = ?", [thumbPath, existing.id])
                  } catch (err) {
                    console.error(`[scan] Main thumb failed for ${existing.file_name}:`, err)
                  }
                } else if (!existing.thumbnail_path || existing.thumbnail_path === '') {
                  // 文件存在但 DB 没记录 → 补上
                  database.execute("UPDATE videos SET thumbnail_path = ? WHERE id = ?", [origThumbPath, existing.id])
                }
                // 补充生成多帧缩略图
                const thumbDir = path.join(thumbnailDir, 'thumbnails', existing.id + '_frames')
                if (!existing.thumb_frame_count || !fs.existsSync(path.join(thumbDir, 'thumb_1.jpg'))) {
                  try {
                    const videoId = existing.id
                    console.log(`[scan] Generating timeline thumbnails for ${existing.file_name} (${videoId})`)
                    const frames = await ffmpeg.generateTimelineThumbnails(filePath, thumbnailDir, videoId, 10)
                    if (frames.length > 0) {
                      database.execute("UPDATE videos SET thumb_frame_count = ?, thumb_base_path = ? WHERE id = ?", [frames.length, path.dirname(frames[0]), videoId])
                      console.log(`[scan] Generated ${frames.length} frames for ${existing.file_name}`)
                    } else {
                      console.error(`[scan] generateTimelineThumbnails returned 0 frames for ${existing.file_name}`)
                    }
                  } catch (err) {
                    console.error(`[scan] Failed to generate timeline for ${existing.file_name}:`, err)
                  }
                }
                // 检查并补充代理文件（跳过，手动触发）
                if (false) {
                  try {
                    console.log(`[scan] Generating proxy for ${existing.file_name}`)
                    const proxyPath = await ffmpeg.generateProxy(filePath, thumbnailDir, existing.id)
                    if (proxyPath) database.execute("UPDATE videos SET proxy_path = ? WHERE id = ?", [proxyPath, existing.id])
                  } catch (err) {
                    console.error(`[scan] Proxy failed for ${existing.file_name}:`, err)
                  }
                }
                continue
              }
            }
            try {
              const fileName = path.basename(filePath)
              const folderPathDir = path.dirname(filePath)
              const metadata = await ffmpeg.getMetadata(filePath)
              const videoId = generateId(filePath)
              const stat = fs.statSync(filePath)
              const thumbnailPath = await ffmpeg.generateThumbnail(filePath, thumbnailDir, videoId)
              let thumbFrameCount = 0, thumbBasePath = ''
              try { const frames = await ffmpeg.generateTimelineThumbnails(filePath, thumbnailDir, videoId, 10); thumbFrameCount = frames.length; thumbBasePath = path.dirname(frames[0]) } catch {}
              let proxyPath = ''
              database.upsertVideo({
                id: videoId, filePath, fileName, folderPath: folderPathDir,
                fileSize: stat.size, duration: metadata.duration,
                width: metadata.width, height: metadata.height, codec: metadata.codec,
                frameRate: metadata.frameRate, bitRate: metadata.bitRate,
                audioCodec: metadata.audioCodec, audioSampleRate: metadata.audioSampleRate,
                audioChannels: metadata.audioChannels,
                createdAt: filesystem.getFileCreationDate(filePath), thumbnailPath,
                thumbFrameCount, thumbBasePath, proxyPath,
                starRating: 0, isDeleted: false,
              })
              existingPaths.push(filePath)
            } catch (err) {
              console.error(`[watcher] Failed to process:`, err)
            }
          }

          database.removeOrphanedVideos(folderPath, existingPaths)
          // 补全缺失帧（代理改为手动触发）
          try {
            const missing = database.queryAll("SELECT id, file_path, file_name FROM videos WHERE folder_path = ? AND (thumb_frame_count IS NULL OR thumb_frame_count = 0) AND is_deleted = 0", [folderPath])
            for (const m of missing) {
              if (!fs.existsSync(m.file_path)) continue
              const thumbDir = path.join(thumbnailDir, 'thumbnails', m.id + '_frames')
              if (!fs.existsSync(path.join(thumbDir, 'thumb_1.jpg'))) {
                console.log(`[watcher] Backfill frames for ${m.file_name}`)
                try {
                  const frames = await ffmpeg.generateTimelineThumbnails(m.file_path, thumbnailDir, m.id, 10)
                  if (frames.length > 0) database.execute("UPDATE videos SET thumb_frame_count = ?, thumb_base_path = ? WHERE id = ?", [frames.length, path.dirname(frames[0]), m.id])
                } catch (err) { console.error(`[watcher] Backfill failed for ${m.file_name}:`, err) }
              }
            }
          } catch (err) { console.error('[watcher] Backfill error:', err) }
          // 清理孤儿缓存
          try {
            const allIds = database.getAllIds()
            filesystem.cleanOrphanCache(app.getPath('userData'), allIds)
          } catch (err) { console.error('[watcher] Orphan cleanup error:', err) }
          // 通知渲染进程刷新
          sender.send(IPC_CHANNELS.FOLDER_CHANGED, folderPath)
        } catch (err) {
          console.error('[watcher] Auto-rescan failed:', err)
        }
      }, 2000)

      folderWatchers.set(folderPath, { watcher: entry?.watcher || watcher, timer })
    })

    folderWatchers.set(folderPath, { watcher, timer: null })
    console.log(`[watcher] Started watching: ${folderPath}`)
  } catch (err) {
    console.error(`[watcher] Failed to start watching ${folderPath}:`, err)
  }
}

export function registerIpcHandlers() {
  // ----------------------------------------------------------------
  // CHECK_FFMPEG
  // ----------------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.CHECK_FFMPEG, async () => {
    return ffmpeg.checkFfmpeg()
  })

  // ----------------------------------------------------------------
  // SELECT_FOLDER — 打开系统文件夹选择对话框
  // ----------------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择视频素材文件夹',
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // ----------------------------------------------------------------
  // SCAN_FOLDER — 扫描文件夹，提取视频元数据和缩略图
  // ----------------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.SCAN_FOLDER,
    async (event, folderPath: string) => {
      if (!fs.existsSync(folderPath)) {
        throw new Error(`Folder not found: ${folderPath}`)
      }

      const thumbnailDir = filesystem.getThumbnailCacheDir(
        app.getPath('userData'),
      )
      const files = filesystem.scanDirectory(folderPath)
      const total = files.length
      let processed = 0
      const existingPaths: string[] = []

      for (const filePath of files) {
        const fileName = path.basename(filePath)
        const folderPathDir = path.dirname(filePath)

        // 检查数据库中是否已存在同文件路径的记录
        const existing = database.queryOne('SELECT file_size, is_deleted, thumb_frame_count, id, proxy_path, thumbnail_path FROM videos WHERE file_path = ?', [filePath])

        if (existing) {
          const stat = fs.statSync(filePath)
          if (existing.file_size === stat.size) {
            existingPaths.push(filePath)
            // 如果之前被标记为已删除（从回收站还原），重置 is_deleted=0
            if (existing.is_deleted === 1) {
              database.execute('UPDATE videos SET is_deleted = 0, updated_at = datetime(\'now\',\'localtime\') WHERE file_path = ?', [filePath])
            }
            // 检查主缩略图是否存在，缺失则重新生成
            const origThumbPath = path.join(thumbnailDir, 'thumbnails', existing.id + '.jpg')
            if (!fs.existsSync(origThumbPath)) {
              try {
                console.log(`[scan] Regenerating main thumbnail for ${fileName}`)
                const thumbPath = await ffmpeg.generateThumbnail(filePath, thumbnailDir, existing.id)
                database.execute("UPDATE videos SET thumbnail_path = ? WHERE id = ?", [thumbPath, existing.id])
              } catch (err) {
                console.error(`[scan] Main thumb failed for ${fileName}:`, err)
              }
            } else if (!existing.thumbnail_path || existing.thumbnail_path === '') {
              database.execute("UPDATE videos SET thumbnail_path = ? WHERE id = ?", [origThumbPath, existing.id])
            }
            // 补充生成多帧缩略图
            const thumbDir = path.join(thumbnailDir, 'thumbnails', existing.id + '_frames')
            if (!existing.thumb_frame_count || !fs.existsSync(path.join(thumbDir, 'thumb_1.jpg'))) {
              try {
                const videoId = existing.id
                console.log(`[scan] Generating timeline thumbnails for ${fileName} (${videoId})`)
                const frames = await ffmpeg.generateTimelineThumbnails(filePath, thumbnailDir, videoId, 10)
                if (frames.length > 0) {
                  database.execute("UPDATE videos SET thumb_frame_count = ?, thumb_base_path = ? WHERE id = ?", [frames.length, path.dirname(frames[0]), videoId])
                  console.log(`[scan] Generated ${frames.length} frames for ${fileName}`)
                } else {
                  console.error(`[scan] generateTimelineThumbnails returned 0 frames for ${fileName}`)
                }
              } catch (err) {
                console.error(`[scan] Failed to generate timeline for ${fileName}:`, err)
              }
            }
            // 检查并补充代理文件（跳过，改为手动触发）
            if (false) {
              try {
                console.log(`[scan] Generating proxy for ${fileName}`)
                const proxyPath = await ffmpeg.generateProxy(filePath, thumbnailDir, existing.id)
                if (proxyPath) database.execute("UPDATE videos SET proxy_path = ? WHERE id = ?", [proxyPath, existing.id])
              } catch (err) {
                console.error(`[scan] Proxy failed for ${fileName}:`, err)
              }
            }
            processed++
            event.sender.send(IPC_CHANNELS.SCAN_PROGRESS, {
              current: processed,
              total,
              fileName,
            })
            continue
          }
        }

        try {
          const metadata = await ffmpeg.getMetadata(filePath)
          const videoId = generateId(filePath)
          const stat = fs.statSync(filePath)
          const thumbnailPath = await ffmpeg.generateThumbnail(
            filePath,
            thumbnailDir,
            videoId,
          )

          // 生成多帧缩略图用于鼠标划擦预览（10帧）
          let thumbFrameCount = 0
          let thumbBasePath = ''
          try {
            const frames = await ffmpeg.generateTimelineThumbnails(filePath, thumbnailDir, videoId, 10)
            thumbFrameCount = frames.length
            thumbBasePath = path.dirname(frames[0])
          } catch {}
          // 生成代理文件（跳过，改为手动触发）
          let proxyPath = ''

          database.upsertVideo({
            id: videoId,
            filePath,
            fileName,
            folderPath: folderPathDir,
            fileSize: stat.size,
            duration: metadata.duration,
            width: metadata.width,
            height: metadata.height,
            codec: metadata.codec,
            frameRate: metadata.frameRate,
            bitRate: metadata.bitRate,
            audioCodec: metadata.audioCodec,
            audioSampleRate: metadata.audioSampleRate,
            audioChannels: metadata.audioChannels,
            createdAt: filesystem.getFileCreationDate(filePath),
            thumbnailPath,
            thumbFrameCount,
            thumbBasePath,
            proxyPath,
            starRating: 0,
            isDeleted: false,
          })
          existingPaths.push(filePath)
          processed++
        } catch (err) {
          console.error(`Failed to process ${fileName}:`, err)
        }

        event.sender.send(IPC_CHANNELS.SCAN_PROGRESS, {
          current: processed,
          total,
          fileName,
        })
      }

      // 清理数据库中已不存在于磁盘的记录（重命名/删除的文件）
      database.removeOrphanedVideos(folderPath, existingPaths)

      // 补全缺失帧 + 代理——当前文件夹中缺失的视频
      try {
        const missing = database.queryAll("SELECT id, file_path, file_name FROM videos WHERE folder_path = ? AND (thumb_frame_count IS NULL OR thumb_frame_count = 0) AND is_deleted = 0", [folderPath])
        for (const m of missing) {
          if (!fs.existsSync(m.file_path)) continue
          const thumbDir = path.join(thumbnailDir, 'thumbnails', m.id + '_frames')
          if (!fs.existsSync(path.join(thumbDir, 'thumb_1.jpg'))) {
            console.log(`[scan] Backfill frames for ${m.file_name}`)
            try {
              const frames = await ffmpeg.generateTimelineThumbnails(m.file_path, thumbnailDir, m.id, 10)
              if (frames.length > 0) {
                database.execute("UPDATE videos SET thumb_frame_count = ?, thumb_base_path = ? WHERE id = ?", [frames.length, path.dirname(frames[0]), m.id])
              }
            } catch (err) {
              console.error(`[scan] Backfill frames failed for ${m.file_name}:`, err)
            }
          }
        }
      } catch (err) {
        console.error('[scan] Backfill error:', err)
      }

      // 设置文件系统监听，自动重新扫描
      startFolderWatcher(folderPath, event.sender)

      // 清理孤儿缓存（数据库中已不存在的视频留下的缩略图/代理）
      try {
        const allIds = database.getAllIds()
        filesystem.cleanOrphanCache(app.getPath('userData'), allIds)
      } catch (err) {
        console.error('[scan] Orphan cleanup error:', err)
      }

      return { total, processed }
    },
  )

  // ----------------------------------------------------------------
  // FOLDER_CHANGED — 停止监听
  // ----------------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.FOLDER_CHANGED, async (_event, action: string, targetPath: string) => {
    if (action === 'stop') {
      stopFolderWatcher(targetPath)
    }
  })

  // ----------------------------------------------------------------
  // GET_VIDEOS
  // ----------------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.GET_VIDEOS, async (_event, filter?) => {
    return database.getVideos(filter)
  })

  // ----------------------------------------------------------------
  // GET_VIDEO
  // ----------------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.GET_VIDEO, async (_event, id: string) => {
    return database.getVideo(id)
  })

  // ----------------------------------------------------------------
  // UPDATE_RATING
  // ----------------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.UPDATE_RATING,
    async (_event, videoId: string, rating: number) => {
      database.updateStarRating(videoId, rating)
      return true
    },
  )

  // ----------------------------------------------------------------
  // UPDATE_TAGS
  // ----------------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.UPDATE_TAGS,
    async (_event, videoId: string, tagIds: number[]) => {
      database.updateVideoTags(videoId, tagIds)
      return true
    },
  )

  // ----------------------------------------------------------------
  // CREATE_TAG
  // ----------------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.CREATE_TAG,
    async (_event, name: string, color?: string) => {
      return database.createTag(name, color)
    },
  )

  // ----------------------------------------------------------------
  // DELETE_TAG
  // ----------------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.DELETE_TAG, async (_event, tagId: number) => {
    database.deleteTag(tagId)
    return true
  })

  // ----------------------------------------------------------------
  // GET_ALL_TAGS
  // ----------------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.GET_ALL_TAGS, async () => {
    return database.getAllTags()
  })

  // ----------------------------------------------------------------
  // DELETE_VIDEO — permanent=true 永久删除；false 移入回收站
  // ----------------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.DELETE_VIDEO,
    async (_event, videoId: string, permanent: boolean) => {
      const video = database.getVideo(videoId)
      if (!video) return false

      if (permanent) {
        filesystem.permanentlyDeleteFile(video.filePath)
        database.removeVideoRecord(videoId)
      } else {
        const success = await filesystem.moveFileToTrash(video.filePath)
        if (success) {
          database.markVideoDeleted(videoId, true)
        } else {
          throw new Error('Failed to move file to trash')
        }
      }
      return true
    },
  )

  // ----------------------------------------------------------------
  // RENAME_VIDEO
  // ----------------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.RENAME_VIDEO,
    async (_event, videoId: string, newName: string) => {
      const video = database.getVideo(videoId)
      if (!video) return false

      const newPath = path.join(path.dirname(video.filePath), newName)
      const result = filesystem.renameFile(video.filePath, newPath)
      if (result) {
        database.execute("UPDATE videos SET file_path = ?, file_name = ?, updated_at = datetime('now','localtime') WHERE id = ?", [newPath, newName, videoId])
      }
      return result
    },
  )

  // ----------------------------------------------------------------
  // EXPORT_VIDEOS — 按星级/标签/扁平 导出视频文件
  // ----------------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_VIDEOS,
    async (_event, options: ExportOptions) => {
      const { videoIds, outputPath, operation, organizeBy } = options
      const success: string[] = []
      const failed: string[] = []

      for (const videoId of videoIds) {
        const video = database.getVideo(videoId)
        if (!video) {
          failed.push(videoId)
          continue
        }

        let subDir = ''
        if (organizeBy === 'star') {
          subDir = '★'.repeat(video.starRating)
          if (!subDir) subDir = '未评分'
        } else if (organizeBy === 'tag') {
          const allTags = database.getAllTags()
          const matched = allTags.filter((t) => video.tags.includes(t.id))
          subDir = matched.length > 0 ? matched[0].name : '未分类'
        }

        const destPath = path.join(outputPath, subDir, video.fileName)

        let result: boolean
        if (operation === 'copy') {
          result = filesystem.copyFile(video.filePath, destPath)
        } else {
          result = filesystem.moveFile(video.filePath, destPath)
        }

        if (result) {
          success.push(videoId)
        } else {
          failed.push(videoId)
        }
      }

      return { success, failed }
    },
  )

  // ----------------------------------------------------------------
  // OPEN_IN_FOLDER
  // ----------------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.OPEN_IN_FOLDER,
    async (_event, filePath: string) => {
      filesystem.openInFileExplorer(filePath)
      return true
    },
  )

  // ----------------------------------------------------------------
  // GET_VIDEO_STATS
  // ----------------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.GET_VIDEO_STATS, async () => {
    return database.getVideoStats()
  })

  // ----------------------------------------------------------------
  // GET_FOLDER_STRUCTURE
  // ----------------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.GET_FOLDER_STRUCTURE, async () => {
    return database.getFolderStructure()
  })

  // ----------------------------------------------------------------
  // GENERATE_PROXIES / STOP_PROXIES — 手动生成代理视频
  // ----------------------------------------------------------------
  let proxyAbort = false

  ipcMain.handle(IPC_CHANNELS.STOP_PROXIES, async () => {
    proxyAbort = true
    return true
  })

  ipcMain.handle(IPC_CHANNELS.GENERATE_PROXIES, async (event) => {
    proxyAbort = false
    const thumbnailDir = filesystem.getThumbnailCacheDir(app.getPath('userData'))
    const allVideos = database.getVideos({}) as any[]
    let done = 0
    const total = allVideos.length
    for (const v of allVideos) {
      if (proxyAbort) break
      if (!v.proxyPath || !fs.existsSync(v.proxyPath)) {
        if (!fs.existsSync(v.filePath)) continue
        done++
        try {
          const proxyPath = await ffmpeg.generateProxy(v.filePath, thumbnailDir, v.id)
          if (proxyPath) database.execute("UPDATE videos SET proxy_path = ? WHERE id = ?", [proxyPath, v.id])
          event.sender.send(IPC_CHANNELS.PROXY_PROGRESS, { current: done, total, fileName: v.fileName, id: v.id })
        } catch (err) {
          console.error(`[proxy] Failed for ${v.fileName}:`, err)
        }
      }
    }
    // 清理孤儿代理
    try {
      const allIds = database.getAllIds()
      filesystem.cleanOrphanCache(app.getPath('userData'), allIds)
    } catch (err) {
      console.error('[proxy] Orphan cleanup error:', err)
    }
    return { stopped: proxyAbort }
  })
}
