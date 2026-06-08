<template>
  <div class="app" tabindex="-1">
    <!-- Top bar -->
    <header class="topbar">
      <div class="topbar-left">
        <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path d="M8 5.5v13l10-6.5L8 5.5z"/></svg>
        <span class="path">{{ folderPath || '选择素材文件夹' }}</span>
      </div>
      <div class="topbar-right">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg>
          <input v-model="searchText" placeholder="搜索视频..." class="search-input" />
        </div>
        <button class="btn btn-ghost" @click="selectFolder">+ 添加文件夹</button>
      </div>
    </header>

    <div class="body">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-inner">
          <div class="sidebar-section">
            <div class="sidebar-label">星级筛选</div>
            <div v-for="s in starOptions" :key="s.value" class="filter-item" :class="{active: starFilter === s.value}" @click="starFilter = s.value">
              <span class="filter-label">{{ s.label }}</span>
              <span class="filter-count">{{ s.count }}</span>
            </div>
          </div>
          <div class="sidebar-section">
            <div class="sidebar-label-row">
              <span class="sidebar-label">标签筛选</span>
              <button class="btn-icon" @click="openNewTagModal" title="新建标签">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>
            <div class="filter-item" :class="{active: tagFilter === undefined}" @click="tagFilter = undefined">
              <span class="filter-label">全部</span>
              <span class="filter-count">{{ videos.length }}</span>
            </div>
            <div v-for="t in tags" :key="t.id" class="filter-item" :class="{active: tagFilter === t.id}" @click="tagFilter = t.id">
              <span class="tag-dot" :style="{background: t.color}"></span>
              <span class="filter-label">{{ t.name }}</span>
              <span class="filter-count">{{ tagCount(t.id) }}</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- Workspace -->
      <main class="main">
        <div class="toolbar">
          <div class="toolbar-left">
            <span class="toolbar-count">{{ filteredVideos.length }} 个视频</span>
            <span class="toolbar-hint">空格原画预览 · Ctrl+滚轮缩放</span>
          </div>
          <div class="toolbar-right">
            <span class="scale-label">{{ scaleSizes[scaleIndex] }}px</span>
            <label class="mode-toggle" :title="previewMode === 'video' ? '切换缩略图预览' : '切换视频预览'">
              <span class="mode-label" :class="{ active: previewMode === 'frames' }">缩略图</span>
              <div class="mode-switch" :class="{ on: previewMode === 'video' }" @click="togglePreviewMode">
                <div class="mode-knob"></div>
              </div>
              <span class="mode-label" :class="{ active: previewMode === 'video' }">视频</span>
            </label>
            <button class="btn btn-ghost btn-sm" @click="refreshFolder" :disabled="!folderPath" title="重新扫描">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>
            </button>
            <div class="proxy-group">
              <button class="btn btn-sm" :class="proxyGenerating ? 'btn-danger' : 'btn-ghost'" @click="toggleProxyGen" :disabled="!folderPath || filteredVideos.length === 0">
                <template v-if="proxyGenerating">
                  <span class="proxy-spinner"></span>
                  {{ proxyProgress }}
                </template>
                <template v-else>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  代理
                </template>
              </button>
              <div class="proxy-bar-wrap" v-if="proxyGenerating">
                <div class="proxy-bar" :style="{ width: proxyPercent + '%' }"></div>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" @click="openExport">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              导出
            </button>
          </div>
        </div>

        <div v-if="filteredVideos.length === 0" class="empty">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" width="48" height="48"><rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M8 5.5v13l10-6.5L8 5.5z"/></svg>
          </div>
          <p>还没有视频素材</p>
          <span class="empty-hint">点击右上角「+ 添加文件夹」开始导入</span>
        </div>

        <div v-else class="grid" :style="{ gridTemplateColumns: gridStyle }" @wheel.prevent="onGridWheel">
          <div
            v-for="v in filteredVideos"
            :key="v.id"
            class="card"
            :class="{ focused: focusedVideo?.id === v.id, 'has-proxy': !!v.proxyPath }"
            @click="onCardClick(v, $event)"
            @mouseenter="onCardEnter(v)"
            @mouseleave="onCardLeave(v)"
            @mousemove="onCardMove($event, v)"
          >
            <div class="thumb">
              <img :src="previewSrc(v)" class="thumb-img" />
              <template v-if="previewMode === 'video' && hoverVideoId === v.id && v.proxyPath">
                <video
                  :src="'local-file://' + v.proxyPath"
                  muted preload="auto" autoplay playsinline
                  class="thumb-video show"
                  @canplay="onVideoCanplay($event, v)"
                  @timeupdate="onVideoTimeUpdate($event, v)"
                ></video>
              </template>
              <span class="play-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M8 5.5v13l10-6.5L8 5.5z"/></svg>
              </span>
              <span class="duration-badge">{{ fmtDuration(v.duration) }}</span>
            </div>
            <div class="info">
              <div class="info-name" :title="v.fileName">{{ v.fileName }}</div>
              <div class="info-star-row">
                <div class="info-stars">
                  <span v-for="i in 5" :key="i" class="star" :class="{ on: i <= v.starRating }" @click.stop="setRating(v.id, i)">★</span>
                  <span v-if="v.starRating > 0" class="star-clear" @click.stop="setRating(v.id, 0)">✕</span>
                </div>
                <div class="info-actions">
                  <button class="action-btn action-trash" @click.stop="deleteVideo(v.id)" title="移入回收站">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="12" height="12"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                  <button class="action-btn" @click.stop="openInFolder(v.filePath)" title="在文件夹中定位">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="12" height="12"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                  </button>
                </div>
              </div>
              <div class="info-tags" v-if="tags.length > 0">
                <span v-for="t in tags" :key="t.id" class="info-tag"
                  :class="{ active: hasCardTag(v, t.id) }"
                  :style="hasCardTag(v, t.id) ? { borderColor: t.color, color: t.color } : {}"
                  @click.stop="toggleCardTag(v, t.id)">{{ t.name }}</span>
              </div>
              <div class="info-meta">
                <span class="meta-item"><span class="meta-l">分辨率</span>{{ v.width }}×{{ v.height }}</span>
                <span class="meta-item"><span class="meta-l">时长</span>{{ fmtDuration(v.duration) }}</span>
                <span class="meta-item"><span class="meta-l">大小</span>{{ fmtSize(v.fileSize) }}</span>
                <span class="meta-item"><span class="meta-l">编码</span>{{ v.codec }}</span>
                <span class="meta-item"><span class="meta-l">帧率</span>{{ fmtFps(v.frameRate) }}</span>
                <span class="meta-item"><span class="meta-l">比特率</span>{{ fmtBitrate(v.bitRate) }}</span>
                <span class="meta-item"><span class="meta-l">音频</span>{{ fmtAudio(v.audioCodec, v.audioSampleRate, v.audioChannels) }}</span>
                <span class="meta-item"><span class="meta-l">日期</span>{{ v.createdAt?.slice(0,10) }}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- QuickLook -->
    <div v-if="quicklookVideo" class="ql-overlay" @click.self="closeQuicklook">
      <div class="ql-window">
        <div class="ql-head">
          <span class="ql-title">{{ quicklookVideo.fileName }}</span>
          <button class="ql-close" @click="closeQuicklook">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <video :src="'local-file://' + quicklookVideo.filePath" controls autoplay class="ql-player"></video>
        <div class="ql-foot">
          <span>{{ quicklookVideo.width }}×{{ quicklookVideo.height }}</span>
          <span>{{ fmtDuration(quicklookVideo.duration) }}</span>
          <span>{{ fmtSize(quicklookVideo.fileSize) }}</span>
          <span class="ql-badge">原画</span>
        </div>
      </div>
    </div>

    <!-- New Tag Modal -->
    <div v-if="showNewTagModal" class="modal-overlay" @click.self="showNewTagModal = false">
      <div class="modal-box">
        <h3>新建标签</h3>
        <input v-model="newTagName" placeholder="标签名称" class="modal-input" @keyup.enter="createTag" />
        <div class="modal-colors">
          <span v-for="c in tagColors" :key="c" class="color-opt" :class="{active: newTagColor === c}" :style="{background: c}" @click="newTagColor = c"></span>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showNewTagModal = false">取消</button>
          <button class="btn btn-primary" @click="createTag" :disabled="!newTagName.trim()">创建</button>
        </div>
      </div>
    </div>

    <!-- Export Modal -->
    <div v-if="showExportModal" class="modal-overlay" @click.self="showExportModal = false">
      <div class="modal-box">
        <h3>导出筛选结果</h3>
        <div class="export-field">
          <label>导出路径</label>
          <div class="export-path-row">
            <input :value="exportPath" readonly placeholder="点击按钮选择" class="modal-input" style="margin-bottom:0;flex:1" />
            <button class="btn btn-ghost" @click="selectExportPath">选择</button>
          </div>
        </div>
        <div class="export-field">
          <label>组织方式</label>
          <div class="export-options">
            <label class="export-radio"><input type="radio" v-model="exportOrganizeBy" value="flat" /> 扁平</label>
            <label class="export-radio"><input type="radio" v-model="exportOrganizeBy" value="star" /> 按星级</label>
            <label class="export-radio"><input type="radio" v-model="exportOrganizeBy" value="tag" /> 按标签</label>
          </div>
        </div>
        <div class="export-field">
          <label>操作方式</label>
          <div class="export-options">
            <label class="export-radio"><input type="radio" v-model="exportOperation" value="copy" /> 复制</label>
            <label class="export-radio"><input type="radio" v-model="exportOperation" value="move" /> 移动</label>
          </div>
        </div>
        <p class="export-summary">将导出 <strong>{{ filteredVideos.length }}</strong> 个视频</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showExportModal = false">取消</button>
          <button class="btn btn-primary" @click="doExport" :disabled="!exportPath || exporting">{{ exporting ? '导出中...' : '开始导出' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { VideoInfo } from './types'

const videos = ref<VideoInfo[]>([])
const tags = ref<any[]>([])
const currentVideo = ref<VideoInfo | null>(null)
const folderPath = ref('')
const searchText = ref('')
const starFilter = ref<number | undefined>(undefined)
const tagFilter = ref<number | undefined>(undefined)

// ── 手动生成代理视频 ──
const proxyGenerating = ref(false)
const proxyProgress = ref('')
const proxyPercent = ref(0)
let proxyCleanup: (() => void) | null = null

async function toggleProxyGen() {
  if (proxyGenerating.value) {
    await window.electronAPI.stopProxies()
    proxyGenerating.value = false
    proxyProgress.value = ''
    if (proxyCleanup) { proxyCleanup(); proxyCleanup = null }
    return
  }
  proxyGenerating.value = true
  proxyProgress.value = '0%'
  proxyPercent.value = 0
  const total = filteredVideos.value.length
  proxyCleanup = window.electronAPI.onProxyProgress((p: any) => {
    const pct = total > 0 ? Math.round((p.current / p.total) * 100) : 0
    proxyProgress.value = `${Math.min(pct, 100)}%`
    proxyPercent.value = Math.min(pct, 100)
  })
  const result = await window.electronAPI.generateProxies()
  proxyGenerating.value = false
  if (result.stopped) {
    proxyProgress.value = '已暂停'
  } else {
    proxyProgress.value = '完成'
  }
  setTimeout(() => { proxyProgress.value = ''; proxyPercent.value = 0 }, 3000)
  if (proxyCleanup) { proxyCleanup(); proxyCleanup = null }
  loadVideos()
}

// ── 网格缩放（Ctrl+滚轮） ──
const scaleSizes = [120, 150, 180, 210, 240, 280, 320, 360]
const scaleIndex = ref(2)

const gridStyle = computed(() => `repeat(auto-fill, minmax(${scaleSizes[scaleIndex.value]}px, 1fr))`)

function onGridWheel(e: WheelEvent) {
  if (!e.ctrlKey) return
  const dir = e.deltaY > 0 ? -1 : 1
  scaleIndex.value = Math.max(0, Math.min(scaleSizes.length - 1, scaleIndex.value + dir))
  localStorage.setItem('videoSifter_gridScale', String(scaleIndex.value))
}

// ── 预览模式 ──
const previewMode = ref<'frames' | 'video'>('frames')
const frameIndex = ref(0)

function togglePreviewMode() {
  previewMode.value = previewMode.value === 'frames' ? 'video' : 'frames'
  localStorage.setItem('videoSifter_previewMode', previewMode.value)
}

// ── 悬停预览 ──
const hoverVideoId = ref<string | null>(null)
const activeVideo = ref<{ id: string; el: HTMLVideoElement; ready: boolean } | null>(null)
const pendingSeek = ref<Record<string, number>>({})

function isHovering(v: VideoInfo): boolean {
  return hoverVideoId.value === v.id
}

function previewSrc(v: VideoInfo): string {
  if (previewMode.value === 'frames' && isHovering(v) && v.thumbFrameCount > 0 && frameIndex.value > 0) {
    return 'local-file://' + v.thumbBasePath + '\\thumb_' + frameIndex.value + '.jpg'
  }
  return 'local-file://' + v.thumbnailPath
}

function onCardEnter(v: VideoInfo) {
  if (!v.filePath) return
  hoverVideoId.value = v.id
  frameIndex.value = 1
  delete pendingSeek.value[v.id]
}

function onCardLeave(v: VideoInfo) {
  if (hoverVideoId.value !== v.id) return
  destroyActiveVideo()
  hoverVideoId.value = null
  frameIndex.value = 0
}

function destroyActiveVideo() {
  if (!activeVideo.value) return
  delete pendingSeek.value[activeVideo.value.id]
  const el = activeVideo.value.el
  el.pause()
  el.removeAttribute('src')
  el.load()
  activeVideo.value = null
}

function onVideoCanplay(e: Event, v: VideoInfo) {
  const el = e.target as HTMLVideoElement
  if (activeVideo.value?.id === v.id && activeVideo.value.ready) {
    const p = pendingSeek.value[v.id]
    if (p !== undefined) { el.currentTime = p; delete pendingSeek.value[v.id] }
    return
  }
  activeVideo.value = { id: v.id, el, ready: true }
  const p = pendingSeek.value[v.id]
  if (p !== undefined) {
    el.currentTime = p
    delete pendingSeek.value[v.id]
  } else {
    el.currentTime = 0
  }
}

function onVideoTimeUpdate(e: Event, v: VideoInfo) {
  if (hoverVideoId.value !== v.id) {
    const el = e.target as HTMLVideoElement
    el.pause()
    el.removeAttribute('src')
    el.load()
  }
}

function onCardMove(e: MouseEvent, v: VideoInfo) {
  if (hoverVideoId.value !== v.id) return
  const thumb = (e.target as HTMLElement).closest('.thumb')
  if (!thumb) return
  const rect = thumb.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  if (previewMode.value === 'frames') {
    if (v.thumbFrameCount <= 0) return
    frameIndex.value = Math.max(1, Math.min(v.thumbFrameCount, Math.round(x * (v.thumbFrameCount - 1)) + 1))
  } else {
    if (!v.duration) return
    const t = x * v.duration
    if (activeVideo.value?.id === v.id) {
      activeVideo.value.el.currentTime = t
      if (activeVideo.value.el.paused) activeVideo.value.el.play().catch(() => {})
    } else {
      pendingSeek.value[v.id] = t
    }
  }
}

// ── 聚焦 / 空格预览 ──
const focusedVideo = ref<VideoInfo | null>(null)
const quicklookVideo = ref<VideoInfo | null>(null)

function onCardClick(v: VideoInfo, _event: MouseEvent) {
  focusedVideo.value = v
  selectVideo(v)
}

function openQuicklook(v: VideoInfo) {
  quicklookVideo.value = v
  currentVideo.value = v
}

function closeQuicklook() {
  quicklookVideo.value = null
  currentVideo.value = null
}

// ── 星级选项 ──
const starOptions = computed(() => {
  const counts: Record<string, number> = {}
  videos.value.forEach(v => { const k = String(v.starRating); counts[k] = (counts[k] || 0) + 1 })
  return [
    { value: undefined, label: '全部', count: videos.value.length },
    { value: 5, label: '★★★★★', count: counts['5'] || 0 },
    { value: 4, label: '★★★★☆', count: counts['4'] || 0 },
    { value: 3, label: '★★★☆☆', count: counts['3'] || 0 },
    { value: 2, label: '★★☆☆☆', count: counts['2'] || 0 },
    { value: 1, label: '★☆☆☆☆', count: counts['1'] || 0 },
    { value: 0, label: '未评分', count: (counts['0'] || 0) + (counts[''] ? 1 : 0) },
  ]
})

function tagCount(tagId: number): number { return videos.value.filter(v => v.tags && v.tags.includes(tagId)).length }
function tagName(tagId: number): string { const t = tags.value.find((x: any) => x.id === tagId); return t ? t.name : '' }
function tagColor(tagId: number): string { const t = tags.value.find((x: any) => x.id === tagId); return t ? t.color : '#999' }

const filteredVideos = computed(() => {
  let list = videos.value
  if (starFilter.value !== undefined) {
    if (starFilter.value === 0) list = list.filter(v => !v.starRating || v.starRating === 0)
    else list = list.filter(v => v.starRating === starFilter.value)
  }
  if (tagFilter.value !== undefined) list = list.filter(v => v.tags && v.tags.includes(tagFilter.value!))
  if (searchText.value) list = list.filter(v => v.fileName.toLowerCase().includes(searchText.value.toLowerCase()))
  return list
})

async function selectFolder() {
  const p = await window.electronAPI.selectFolder()
  if (!p?.trim()) return
  if (folderPath.value) window.electronAPI.stopWatchingFolder(folderPath.value)
  folderPath.value = p.trim()
  localStorage.setItem('videoSifter_lastFolder', p.trim())
  starFilter.value = undefined; tagFilter.value = undefined; searchText.value = ''; currentVideo.value = null; focusedVideo.value = null
  await window.electronAPI.scanFolder(p.trim())
  await loadVideos()
}

async function refreshFolder() {
  if (!folderPath.value) return
  currentVideo.value = null; focusedVideo.value = null
  await window.electronAPI.scanFolder(folderPath.value)
  await loadVideos()
}

async function loadVideos() {
  const filter: any = {}
  if (folderPath.value) filter.folderPath = folderPath.value
  videos.value = await window.electronAPI.getVideos(filter)
  tags.value = await window.electronAPI.getAllTags()
}

function selectVideo(v: VideoInfo) { currentVideo.value = v }

async function setRating(id: string, r: number) {
  const v = videos.value.find(x => x.id === id)
  if (v && v.starRating === r) r = 0
  await window.electronAPI.updateRating(id, r)
  if (v) v.starRating = r
  if (currentVideo.value?.id === id) currentVideo.value.starRating = r
}

async function deleteVideo(id: string) {
  if (!confirm('确定移入回收站？')) return
  try {
    await window.electronAPI.deleteVideo(id, false)
    currentVideo.value = null; focusedVideo.value = null
    loadVideos()
    alert('已移入回收站')
  } catch (e: any) { alert('删除失败：' + (e?.message || '未知错误')) }
}
function openInFolder(fp: string) { window.electronAPI.openInFolder(fp) }

// ── 导出 ──
const showExportModal = ref(false)
const exportPath = ref('')
const exportOrganizeBy = ref<'flat' | 'star' | 'tag'>('flat')
const exportOperation = ref<'copy' | 'move'>('copy')
const exporting = ref(false)

function openExport() {
  if (filteredVideos.value.length === 0) { alert('没有可导出的视频'); return }
  exportPath.value = folderPath.value ? folderPath.value + '\\_导出筛选' : ''
  exportOrganizeBy.value = 'flat'; exportOperation.value = 'copy'
  showExportModal.value = true
}
async function selectExportPath() { const p = await window.electronAPI.selectFolder(); if (p) exportPath.value = p }
async function doExport() {
  if (!exportPath.value || exporting.value) return
  exporting.value = true
  try {
    const result = await window.electronAPI.exportVideos({ sourceFolder: folderPath.value, outputPath: exportPath.value, videoIds: filteredVideos.value.map(v => v.id), operation: exportOperation.value, organizeBy: exportOrganizeBy.value })
    showExportModal.value = false
    alert(`导出完成！\n成功: ${result.success.length}\n失败: ${result.failed.length}`)
  } catch (e: any) { alert('导出失败：' + (e?.message || '未知错误')) }
  finally { exporting.value = false }
}

// ── 标签 ──
const showNewTagModal = ref(false)
const newTagName = ref('')
const newTagColor = ref('#e8f5e9')
const tagColors = ['#e8f5e9', '#e3f2fd', '#fff3e0', '#fce4ec', '#f3e5f5', '#e0f7fa', '#fff8e1', '#fbe9e7']

function openNewTagModal() { newTagName.value = ''; newTagColor.value = tagColors[0]; showNewTagModal.value = true }
async function createTag() {
  const name = newTagName.value.trim()
  if (!name) return
  try { await window.electronAPI.createTag(name, newTagColor.value); showNewTagModal.value = false; tags.value = await window.electronAPI.getAllTags() }
  catch (e: any) { alert('创建标签失败：' + (e?.message || '未知错误')) }
}

function hasTag(tagId: number): boolean { return (currentVideo.value?.tags || []).some(id => Number(id) === Number(tagId)) }
function hasCardTag(v: VideoInfo, tagId: number): boolean { return (v.tags || []).some(id => Number(id) === Number(tagId)) }
function toggleCardTag(v: VideoInfo, tagId: number) { toggleTag(v.id, tagId) }
async function toggleTag(videoId: string, tagId: number) {
  const v = videos.value.find(x => x.id === videoId)
  if (!v) return
  const currentTags = (v.tags || []).map(Number); tagId = Number(tagId)
  const newTags = currentTags.includes(tagId) ? currentTags.filter(id => id !== tagId) : [...currentTags, tagId]
  await window.electronAPI.updateTags(videoId, newTags)
  v.tags = newTags; if (currentVideo.value?.id === videoId) currentVideo.value.tags = newTags
}

// ── 格式化 ──
function fmtDuration(s: number) { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return m > 0 ? `${m}:${String(sec).padStart(2,'0')}` : `0:${String(sec).padStart(2,'0')}` }
function fmtStars(r: number) { return '★'.repeat(r) + '☆'.repeat(5 - r) }
function fmtSize(b: number) { if (!b) return '0 B'; const u = ['B','KB','MB','GB']; const i = Math.floor(Math.log(b)/Math.log(1024)); return `${(b/Math.pow(1024,i)).toFixed(i>=2?1:0)} ${u[i]}` }
function fmtFps(f: number) { return f ? `${f.toFixed(2)} fps` : '-' }
function fmtBitrate(b: number) { return b >= 1e6 ? `${(b/1e6).toFixed(1)} Mbps` : b >= 1e3 ? `${(b/1e3).toFixed(0)} Kbps` : '-' }
function fmtAudio(c: string, sr: number, ch: number) { const chs = ch === 1 ? '单声道' : ch === 2 ? '立体声' : `${ch}声道`; return c ? `${c.toUpperCase()} ${Math.round(sr/1000)}kHz ${chs}` : '-' }

// ── 生命周期 ──
let folderChangedCleanup: (() => void) | null = null

onMounted(async () => {
  const saved = localStorage.getItem('videoSifter_gridScale')
  if (saved) scaleIndex.value = Math.max(0, Math.min(scaleSizes.length - 1, Number(saved)))
  const pm = localStorage.getItem('videoSifter_previewMode')
  if (pm === 'video' || pm === 'frames') previewMode.value = pm

  // 强制重置为缩略图模式（干净启动，之前 localStorage 可能残留）
  const resetStats = await window.electronAPI.getVideoStats().catch(() => ({ total: 0 }))
  if (!resetStats || resetStats.total === 0) {
    previewMode.value = 'frames'
    localStorage.setItem('videoSifter_previewMode', 'frames')
  }

  folderChangedCleanup = window.electronAPI.onFolderChanged(async () => { if (folderPath.value) await loadVideos() })
  try {
    const stats = await window.electronAPI.getVideoStats()
    if (stats.total > 0) {
      const lastFolder = localStorage.getItem('videoSifter_lastFolder')
      if (lastFolder) folderPath.value = lastFolder
      else { const folders = await window.electronAPI.getFolderStructure(); if (folders.length > 0) folderPath.value = folders[0].path }
      await loadVideos()
    }
  } catch {}
  document.addEventListener('keydown', onGlobalKeyDown)
})

onUnmounted(() => {
  if (folderChangedCleanup) folderChangedCleanup()
  if (folderPath.value) window.electronAPI.stopWatchingFolder(folderPath.value)
  document.removeEventListener('keydown', onGlobalKeyDown)
})

function onGlobalKeyDown(e: KeyboardEvent) {
  if ((e.key === ' ' || e.code === 'Space') && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault()
    if (showNewTagModal.value || showExportModal.value) return
    if (quicklookVideo.value) { closeQuicklook(); return }
    const target = hoverVideoId.value
      ? videos.value.find(v => v.id === hoverVideoId.value)
      : focusedVideo.value
    if (target) openQuicklook(target)
  }
  if (e.key === 'Escape' && quicklookVideo.value) { closeQuicklook() }
}
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #1a1a2e; background: #f8f9fb; -webkit-font-smoothing: antialiased; }
.app { height: 100vh; display: flex; flex-direction: column; outline: none; }

/* ── Top Bar ── */
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 20px; height: 48px; background: #fff; border-bottom: 1px solid #eaeef2; flex-shrink: 0; }
.topbar-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.logo-icon { color: #4f46e5; flex-shrink: 0; }
.path { font-size: 12px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.topbar-right { display: flex; align-items: center; gap: 10px; }
.search-wrap { position: relative; display: flex; align-items: center; }
.search-icon { position: absolute; left: 10px; color: #94a3b8; pointer-events: none; }
.search-input { padding: 6px 10px 6px 32px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; width: 200px; background: #f8fafc; color: #1e293b; outline: none; transition: border-color 0.15s, background 0.15s; }
.search-input:focus { border-color: #4f46e5; background: #fff; }
.search-input::placeholder { color: #94a3b8; }

/* ── Buttons ── */
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; cursor: pointer; font-size: 12px; color: #475569; transition: all 0.15s; white-space: nowrap; }
.btn:hover { background: #f8fafc; border-color: #cbd5e1; }
.btn-ghost { border-color: transparent; background: transparent; }
.btn-ghost:hover { background: #f1f5f9; border-color: transparent; }
.btn-primary { background: #4f46e5; color: #fff; border-color: #4f46e5; }
.btn-primary:hover { background: #4338ca; border-color: #4338ca; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-icon { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: none; border-radius: 6px; background: transparent; cursor: pointer; color: #64748b; transition: all 0.15s; }
.btn-icon:hover { background: #f1f5f9; color: #334155; }
.btn-danger { background: #ef4444; color: #fff; border-color: #ef4444; }
.btn-danger:hover { background: #dc2626; }
.btn:disabled { opacity: 0.4; cursor: default; }

/* Proxy spinner */
.proxy-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Proxy progress bar */
.proxy-group { display: flex; align-items: center; gap: 6px; }
.proxy-bar-wrap { width: 60px; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden; }
.proxy-bar { height: 100%; background: #ef4444; border-radius: 2px; transition: width 0.2s ease; }

/* ── Body ── */
.body { flex: 1; display: flex; overflow: hidden; }

/* ── Sidebar ── */
.sidebar { width: 200px; flex-shrink: 0; background: #fff; border-right: 1px solid #eaeef2; overflow-y: auto; }
.sidebar-inner { padding: 16px 12px; }
.sidebar-section { margin-bottom: 20px; }
.sidebar-label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.sidebar-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 600; margin-bottom: 8px; display: block; }
.sidebar-label-row .sidebar-label { margin-bottom: 0; }
.filter-item { display: flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; color: #475569; transition: all 0.1s; margin-bottom: 1px; }
.filter-item:hover { background: #f1f5f9; }
.filter-item.active { background: #eef2ff; color: #4f46e5; font-weight: 500; }
.filter-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.filter-count { font-size: 11px; color: #94a3b8; }
.filter-item.active .filter-count { color: #818cf8; }
.tag-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

/* ── Main ── */
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

/* ── Toolbar ── */
.toolbar { display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; background: #fff; border-bottom: 1px solid #eaeef2; flex-shrink: 0; }
.toolbar-left { display: flex; align-items: center; gap: 12px; }
.toolbar-count { font-size: 12px; font-weight: 500; color: #1e293b; }
.toolbar-hint { font-size: 11px; color: #94a3b8; }
.toolbar-right { display: flex; align-items: center; gap: 10px; }
.scale-label { font-size: 11px; color: #94a3b8; min-width: 30px; text-align: right; }
.mode-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
.mode-label { font-size: 11px; color: #94a3b8; transition: color 0.15s; }
.mode-label.active { color: #4f46e5; font-weight: 500; }
.mode-switch { width: 30px; height: 16px; background: #e2e8f0; border-radius: 8px; position: relative; transition: background 0.2s; flex-shrink: 0; }
.mode-switch.on { background: #4f46e5; }
.mode-knob { width: 12px; height: 12px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: left 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.15); }
.mode-switch.on .mode-knob { left: 16px; }

/* ── Empty ── */
.empty { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 8px; color: #94a3b8; }
.empty-icon { opacity: 0.3; }
.empty p { font-size: 14px; color: #64748b; }
.empty-hint { font-size: 12px; }

/* ── Grid ── */
.grid { flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; padding: 16px 20px; align-content: start; }

/* ── Card ── */
.card { border-radius: 10px; overflow: hidden; cursor: pointer; background: #fff; position: relative; display: flex; flex-direction: column; box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04); transition: box-shadow 0.2s, transform 0.15s; }
.card.has-proxy { box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 0 0 1.5px rgba(255,255,255,0.7), 0 0 0 2px rgba(0,0,0,0.06); }
.card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(79,70,229,0.15); transform: translateY(-1px); }
.card.has-proxy:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06), 0 0 0 1.5px rgba(255,255,255,0.8), 0 0 0 2px rgba(79,70,229,0.15); }
.card.focused { box-shadow: 0 0 0 2px rgba(79,70,229,0.25); }
.card.has-proxy.focused { box-shadow: 0 0 0 1.5px rgba(255,255,255,0.7), 0 0 0 2.5px rgba(79,70,229,0.3); }

/* Thumb */
.thumb { position: relative; aspect-ratio: 16/9; background: #0f172a; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
.thumb-img { width: 100%; height: 100%; object-fit: cover; transition: opacity 0.15s; }
.thumb:has(video.show) .thumb-img { opacity: 0; }
.thumb-video { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; opacity: 0; }
.thumb-video.show { opacity: 1; }
.play-icon { position: absolute; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); border-radius: 50%; color: #fff; pointer-events: none; z-index: 2; opacity: 0; transition: opacity 0.2s; backdrop-filter: blur(4px); }
.card:hover .play-icon { opacity: 0.7; }
.card:has(video.show) .play-icon { opacity: 0; }
.duration-badge { position: absolute; bottom: 5px; right: 5px; background: rgba(0,0,0,0.7); color: #fff; padding: 1px 6px; border-radius: 4px; font-size: 10px; pointer-events: none; z-index: 2; backdrop-filter: blur(4px); }

/* Info */
.info { flex: 1; padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 3px; }
.info-name { font-size: 12px; font-weight: 500; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Stars + Actions row */
.info-star-row { display: flex; align-items: center; min-height: 16px; gap: 3px; }
.info-stars { display: flex; align-items: center; gap: 1px; flex: 1; }
.star { cursor: pointer; font-size: 14px; color: #e2e8f0; line-height: 1; transition: transform 0.1s, color 0.1s; }
.star.on { color: #f59e0b; }
.star:hover { transform: scale(1.25); }
.star-clear { cursor: pointer; font-size: 9px; color: #cbd5e1; margin-left: 3px; transition: color 0.1s; }
.star-clear:hover { color: #ef4444; }

/* Tags */
.info-tags { display: flex; flex-wrap: wrap; gap: 3px; min-height: 14px; }
.info-tag { padding: 0 5px; border-radius: 4px; font-size: 9px; cursor: pointer; border: 1px solid #e2e8f0; color: #94a3b8; background: transparent; line-height: 14px; transition: all 0.1s; }
.info-tag.active { font-weight: 500; }
.info-tag:hover { transform: scale(1.05); }

/* Meta */
.info-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8px; font-size: 10px; color: #94a3b8; margin-top: 2px; line-height: 1.5; }
.meta-l { color: #cbd5e1; margin-right: 3px; }
.meta-item { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Actions in star row */
.info-star-row .info-actions { display: flex; gap: 2px; flex-shrink: 0; }
.info-star-row .action-btn { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: none; border-radius: 4px; background: transparent; cursor: pointer; color: #94a3b8; transition: all 0.1s; }
.info-star-row .action-btn:hover { background: #f1f5f9; color: #475569; }
.info-star-row .action-trash:hover { background: #fef2f2; color: #ef4444; }

/* ── QuickLook ── */
.ql-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 900; backdrop-filter: blur(4px); animation: fadeIn 0.15s ease; }
.ql-window { background: #000; border-radius: 12px; overflow: hidden; width: min(80vw, 960px); max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 16px 48px rgba(0,0,0,0.4); animation: scaleIn 0.15s ease; }
.ql-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(0,0,0,0.85); color: #fff; flex-shrink: 0; }
.ql-title { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ql-close { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; border-radius: 6px; background: transparent; cursor: pointer; color: #64748b; transition: all 0.15s; }
.ql-close:hover { background: rgba(239,68,68,0.2); color: #ef4444; }
.ql-player { width: 100%; display: block; max-height: 80vh; background: #000; }
.ql-foot { display: flex; gap: 16px; padding: 10px 16px; background: rgba(0,0,0,0.85); color: #64748b; font-size: 12px; flex-shrink: 0; align-items: center; }
.ql-badge { background: #4f46e5; color: #fff; padding: 1px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; }

/* ── Modals ── */
.modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); animation: fadeIn 0.12s ease; }
.modal-box { background: #fff; border-radius: 12px; padding: 24px; width: 380px; max-height: 80vh; overflow-y: auto; box-shadow: 0 16px 48px rgba(0,0,0,0.15); animation: scaleIn 0.12s ease; }
.modal-box h3 { font-size: 14px; font-weight: 600; margin-bottom: 16px; color: #1e293b; }
.modal-input { width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; margin-bottom: 12px; outline: none; transition: border-color 0.15s; color: #1e293b; }
.modal-input:focus { border-color: #4f46e5; }
.modal-colors { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.color-opt { width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; transition: border-color 0.15s; }
.color-opt.active { border-color: #4f46e5; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }

/* ── Export Modal ── */
.export-field { margin-bottom: 14px; }
.export-field label { display: block; font-size: 12px; color: #64748b; margin-bottom: 6px; font-weight: 500; }
.export-path-row { display: flex; gap: 6px; }
.export-options { display: flex; flex-direction: column; gap: 6px; }
.export-radio { font-size: 12px; display: flex; align-items: center; gap: 6px; cursor: pointer; color: #475569; }
.export-radio input { cursor: pointer; accent-color: #4f46e5; }
.export-summary { font-size: 12px; color: #64748b; margin: 12px 0; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
</style>
