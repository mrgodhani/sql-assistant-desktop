<script setup lang="ts">
import { computed, ref } from 'vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Filter, Search } from 'lucide-vue-next'

const props = defineProps<{
  tables: string[]
  modelValue: string[] | null
  selectedNodeId?: string | null
  getConnectedIds?: (nodeId: string) => string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[] | null]
}>()

const searchQuery = ref('')

const selectedSet = computed(() => {
  if (props.modelValue === null) return new Set(props.tables.map((id) => id.toLowerCase()))
  return new Set(props.modelValue.map((id) => id.toLowerCase()))
})

const lowerToOriginal = computed(
  () => new Map(props.tables.map((id) => [id.toLowerCase(), id]))
)

const filteredTables = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return props.tables
  return props.tables.filter((id) => id.toLowerCase().includes(q))
})

function isChecked(tableId: string): boolean {
  return selectedSet.value.has(tableId.toLowerCase())
}

function toggle(tableId: string, checked: boolean): void {
  const lower = tableId.toLowerCase()
  let newSet: Set<string>
  if (props.modelValue === null) {
    newSet = new Set(props.tables.map((id) => id.toLowerCase()))
  } else {
    newSet = new Set(props.modelValue.map((id) => id.toLowerCase()))
  }

  if (checked) {
    newSet.add(lower)
  } else {
    newSet.delete(lower)
  }

  if (newSet.size === 0) {
    emit('update:modelValue', [])
    return
  }
  if (newSet.size === props.tables.length) {
    emit('update:modelValue', null)
    return
  }
  emit('update:modelValue', Array.from(newSet).map((l) => lowerToOriginal.value.get(l) ?? l))
}

function selectAll(): void {
  emit('update:modelValue', null)
}

function deselectAll(): void {
  emit('update:modelValue', [])
}

function connectedToSelected(): void {
  if (!props.selectedNodeId || !props.getConnectedIds) return
  const ids = props.getConnectedIds(props.selectedNodeId)
  emit('update:modelValue', ids.length === props.tables.length ? null : ids)
}
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="outline" size="sm">
        <Filter class="size-3.5 mr-1" />
        Filter tables
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[280px] p-0" align="start">
      <div class="flex flex-col gap-2 p-3">
        <div class="relative">
          <Search
            class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
          />
          <Input
            v-model="searchQuery"
            placeholder="Search tables..."
            class="pl-8 h-8 text-sm"
          />
        </div>
        <div class="max-h-[240px] overflow-y-auto space-y-1.5 pr-1">
          <label
            v-for="tableId in filteredTables"
            :key="tableId"
            class="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-accent text-sm"
          >
            <Checkbox
              :checked="isChecked(tableId)"
              @update:checked="(v) => toggle(tableId, v === true)"
            />
            <span class="truncate">{{ tableId }}</span>
          </label>
          <p v-if="filteredTables.length === 0" class="text-xs text-muted-foreground px-2 py-1.5">
            No tables match
          </p>
        </div>
        <div class="flex flex-wrap gap-1 pt-1 border-t border-border">
          <Button variant="ghost" size="sm" class="h-7 text-xs" @click="selectAll">
            Select all
          </Button>
          <Button variant="ghost" size="sm" class="h-7 text-xs" @click="deselectAll">
            Deselect all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-7 text-xs"
            :disabled="!selectedNodeId"
            @click="connectedToSelected"
          >
            Connected to selected
          </Button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
