<template>
  <n-modal v-model:show="show" title="管理标签">
    <n-card title="管理标签" :bordered="false" style="width: 400px">
      <!-- 已有标签列表 -->
      <div style="margin-bottom: 16px;">
        <div style="font-size: 13px; color: #666; margin-bottom: 8px;">已有标签：</div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          <n-tag
            v-for="tag in allTags"
            :key="tag.id"
            :color="{ color: tag.color, textColor: '#333' }"
            closable
            @close="handleDeleteTag(tag.id)"
          >
            {{ tag.name }}
          </n-tag>
          <span v-if="allTags.length === 0" style="color: #999; font-size: 13px;">
            暂无标签，请创建
          </span>
        </div>
      </div>

      <!-- 新建标签 -->
      <div style="display: flex; gap: 8px;">
        <n-input v-model:value="newTagName" placeholder="输入新标签名称" style="flex: 1;" />
        <n-button type="primary" @click="handleCreateTag" :disabled="!newTagName.trim()">
          创建
        </n-button>
      </div>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NModal, NCard, NTag, NButton, NInput, useMessage } from 'naive-ui'
import { useVideoStore } from '../stores/video'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [v: boolean] }>()
const message = useMessage()

const videoStore = useVideoStore()
const newTagName = ref('')

const allTags = computed(() => videoStore.tags)

async function handleCreateTag() {
  if (!newTagName.value.trim()) return
  try {
    await window.electronAPI.createTag(newTagName.value.trim())
    await videoStore.loadTags()
    newTagName.value = ''
    message.success('标签创建成功')
  } catch {
    message.error('创建失败，名称可能已存在')
  }
}

async function handleDeleteTag(tagId: number) {
  try {
    await window.electronAPI.deleteTag(tagId)
    await videoStore.loadTags()
    message.success('标签已删除')
  } catch {
    message.error('删除失败')
  }
}
</script>
