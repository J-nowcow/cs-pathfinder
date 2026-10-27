"""Rebuild authored topic links and licensed Jira assets without network or database writes."""
from pathlib import Path
import json,re,shutil,base64,hashlib
C=Path(__file__).resolve().parents[1];E=C/'learning-content/engineer';J=C/'learning-content/jira/template';P=C/'public/jira'
guide=json.loads((E/'guides.json').read_text());source=json.loads((E/'source-index.json').read_text())
norm=lambda s:re.sub(r'[\s_\-]','',s.casefold())
review_source=json.loads((E/'classification-reviews.json').read_text())
reviews={r['id']:r for r in review_source['reviews']}
assert len(reviews)==len(review_source['reviews']), 'Duplicate classification review'
assert set(reviews)<=set(q['id'] for q in source['questions'])
guide_ids={g['id'] for g in guide}
allowed_types={'개념','비교','계산','설계','적용','절차','평가','구조·원리','효과'}
questions=[]
for q in source['questions']:
 terms={norm(t) for t in q['rawTopics']};links=[g['id'] for g in guide if any(norm(a) in terms for a in g['aliases'])]
 review=reviews.get(q['id'])
 if review:
  assert q['text'] is not None, 'Classification review requires published source text'
  assert hashlib.sha256(q['text'].encode()).hexdigest()==review['sourceTextSha256'], 'Stale classification review'
  assert review['core'] and review['rationale'] and review['types']
  assert set(review['coreTopics']+review['backgroundTopics'])<=guide_ids
  assert not set(review['coreTopics']) & set(review['backgroundTopics'])
  assert set(review['types'])<=allowed_types
  review={**review,'reviewedAt':review_source['reviewedAt']}
 questions.append({**q,'autoTopics':links,'autoTypes':q['types'],
  'topics':review['coreTopics'] if review else links,
  'backgroundTopics':review['backgroundTopics'] if review else [],
  'types':review['types'] if review else q['types'],'classification':review})
assert len(questions)==1860 and sum(q['text'] is not None for q in questions)==31
assert all(q['round']==140 or q['text'] is None for q in questions)
for g in guide:
 qs=[q for q in questions if g['id'] in q['topics']];g['questionCount']=len(qs);g['roundCount']=len({q['round'] for q in qs})
 g['reviewedCount']=sum(q['classification'] is not None for q in qs)
 g['candidateCount']=len(qs)-g['reviewedCount']
 g['backgroundCount']=sum(g['id'] in q['backgroundTopics'] for q in questions)
pmp=json.loads((C/'pm-content/pmp/source/course.json').read_text())
(C/'data/pmp-library.json').write_text(json.dumps({'nodes':[{k:n[k] for k in ['id','title']} for n in pmp['nodes']]},ensure_ascii=False,indent=2)+'\n')
(C/'data/engineer-guides.json').write_text(json.dumps(guide,ensure_ascii=False,indent=2)+'\n')
(C/'data/engineer-index.json').write_text(json.dumps({**source,'classificationMethod':review_source['method'],'classificationReviewedAt':review_source['reviewedAt'],'questions':questions},ensure_ascii=False,separators=(',',':'))+'\n')
shutil.copytree(J,P,dirs_exist_ok=True)
app=(P/'app.js').read_text();old='function save(){try{localStorage.setItem(KEY,JSON.stringify(state));'
assert old in app;app=app.replace(old,"function save(){try{state._updatedAt=new Date().toISOString();state._lastRoute=location.hash;localStorage.setItem(KEY,JSON.stringify(state));",1);(P/'app.js').write_text(app)
h=(P/'index.html').read_text();h=h.replace('<div class="side-label">','<div style="padding:0 24px 16px;display:flex;gap:14px;flex-wrap:wrap;font-size:13px"><a href="/learn/jira">실무 미션 ↗</a><a href="/learn/progress">통합 기록 ↗</a></div><div class="side-label">',1);(P/'index.html').write_text(h)
# Standalone Jira file retains original six OFL fonts, never the locally installed KT font.
css=(P/'style.css').read_text()
for f in (P/'assets').glob('*.woff2'):css=css.replace("url('assets/"+f.name+"')","url('data:font/woff2;base64,"+base64.b64encode(f.read_bytes()).decode()+"')")
off=re.sub(r'\s*<link rel="preload"[^>]+>','',h);off=re.sub(r'<link rel="icon"[^>]+>','',off).replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
off=off.replace('<script defer src="data.js"></script><script defer src="trace-data.js"></script><script defer src="app.js"></script>','')
app=app.replace("async function offline(){try{", "async function offline(){if(location.protocol==='file:'){toast('이미 오프라인 공부방을 열고 있어요. 이 파일을 보관해주세요.');return}try{")
licenses={f.name:f.read_text() for f in (P/'assets').glob('*LICENSE.txt')}
code='\n'.join([(P/'data.js').read_text(),(P/'trace-data.js').read_text(),app]).replace('</script','<\\/script')
off=off.replace('</body>','<script type="application/json" id="bundled-font-licenses">'+json.dumps(licenses,ensure_ascii=False).replace('<','\\u003c')+'</script><script>'+code+'</script></body>');off=off.replace('href="/learn/','href="https://cs-pathfinder.vercel.app/learn/')
(P/'offline.html').write_text(off)
assert (J/'data.js').read_bytes()==(P/'data.js').read_bytes()
print(json.dumps({'guides':len(guide),'slots':len(questions),'linked':sum(bool(q['topics']) for q in questions),'unclassified':sum(not q['topics'] and not q['backgroundTopics'] for q in questions),'reviewed':len(reviews),'backgroundOnly':sum(bool(q['backgroundTopics']) and not q['topics'] for q in questions),'fulltext':31,'jiraSourceSha256':hashlib.sha256((P/'data.js').read_bytes()).hexdigest(),'jiraOfflineBytes':len(off.encode())}))
