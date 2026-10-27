import { PMP_QUERY_LIMIT } from '@/lib/pmp/search'

export function PmpSearchForm({
  query = '',
  error,
}: {
  query?: string
  error?: 'long' | 'multiple' | null
}) {
  return (
    <form
      action="/learn/pmp/search"
      method="get"
      autoComplete="off"
      role="search"
      className="pmp-search-form"
    >
      <label htmlFor="pmp-query">수업 찾기</label>
      <div>
        <input
          id="pmp-query"
          name="q"
          type="search"
          defaultValue={query}
          maxLength={PMP_QUERY_LIMIT}
          placeholder="예: 음수 여유, CPI, 이해관계자"
          aria-describedby="pmp-search-help pmp-search-scope"
          aria-invalid={!!error}
        />
        <button type="submit">찾기</button>
      </div>
      <p id="pmp-search-help">
        여러 단어를 입력하면 모두 포함한 수업을 찾습니다. 검색어는{' '}
        {PMP_QUERY_LIMIT}자까지 입력하세요.
      </p>
      <p id="pmp-search-scope">
        제목·본문·표·심화 설명·수업 용어에서 찾습니다. 별도 사례와 실습 화면,
        개인 메모는 제외합니다.
      </p>
      <p className="pmp-search-url-note">
        검색어는 주소에 남습니다. 개인정보나 비공개 답안은 입력하지 마세요.
      </p>
      {error ? (
        <p role="alert">
          {error === 'long'
            ? '검색어가 너무 깁니다. 앞부분 120자만 표시했습니다. 줄이거나 다시 입력해 주세요.'
            : '검색어는 하나만 입력해 주세요.'}
        </p>
      ) : null}
    </form>
  )
}
