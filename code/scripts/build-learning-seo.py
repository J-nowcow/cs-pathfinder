"""Generate a small public discovery index without importing lesson bodies at runtime."""
from pathlib import Path
import html,json,re
root=Path(__file__).resolve().parents[1]
def read(path):return json.loads((root/path).read_text())
def plain(text):
    return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]*>',' ',text))).strip()
pages=[]
def add(path,title,description,parent=None,article=False):
    pages.append(dict(path=path,title=title,description=plain(description),parent=parent,article=article))
add('/learn','PM·CS 학습 길라잡이','PM 이론·CS 이론·자격증 대비 자료를 둘러보고 개념과 사례, 연습으로 공부합니다.')
add('/learn/pmp','프로젝트·제품 관리','PMP 개념·사례·계산 실습을 14장·74수업으로 읽습니다. 독립 자습 자료이며 PMI 공식 교재나 공인 교육시간 과정은 아닙니다.','/learn')
add('/learn/pmp/terms','PMP 용어집','PMP 용어의 뜻을 확인하고 연결된 수업에서 개념과 사례를 함께 읽습니다.','/learn/pmp')
add('/learn/engineer','정보관리기술사 · 주제로 연결하는 기출','24개 핵심 주제의 개념·비교·답안 연습과 60회차 기출 위치 색인.','/learn')
add('/learn/certificate','정보처리기사 이론 · DB·SQL·테스트·주소 범위','독립적인 도서관 예제로 배우는 관계 모델·SQL·테스트 설계·IPv4 주소 범위. 기출과 복원 코드는 포함하지 않습니다.','/learn')
add('/learn/jira','Jira 작업 관리 연습','가상 작업 데이터로 요구·흐름·검색·변경·보고를 연습합니다. 회사 Jira와 연결되지 않는 연습용 자료입니다.','/learn')
pmp=read('pm-content/pmp/source/course.json');edits=read('learning-content/pmp-editorial.json')
for n in pmp['nodes']:
    n={**n,**edits.get(n['id'],{})}
    add('/learn/pmp/'+n['id'],n['title'],n['answer'],'/learn/pmp',True)
for n in pmp['cases']:add('/learn/pmp/case/'+n['id'],n['title'],n['context'],'/learn/pmp',True)
for n in read('data/engineer-guides.json'):add('/learn/engineer/'+n['id'],n['title'],n['definition'],'/learn/engineer',True)
for n in read('learning-content/certificate/course.json')['lessons']:add('/learn/certificate/'+n['id'],n['title'],n['lead'],'/learn/certificate',True)
assert len({n['path'] for n in pages})==len(pages)
assert all(n['description'] and not any(c in n['description'] for c in '<>') for n in pages)
# Approved copy changes can be made without changing preserved lesson sources.
overrides=root/'learning-content/seo-editorial.json'
if overrides.exists():
    for n in pages:
        edit=read('learning-content/seo-editorial.json').get(n['path'],{})
        assert not (set(edit)-{'title','description'}), 'SEO overrides cannot alter public identities'
        n.update(edit)
(root/'data/learning-search.json').write_text(json.dumps(pages,ensure_ascii=False,indent=2)+'\n')
print('Public learning discovery pages:',len(pages))
