import { Fragment } from 'react'
import { parseInline, splitParagraphs } from '@/lib/markdown/inline'

/**
 * 해설 본문 렌더러.
 *
 * dangerouslySetInnerHTML을 쓰지 않는다. 자유 입력이 전역 자산이 되므로
 * 오염이 증폭되고, HTML 경로를 아예 두지 않는 편이 정화보다 확실하다.
 */
export function Prose({ body }: { body: string }) {
  return (
    <div className="prose-body text-[16px] text-ink sm:text-[17px]">
      {splitParagraphs(body).map((para, i) => (
        <p key={i}>
          {parseInline(para).map((t, j) => (
            <Fragment key={j}>
              {t.type === 'bold' ? (
                <strong>{t.value}</strong>
              ) : t.type === 'code' ? (
                <code>{t.value}</code>
              ) : (
                t.value
              )}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  )
}
