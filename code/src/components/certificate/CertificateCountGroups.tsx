import { countGroups } from '@/lib/certificate/count-groups'
import { LessonSectionHeading } from '@/components/library/LessonSectionHeading'
import { CertificateTable } from './CertificateTable'

export function CertificateCountGroups() {
  return (
    <section aria-labelledby="lesson-count-groups">
      <LessonSectionHeading id="lesson-count-groups">
        선택 연습: GROUP BY로 결과 행 나누기
      </LessonSectionHeading>
      <p>
        위의 books 4행과 다른 창작 입력 5행이다. VALUES에 적힌 행만
        사용하며 기존 책 데이터는 바꾸지 않는다. 먼저 결과가 몇 행인지,
        각 그룹의 네 집계값이 얼마인지 예상해 보자.
      </p>
      <pre className="certificate-code"><code>{countGroups.sql}</code></pre>
      <details>
        <summary>결과와 해설 보기</summary>
        <CertificateTable
          caption="별도 창작 입력 5행 · 격리 PGlite의 읽기 전용 SELECT로 확인한 결과 3행"
          headers={countGroups.headers}
          rows={countGroups.rows}
        />
        <p>
          GROUP BY는 DB·SW·NULL의 세 그룹을 만든다. 이때 NULL인
          shelf_code 두 행도 한 그룹으로 묶인다. GROUP BY의 묶음과
          NULL을 동등 비교하는 WHERE 조건은 구분해야 한다.
        </p>
        <p>
          DB의 pages는 120·120이므로 known_pages는 2지만
          distinct_pages는 1이다. SW는 입력 행이 하나 있으므로
          all_rows는 1이고 pages가 NULL이어서 두 pages 집계값은 0이다.
        </p>
        <p>
          NULL 그룹은 두 행이므로 all_rows는 2다. pages에는 80이 하나
          있어 known_pages와 distinct_pages는 1이다. 반면
          known_shelves는 다른 열인 shelf_code를 세므로 0이다.
          결과의 3행과 각 셀의 집계 숫자는 같은 수가 아니다.
        </p>
        <p>
          이 쿼리의 GROUP BY 앞에 WHERE FALSE를 넣으면 입력이 없어져
          결과도 0행이다. 같은 빈 입력에서 GROUP BY 없이 COUNT만
          조회하면 집계값이 모두 0인 결과 1행을 받는다.
          이 비교에는 HAVING이나 빈 그룹 집합을 사용하지 않는다.
        </p>
      </details>
      <p>
        한 번 더 생각해 보자. 입력의 (NULL, 80) 한 행을 (DB, 80)으로
        바꾸면 결과 행 수와 DB·NULL 그룹의 네 집계값은 어떻게 될까?
        답을 말하거나 메모한 뒤 해설을 열어 보자. 자동 채점은 하지 않는다.
      </p>
      <details>
        <summary>변경한 입력의 답과 이유 보기</summary>
        <p>
          결과는 여전히 3행이다. NULL 그룹에 (NULL, NULL)이 남기
          때문이다. DB는 all_rows 3, known_pages 3, distinct_pages 2,
          known_shelves 3이다. pages의 서로 다른 값은 120·80이다.
          NULL 그룹은 all_rows 1이고 나머지 세 집계값은 모두 0이다.
          SW 그룹은 바뀌지 않는다.
        </p>
      </details>
      <p className="study-meta">
        GROUP BY의 기초를 확인하는 보충 예제다. HAVING·윈도우 함수나
        SQL 전 범위의 숙련도를 평가하지 않는다. 근거 문서는 PostgreSQL
        18이며 예제 실행은 격리 PGlite에서 확인했다. 원문 확인: 2026-11-10.
      </p>
      <ul>
        {countGroups.sources.map(source => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title} ↗
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
