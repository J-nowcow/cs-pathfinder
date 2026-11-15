import { WebRequestLesson } from '@/components/web-request/WebRequestLesson'
import { learningMetadata, learningJsonLd } from '@/lib/seo/learning'
import { serializeJsonLd } from '@/lib/seo/jsonld'
import '@/app/study-poc/study-poc.css'

export const dynamic = 'force-static'
export const metadata = learningMetadata('/learn/web-request')

export default function WebRequestPage() {
  const json = learningJsonLd('/learn/web-request')
  return <>
    {json && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(json) }} />}
    <WebRequestLesson />
    <noscript><style>{'.wr-lesson[data-web-request-interactive]{display:none!important}'}</style><article className="study-poc sp-nojs">
      <h1>웹 요청에서 DB 조회까지</h1>
      <p>HTTP는 브라우저와 앱 서버가 요청·응답을 주고받는 규칙입니다. 앱 서버는 요청을 받아 코드를 실행합니다.</p>
      <h2>두 연결의 양 끝</h2><p>준비된 웹 연결 W1은 브라우저↔앱 서버, DB 연결 C1은 앱 서버↔DB 구간입니다. 풀은 연결을 보관하고 빌려주는 앱의 구성 요소이며 C1은 사용할 수 있는 상태입니다.</p>
      <h2>조회 요청과 서버 코드</h2><p>브라우저가 GET /counters/7을 보내면 앱은 주소의 7을 행의 id로 사용합니다. SQL은 DB에 보내는 명령입니다. 이 코드에서는 C1을 빌려 SELECT value FROM counters WHERE id = 7을 보내고 숫자 0을 받습니다. 앱이 C1을 반납한 뒤 W1으로 정상 처리 상태 200과 본문 {`{"value":0}`}을 응답합니다. JSON은 데이터를 텍스트로 표현하는 형식이며 본문의 value에 숫자 0을 담습니다.</p>
      <h2>응답 완료 뒤 재사용</h2><p>브라우저가 응답을 받아도 W1은 열려 있습니다. 같은 W1으로 두 번째 요청을 보내면 이 서버 코드는 C1을 다시 빌려 SELECT를 다시 실행합니다. C1 반납·브라우저 응답 수신·W1 닫힘은 별도 사건입니다. W1을 닫아도 C1은 앱의 풀에 남습니다.</p>
      <h2>DB가 없는 서버 코드</h2><p>새 상황의 GET /version 코드가 고정값 {`{"version":1}`}만 반환한다면 C1을 빌릴 필요가 없습니다. 요청과 응답은 W1을 사용합니다. 고정값은 서버 코드에 직접 적은 숫자입니다.</p>
      <details><summary>예시의 조건</summary><p>HTTPS로 보호된 HTTP/1.1 연결이 준비된 상태에서 두 요청을 순서대로 보냅니다. 응답 캐시·프록시·동시 요청·실패는 제외합니다. W1의 HTTP 메시지는 복호화한 학습용 표현이며 DNS·TCP·TLS 내부는 다루지 않습니다. 반납 후 응답하는 순서는 선택한 코드의 예시입니다. 장면은 브라우저에 저장하지 않습니다.</p></details>
      <p>직접 요청을 보내고 시간선을 움직이려면 JavaScript를 켜 주세요.</p><a href="/learn/db-connections">DB 연결·잠금·대기 다시 보기</a>
    </article></noscript>
  </>
}
