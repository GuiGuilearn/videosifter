<template>
  <div class="detail-panel">
    <div class="panel-header">
      <span style="font-weight: 600; font-size: 14px;">视频详情</span>
      <n-button text @click="$emit('close')" size="small">✕</n-button>
    </div>

    <div class="panel-body">
      <div class="panel-content">
        <!-- Left: Player (68%) -->
        <div class="player-section">
          <VideoPlayer :src="'file:///' + video.filePath" />

          <!-- Thumbnail Timeline -->
          <div class="timeline-thumbs">
            <div v-for="i in 7" :key="i" class="thumb-placeholder"></div>
          </div>
        </div>

        <!-- Right: Info Panel (32%) -->
        <div class="info-section">
          <!-- 1. File name -->
          <div class="info-group">
            <div class="info-label">文件名</div>
            <div class="file-name-row">
              <span class="file-name-text" :title="video.fileName">{{ video.fileName }}</span>
              <n-button text size="small" @click="openRenameModal">✏️</n-button>
            </div>
          </div>

          <!-- 2. Star rating -->
          <div class="info-group">
            <div class="info-label">评分</div>
            <div class="rating-row">
              <div class="stars">
                <span
                  v-for="i in 5"
                  :key="i"
                  class="star"
                  :style="{ color: i <= video.starRating ? '#f59e0b' : '#e0e0e0' }"
                  @click="videoStore.updateRating(video.id, i)"
                >★</span>
              </div>
              <span class="rating-text">{{ video.starRating }}/5</span>
            </div>
          </div>

          <!-- 3. Tag management -->
          <div class="info-group">
            <div class="info-label">标签</div>
            <div class="tags">
              <span
                v-for="tag in videoTags"
                :key="tag.id"
                class="tag-item"
                :style="{ background: tag.color + '33', color: tag.color, border: '1px solid ' + tag.color }"
              >
                {{ tag.name }}
                <span class="tag-remove" @click="removeTag(tag.id)">✕</span>
              </span>
              <n-button text size="tiny" @click="openTagModal">+ 添加标签</n-button>
            </div>
          </div>

          <!-- 4. Video specs -->
          <div class="info-group">
            <div class="info-label">规格</div>
            <div class="spec-divider"></div>
            <div class="spec-row">
              <span class="spec-label">分辨率</span>
              <span class="spec-value">{{ formatResolution(video.width, video.height) }}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">时长</span>
              <span class="spec-value">{{ formatDuration(video.duration) }}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">文件大小</span>
              <span class="spec-value">{{ formatFileSize(video.fileSize) }}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">编码格式</span>
              <span class="spec-value">{{ video.codec }}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">帧率</span>
              <span class="spec-value">{{ formatFrameRate(video.frameRate) }}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">比特率</span>
              <span class="spec-value">{{ formatBitRate(video.bitRate) }}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">音频</span>
              <span class="spec-value">{{ formatAudioInfo(video.audioCodec, video.audioSampleRate, video.audioChannels) }}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">创建日期</span>
              <span class="spec-value">{{ video.createdAt }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom action buttons -->
    <div class="action-buttons">
      <n-button type="error" size="small" @click="deleteModalVisible = true">🗑️ 移入回收站</n-button>
      <n-button size="small" @click="openInFolder">📂 定位文件</n-button>
      <n-button size="small" @click="copySpecs">📋 复制规格</n-button>
    </div>

    <!-- Rename Modal -->
    <n-modal v-model:show="renameModalVisible">
      <n-card title="重命名文件" style="width: 400px;" closable @close="renameModalVisible = false">
        <n-input v-model:value="newFileName" placeholder="输入新文件名" />
        <template #footer>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <n-button @click="renameModalVisible = false">取消</n-button>
            <n-button type="primary" @click="confirmRename" :disabled="!newFileName.trim()">确认</n-button>
          </div>
        </template>
      </n-card>
    </n-modal>

    <!-- Tag Selection Modal -->
    <n-modal v-model:show="tagModalVisible">
      <n-card title="添加标签" style="width: 400px;" closable @close="tagModalVisible = false">
        <div v-if="availableTags.length === 0" style="color: #999; font-size: 13px; padding: 8px 0;">没有可用的标签</div>
        <div v-else>
          <div v-for="tag in availableTags" :key="tag.id" class="tag-check-row">
            <n-checkbox v-model:checked="tagSelection[tag.id]" />
            <span
              class="tag-item"
              :style="{ background: tag.color + '33', color: tag.color, border: '1px solid ' + tag.color }"
            >{{ tag.name }}</span>
          </div>
        </div>
        <template #footer>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <n-button @click="tagModalVisible = false">取消</n-button>
            <n-button type="primary" @click="confirmAddTags">确认</n-button>
          </div>
        </template>
      </n-card>
    </n-modal>

    <!-- Delete Confirmation Modal -->
    <n-modal v-model:show="deleteModalVisible">
      <n-card title="确认删除" style="width: 400px;" closable @close="deleteModalVisible = false">
        <p style="margin: 0;">确定要将此视频移入回收站吗？</p>
        <template #footer>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <n-button @click="deleteModalVisible = false">取消</n-button>
            <n-button type="error" @click="confirmDelete">确认删除</n-button>
          </div>
        </template>
      </n-card>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, ref, computed } from 'vue'
import { useVideoStore } from '../stores/video'
import { NButton, NModal, NCard, NInput, NCheckbox, useMessage } from 'naive-ui'
import VideoPlayer from './VideoPlayer.vue'
import { formatFileSize, formatDuration, formatResolution, formatFrameRate, formatBitRate, formatAudioInfo } from '../utils/format'
import type { VideoInfo, Tag } from '../types'

const props = defineProps<{ video: VideoInfo }>()
const emit = defineEmits<{ close: [] }>()

const videoStore = useVideoStore()
const message = useMessage()

// ── Rename ──
const renameModalVisible = ref(false)
const newFileName = ref('')

function openRenameModal() {
  newFileName.value = props.video.fileName
  renameModalVisible.value = true
}

async function confirmRename() {
  const name = newFileName.value.trim()
  if (!name) return
  await window.electronAPI.renameVideo(props.video.id, name)
  renameModalVisible.value = false
  await videoStore.loadVideos()
  message.success('重命名成功')
}

// ── Tags ──
const videoTags = computed(() => {
  return props.video.tags
    .map(tagId => videoStore.tags.find(t => t.id === tagId))
    .filter((t): t is Tag => t !== undefined)
})

const availableTags = computed(() => {
  return videoStore.tags.filter(t => !props.video.tags.includes(t.id))
})

const tagModalVisible = ref(false)
const tagSelection = ref<Record<number, boolean>>({})

function openTagModal() {
  tagSelection.value = {}
  tagModalVisible.value = true
}

async function confirmAddTags() {
  const selected = Object.entries(tagSelection.value)
    .filter(([, v]) => v)
    .map(([id]) => Number(id))
  if (selected.length === 0) {
    tagModalVisible.value = false
    return
  }
  const newTags = [...props.video.tags, ...selected]
  await window.electronAPI.updateTags(props.video.id, newTags)
  tagModalVisible.value = false
  await videoStore.loadVideos()
  message.success('标签已更新')
}

async function removeTag(tagId: number) {
  const newTags = props.video.tags.filter(id => id !== tagId)
  await window.electronAPI.updateTags(props.video.id, newTags)
  await videoStore.loadVideos()
}

// ── Delete ──
const deleteModalVisible = ref(false)

async function confirmDelete() {
  await window.electronAPI.deleteVideo(props.video.id, false)
  deleteModalVisible.value = false
  await videoStore.loadVideos()
  emit('close')
  message.success('已移入回收站')
}

// ── Open in folder ──
async function openInFolder() {
  await window.electronAPI.openInFolder(props.video.filePath)
}

// ── Copy specs ──
function copySpecs() {
  const specs = [
    `分辨率: ${formatResolution(props.video.width, props.video.height)}`,
    `时长: ${formatDuration(props.video.duration)}`,
    `文件大小: ${formatFileSize(props.video.fileSize)}`,
    `编码格式: ${props.video.codec}`,
    `帧率: ${formatFrameRate(props.video.frameRate)}`,
    `比特率: ${formatBitRate(props.video.bitRate)}`,
    `音频: ${formatAudioInfo(props.video.audioCodec, props.video.audioSampleRate, props.video.audioChannels)}`,
    `创建日期: ${props.video.createdAt}`,
  ].join('\n')

  navigator.clipboard.writeText(specs).then(() => {
    message.success('已复制')
  }).catch(() => {
    message.error('复制失败')
  })
}
</script>

<style scoped>
.detail-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
}
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}
.panel-content {
  display: flex;
  gap: 16px;
  padding: 16px;
}
.player-section {
  flex: 0 0 68%;
}
.info-section {
  flex: 1;
  min-width: 0;
}
.info-group {
  margin-bottom: 14px;
}
.info-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}
.file-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.file-name-text {
  font-size: 14px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rating-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rating-text {
  font-size: 13px;
  color: #999;
}
.stars {
  display: flex;
  gap: 4px;
}
.star {
  font-size: 28px;
  cursor: pointer;
  transition: transform 0.1s;
}
.star:hover {
  transform: scale(1.15);
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag-item {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.tag-remove {
  cursor: pointer;
  opacity: 0.6;
  font-size: 12px;
}
.tag-check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.spec-row {
  display: flex;
  align-items: center;
  padding: 4px 0;
}
.spec-label {
  width: 72px;
  font-size: 13px;
  color: #999;
  flex-shrink: 0;
}
.spec-value {
  font-size: 14px;
  color: #333;
}
.action-buttons {
  border-top: 1px solid #eee;
  padding: 12px 16px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.spec-divider {
  border-top: 1px solid #eee;
  padding-top: 12px;
  margin-top: 6px;
}
.timeline-thumbs {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.thumb-placeholder {
  flex: 1;
  aspect-ratio: 16 / 9;
  background: #e0e0e0;
  border-radius: 4px;
}
</style>
