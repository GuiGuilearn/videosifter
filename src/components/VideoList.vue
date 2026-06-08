<template>
  <n-table :single-line="false" size="small">
    <thead>
      <tr>
        <th style="width: 60px">缩略图</th>
        <th>文件名</th>
        <th style="width: 90px">评分</th>
        <th style="width: 90px">分辨率</th>
        <th style="width: 90px">文件大小</th>
        <th style="width: 80px">时长</th>
        <th>标签</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="video in videos"
        :key="video.id"
        :class="{ selected: selectedIds?.has(video.id) }"
        @click="$emit('select', video.id)"
        @dblclick="openDetail(video)"
      >
        <td>
          <div class="list-thumbnail">
            <img
              v-if="video.thumbnailPath"
              :src="video.thumbnailPath"
              alt=""
            />
          </div>
        </td>
        <td>
          <span class="list-file-name" :title="video.fileName">{{ video.fileName }}</span>
        </td>
        <td>
          <span class="list-stars">{{ formatStarRating(video.starRating) }}</span>
        </td>
        <td>{{ video.width }}&times;{{ video.height }}</td>
        <td>{{ formatFileSize(video.fileSize) }}</td>
        <td>{{ formatDuration(video.duration) }}</td>
        <td>
          <div v-if="video.tags.length > 0" class="list-tags">
            <span
              v-for="tagId in video.tags"
              :key="tagId"
              class="list-tag-pill"
              :style="{ background: getTagColor(tagId) }"
            >
              {{ getTagName(tagId) }}
            </span>
          </div>
        </td>
      </tr>
    </tbody>
  </n-table>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
import type { VideoInfo } from '../types'
import { formatFileSize, formatDuration, formatStarRating } from '../utils/format'
import { useVideoStore } from '../stores/video'

const props = defineProps<{ videos: VideoInfo[]; selectedIds?: Set<string> }>()
const emit = defineEmits<{ select: [id: string] }>()

const videoStore = useVideoStore()

function openDetail(video: VideoInfo) {
  videoStore.setCurrentVideo(video)
}

function getTagColor(tagId: number): string {
  const tag = videoStore.tags.find((t) => t.id === tagId)
  return tag ? tag.color : '#e0e0e0'
}

function getTagName(tagId: number): string {
  const tag = videoStore.tags.find((t) => t.id === tagId)
  return tag ? tag.name : ''
}
</script>

<style scoped>
.n-table tr.selected {
  background-color: rgba(25, 118, 210, 0.08);
}
.list-thumbnail {
  width: 40px;
  height: 24px;
  overflow: hidden;
  border-radius: 3px;
  background: #1a1a2e;
}
.list-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.list-file-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
  display: inline-block;
}
.list-stars {
  font-size: 14px;
  color: #f59e0b;
  letter-spacing: 1px;
}
.list-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.list-tag-pill {
  padding: 0 6px;
  border-radius: 8px;
  font-size: 10px;
  color: #333;
  white-space: nowrap;
}
</style>
