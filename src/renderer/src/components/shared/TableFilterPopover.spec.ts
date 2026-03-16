import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import TableFilterPopover from './TableFilterPopover.vue'

const TABLES = ['dbo.Orders', 'dbo.Customers', 'dbo.Products']

// Stubs for shadcn-vue / reka-ui components that use portals or complex DOM behaviour
const globalStubs = {
  Popover: {
    template: '<div><slot /><slot name="content" /></div>',
    props: ['open'],
    emits: ['update:open']
  },
  PopoverTrigger: { template: '<div><slot /></div>' },
  PopoverContent: { template: '<div><slot /></div>' },
  Checkbox: {
    template: '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
    props: ['modelValue'],
    emits: ['update:modelValue']
  },
  Button: { template: '<button @click="$emit(\'click\')"><slot /></button>', emits: ['click'] },
  Input: {
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue'],
    emits: ['update:modelValue']
  }
}

function mountPopover(
  modelValue: string[] | null = null
): ReturnType<typeof mount<typeof TableFilterPopover>> {
  return mount(TableFilterPopover, {
    props: { tables: TABLES, modelValue },
    global: { stubs: globalStubs }
  })
}

describe('TableFilterPopover — deferred-apply model', () => {
  it('all tables are shown as checked when modelValue is null (no filter)', () => {
    const wrapper = mountPopover(null)
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes).toHaveLength(TABLES.length)
    checkboxes.forEach((cb) => expect((cb.element as HTMLInputElement).checked).toBe(true))
  })

  it('only selected tables appear checked when modelValue has a subset', () => {
    const wrapper = mountPopover(['dbo.Orders'])
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    const checked = checkboxes.filter((cb) => (cb.element as HTMLInputElement).checked)
    expect(checked).toHaveLength(1)
  })

  it('toggling a checkbox does NOT emit update:modelValue immediately', async () => {
    const wrapper = mountPopover(null)
    const first = wrapper.findAll('input[type="checkbox"]')[0]
    await first.setValue(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('clicking Apply emits update:modelValue with current pending selection', async () => {
    const wrapper = mountPopover(null)

    // Uncheck the first table (dbo.Orders)
    const first = wrapper.findAll('input[type="checkbox"]')[0]
    await first.setValue(false)

    // Click Apply
    const applyBtn = wrapper.findAll('button').find((b) => b.text().includes('Apply'))
    await applyBtn!.trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    const payload = emitted![0][0] as string[] | null
    // Should contain the two tables that are still checked
    expect(Array.isArray(payload)).toBe(true)
    expect(payload).not.toContain('dbo.Orders')
    expect(payload).toContain('dbo.Customers')
    expect(payload).toContain('dbo.Products')
  })

  it('clicking Clear emits update:modelValue with null', async () => {
    const wrapper = mountPopover(['dbo.Orders'])
    const clearBtn = wrapper.findAll('button').find((b) => b.text().includes('Clear'))
    await clearBtn!.trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toBeNull()
  })

  it('external modelValue change (e.g. badge × click) resets localPending', async () => {
    const wrapper = mountPopover(['dbo.Orders'])

    // Simulate external reset to null (badge clear button clicked)
    await wrapper.setProps({ modelValue: null })
    await nextTick()

    // All checkboxes should now be checked
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    checkboxes.forEach((cb) => expect((cb.element as HTMLInputElement).checked).toBe(true))
  })

  it('Select all sets localPending to null (all tables visible)', async () => {
    const wrapper = mountPopover(['dbo.Orders'])
    const selectAllBtn = wrapper.findAll('button').find((b) => b.text().includes('Select all'))
    await selectAllBtn!.trigger('click')

    // Should not have emitted yet (deferred)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    // All checkboxes should now appear checked
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    checkboxes.forEach((cb) => expect((cb.element as HTMLInputElement).checked).toBe(true))
  })

  it('Deselect all sets localPending to empty array', async () => {
    const wrapper = mountPopover(null)
    const deselectBtn = wrapper.findAll('button').find((b) => b.text().includes('Deselect all'))
    await deselectBtn!.trigger('click')
    await flushPromises()

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    checkboxes.forEach((cb) => expect((cb.element as HTMLInputElement).checked).toBe(false))
  })
})
