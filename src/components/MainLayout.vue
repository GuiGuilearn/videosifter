<template>
  <div>视频数: {{ videoStore.videos.length }}</div>
</template>

<script setup lang="ts">
import { useVideoStore } from '../stores/video'
const videoStore = useVideoStore()
</script>
