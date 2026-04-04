<script setup lang="ts">
import { ref, watch } from 'vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { DesignerColumn } from '../../../../../shared/types'
import { useDesignerStore } from '@renderer/stores/useDesignerStore'

const props = defineProps<{
  open: boolean
  tableId: string
  column?: DesignerColumn
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const store = useDesignerStore()

const COMMON_TYPES = [
  'INTEGER', 'BIGINT', 'VARCHAR(255)', 'TEXT', 'BOOLEAN',
  'TIMESTAMP', 'DATE', 'DECIMAL(10,2)', 'UUID', 'FLOAT'
]

const name = ref('')
const type = ref('VARCHAR(255)')
const nullable = ref(false)
const isPrimaryKey = ref(false)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      name.value = props.column?.name ?? ''
      type.value = props.column?.type ?? 'VARCHAR(255)'
      nullable.value = props.column?.nullable ?? false
      isPrimaryKey.value = props.column?.isPrimaryKey ?? false
    }
  },
  { immediate: true }
)

const isAddMode = !props.column

function save(): void {
  const columnData = {
    name: name.value.trim(),
    type: type.value.trim() || 'TEXT',
    nullable: nullable.value,
    isPrimaryKey: isPrimaryKey.value
  }
  if (!columnData.name) return

  if (props.column) {
    store.updateColumn(props.tableId, props.column.id, columnData)
  } else {
    store.addColumn(props.tableId, columnData)
  }
  emit('update:open', false)
}

function cancel(): void {
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[380px]">
      <DialogHeader>
        <DialogTitle>{{ isAddMode ? 'Add Column' : 'Edit Column' }}</DialogTitle>
      </DialogHeader>

      <div class="grid gap-4 py-2">
        <div class="grid gap-1.5">
          <Label for="col-name">Name</Label>
          <Input
            id="col-name"
            v-model="name"
            placeholder="column_name"
            data-testid="col-name-input"
            @keydown.enter="save"
          />
        </div>

        <div class="grid gap-1.5">
          <Label for="col-type">Type</Label>
          <Input
            id="col-type"
            v-model="type"
            placeholder="VARCHAR(255)"
            list="col-type-list"
            data-testid="col-type-input"
          />
          <datalist id="col-type-list">
            <option v-for="t in COMMON_TYPES" :key="t" :value="t" />
          </datalist>
        </div>

        <div class="flex items-center justify-between">
          <Label for="col-nullable" class="cursor-pointer">Nullable</Label>
          <Switch id="col-nullable" v-model:checked="nullable" data-testid="col-nullable-toggle" />
        </div>

        <div class="flex items-center justify-between">
          <Label for="col-pk" class="cursor-pointer">Primary Key</Label>
          <Switch id="col-pk" v-model:checked="isPrimaryKey" data-testid="col-pk-toggle" />
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" @click="cancel">Cancel</Button>
        <Button :disabled="!name.trim()" @click="save">
          {{ isAddMode ? 'Add' : 'Save' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
