"""Extract client identity/display fields; preserve authored text and checklist keys."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
course = json.loads((root / 'learning-content/certificate/course.json').read_text())
catalog = [{key: lesson[key] for key in ('id', 'title', 'recall', 'checklist')} for lesson in course['lessons']]
assert len({lesson['id'] for lesson in catalog}) == len(catalog)
assert all(isinstance(lesson[key], str) for lesson in catalog for key in ('id', 'title', 'recall'))
assert all(isinstance(lesson['checklist'], list) and all(isinstance(item, str) for item in lesson['checklist']) for lesson in catalog)
(root / 'data/certificate-catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
print('Certificate client catalog:', len(catalog))
