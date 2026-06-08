<template>
  <n-modal
    :show="props.show"
    @update:show="val => emit('update:show', val)"
    title="📤 导出筛选结果"
    style="width: 700px"
    preset="card"
    :mask-closable="false"
  >
    <n-card closable @close="exportStore.closeDialog()" :bordered="false" role="dialog" size="small">
      <!-- 顶部条件选择行 -->
      <div class="filter-row">
        <!-- 星级快捷筛选 -->
        <div class="star-pills">
          <span
            v-for="pill in starPills"
            :key="pill.value"
            class="pill"
            :class="{ active: exportStore.starFilter === pill.value }"
            @click="exportStore.starFilter = pill.value"
          >
            {{ pill.label }}
          </span>
        </div>

        <!-- 标签选择 -->
        <div class="tag-chips">
          <span
            v-for="tag in videoStore.tags"
            :key="tag.id"
            class="tag-chip"
            :class="{ active: exportStore.selectedTagIds.includes(tag.id) }"
            :style="{ borderColor: tag.color }"
            @click="toggleTag(tag.id)"
          >
            {{ tag.name }}
          </span>
        </div>

        <!-- 文件夹选择 -->
        <n-select
          v-model:value="exportStore.selectedFolder"
          :options="folderOptions"
          placeholder="选择文件夹"
          clearable
          style="width: 180px"
          size="small"
        />

        <!-- 已选计数 -->
        <div class="selected-count">
          已选 {{ filteredVideos.length }} 个视频 (共 {{ totalSize }})
        </div>
      </div>

      <n-divider />

      <!-- 缩略图预览网格 -->
      <div class="preview-section">
        <div class="preview-title">📸 即将导出的视频</div>
        <div class="thumbnail-grid">
          <div
            v-for="video in filteredVideos"
            :key="video.id"
            class="thumbnail-card"
            :title="video.fileName"
          >
            <img
              v-if="video.thumbnailPath"
              :src="video.thumbnailPath"
              class="thumb-img"
              alt=""
            />
            <div class="thumb-placeholder" v-else>
              <span>🎬</span>
            </div>
            <div class="thumb-info">
              <div class="thumb-name">{{ video.fileName }}</div>
              <div class="thumb-stars">{{ starString(video.starRating) }}</div>
              <div class="thumb-size">{{ formatFileSize(video.fileSize) }}</div>
            </div>
          </div>
          <div v-if="filteredVideos.length === 0" class="empty-hint">
            没有匹配的视频
          </div>
        </div>
      </div>

      <details class="output-settings">
        <summary>⚙️ 输出设置</summary>
        <div class="settings-body">
          <!-- 输出路径 -->
          <div class="setting-row">
            <label class="setting-label">输出路径</label>
            <div class="setting-control path-control">
              <n-input
                v-model:value="exportStore.outputPath"
                placeholder="选择输出目录"
                size="small"
              />
              <n-button size="small" @click="browseOutputPath">浏览</n-button>
            </div>
          </div>

          <!-- 操作方式 -->
          <div class="setting-row">
            <label class="setting-label">操作方式</label>
            <div class="setting-control">
              <label class="radio-item">
                <input
                  type="radio"
                  v-model="exportStore.operation"
                  value="copy"
                />
                复制
              </label>
              <label class="radio-item">
                <input
                  type="radio"
                  v-model="exportStore.operation"
                  value="move"
                />
                移动
              </label>
            </div>
          </div>

          <!-- 组织方式 -->
          <div class="setting-row">
            <label class="setting-label">组织方式</label>
            <n-select
              v-model:value="exportStore.organizeBy"
              :options="organizeOptions"
              style="width: 200px"
              size="small"
            />
          </div>

          <!-- 目录结构预览 -->
          <div class="structure-preview">
            <pre>{{ previewStructure() }}</pre>
          </div>
        </div>
      </details>

      <n-divider />

      <!-- 底部按钮 -->
      <div class="footer-actions">
        <n-button @click="exportStore.closeDialog()">取消</n-button>
        <n-button type="primary" @click="handleExport" :disabled="filteredVideos.length === 0">
          🚀 导出 {{ filteredVideos.length }} 个视频
        </n-button>
      </div>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useVideoStore } from '../stores/video'
import { useExportStore } from '../stores/export'
import { NModal, NCard, NButton, NInput, NSelect, NDivider, useMessage } from 'naive-ui'
import { formatFileSize } from '../utils/format'

const videoStore = useVideoStore()
const exportStore = useExportStore()
const message = useMessage()

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [v: boolean] }>()

const starPills = [
  { label: '全部', value: 'all' },
  { label: '≥ ★★★★', value: '4up' },
  { label: '≥ ★★★', value: '3up' },
]

const organizeOptions = [
  { label: '按星级分文件夹', value: 'star' },
  { label: '按标签分文件夹', value: 'tag' },
  { label: '全部放在一起', value: 'flat' },
]

// 根据 exportStore 条件从 videoStore.videos 筛选
const filteredVideos = computed(() => {
  return videoStore.videos.filter(v => {
    // starFilter
    if (exportStore.starFilter === '4up' && v.starRating < 4) return false
    if (exportStore.starFilter === '3up' && v.starRating < 3) return false
    // tagIds
    if (exportStore.selectedTagIds.length > 0) {
      if (!exportStore.selectedTagIds.some(id => v.tags.includes(id))) return false
    }
    // folder
    if (exportStore.selectedFolder && v.folderPath !== exportStore.selectedFolder) return false
    return true
  })
})

const totalSize = computed(() => {
  return formatFileSize(filteredVideos.value.reduce((sum, v) => sum + v.fileSize, 0))
})

const folderOptions = computed(() => {
  return videoStore.folderStructure.map(f => ({ label: f.path.split(/[\\/]/).pop() || f.path, value: f.path }))
})

function toggleTag(tagId: number) {
  const idx = exportStore.selectedTagIds.indexOf(tagId)
  if (idx >= 0) {
    exportStore.selectedTagIds.splice(idx, 1)
  } else {
    exportStore.selectedTagIds.push(tagId)
  }
}

function starString(r: number): string {
  return '★'.repeat(r) + '☆'.repeat(5 - r)
}

async function browseOutputPath() {
  // 简化的浏览功能 — 实际使用 window.electronAPI 的对话框
  // 暂时保留当前路径不变
}

async function handleExport() {
  const options = {
    sourceFolder: videoStore.folderStructure[0]?.path || '',
    outputPath: exportStore.outputPath,
    videoIds: filteredVideos.value.map(v => v.id),
    operation: exportStore.operation,
    organizeBy: exportStore.organizeBy,
  }
  const result = await window.electronAPI.exportVideos(options)
  if (result.failed.length > 0) {
    message.success(`导出完成：${result.success.length} 个成功，${result.failed.length} 个失败`)
  } else {
    message.success(`成功导出 ${result.success.length} 个视频！`)
  }
  exportStore.closeDialog()
}

function previewStructure(): string {
  const videos = filteredVideos.value
  if (exportStore.organizeBy === 'flat') return `📂 全部放在 ${exportStore.outputPath}`
  // 按星级/标签估算目录结构
  if (exportStore.organizeBy === 'star') {
    const stars = [...new Set(videos.map(v => v.starRating))].sort((a, b) => b - a)
    return stars.map(s => {
      const count = videos.filter(v => v.starRating === s).length
      return s > 0 ? `📁 ${'★'.repeat(s)}/ (${count}个)` : '📁 未评分/'
    }).join('\n')
  }
  return '📁 按标签分文件夹/'
}
</script>

<style scoped>
.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.star-pills {
  display: flex;
  gap: 6px;
}

.pill {
  padding: 4px 14px;
  border-radius: 16px;
  font-size: 13px;
  border: 1px solid #d9d9d9;
  cursor: pointer;
  background: #fff;
  transition: all 0.15s;
  white-space: nowrap;
}
.pill:hover {
  border-color: #1976d2;
  color: #1976d2;
}
.pill.active {
  background: #1976d2;
  color: #fff;
  border-color: #1976d2;
}

.tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-chip {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  border: 1px solid #d9d9d9;
  cursor: pointer;
  background: #fff;
  transition: all 0.15s;
}
.tag-chip:hover {
  opacity: 0.75;
}
.tag-chip.active {
  background: var(--color, #e3f2fd);
  border-color: var(--color, #1976d2);
}

.selected-count {
  margin-left: auto;
  font-size: 13px;
  color: #666;
  white-space: nowrap;
}

/* 缩略图预览 */
.preview-section {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
  padding: 12px;
}

.preview-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #333;
}

.thumbnail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
  padding: 0;
}

.thumbnail-card {
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  transition: box-shadow 0.15s;
}
.thumbnail-card:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.thumb-img {
  width: 100%;
  height: 72px;
  object-fit: cover;
  display: block;
  background: #1a1a2e;
}

.thumb-placeholder {
  width: 100%;
  height: 72px;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.thumb-info {
  padding: 6px;
}

.thumb-name {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #333;
}

.thumb-stars {
  font-size: 10px;
  color: #f59e0b;
  letter-spacing: 1px;
  margin-top: 2px;
}

.thumb-size {
  font-size: 10px;
  color: #999;
  margin-top: 1px;
}

.empty-hint {
  grid-column: 1 / -1;
  text-align: center;
  padding: 32px 0;
  color: #999;
  font-size: 13px;
}

/* 输出设置 */
.output-settings {
  margin-top: 12px;
}

.output-settings summary {
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  padding: 8px 0;
  user-select: none;
}

.settings-body {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px solid #eee;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.setting-label {
  min-width: 80px;
  font-size: 13px;
  color: #555;
}

.setting-control {
  flex: 1;
}

.path-control {
  display: flex;
  gap: 8px;
}

.path-control .n-input {
  flex: 1;
}

.radio-item {
  font-size: 13px;
  margin-right: 16px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.structure-preview {
  background: #f0f0f0;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
  overflow-x: auto;
}
.structure-preview pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
  line-height: 1.6;
}

/* 底部按钮 */
.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
