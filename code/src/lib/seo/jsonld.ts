// Editorial explanations are Articles, not user-submitted QAPage answers.

/** 도식·콜아웃 펜스와 표를 걷어내고 문단 평문만 남긴다 */
export function plainText(body: string): string {
  const out: string[] = []
  let inFence = false
  for (const line of body.split('\n')) {
    const t = line.trim()
    if (t.startsWith(':::')) {
      /*
       * 콜아웃(note·warn)은 글이라 남기고 싶지만, 열림과 닫힘을 구분해야
       * 한다. 여는 줄(`:::note`)은 이름이 붙고 닫는 줄은 `:::` 홑이다.
       * 도식(flow 등)과 콜아웃을 가르는 것보다 펜스 안을 통째로 빼는 쪽이
       * 단순하고, 콜아웃 문장이 빠져도 답의 뼈대는 문단에 있다.
       */
      inFence = t !== ':::' ? true : false
      continue
    }
    if (inFence) continue
    if (t.startsWith('|')) continue
    if (t.length === 0) continue
    out.push(
      t
        .replace(/==([^=]+)==/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1'),
    )
  }
  return out.join(' ')
}

/**
 * `</script>`가 본문에 오면 스크립트 블록이 그 자리에서 닫힌다.
 * JSON 안의 `<`를 유니코드로 바꾸면 뜻은 같고 닫힘은 없다.
 */
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function questionArticleJsonLd(args: {
  question: string
  body: string
  url: string
  dateCreated?: string
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: args.question,
    articleBody: plainText(args.body),
    url: args.url,
    mainEntityOfPage: args.url,
    inLanguage: 'ko',
    ...(args.dateCreated ? { dateCreated: args.dateCreated } : {}),
  }
}

export function webSiteJsonLd(args: { name: string; url: string; description: string }): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': new URL('/#website', args.url).href,
    name: args.name,
    url: args.url,
    description: args.description,
    inLanguage: 'ko',
  }
}
