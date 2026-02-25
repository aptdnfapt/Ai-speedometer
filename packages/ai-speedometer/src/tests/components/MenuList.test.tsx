import { describe, test, expect, mock } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { MenuList } from '../../tui/components/MenuList.tsx'

const ITEMS = [
  { label: 'Item One' },
  { label: 'Item Two' },
  { label: 'Item Three' },
]

describe('MenuList', () => {
  test('renders all items', async () => {
    const s = await testRender(
      <MenuList items={ITEMS} onSelect={mock()} />,
      { width: 40, height: 10 }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('Item One')
    expect(frame).toContain('Item Two')
    expect(frame).toContain('Item Three')
  })

  test('highlights first item by default with › arrow', async () => {
    const s = await testRender(
      <MenuList items={ITEMS} onSelect={mock()} />,
      { width: 40, height: 10 }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('›')
  })

  test('snapshot: MenuList 3 items selected=0', async () => {
    const s = await testRender(
      <MenuList items={ITEMS} selectedIndex={0} onSelect={mock()} />,
      { width: 40, height: 10 }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toMatchSnapshot()
  })

  test('snapshot: MenuList 3 items selected=2', async () => {
    const s = await testRender(
      <MenuList items={ITEMS} selectedIndex={2} onSelect={mock()} />,
      { width: 40, height: 10 }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toMatchSnapshot()
  })
})
