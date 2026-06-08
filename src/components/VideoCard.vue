<template>
  <div
    class="video-card"
    :class="{ selected }"
    @click="$emit('select')"
    @dblclick="$emit('dblclick')"
  >
    <div class="thumbnail">
      <img
        v-if="video.thumbnailPath"
        :src="video.thumbnailPath"
        alt=""
      />
      <div class="play-icon">&#9654;</div>
      <div class="duration-badge">{{ formatDuration(video.duration) }}</div>
    </div>
    <div class="card-info">
      <div class="file-name" :title="video.fileName">{{ video.fileName }}</div>
      <div class="card-meta">
        <span class="stars">{{ formatStarRating(video.starRating) }}</span>
        <span class="resolution">{{ video.width }}&times;{{ video.height }}</span>
      </div>
      <div v-if="video.tags.length > 0" class="card-tags">
        <span
          v-for="tagId in video.tags"
          :key="tagId"
          class="tag-pill"
          :style="{ background: getTagColor(tagId) }"
        >
          {{ getTagName(tagId) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
import type { VideoInfo } from '../types'
import { formatDuration, formatStarRating } from '../utils/format'
import { useVideoStore } from '../stores/video'

const props = defineProps<{ video: VideoInfo; selected?: boolean }>()
const emit = defineEmits<{ select: []; dblclick: [] }>()

const videoStore = useVideoStore()

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
.video-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  background: white;
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
}
.video-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-color: #1976d2;
}
.video-card.selected {
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25,118,210,0.2);
}
.thumbnail {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #1a1a2e;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.play-icon {
  position: absolute;
  font-size: 32px;
  opacity: 0.7;
  color: white;
}
.duration-badge {
  position: absolute;
  bottom: 4px;
  right: 6px;
  background: rgba(0,0,0,0.75);
  color: white;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
}
.card-info {
  padding: 8px;
}
.file-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}
.stars {
  color: #f59e0b;
  font-size: 13px;
  letter-spacing: 1px;
}
.resolution {
  color: #999;
  font-size: 11px;
}
.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.tag-pill {
  padding: 0 6px;
  border-radius: 8px;
  font-size: 10px;
  color: #333;
}
</style>
