<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Undo2, Plus } from 'lucide-vue-next'
import { useSchemaDesignerStore } from '@renderer/stores/useSchemaDesignerStore'
import { DATABASE_TYPE_LABELS } from '../../../../shared/types'

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

    <div class="flex-1" />

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
