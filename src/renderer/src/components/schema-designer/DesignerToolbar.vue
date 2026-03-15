<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Undo2, Plus, Filter, X, Download, RotateCcw } from 'lucide-vue-next'
import { useSchemaDesignerStore } from '@renderer/stores/useSchemaDesignerStore'
import { DATABASE_TYPE_LABELS } from '../../../../shared/types'
import { exportDiagram } from '@/lib/export-diagram'
import DesignerTableFilterPopover from './DesignerTableFilterPopover.vue'

const store = useSchemaDesignerStore()
</script>

<template>
  <div class="flex items-center gap-3 border-b border-border bg-background px-4 py-2">
    <Badge v-if="store.session" variant="outline">
      {{ DATABASE_TYPE_LABELS[store.session.dialect] }}
    </Badge>
    <span class="text-sm font-medium">Schema Designer</span>
    <span v-if="store.schema" class="text-xs text-muted-foreground">
      {{ store.schema.tables.length }} table{{ store.schema.tables.length !== 1 ? 's' : '' }}
    </span>

    <DesignerTableFilterPopover />

    <Badge
      v-if="store.hasFilter"
      variant="secondary"
      class="gap-1.5 pl-2 pr-1 cursor-pointer hover:bg-secondary/80"
      @click="store.clearFilter"
    >
      <Filter class="size-3" />
      Showing {{ store.filteredTables?.length }} of {{ store.schema?.tables.length }}
      <X class="size-3 text-muted-foreground hover:text-foreground" />
    </Badge>

    <div class="flex-1" />

    <Button v-if="store.hasSchema" variant="outline" size="sm" @click="store.clearNodePositions">
      <RotateCcw class="size-3.5 mr-1" />
      Re-layout
    </Button>
    <DropdownMenu v-if="store.hasSchema">
      <DropdownMenuTrigger as-child>
        <Button variant="outline" size="sm">
          <Download class="size-3.5 mr-1" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem @click="() => exportDiagram('png', 'designer-erd')">
          Export PNG
        </DropdownMenuItem>
        <DropdownMenuItem @click="() => exportDiagram('svg', 'designer-erd')">
          Export SVG
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Button v-if="store.canUndo" variant="outline" size="sm" @click="store.undo">
      <Undo2 class="size-3.5 mr-1" />
      Undo
    </Button>
    <Button variant="outline" size="sm" @click="store.endSession">
      <Plus class="size-3.5 mr-1" />
      New Session
    </Button>
  </div>
</template>
