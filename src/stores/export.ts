import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useExportStore = defineStore('export', () => {
  const showDialog = ref(false)
  const outputPath = ref('')
  const operation = ref<'copy' | 'move'>('copy')
  const organizeBy = ref<'star' | 'tag' | 'flat'>('star')
  const starFilter = ref<string>('all')
  const selectedTagIds = ref<number[]>([])
  const selectedFolder = ref('')

  function openDialog(defaultOutputPath: string) {
    outputPath.value = defaultOutputPath
    starFilter.value = 'all'; selectedTagIds.value = []; selectedFolder.value = ''
    showDialog.value = true
  }
  function closeDialog() { showDialog.value = false }

  return { showDialog, outputPath, operation, organizeBy, starFilter, selectedTagIds, selectedFolder, openDialog, closeDialog }
})
