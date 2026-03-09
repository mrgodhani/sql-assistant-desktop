import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DataTable from './DataTable.vue'

describe('DataTable', () => {
  const columns = ['id', 'name']
  const rows = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' }
  ]

  beforeEach(() => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    })
  })

  it('renders columns and rows', () => {
    const wrapper = mount(DataTable, {
      props: { columns, rows, rowCount: 3 }
    })
    expect(wrapper.text()).toContain('id')
    expect(wrapper.text()).toContain('name')
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
  })

  it('filters rows by filter text', async () => {
    const wrapper = mount(DataTable, {
      props: { columns, rows, rowCount: 3 }
    })
    await wrapper.find('input').setValue('Alice')
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).not.toContain('Bob')
  })

  it('sorts when header clicked', async () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: ['name'],
        rows: [{ name: 'Z' }, { name: 'A' }, { name: 'M' }],
        rowCount: 3
      }
    })
    await wrapper.find('th').trigger('click')
    const cells = wrapper.findAll('td')
    expect(cells[0].text()).toBe('A')
  })
})
