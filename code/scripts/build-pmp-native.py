"""Extract only quiz/recall data for native clients; the reviewed source is unchanged."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
c=json.loads((root/'pm-content/pmp/source/course.json').read_text())
questions=[{'id':n['id'],'node':n['id'],'scene':n['scene'],'options':n['options'],'recall':n['recall']} for n in c['nodes']]
questions += [{**q,'scene':q.get('scene') or q['q']} for case in c['cases'] for q in case['questions']]
assert len({q['id'] for q in questions})==len(questions)
assert all(sum(bool(o['correct']) for o in q['options'])==1 for q in questions)
(root/'data/pmp-native-questions.json').write_text(json.dumps(questions,ensure_ascii=False,indent=2)+'\n')
print('Native PMP questions:',len(questions))
