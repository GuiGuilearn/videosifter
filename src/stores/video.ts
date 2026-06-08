import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { VideoInfo, VideoFilter, ScanProgress, Tag } from '../types'

export const useVideoStore = defineStore('video', () => {
  const videos = ref<VideoInfo[]>([])
  const tags = ref<Tag[]>([])
  const currentVideo = ref<VideoInfo | null>(null)
  const selectedVideoIds = ref<Set<string>>(new Set())
  const isScanning = ref(false)
  const scanProgress = ref<ScanProgress>({ current: 0, total: 0, fileName: '' })
  const folderStructure = ref<{ path: string; count: number }[]>([])
  const viewMode = ref<'grid' | 'list'>('grid')

  const totalCount = computed(() => videos.value.length)
  const selectedCount = computed(() => selectedVideoIds.value.size)
  const selectedVideos = computed(() => videos.value.filter(v => selectedVideoIds.value.has(v.id)))

  async function scanFolder(folderPath: string) {
    isScanning.value = true
    scanProgress.value = { current: 0, total: 0, fileName: '' }
    try {
      await window.electronAPI.scanFolder(folderPath)
      await loadVideos()
      await loadFolderStructure()
    } finally { isScanning.value = false }
  }

  async function loadVideos(filter?: VideoFilter) {
    videos.value = await window.electronAPI.getVideos(filter || {})
  }

  async function loadTags() { tags.value = await window.electronAPI.getAllTags() }
  async function loadFolderStructure() { folderStructure.value = await window.electronAPI.getFolderStructure() }
  async function setCurrentVideo(video: VideoInfo | null) { currentVideo.value = video }

  async function updateRating(videoId: string, rating: number) {
    await window.electronAPI.updateRating(videoId, rating)
    const v = videos.value.find(v => v.id === videoId)
    if (v) v.starRating = rating
    if (currentVideo.value?.id === videoId) currentVideo.value.starRating = rating
  }

  async function updateTags(videoId: string, tagIds: number[]) {
    await window.electronAPI.updateTags(videoId, tagIds)
    const v = videos.value.find(v => v.id === videoId)
    if (v) v.tags = tagIds
    if (currentVideo.value?.id === videoId) currentVideo.value.tags = tagIds
  }

  function toggleSelect(videoId: string) {
    const s = new Set(selectedVideoIds.value)
    s.has(videoId) ? s.delete(videoId) : s.add(videoId)
    selectedVideoIds.value = s
  }

  function selectAll() { selectedVideoIds.value = new Set(videos.value.map(v => v.id)) }
  function clearSelection() { selectedVideoIds.value = new Set() }

  return {
    videos, tags, currentVideo, selectedVideoIds,
    isScanning, scanProgress, folderStructure, viewMode,
    totalCount, selectedCount, selectedVideos,
    scanFolder, loadVideos, loadTags, loadFolderStructure,
    setCurrentVideo, updateRating, updateTags,
    toggleSelect, selectAll, clearSelection,
  }
})
