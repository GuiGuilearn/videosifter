<template>
  <div class="player-wrapper">
    <video
      ref="videoRef"
      :src="src"
      :poster="poster"
      @loadedmetadata="onLoadedMetadata"
      @timeupdate="onTimeUpdate"
      @ended="onEnded"
      @play="onPlay"
      @pause="onPause"
      controls
      autoplay
    />
  </div>
</template>

<script setup lang="ts">
import { defineProps, ref } from 'vue'

const props = defineProps<{ src: string; poster?: string }>()

const videoRef = ref<HTMLVideoElement | null>(null)

function play() {
  videoRef.value?.play()
}

function pause() {
  videoRef.value?.pause()
}

defineExpose({ play, pause })

function onLoadedMetadata() {
  // 视频元数据加载完成时的处理
}

function onTimeUpdate() {
  // 播放进度更新时的处理
}

function onEnded() {
  // 视频播放结束时的处理
}

function onPlay() {
  // 视频开始播放时的处理
}

function onPause() {
  // 视频暂停时的处理
}
</script>

<style scoped>
.player-wrapper {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: 6px;
  overflow: hidden;
}

.player-wrapper video {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
