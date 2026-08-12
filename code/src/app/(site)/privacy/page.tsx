import type { Metadata } from 'next'

/**
 * 개인정보처리방침.
 *
 * **계정이 생기기 전에 이미 필요하다.** 지금도 개인정보를 처리하고 있기
 * 때문이다 — 하루 한도를 세려고 IP를 저장하고(`quota/key.ts`), 추천을 한 번만
 * 세려고 브라우저에 식별자 쿠키를 심는다(`vote/identity.ts`). 개인정보 보호법
 * 제2조는 "업무를 목적으로" 개인정보파일을 운용하는 개인도 처리자로 본다.
 * 사업자 등록 여부와 무관하다.
 *
 * 그래서 로그인 버튼보다 **먼저** 올린다. 버튼이 먼저 나가면 그 시점부터
 * 위반이다.
 *
 * **여기 적힌 것은 코드에서 확인한 것만이다.** 있어 보이려고 항목을 늘리지
 * 않았다. 방침에 적었는데 안 하는 것도, 하는데 안 적은 것도 둘 다 문제다.
 * 수집 항목을 바꾸면 이 파일도 같이 바꿔야 한다.
 */
export const metadata: Metadata = {
  title: '개인정보처리방침',
  description: 'CS 길라잡이가 무엇을 저장하고 무엇을 저장하지 않는지.',
}

/** 이 방침이 마지막으로 사실과 대조된 날 */
const REVIEWED = '2026년 8월 10일'
const CONTACT = 'wkdgusdn0321@naver.com'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-[17px] font-bold leading-[1.45]">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-[1.75] text-muted">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[680px] px-5 py-10">
      <h1 className="text-[24px] font-bold leading-[1.35]">개인정보처리방침</h1>
      <p className="mt-3 text-[15px] leading-[1.75] text-muted">
        CS 길라잡이(이하 &lsquo;서비스&rsquo;)는 가입 없이 쓸 수 있습니다. 그래도 서비스를 돌리는 데
        필요한 최소한을 저장합니다. 무엇을 저장하고 무엇을 저장하지 않는지 아래에 적습니다.
      </p>
      <p className="mt-2 text-[13px] text-faint">사실과 대조한 날: {REVIEWED}</p>

      <Section title="1. 무엇을 저장하는가">
        <p>지금 저장하는 것은 셋뿐입니다.</p>
        <ul className="ml-4 list-disc space-y-2">
          <li>
            <strong className="text-ink">IP 주소</strong> — 하루에 새 해설을 몇 개까지 만들 수
            있는지 세는 데만 씁니다. 이 값이 없으면 한 사람이 서비스 전체의 생성 비용을 소진할 수
            있습니다.
          </li>
          <li>
            <strong className="text-ink">추천 식별 쿠키(<code>cspf_vid</code>)</strong> — 브라우저마다 한 번씩
            만드는 임의의 값입니다. &ldquo;이 브라우저가 이 글에 이미 추천했는가&rdquo;를 판단하는 데만
            씁니다. 이름·이메일과 이어지지 않고, 이 값만으로는 누구인지 알 수 없습니다.
          </li>
          <li>
            <strong className="text-ink">로그인하면, 이메일 주소</strong> — 계정을 알아보고 탈퇴
            요청에 응답하는 데 씁니다. 이름·프로필 사진은 구글이 보내와도{' '}
            <strong className="text-ink">받지 않습니다.</strong> 로그인 상태는 서버의 세션 표에
            남고, 탈퇴하면 그 자리에서 지워집니다 — 다른 기기의 로그인도 그 순간 끝납니다.
          </li>
        </ul>
        <p>
          <strong className="text-ink">저장하지 않는 것</strong> — 이름, 프로필 사진, 전화번호,
          생년월일, 성별, 결제 정보. 로그인은 선택이고, 로그인해도 이메일 밖의 것은 받지 않습니다.
        </p>
        <p>
          어떤 질문을 눌러 어디까지 파고들었는지를 나타내는 <strong className="text-ink">지도</strong>와,
          날짜별로 몇 편을 파고들었는지 나타내는 <strong className="text-ink">학습 기록(잔디)</strong>은 기본적으로
          브라우저 안(localStorage)에 있습니다. <strong className="text-ink">로그인하지 않으면 서버로
          보내지 않습니다.</strong> 브라우저 저장소를 비우면 같이 사라지고, 다른 기기에서는 보이지
          않습니다.
        </p>
        <p>
          <strong className="text-ink">로그인하면 이 두 기록을 계정에 저장합니다</strong> — 기기를
          바꿔도 이어보게 하기 위해서입니다. 저장하는 것은 질문 번호·날짜·파고든 경로의 모양뿐입니다.
          무엇을 검색했는지, 어떤 글을 얼마나 오래 봤는지는 여전히 적지 않습니다. 탈퇴하면 계정에
          저장된 기록도 그 자리에서 함께 지워집니다.
        </p>
      </Section>

      <Section title="2. 왜 저장하는가">
        <p>
          IP는 <strong className="text-ink">하루 생성 한도</strong>를 세기 위해서입니다. 추천 쿠키는{' '}
          <strong className="text-ink">중복 추천을 막기 위해서</strong>입니다. 그 밖의 목적으로 쓰지
          않습니다. 광고를 붙이지 않고, 광고 식별자나 행동 추적 스크립트를 심지 않습니다.
        </p>
      </Section>

      <Section title="3. 얼마나 보관하는가">
        <ul className="ml-4 list-disc space-y-2">
          <li>하루 한도 기록(IP) — 날짜 단위로 쌓이며, 목적을 다한 기록은 지웁니다.</li>
          <li>추천 식별 쿠키 — 브라우저에 1년. 브라우저에서 쿠키를 지우면 즉시 사라집니다.</li>
          <li>추천 기록 — 어떤 식별자가 어떤 글에 추천했는지. 추천을 되돌리면 지웁니다.</li>
          <li>
            로그인 계정과 세션 — 탈퇴를 요청하면 그 자리에서 지웁니다. 세션 행이 지워지는 순간
            모든 기기에서 로그아웃됩니다.
          </li>
          <li>
            계정에 저장된 학습 기록(지도·잔디) — 계정이 지워지면 함께 지워지도록 데이터베이스
            차원에서 묶여 있습니다.
          </li>
        </ul>
      </Section>

      <Section title="4. 어디에 맡기는가">
        <p>
          서비스를 돌리려고 아래 사업자의 설비를 씁니다. 이들은 <strong className="text-ink">해외에
          서버를 둡니다.</strong>
        </p>
        <ul className="ml-4 list-disc space-y-2">
          <li>
            <strong className="text-ink">Vercel</strong> — 웹사이트 실행과 접속 기록
          </li>
          <li>
            <strong className="text-ink">Neon</strong> — 데이터베이스 보관
          </li>
          <li>
            <strong className="text-ink">Google (Gemini API)</strong> — 해설 생성과 질문
            임베딩(비슷한 질문을 찾으려고 문장을 숫자로 바꾸는 일). 두 경우 모두 질문의{' '}
            <em>내용</em>만 전달됩니다. IP나 쿠키 값은 보내지 않습니다.
          </li>
          <li>
            <strong className="text-ink">Google (로그인)</strong> — 구글 계정으로 로그인할 때
            인증은 구글이 처리합니다. 서비스가 받는 것은 이메일 주소뿐입니다.
          </li>
        </ul>
        <p>이들에게 개인정보를 팔거나 광고 목적으로 넘기지 않습니다.</p>
      </Section>

      <Section title="5. 쿠키를 거부할 수 있는가">
        <p>
          있습니다. 브라우저 설정에서 이 사이트의 쿠키를 막으면 됩니다. 막아도 읽는 데는 아무 지장이
          없습니다. 추천이 &ldquo;이미 눌렀는지&rdquo;를 기억하지 못할 뿐입니다.
        </p>
      </Section>

      <Section title="6. 권리와 행사 방법">
        <p>
          열람·정정·삭제·처리정지를 요구할 수 있습니다. 아래 연락처로 알려 주면 처리하고 결과를
          알립니다. 다만 <strong className="text-ink">계정이 없어서 요청한 사람과 저장된 기록을
          이어 줄 방법이 제한적입니다.</strong> IP나 쿠키 값을 함께 알려 주면 찾을 수 있습니다.
        </p>
        <p>
          가장 빠른 방법은 브라우저에서 직접 지우는 것입니다. 쿠키와 사이트 데이터를 지우면 이
          브라우저에 남은 것은 그 자리에서 사라집니다.
        </p>
      </Section>

      <Section title="7. 안전하게 지키려고 하는 것">
        <p>
          추천 식별 쿠키는 <code>httpOnly</code>로 둡니다. 페이지 스크립트가 읽지 못하므로 확장
          프로그램이나 스크립트 삽입으로 남의 식별자를 바꿔치기하는 길이 하나 줄어듭니다. 통신은
          전 구간 HTTPS입니다. 데이터베이스 접속 정보는 코드에 넣지 않고 실행 환경에만 둡니다.
        </p>
      </Section>

      <Section title="8. 문의">
        <p>
          개인정보에 관한 문의는 아래로 받습니다. 서비스 운영자가 직접 답합니다.
        </p>
        <p>
          <a className="text-accent underline underline-offset-2" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
        </p>
        <p>
          개인정보 침해로 도움이 필요하면 개인정보침해신고센터(국번 없이 118,{' '}
          <a
            className="text-accent underline underline-offset-2"
            href="https://privacy.kisa.or.kr"
            rel="noopener noreferrer"
            target="_blank"
          >
            privacy.kisa.or.kr
          </a>
          )에 문의할 수 있습니다.
        </p>
      </Section>

      <Section title="9. 바뀌면">
        <p>
          저장하는 항목이나 맡기는 곳이 바뀌면 이 문서를 먼저 고치고 서비스에 반영합니다. 바뀐
          내용은 이 페이지 맨 위의 날짜로 알 수 있습니다.
        </p>
      </Section>
    </main>
  )
}
