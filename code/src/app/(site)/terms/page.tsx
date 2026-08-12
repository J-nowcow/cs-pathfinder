import type { Metadata } from 'next'

/**
 * 이용약관.
 *
 * **틀린 약관은 없는 것보다 나쁘다.** 그래서 지킬 수 있는 것만 적는다 —
 * 개인이 운영하는 무료 서비스가 기업 약관을 흉내 내면, 안 지키는 조항이
 * 생기고 그 순간 문서 전체가 못 믿을 것이 된다. `/privacy`의 원칙
 * ("코드에서 확인한 것만")과 같은 결이다.
 *
 * 준거법·분쟁 조항을 안 넣는 이유도 같다. 넣는 순간 그 절차를 실제로
 * 감당할 수 있어야 하는데, 그럴 몸집이 아니다. 문의 창구가 실제 절차다.
 */
export const metadata: Metadata = {
  title: '이용약관',
  description: 'CS 길라잡이가 약속하는 것과 약속하지 않는 것.',
}

/** 이 약관이 마지막으로 사실과 대조된 날 */
const REVIEWED = '2026년 8월 13일'
const CONTACT = 'wkdgusdn0321@naver.com'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-[17px] font-bold leading-[1.45]">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-[1.75] text-muted">{children}</div>
    </section>
  )
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-[680px] px-5 py-10">
      <h1 className="text-[24px] font-bold leading-[1.35]">이용약관</h1>
      <p className="mt-3 text-[15px] leading-[1.75] text-muted">
        CS 길라잡이(이하 &lsquo;서비스&rsquo;)를 쓰실 때의 약속입니다. 짧습니다 — 지킬 수 있는
        것만 적었기 때문입니다.
      </p>
      <p className="mt-2 text-[13px] text-faint">사실과 대조한 날: {REVIEWED}</p>

      <Section title="1. 이 서비스는 무엇인가">
        <p>
          CS 면접 질문과 해설을 읽고, 꼬리질문으로 파고드는 무료 학습 서비스입니다. 가입 없이
          전부 쓸 수 있고, 구글 로그인을 하면 학습 기록이 계정에 저장됩니다. 개인이 만들어 운영합니다.
        </p>
      </Section>

      <Section title="2. 해설의 정확성 — 가장 중요한 조항">
        <p>
          <strong className="text-ink">해설 초안은 AI가 쓰고, 틀릴 수 있습니다.</strong> 얼마나
          틀리는지 재서{' '}
          <a
            className="rounded-sm underline decoration-dotted underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href="https://github.com/J-nowcow/cs-pathfinder/tree/main/code/docs/audit"
          >
            공개된 기록
          </a>
          으로 남기고 있지만, 오류가 0이라고 약속하지 않습니다.
        </p>
        <p>
          면접에서 하는 답변의 책임은 답한 사람에게 있습니다. 이 서비스는 학습을 돕는 참고
          자료이지, 정답을 보증하는 교재가 아닙니다. 틀린 곳을 찾으면 화면 위{' '}
          <strong className="text-ink">문의</strong>로 알려 주시기 바랍니다 — 가장 반기는 기여입니다.
        </p>
      </Section>

      <Section title="3. AI 입력란에 적는 것">
        <ul className="ml-4 list-disc space-y-2">
          <li>꼬리질문 입력과 레쥬메 내용은 질문을 만드는 AI에 전달됩니다. 입력란에도 같은 안내가 있습니다.</li>
          <li>이름·연락처 같은 개인정보는 적지 마시기 바랍니다. 자동 검사가 막기도 하지만 완전하지 않습니다.</li>
          <li>레쥬메 원문은 서버에 저장하지 않습니다. 만든 질문은 현재 브라우저에만 남습니다.</li>
          <li>CS 학습과 무관한 요청(코드 대필·번역·잡담)은 거절됩니다.</li>
          <li>하루 사용 한도가 있습니다. 남은 횟수는 입력 칸 옆에 보입니다.</li>
        </ul>
      </Section>

      <Section title="4. 콘텐츠를 가져다 쓰는 것">
        <p>
          해설 전문과 코드는{' '}
          <a
            className="rounded-sm underline decoration-dotted underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href="https://github.com/J-nowcow/cs-pathfinder"
          >
            GitHub 저장소
          </a>
          에 MIT 라이선스로 공개돼 있습니다. 자유롭게 쓰되, 출처를 남겨 주시면 고맙겠습니다.
          단 해설에 오류가 있을 수 있으므로(2조) 가져다 쓴 결과의 책임은 가져간 쪽에 있습니다.
        </p>
      </Section>

      <Section title="5. 서비스의 변경과 중단">
        <p>
          무료로 운영하는 개인 서비스라 예고 없이 바뀌거나 멈출 수 있습니다. 대신 콘텐츠는
          저장소에 남습니다 — 서비스가 사라져도 해설은 읽을 수 있습니다.
        </p>
      </Section>

      <Section title="6. 하지 말아 달라는 것">
        <ul className="ml-4 list-disc space-y-2">
          <li>자동화 도구로 과도한 요청을 보내는 것. 하루 한도는 사람 기준입니다.</li>
          <li>다른 사람의 개인정보를 입력하는 것.</li>
          <li>서비스를 사칭하거나, 여기서 만든 것을 서비스 공식 자료처럼 배포하는 것.</li>
        </ul>
      </Section>

      <Section title="7. 문의">
        <p>
          약관에 대한 질문, 오류 신고, 그 밖의 무엇이든 —{' '}
          <a className="rounded-sm underline decoration-dotted underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>{' '}
          또는 GitHub 이슈로 보내 주세요. 개인정보를 어떻게 다루는지는{' '}
          <a className="rounded-sm underline decoration-dotted underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" href="/privacy">
            개인정보처리방침
          </a>
          에 따로 있습니다.
        </p>
      </Section>
    </main>
  )
}
