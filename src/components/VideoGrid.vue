<template>
  <div class="video-grid">
    <VideoCard
      v-for="video in videos"
      :key="video.id"
      :video="video"
      :selected="selectedIds?.has(video.id)"
      @select="$emit('select', video.id)"
      @dblclick="openDetail(video)"
    />
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
import type { VideoInfo } from '../types'
import { useVideoStore } from '../stores/video'
import VideoCard from './VideoCard.vue'

const props = defineProps<{ videos: VideoInfo[]; selectedIds?: Set<string> }>()
const emit = defineEmits<{ select: [id: string] }>()

const videoStore = useVideoStore()

function openDetail(video: VideoInfo) {
  videoStore.setCurrentVideo(video)
}
</script>

<style scoped>
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
</style>
