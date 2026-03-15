import { toPng, toSvg } from 'html-to-image'

export async function exportDiagram(format: 'png' | 'svg', filename = 'schema'): Promise<void> {
  const viewport = document.querySelector('.vue-flow__viewport') as HTMLElement
  if (!viewport) return

  const nodeEls = viewport.querySelectorAll('.vue-flow__node')
  if (!nodeEls.length) return

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const viewportRect = viewport.getBoundingClientRect()
  const transformStyle = getComputedStyle(viewport).transform
  let scale = 1
  if (transformStyle && transformStyle !== 'none') {
    const matrix = new DOMMatrix(transformStyle)
    scale = matrix.a
  }

  for (const nodeEl of nodeEls) {
    const rect = (nodeEl as HTMLElement).getBoundingClientRect()
    const x = (rect.left - viewportRect.left) / scale
    const y = (rect.top - viewportRect.top) / scale
    const w = rect.width / scale
    const h = rect.height / scale

    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w)
    maxY = Math.max(maxY, y + h)
  }

  const padding = 40
  minX -= padding
  minY -= padding
  maxX += padding
  maxY += padding

  const width = maxX - minX
  const height = maxY - minY

  const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim()

  const options = {
    backgroundColor: bgColor ? `hsl(${bgColor})` : '#09090b',
    pixelRatio: 2,
    width: width * scale,
    height: height * scale,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${-minX}px, ${-minY}px) scale(1)`
    }
  }

  const dataUrl = format === 'png' ? await toPng(viewport, options) : await toSvg(viewport, options)

  const link = document.createElement('a')
  link.download = `${filename}.${format}`
  link.href = dataUrl
  link.click()
}
