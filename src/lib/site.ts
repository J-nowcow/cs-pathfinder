/**
 * 이 사이트의 절대 주소.
 *
 * OG 이미지는 상대 경로로 못 쓴다. 카톡·트위터 크롤러가 남의 서버에서 태그를
 * 읽기 때문에 `/opengraph-image.png`만 주면 자기 도메인에서 찾는다. Next는
 * metadataBase를 기준으로 절대 주소를 만들어주는데, 그 기준을 안 주면 추론한다.
 *
 * 추론에 맡기면 프로덕션에서 배포마다 바뀌는 임시 주소가 박힌다. 그 배포가
 * 밀려나면 예전에 공유한 링크의 미리보기가 통째로 깨진다. 공유가 핵심 기능이라
 * 그 상태로 두면 안 된다.
 *
 * 우선순위가 있다.
 * 1. NEXT_PUBLIC_SITE_URL — 직접 지정. 도메인을 붙이면 여기만 바꾸면 된다
 * 2. 프리뷰 배포 — 자기 주소. 프리뷰 미리보기가 프로덕션을 가리키면 확인이 안 된다
 * 3. 프로덕션 — VERCEL_PROJECT_PRODUCTION_URL. Vercel이 주는 안정된 도메인이다
 * 4. 로컬
 */
const LOCAL = 'http://localhost:3000'

function resolve(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) return explicit

  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (production) return `https://${production}`

  return LOCAL
}

export const SITE_URL = resolve()

export function siteUrl(): URL {
  try {
    return new URL(SITE_URL)
  } catch {
    // 환경변수에 오타가 나면 빌드가 아니라 미리보기만 조용히 깨진다.
    // 로컬로 떨어뜨리고 넘어간다. 태그가 없는 것보다는 낫다.
    return new URL(LOCAL)
  }
}

/**
 * 기본 공유 이미지 경로.
 *
 * 트리마다 다른 이미지를 그리려면 Satori에 한글 폰트를 실어야 한다. 지금은
 * 한 장으로 간다. 카톡 카드는 제목을 따로 보여주므로 어느 질문인지는 거기서 읽힌다.
 */
export const OG_IMAGE_PATH = '/opengraph-image.png'

/**
 * 공유 태그 한 벌.
 *
 * **generateMetadata가 openGraph를 반환하면 Next가 파일 규약(app/opengraph-image.png)을
 * 합쳐주지 않는다.** 그래서 페이지마다 이미지를 직접 넣어야 하는데, 이걸 두 번
 * 빠뜨렸다. 하필 공유 링크에만 썸네일이 없어지는 형태라 눈에도 잘 안 띈다.
 *
 * 페이지가 늘 때마다 같은 실수가 나므로 한 자리에 모은다. 절대 주소는
 * metadataBase가 펴준다.
 */
export function socialMeta(args: {
  title: string
  description: string
  /** 질문·트리처럼 내용이 있는 문서면 article. 기본은 website */
  type?: 'article' | 'website'
}) {
  const images = [OG_IMAGE_PATH]

  return {
    openGraph: {
      title: args.title,
      description: args.description,
      type: args.type ?? 'website',
      locale: 'ko_KR',
      images,
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: args.title,
      description: args.description,
      images,
    },
  }
}
