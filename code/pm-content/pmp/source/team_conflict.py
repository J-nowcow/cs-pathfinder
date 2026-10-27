# -*- coding: utf-8 -*-
"""Authored conflict-facilitation case; theory, evidence and Scrum rules separated."""
from html import escape as e
SOURCES=[
 dict(id='psych-safety-1999',title='Amy Edmondson · Psychological Safety and Learning Behavior in Work Teams',url='https://web.mit.edu/curhan/www/docs/Articles/15341_Readings/Group_Performance/Edmondson%20Psychological%20safety.pdf',doi='10.2307/2666999',published='1999-06',checked='2026-10-27',kind='원 연구 · 단일 제조기업 51개 팀 현장 연구',note='Administrative Science Quarterly 44(2), 350–383. 정의·연구 개요와 한계 절을 확인. 심리적 안전과 학습 행동의 관련성을 보고한 역사적 연구이며 모든 팀에 대한 인과 효과·성공 보장을 뜻하지 않음.2026-10-27 원문 확인.'),
 dict(id='team-stages-1977',title='Tuckman & Jensen · Stages of Small-Group Development Revisited',url='https://journals.sagepub.com/doi/abs/10.1177/105960117700200404',doi='10.1177/105960117700200404',published='1977-12',checked='2026-10-27',access='출판사 초록만 확인; 유료 본문 미열람',kind='원저자 후속 문헌 검토 · 공개 초록',note='1965년 4단계 가설의 후속 검토. 초록은 22편 중 직접 검증 목적의 연구가1편이었다고 밝히며 해산 단계와 추가 검증 필요를 제시. 1977-12 발행,2026-10-27 출판사 초록 확인. 모든 팀의 직선 진행을 입증한 실험으로 소개하지 않음.')
]
SCRUM=dict(id='scrum',title='Scrum Guides · 2020 Scrum Guide',url='https://scrumguides.org/scrum-guide.html',edition='November 2020',published='2020-11',checked='2026-10-27',kind='특정 프레임워크의 공식 정의',note='2020판의 자기 관리·책임·Sprint 중 품질·범위 조정·Definition of Done 참고. 2026-10-27 공식 영문 원문 확인. Scrum 규칙과 일반 프로젝트의 조직별 승인 절차를 구분하며 아래 사례는 독립 창작.')
DATA={
 'observations':[
  ('관찰한 사실','같은 가상 신청 기능에서 재시도 시 중복 신청이 재현됐다. 재현 절차와 로그를 함께 확인한다.'),
  ('해석·가설','“QA가 출시를 막는다”, “개발이 품질을 무시한다”는 당사자의 해석이다. 사람의 의도나 성격으로 확정하지 않는다.'),
  ('지키려는 이해','개발은 약속한 성과와 일정, QA는 오류로 인한 사용자 피해를 걱정한다. 서로 무엇을 보호하려는지 묻는다.'),
  ('기준·결정 권한','조직의 품질 최소 기준과 기존 Definition of Done을 확인한다. 범위·작업 계획·품질 판단·출시 승인을 한 사람의 권한으로 합치지 않는다.')
 ],
 'branches':[
  ('즉시 보호가 필요한가?','서비스 피해가 진행되거나 위협·괴롭힘이 있다면 보호·중단·정해진 보고 경로를 우선한다. 토론의 결론을 기다리지 않는다.'),
  ('증거나 기준이 불명확한가?','재현 자료·문서 버전·기준의 적용 범위를 함께 확인한다. 필요한 정보를 모을 담당과 다시 결정할 시점을 정한다.'),
  ('기준은 분명하고 대안이 있는가?','지키려는 이해와 제약을 놓고 대안을 만든다. 권한 범위 안에서 선택하고 담당·확인 증거·재검토 조건을 기록한다.')
 ],
 'dialogue':[
  ('조정자','“누가 잘못했는지 정하기 전에 재현 조건과 현재 완료 기준부터 같은 자료로 확인하죠. 각자 가장 걱정하는 영향은 무엇인가요?”'),
  ('개발자','“시연 약속이 걱정돼요. 기능 전체가 아니라 신청의 핵심 흐름을 보여줄 다른 범위를 검토할 수 있을까요?”'),
  ('QA 역할의 팀원','“중복 신청이 남은 채 완료 처리되는 게 걱정돼요. 재현 테스트와 완료 기준을 함께 확인하고 싶어요.”'),
  ('조정자','“우려를 알려줘서 고마워요. 품질 기준을 충족하는 범위가 가능한지 Developers와 Product Owner가 검토하고, 안 되면 미완료로 투명하게 남깁시다.”')
 ],
 'record':[
  ('공유 문제','재시도 중복 신청의 재현·영향·현재 기준을 확인한다. “성격 충돌”로 종결하지 않는다.'),
  ('검토 대안','완료 기준을 충족하는 별도 범위가 가능한지 검토 / 결함 수정 후 재검증 / 목표·범위 예측 조정. 미검증 결과를 완료로 표시하는 안은 제외한다.'),
  ('역할과 권한','Developers는 품질 기준에 맞는 구현·작업 계획, Product Owner는 가치·백로그 순서와 범위 협의, Scrum Master는 효과적인 협업·장애물 제거를 돕는다. 별도 조직 출시 승인자는 조직 규칙에 따른다.'),
  ('후속 확인','재현 테스트 결과·완료 기준 충족 여부·남은 위험과 결정 근거를 기록한다. 다음 점검 전에 자료 담당을 정하고, 회고에서 재발 원인을 살핀다.')
 ]
}

def render():
 out='<section class="article-section team-study"><span class="eyebrow">CONFLICT → EVIDENCE → SHARED DECISION</span><h2>갈등을 대화와 결정 기록으로 풀어 봐요.</h2><p class="team-lead">같은 상황에서도 사실·해석·이해관계·결정 권한을 섞으면 대화가 어긋납니다. 아래는 제품 팀의 품질 갈등을 푸는 창작 사례예요. 단계 모형은 관찰을 돕고, 실제 대응은 증거·긴급성·권한에 맞춰 고릅니다.</p>'
 out+='<h3>팀 발달은 관찰의 렌즈예요.</h3><div class="team-stages" role="group" aria-label="팀 발달 모형의 다섯 관점. 의무 순서나 현재 팀의 확정 진단이 아닙니다.">'
 for title,body in [('형성','목표·기대·역할을 확인하는가?'),('혼란','쟁점과 책임 경계가 드러나는가?'),('규범화','공동 기준과 협업 규칙이 작동하는가?'),('수행','과업에 맞춰 함께 조정하는가?'),('해산','인계·학습·전환을 마무리하는가?')]:out+='<div><b>'+e(title)+'</b><span>'+e(body)+'</span></div>'
 out+='</div><p class="small muted">Tuckman·Jensen의 1977년 후속 검토 공개 초록은 22편 중 1편이 원래 가설의 직접 검증을 목적으로 했다고 설명합니다. 모형의 역사적 기원을 이해하는 근거이며 “모든 팀이 이 순서로 성장한다”는 보장이 아닙니다. 그림은 자체 제작한 관찰 질문이고 단계별 진단 검사나 숙련도 점수가 아닙니다.</p>'
 out+='<h3>심리적 안전과 기준은 함께 다뤄요.</h3><p>질문·도움 요청·오류 보고·이견 제시를 할 때 대인관계상 불이익을 두려워하지 않는 팀의 믿음을 심리적 안전으로 봅니다. 늘 의견이 같거나 실수를 검토하지 않는다는 뜻은 아닙니다. 리더가 우려를 듣고 확인할 수 있게 반응하는 것과, 업무 기준·책임을 명확히 하는 것을 함께 연습해 봅니다.</p><aside class="notice"><b>연구가 말한 범위를 넘지 않기</b><p>Edmondson의 1999년 현장 연구는 한 제조기업의 51개 팀에서 심리적 안전과 학습 행동의 관련성을 보고했습니다. 단일 기업·시점 중심 자료의 한계를 원문도 밝힙니다. 이 수업의 대화법이 성과를 얼마나 높인다는 실험이나 인과 보장은 아닙니다. 여기의 조정 절차는 학습용으로 구성한 실무 연습입니다.</p></aside>'
 out+='<h3>가상 사례 · “완료”를 두고 충돌한다면</h3><p>Scrum으로 일하는 가상 신청 서비스 팀입니다. 현재 긴급 사고는 없고, 약속한 시연 전에 재시도 중복 신청 결함이 발견됐습니다. 기존 완료 기준에는 재시도 때 중복 신청을 막는 테스트 통과가 포함돼 있습니다. 특정 회사·실제 Jira 데이터가 아닙니다.</p><div class="team-observations">'
 for title,body in DATA['observations']:out+='<article><h4>'+e(title)+'</h4><p>'+e(body)+'</p></article>'
 out+='</div><h3>대응을 고르는 세 갈래 질문</h3><p class="small muted">아래는 갈등 전략의 공식 진단표가 아닌 자체 점검 흐름입니다. 상황이 바뀌면 앞선 보호·기준 질문으로 돌아갑니다.</p><ol class="team-branches">'
 for title,body in DATA['branches']:out+='<li><b>'+e(title)+'</b><p>'+e(body)+'</p></li>'
 out+='</ol><div class="team-dialogue"><h3>원인을 좁히는 대화 예시</h3>'
 for role,line in DATA['dialogue']:out+='<div><b>'+e(role)+'</b><p>'+e(line)+'</p></div>'
 out+='</div><h3>무엇을 협의하고, 무엇을 지킬까요?</h3><div class="team-boundaries"><article><h4>Scrum 2020의 기준</h4><p>Sprint 중 품질을 낮추지 않습니다. 배운 내용에 따라 Product Owner와 범위를 명확히 하거나 재협의할 수 있습니다. 완료 정의에 못 미친 작업은 Increment에 포함할 수 없습니다. 조직의 완료 기준이 있다면 최소 기준으로 따릅니다.</p></article><article><h4>이 사례에서의 적용 판단</h4><p>일정을 맞추려고 결함이 남은 항목을 “완료”로 바꾸지 않습니다. 더 작은 범위가 실제로 완료 기준을 충족할 수 있는지 검토합니다. 단순히 이름을 나눠 부른다고 품질이 확보되지는 않습니다. 불가능하면 미완료 상태와 영향·예측을 투명하게 알리고 후속 계획을 조정합니다.</p></article></div><p class="small muted">Scrum Team의 자기 관리와 세 가지 책임은 Scrum에 한정한 정의입니다. 일반 프로젝트의 PM·QA·조직별 승인 구조에 그대로 대입하지 않습니다. 이 대화에서 “조정자”는 공식 Scrum 책임을 추가로 만든 명칭이 아니며, 조정을 수행하는 사람을 가리킵니다.</p>'
 out+='<h3>대화가 끝나면 남기는 결정 기록</h3><dl class="team-record">'
 for title,body in DATA['record']:out+='<div><dt>'+e(title)+'</dt><dd>'+e(body)+'</dd></div>'
 out+='</dl><p>“앞으로 잘 지내자”에서 끝내지 않고, 기준의 같은 버전을 봤는지·검증할 증거가 생겼는지·이의를 다시 낼 경로가 있는지 확인합니다. 발언 횟수나 회의의 조용함만으로 심리적 안전을 점수화하지 않습니다.</p><h3>내 판단을 설명해 보기</h3><p class="small muted">비채점 적용 연습 · 기존 수업의 채점 문제와 별개입니다.</p>'
 for q,a in [
 ('“둘이 한 단계씩 양보하자”가 언제 문제일까요?','기능의 편의나 협의 가능한 선호는 절충할 수 있지만, 이 사례의 조직 품질 최소 기준이나 현재 완료 기준 충족 여부를 반씩 타협할 수는 없습니다. 대안의 범위와 구현 방법을 검토하되 검증하지 않은 작업을 완료 처리하지 않습니다. 협력도 모든 요구를 만족시킨다는 보장은 없습니다.'),
 ('새 팀원이 이견을 말하면 혼란 단계라고 진단할까요?','단계 이름을 먼저 붙이지 않습니다. 관찰한 쟁점·자료·역할·기준의 변화와 당사자의 설명을 확인합니다. 유익한 이견일 수 있고, 필요한 정보를 제공하는 행동일 수도 있습니다. 팀 모형으로 개인의 성격이나 동기를 확정하지 않습니다.'),
 ('지금 정보가 없어서 유보하면 회피인가요?','자료를 모을 담당·재논의 시점·그동안의 위험 조치를 정한 유보는 정보 확보를 위한 선택일 수 있습니다. 아무 조치나 돌아올 약속 없이 미루면 문제와 책임이 남습니다. 피해가 진행되면 보호 조치를 먼저 검토해야 합니다.'),
 ('심리적 안전이 높아지면 결함 보고가 바로 줄어야 할까요?','보고가 늘어나는 것은 이전에 숨겨진 문제가 드러난 결과일 수도 있습니다. 단일 보고 건수의 증가·감소만으로 안전이나 실제 품질을 판정하지 않습니다. 보고 이후 조사·조치·학습과 실제 피해·재발의 맥락을 함께 확인합니다. 이 사례는 그런 효과의 실증 수치를 제공하지 않습니다.')]:out+='<details class="think-box team-reflection"><summary>'+e(q)+'</summary><p>'+e(a)+'</p></details>'
 out+='<p class="evidence-links"><a class="text-link" href="pmp-lesson:n06">갈등 전략의 기본 →</a><a class="text-link" href="pmp-lesson:n55">동기와 사람을 단정하지 않기 →</a><a class="text-link" href="pmp-lesson:n64">Scrum의 책임과 산출물 →</a><a class="text-link" href="pmp-lesson:n18">품질과 수용의 구분 →</a></p><details class="evidence-source-details"><summary>근거·판본·확인 범위</summary><ul class="source-list">'
 for s in SOURCES+[SCRUM]:out+='<li><a target="_blank" rel="noopener" href="'+e(s['url'])+'">'+e(s['title'])+'</a><p>'+e(s['note'])+'</p>'+('<p>'+e(s['access'])+'</p>' if s.get('access') else '')+'</li>'
 return out+'</ul></details></section>'
