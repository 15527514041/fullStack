import { toBlob } from 'html-to-image'

/**
 * 把页面上的 DOM 节点渲染成 PNG(导出图片的通用能力)
 *
 * 节点在页面里长什么样,导出就是什么样:组件用 scoped 样式也没关系,
 * 因为克隆体保留了 data-v 属性,原样式照样命中,不用为导出另写一套样式。
 */
export interface ImageExportOptions {
  /** 图片顶部居中的标题;不传就只导出节点本身 */
  title?: string
  /** 四周留白(px),默认 24 */
  padding?: number
  /** 标题与内容之间的间距(px),默认 16 */
  gap?: number
  /** 缩放倍数,默认 2(2 倍图在高分屏 / 微信里更清晰) */
  pixelRatio?: number
  /** 背景色,默认白色 */
  backgroundColor?: string
}

export async function renderNodeToPng(node: HTMLElement, options: ImageExportOptions = {}): Promise<Blob> {
  const { title, padding = 24, gap = 16, pixelRatio = 2, backgroundColor = '#ffffff' } = options

  // 临时容器:固定到视口外,不打扰页面;宽度按节点当前宽度算(全局 border-box,内边距算在宽度里)
  const holder = document.createElement('div')
  Object.assign(holder.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    display: 'flex',
    flexDirection: 'column',
    gap: `${gap}px`,
    width: `${node.offsetWidth + padding * 2}px`,
    padding: `${padding}px`,
    background: backgroundColor
  })

  if (title) {
    const titleEl = document.createElement('div')
    titleEl.textContent = title
    Object.assign(titleEl.style, {
      fontSize: '20px',
      fontWeight: '600',
      lineHeight: '28px',
      textAlign: 'center',
      color: 'var(--color-text-1)'
    })
    holder.append(titleEl)
  }

  holder.append(node.cloneNode(true) as HTMLElement)
  // 必须挂到文档里:元素要真实参与布局,html-to-image 才拿得到正确的 computed style
  document.body.appendChild(holder)

  try {
    const blob = await toBlob(holder, {
      pixelRatio,
      backgroundColor,
      // holder 自己是被固定到视口外的,克隆时要把定位还原,否则渲染出来是一整张白图
      style: { position: 'static', left: '0', top: '0' }
    })
    if (!blob) throw new Error('render node to png failed')
    return blob
  } finally {
    holder.remove()
  }
}
