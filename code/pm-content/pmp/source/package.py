# -*- coding: utf-8 -*-
from pathlib import Path
import base64,json,html,zipfile,os
from float_reader import render as float_reader
R=Path(__file__).resolve().parents[1];D=R/'dist';O=Path(os.environ.get('PMP_OUTPUT_DIR',str(R/'downloads')));O.mkdir(parents=True,exist_ok=True)
C=json.loads((R/'source/course.json').read_text());e=html.escape;T=len(C['nodes']);Q=T+sum(len(c['questions']) for c in C['cases']);G=len(C['glossary']);B={n['id']:n for n in C['nodes']}
css=(D/'style.css').read_text()
for p in (D/'assets').glob('*.woff2'):css=css.replace("url('assets/"+p.name+"')",'url(data:font/woff2;base64,'+base64.b64encode(p.read_bytes()).decode()+')')
licenses='<template id="font-license-notices"><pre>'+e('\n\n'.join(p.name+'\n'+p.read_text() for p in sorted((D/'assets').glob('*LICENSE.txt'))))+'</pre></template>'
index=(D/'index.html').read_text().replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
for name in ['data.js','app.js']:index=index.replace('<script src="'+name+'"></script>','<script>'+(D/name).read_text().replace('</script','<\\/script')+'</script>')
(O/'PMP_개념서_확장판_학습지도.html').write_text(index.replace('</body>',licenses+'</body>'))
def sources(ids):return ' · '.join(f'<a href="{s["url"]}">{e(s["title"])}</a>' for s in C['sources'] if s['id'] in ids)
def quiz(n):
 correct=next(i for i,o in enumerate(n['options']) if o['correct'])
 return '<section class="quiz"><span class="eyebrow">창작 판단 연습</span><p class="scene">'+e(n.get('scene',n.get('q','')))+'</p><ol type="A">'+''.join('<li>'+e(o['text'])+'</li>' for o in n['options'])+'</ol><details><summary>정답과 선택지별 해설</summary><p>정답 '+chr(65+correct)+'</p>'+''.join('<div class="explanation"><b>'+('✓ ' if o['correct'] else '')+e(o['text'])+'</b>'+e(o['why'])+'</div>' for o in n['options'])+'</details></section>'
def detail(n):
 if not n.get('table'):return ''
 return '<section class="article-section"><span class="eyebrow">개념·정의·차이</span><h3>비슷한 개념 구분하기</h3><div class="concept-scroll"><table class="concept-table"><thead><tr><th scope="col">개념</th><th scope="col">의미·쓰임</th><th scope="col">구분할 점</th></tr></thead><tbody>'+''.join('<tr>'+''.join(('<th scope="row">' if i==0 else '<td>')+e(v)+('</th>' if i==0 else '</td>') for i,v in enumerate(row))+'</tr>' for row in n['table'])+'</tbody></table></div></section><section class="article-section worked-example"><span class="eyebrow">풀이가 있는 가상 예제</span><ol>'+''.join('<li>'+e(p)+'</li>' for p in n['worked'])+'</ol></section><aside class="concept-trap"><b>헷갈리기 쉬운 지점</b><p>'+e(n['trap'])+'</p></aside>'+(float_reader(C) if n.get('lab')=='float' else '')+n.get('supplement','').replace('pmp-lesson:','#')
body='''<header class="header"><div class="header-inner"><a href="#top" class="brand">PMP 길라잡이 · 개념서 확장판</a><nav aria-label="빠른 이동"><a href="#contents">14장 목차</a><a href="#framework">기본 체계</a><a href="#cases">연결 사례</a><a href="#terms">용어 사전</a><a href="#sources">공식 자료</a></nav></div></header><main id="top"><section class="hero"><div><span class="eyebrow">PMP PATHFINDER / CONCEPT BOOK · V2</span><h1>질문을 넘어,<br><em>개념의 구조까지.</em></h1>'''
body+=f'<p>v{C["version"]} · 14장 · {T}개 수업(입문 36·심화 38)<br>심화 개념 비교 187항목 · {Q}개 창작 문제 · {G}개 용어</p></div></section>'
body+='''<div class="notice">읽는 순서 · ① 질문에 내 답 생각하기 ② 본문과 개념 비교 읽기 ③ 가정과 풀이를 따라 예제 계산하기 ④ 판단 문제에 답하고 해설 확인 ⑤ 회상 질문 설명하기.<br>이 파일은 스크립트 없이 모든 내용을 읽도록 만들었습니다. 진도·메모·채점·계산 실험은 ‘PMP_개념서_확장판_학습지도.html’을 사용하세요. 수업 번호는 입문판 기록을 유지하는 고유 번호입니다. 공부 순서는 아래 장 순서예요.</div><section id="framework" class="reader-lesson"><h2>시험 범위와 개념 분류를 구분해요.</h2><div class="article-text"><p>ECO는 시험에서 평가할 책임을 정의합니다. PMBOK는 프로젝트 관리의 개념과 실천을 다루는 참고 체계입니다. 이 자료의 14장은 독학을 위한 편집 분류이며 공식 목차와 같지 않습니다.</p><p>PMBOK 8판은 6개 원칙과 7개 성과 영역으로 구성됩니다. 전체 관점·가치·품질·책임 있는 리더십·지속가능성·권한 있는 팀을 강조하며, 7개 영역은 거버넌스·범위·일정·재무·이해관계자·자원·위험입니다.</p><p>전통적인 5개 프로세스 그룹은 착수·기획·실행·감시통제·종료입니다. 10개 지식영역은 통합·범위·일정·원가·품질·자원·소통·위험·조달·이해관계자입니다. 이는 제품 개발의 고정된 다섯 단계나 현행 시험의 세 영역과 같은 분류가 아닙니다.</p></div><p class="muted small" style="margin-top:20px">참고 · '''+sources(['eco','pmbok8'])+'</p></section><section id="contents" class="reader-lesson"><span class="eyebrow">14 CHAPTERS / 큰 그림</span><h2>기본부터 심화까지</h2>'
for i,t in enumerate(C['tracks']):
 body+=f'<details class="think-box"><summary>{i+1:02} · {e(t["title"])} — {e(t["sub"])}</summary><div class="lesson-list">'
 for id in t['order']:
  n=B[id];body+=f'<a class="lesson-row" href="#{id}"><span class="number">{id[1:]}</span><div><h3>{e(n["title"])}</h3><p>'+('심화 · 비교 표와 풀이 예제' if n['level']=='deep' else '입문 · 개념과 상황 판단')+'</p></div></a>'
 body+='</div></details>'
body+='</section>'
for i,id in enumerate(C['readingOrder']):
 n=B[id];body+=f'<article class="reader-lesson" id="{id}"><span class="eyebrow">LESSON {id[1:]} · '+('DEEP CONCEPT' if n['level']=='deep' else 'FOUNDATION')+f' · {e(n["title"])}</span><h2>{e(n["q"])}</h2><p class="answer-lead">{e(n["answer"])}</p><div class="article-text">'+''.join('<p>'+e(p)+'</p>' for p in n['body'])+'</div>'+detail(n)+'<section class="article-section"><h3>판단은 이 순서로</h3><ol class="decision-steps">'+''.join('<li>'+e(s)+'</li>' for s in n['steps'])+'</ol></section>'+quiz(n)+f'<section class="recall article-section"><span class="eyebrow">회상 연습</span><p>{e(n["recall"])}</p></section><section class="article-section"><h3>연결된 개념으로</h3><div class="followups">'+''.join(f'<a class="followup" href="#{x}"><b>{e(B[x]["q"])}</b><i>↗</i></a>' for x in n['links'])+'</div></section><p class="muted small" style="margin-top:20px">참고 · '+sources(n['sources'])+'</p><div class="reading-footer"><a href="#contents">↑ 목차</a>'+(f'<a href="#{C["readingOrder"][i+1]}">장 순서로 다음 →</a>' if i+1<T else '<a href="#cases">연결 사례로 →</a>')+'</div></article>'
body+='<section id="cases" class="reader-lesson"><span class="eyebrow">CONNECTED CASES</span><h2>여러 결정을 연결해 보기</h2>'
for c in C['cases']:body+='<article style="margin-top:40px"><h3>'+e(c['title'])+'</h3><p class="scenario-context" style="margin-top:20px">'+e(c['context'])+'</p>'+''.join(quiz(q) for q in c['questions'])+'</article>'
body+='</section><section id="terms" class="reader-lesson"><span class="eyebrow">GLOSSARY / '+str(G)+' ENTRIES</span><h2>용어에서 설명으로 돌아가기</h2><div class="term-grid">'
for g in C['glossary']:body+=f'<article class="term"><h3>{e(g["ko"])}</h3><p class="en">{e(g["en"])}</p><p>{e(g["body"])}</p>'+''.join(f'<a href="#{id}">{e(B[id]["title"])} ↗</a>' for id in g['nodes'])+'</article>'
body+='</div></section><section id="sources" class="reader-lesson"><h2>시험 기준과 참고 자료</h2><div class="notice spaced">2026년 7월 ECO: People 33%·Process 41%·Business Environment 26%. 예측형 약 40%, 적응형/애자일·하이브리드 합계 약 60%. 총 180문항·240분, 채점 170문항·사전시험 10문항.<br>독립 자습서이며 PMI 공식 교재·기출·공인 교육시간·합격 판정 도구가 아닙니다. PMBOK 원문 전체와 모든 산업 실무를 대체한다는 의미가 아닙니다. 모든 사례·문제는 창작입니다.</div><ul class="source-list">'+''.join(f'<li><a href="{s["url"]}">{e(s["title"])} ↗</a><p>{e(s["note"])}</p></li>' for s in C['sources'])+'</ul><a href="#top">맨 위로 ↑</a></section></main><footer><div><b>PMP 길라잡이 · 개념서 확장판</b><span>v2.5 · 2026.10.27 · 오프라인 읽기</span></div></footer>'
extra='''html{scroll-behavior:auto}.reader-lesson{max-width:800px;margin:65px auto 0;padding:35px 0;border-top:1px solid var(--line);scroll-margin-top:135px}.reader-lesson>h2{font-family:Gowun;font-weight:400;font-size:32px;line-height:1.5}.reader-lesson h3{margin-bottom:15px}.reader-lesson .term-grid{grid-template-columns:repeat(2,1fr)}.quiz ol{padding-left:24px;font-size:15px;line-height:2}.quiz details{margin-top:20px}.quiz summary{padding:12px 0}.reader-lesson>*{min-width:0}@media(max-width:420px){.reader-lesson{margin-top:40px}.reader-lesson>h2{font-size:27px}.reader-lesson .term-grid{grid-template-columns:minmax(0,1fr)}}@media print{.reader-lesson{break-before:page;margin-top:20px}details,details>*{display:block!important}.quiz{break-inside:auto}}'''
reader='<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PMP 개념서 확장판 · 폰용 읽기</title><style>'+css+extra+'</style></head><body>'+body+licenses+'</body></html>'
(O/'PMP_개념서_확장판_폰용.html').write_text(reader)
readme=f'''PMP 길라잡이 · 개념서 확장판 v{C['version']} / {C['asof']}

입문판의 한계였던 개념 깊이와 범위를 보강했습니다.
14장·{T}개 수업(입문36+심화38)·{Q}개 창작 문제·{G}개 용어 항목.
심화에는 정의·차이의 비교 표, 풀이 예제, 오해, 회상 질문이 있습니다.
이전 파일은 그대로 남겨 두었습니다.

이번 v2.5: 수업73에 혼동행렬·정확도/재현율/경보 적중률·검토 부하 사례를 추가.
  99% 정확도의 함정과 AI 도입·생성형 평가·운영 책임을 연결합니다.
  v2.4의 수업65에는 전략→성과 목표→기회·해결안→로드맵→결정 기록을 추가.
  가상 신청 서비스에서 필수 작업·가용량·기회비용을 함께 판단합니다.
  v2.3의 수업52에는 표본·무작위 배정·신뢰구간·실무 기준 비교를 추가.
  집단당 100/1,000/10,000명에서 같은 5%p 차이의 불확실성을 그래프로 비교합니다.
  v2.2의 수업68에는 제품 발견·연구 방법·실험 지표·가드레일 판단 사례를 추가.
  수업69의 편익·지표와 연결하고 4가지 비채점 회상·적용 연습을 제공합니다.
  v2.1의 수업44 5작업 일정 그림·전진/후진 계산 카드·여유 공유 실험도 유지합니다.
  판단 실험실→총 여유 ≠ 자유 여유에서 기간 변경·경로 전환을 비교하세요.
  폰용 읽기에도 같은 예제와 4가지 예측·풀이가 들어 있습니다.
  이미 받은 파일은 자동 갱신되지 않으므로 새 파일을 다시 받아야 합니다.

폰에서 읽기: PMP_개념서_확장판_폰용.html
  스크립트 없이 모든 수업·표·문제·해설을 읽습니다.
  목차를 펼치고 장 순서대로 읽으세요. 폰에서는 비교 표가 개념별 카드로 표시됩니다.

학습 지도·진도·메모·검색·채점·실험:
  PMP_개념서_확장판_학습지도.html을 스크립트를 실행하는 브라우저로 엽니다.
  Android 파일 앱 미리보기가 버튼을 실행하지 않으면 폰용 읽기를 사용하세요.
  실제 Android 기기 대신 Chrome 모바일 화면과 스크립트 차단 상태를 검증했습니다.
  글꼴·코드·내용이 모두 파일 안에 있습니다. 공식 링크를 새로 열 때만 인터넷이 필요합니다.

학습 순서: 14개 장의 순서입니다. 수업 번호는 기록 호환용 고유 번호입니다.
  각 수업: 질문→개념→비교→풀이→판단 문제→회상.
  전체 개념을 보려면 학습지도의 ‘개념 범위’를 사용하세요.

기록: 이전 학습지도에서 내 기록→백업 내보내기를 하고 확장판에서 불러오면 됩니다.
  기존 수업 ID와 백업 형식을 유지했습니다. 자동 계정 동기화는 없습니다.
  같은 메모·생각·복습은 가져온 파일 내용이 우선하며 답은 최신 것을 유지합니다.
  파일 위치·이름·브라우저가 바뀌면 저장 공간이 달라질 수 있으니 백업하세요.

기준: 시험 범위는 July 2026 ECO. PMBOK8은 참고 개념 체계입니다.
  14장은 학습용 편집 분류이며 공식 목차나 모든 산업의 전체 지식이 아닙니다.
  독립 자습서이며 공인 35시간 과정·기출·실전 합격 예측을 제공하지 않습니다.
  원문 전체를 복제한 것이 아닌 자체 설명·가상 사례와 계산 예제입니다.
  Jira 자료는 변경하지 않았고, 온라인 배포는 수행하지 않았습니다.

폰트: SUIT·SUITE·고운바탕. 라이선스는 HTML 내부와 fonts-licenses/에 포함.
'''
(O/'PMP_개념서_확장판_시작하기.txt').write_text(readme)
with zipfile.ZipFile(O/'PMP_개념서_확장판_오프라인.zip','w',zipfile.ZIP_DEFLATED) as z:
 for name in ['PMP_개념서_확장판_폰용.html','PMP_개념서_확장판_학습지도.html','PMP_개념서_확장판_시작하기.txt']:z.write(O/name,name)
 for p in (D/'assets').glob('*LICENSE.txt'):z.write(p,'fonts-licenses/'+p.name)
for p in O.glob('PMP_개념서_확장판*'):print(p.name,p.stat().st_size)
