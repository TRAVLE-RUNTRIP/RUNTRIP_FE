import type { ReactNode } from 'react'

interface ScreenProps {
  /** 기능명세서의 화면 ID (예: M-10). 개발 중 확인용으로 보여줘요. */
  id: string
  title: string
  children?: ReactNode
}

/** 화면 뼈대. 각 화면 이슈(#3~#11)에서 실제 UI로 바꿔요. */
export function Screen({ id, title, children }: ScreenProps) {
  return (
    <section className="screen-body">
      <header className="screen-header">
        <span className="screen-id">{id}</span>
        <h1>{title}</h1>
      </header>
      {children}
    </section>
  )
}
