<template>
  <div class="sidebar">
    <!-- 1. 标签分类区 -->
    <div class="sidebar-section">
      <div class="sidebar-section-title">
        <span>🏷️ 标签分类</span>
        <n-button text size="tiny" @click="showTagModal = true">+ 新建</n-button>
      </div>
      <div class="tag-cloud">
        <n-tag
          v-for="tag in videoStore.tags"
          :key="tag.id"
          :color="{ color: tag.color, textColor: '#333' }"
          :checkable="true"
          :checked="filterStore.selectedTagIds.includes(tag.id)"
          size="small"
          style="margin: 2px; cursor: pointer;"
          @click="filterStore.toggleTag(tag.id)"
        >
          {{ tag.name }}
        </n-tag>
      </div>
    </div>

    <!-- 2. 星级筛选区 -->
    <div class="sidebar-section">
      <div class="sidebar-section-title">
        <span>⭐ 星级筛选</span>
        <n-button text size="tiny" @click="filterStore.starRating = undefined">清除</n-button>
      </div>
      <div class="star-list">
        <div
          v-for="opt in starOptions"
          :key="opt.label"
          class="star-item"
          :class="{ active: filterStore.starRating === opt.rating }"
          @click="filterStore.starRating = opt.rating"
        >
          <span class="star-icons">{{ opt.icons }}</span>
          <span class="star-count">{{ opt.count }}</span>
        </div>
      </div>
    </div>

    <!-- 3. 文件夹结构区 -->
    <div class="sidebar-section">
      <div class="sidebar-section-title">
        <span>📂 文件夹</span>
      </div>
      <div class="folder-list">
        <div
          class="folder-item"
          :class="{ active: filterStore.selectedFolder === undefined }"
          @click="filterStore.selectedFolder = undefined"
        >
          <span>📁 全部视频</span>
          <span class="folder-count">{{ videoStore.totalCount }}</span>
        </div>
        <div
          v-for="folder in videoStore.folderStructure"
          :key="folder.path"
          class="folder-item"
          :class="{ active: filterStore.selectedFolder === folder.path }"
          @click="filterStore.selectedFolder = folder.path"
        >
          <span>📁 {{ getFolderName(folder.path) }}</span>
          <span class="folder-count">{{ folder.count }}</span>
        </div>
      </div>
    </div>

    <!-- 4. 新建标签弹窗 -->
    <n-modal v-model:show="showTagModal">
      <n-card style="width: 320px;" title="新建标签" :bordered="false" closable @close="showTagModal = false">
        <n-input
          v-model:value="newTagName"
          placeholder="输入标签名称"
          @keyup.enter="handleCreateTag"
        />
        <template #footer>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <n-button size="small" @click="showTagModal = false">取消</n-button>
            <n-button size="small" type="primary" @click="handleCreateTag">创建</n-button>
          </div>
        </template>
      </n-card>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVideoStore } from '../stores/video'
import { useFilterStore } from '../stores/filter'
import { NButton, NTag, NModal, NCard, NInput, useMessage } from 'naive-ui'

const videoStore = useVideoStore()
const filterStore = useFilterStore()
const message = useMessage()

const showTagModal = ref(false)
const newTagName = ref('')

const starOptions = computed(() => {
  const base = [
    { label: '未评分', rating: undefined as number | undefined, icons: '未评分' },
    { label: '5 星', rating: 5 as number | undefined, icons: '★★★★★' },
    { label: '4 星', rating: 4 as number | undefined, icons: '★★★★☆' },
    { label: '3 星', rating: 3 as number | undefined, icons: '★★★☆☆' },
    { label: '2 星', rating: 2 as number | undefined, icons: '★★☆☆☆' },
    { label: '1 星', rating: 1 as number | undefined, icons: '★☆☆☆☆' },
  ]
  return base.map(opt => ({
    ...opt,
    count: opt.rating === undefined
      ? videoStore.videos.filter(v => !v.starRating || v.starRating === 0).length
      : videoStore.videos.filter(v => v.starRating === opt.rating).length,
  }))
})

function getFolderName(folderPath: string): string {
  const parts = folderPath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || folderPath
}

async function handleCreateTag() {
  const name = newTagName.value.trim()
  if (!name) {
    message.warning('请输入标签名称')
    return
  }
  try {
    await window.electronAPI.createTag(name)
    await videoStore.loadTags()
    newTagName.value = ''
    showTagModal.value = false
    message.success('标签创建成功')
  } catch {
    message.error('创建标签失败')
  }
}
</script>

<style scoped>
.sidebar {
  padding: 12px;
  font-size: 13px;
  background: #fafafa;
  height: 100%;
  overflow-y: auto;
  border-right: 1px solid #e8e8e8;
}
.sidebar-section {
  margin-bottom: 16px;
}
.sidebar-section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 13px;
}
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}
.star-list,
.folder-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.star-item,
.folder-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.star-item:hover,
.folder-item:hover {
  background: #e8f0fe;
}
.star-item.active,
.folder-item.active {
  background: #e3f2fd;
  color: #1976d2;
  font-weight: 500;
}
.star-label {
  font-size: 13px;
}
.star-icons {
  font-size: 14px;
  letter-spacing: 1px;
}
.star-count,
.folder-count {
  margin-left: auto;
  color: #999;
  font-size: 12px;
}
.folder-item .folder-count {
  margin-left: auto;
}
</style>
