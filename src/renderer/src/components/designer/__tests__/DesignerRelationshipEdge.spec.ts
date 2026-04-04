import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const mockSelectEdge = vi.fn()
const mockUpdateRelationshipType = vi.fn()
const mockRemoveRelationship = vi.fn()
let mockSelectedEdgeId = ''

vi.mock('@renderer/stores/useDesignerStore', () => ({
  useDesignerStore: () => ({
    get selectedEdgeId() { return mockSelectedEdgeId },
    selectEdge: mockSelectEdge,
    updateRelationshipType: mockUpdateRelationshipType,
    removeRelationship: mockRemoveRelationship
  })
}))

vi.mock('@vue-flow/core', () => ({
  BaseEdge: { props: ['id', 'path', 'markerEnd', 'style'], template: '<path />' },
  EdgeLabelRenderer: { template: '<slot />' },
  getSmoothStepPath: () => ['/path', 50, 50]
}))

vi.mock('lucide-vue-next', () => ({ X: { template: '<span />' } }))

import DesignerRelationshipEdge from '../DesignerRelationshipEdge.vue'

const baseProps = {
  id: 'edge-1',
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  data: { type: '1:N' as const, relId: 'edge-1' }
}

describe('DesignerRelationshipEdge', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockSelectEdge.mockReset()
    mockUpdateRelationshipType.mockReset()
    mockRemoveRelationship.mockReset()
    mockSelectedEdgeId = ''
  })

  it('renders cardinality label matching data.type', () => {
    const wrapper = mount(DesignerRelationshipEdge, { props: baseProps })
    expect(wrapper.find('[data-testid="edge-label"]').text()).toBe('1:N')
  })

  it('renders 1:1 label when data.type is 1:1', () => {
    const wrapper = mount(DesignerRelationshipEdge, {
      props: { ...baseProps, data: { type: '1:1' as const, relId: 'edge-1' } }
    })
    expect(wrapper.find('[data-testid="edge-label"]').text()).toBe('1:1')
  })

  it('renders 1:N as default when data.type is undefined', () => {
    const wrapper = mount(DesignerRelationshipEdge, {
      props: { ...baseProps, data: { relId: 'edge-1' } }
    })
    expect(wrapper.find('[data-testid="edge-label"]').text()).toBe('1:N')
  })

  it('label click calls store.selectEdge with edge id', async () => {
    const wrapper = mount(DesignerRelationshipEdge, { props: baseProps })
    await wrapper.find('[data-testid="edge-label"]').trigger('click')
    expect(mockSelectEdge).toHaveBeenCalledWith('edge-1')
  })

  it('does not show cardinality popover when edge is not selected', () => {
    mockSelectedEdgeId = ''
    const wrapper = mount(DesignerRelationshipEdge, { props: baseProps })
    expect(wrapper.find('[data-testid="cardinality-popover"]').exists()).toBe(false)
  })

  it('shows cardinality popover when store.selectedEdgeId matches', () => {
    mockSelectedEdgeId = 'edge-1'
    const wrapper = mount(DesignerRelationshipEdge, { props: baseProps })
    expect(wrapper.find('[data-testid="cardinality-popover"]').exists()).toBe(true)
  })

  it('clicking a cardinality button calls store.updateRelationshipType', async () => {
    mockSelectedEdgeId = 'edge-1'
    const wrapper = mount(DesignerRelationshipEdge, { props: baseProps })
    const buttons = wrapper.findAll('[data-testid="cardinality-popover"] button')
    const oneToOneBtn = buttons.find((b) => b.text() === '1:1')
    await oneToOneBtn?.trigger('click')
    expect(mockUpdateRelationshipType).toHaveBeenCalledWith('edge-1', '1:1')
  })

  it('delete button calls store.removeRelationship', async () => {
    mockSelectedEdgeId = 'edge-1'
    const wrapper = mount(DesignerRelationshipEdge, { props: baseProps })
    await wrapper.find('[data-testid="edge-delete"]').trigger('click')
    expect(mockRemoveRelationship).toHaveBeenCalledWith('edge-1')
  })
})
