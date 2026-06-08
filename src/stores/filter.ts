import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { VideoFilter } from '../types'

export const useFilterStore = defineStore('filter', () => {
  const starRating = ref<number | undefined>(undefined)
  const starMin = ref<number | undefined>(undefined)
  const includeUnrated = ref(true)
  const selectedTagIds = ref<number[]>([])
  const selectedFolder = ref<string | undefined>(undefined)
  const searchText = ref('')

  const activeFilter = computed<VideoFilter>(() => ({
    starRating: starRating.value,
    starMin: starMin.value,
    includeUnrated: includeUnrated.value,
    tagIds: selectedTagIds.value.length > 0 ? selectedTagIds.value : undefined,
    folderPath: selectedFolder.value,
    searchText: searchText.value || undefined,
  }))

  const hasActiveFilter = computed(() =>
    starRating.value !== undefined || starMin.value !== undefined ||
    selectedTagIds.value.length > 0 || selectedFolder.value !== undefined ||
    searchText.value.length > 0
  )

  function resetFilter() {
    starRating.value = undefined; starMin.value = undefined
    includeUnrated.value = true; selectedTagIds.value = []
    selectedFolder.value = undefined; searchText.value = ''
  }

  function toggleTag(tagId: number) {
    const idx = selectedTagIds.value.indexOf(tagId)
    selectedTagIds.value = idx >= 0
      ? selectedTagIds.value.filter(id => id !== tagId)
      : [...selectedTagIds.value, tagId]
  }

  return { starRating, starMin, includeUnrated, selectedTagIds, selectedFolder, searchText, activeFilter, hasActiveFilter, resetFilter, toggleTag }
})
