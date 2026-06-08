<template>
  <n-modal v-model:show="show" title="确认删除" :mask-closable="false">
    <n-card title="确认删除" :bordered="false" style="width: 400px">
      <p style="margin-bottom: 12px; font-size: 14px;">
        {{ message }}
      </p>
      <n-checkbox v-model:checked="permanent" style="margin-bottom: 12px;">
        彻底删除（跳过回收站，无法恢复）
      </n-checkbox>
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <n-button @click="cancel">取消</n-button>
        <n-button type="error" @click="confirm">
          {{ permanent ? '🗑️ 彻底删除' : '🗑️ 移入回收站' }}
        </n-button>
      </div>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NModal, NCard, NButton, NCheckbox } from 'naive-ui'

const props = defineProps<{ show: boolean; message: string }>()
const emit = defineEmits<{ 'update:show': [v: boolean]; confirm: [permanent: boolean] }>()

const permanent = ref(false)

function cancel() {
  permanent.value = false
  emit('update:show', false)
}

function confirm() {
  emit('confirm', permanent.value)
  permanent.value = false
}
</script>
