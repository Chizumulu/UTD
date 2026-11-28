import json, math, os, pathlib, shutil, sys, tempfile, unittest
from itertools import product

SUITES = {
    'lighthouse': set(product(('mobile','desktop'),('before','after'),range(1,6))),
    'traces': set(product(('baseline','candidate'),range(1,7))),
    'desktop-traces': set(product(('baseline','candidate'),range(1,7))),
    'pixels': {f'{w}-{l}-{t}' for w,l,t in product((390,412,720,768,1199,1200,1440),('ko','en'),('light','dark'))},
}
METRICS = ('score','cumulative-layout-shift','largest-contentful-paint','first-contentful-paint','total-blocking-time','speed-index','mainthread-work-breakdown','bootup-time','total-byte-weight')

def require(ok, message):
    if not ok: raise ValueError(message)

def number(v):
    return type(v) in (int,float) and math.isfinite(v) and v >= 0

def validate(suite, data):
    rows = data['rows'] if suite == 'lighthouse' else data
    ids = []
    for row in rows:
        if suite == 'lighthouse':
            ids.append((row['profile'],row['side'],row['index']))
            require(all(number(row['metrics'][m]) for m in METRICS), 'invalid metrics')
            require(row['metrics']['score'] <= 100, 'invalid score')
        elif suite == 'pixels':
            ids.append(row['key'])
            require(all(number(row[k]) for k in ('pixels','total','ratio')), 'invalid pixels')
            require(row['total'] > 0 and row['pixels'] <= row['total'] and abs(row['ratio']-row['pixels']/row['total']) < 1e-9, 'invalid ratio')
        else:
            ids.append((row['arm'],row['round']))
            require(number(row['cls']), 'invalid CLS')
    require(len(ids)==len(set(ids)) and set(ids)==SUITES[suite], 'duplicate or missing measurement IDs')
    return len(ids)

def assemble(parts, root, sha, build='success', measure='success'):
    root.mkdir(parents=True, exist_ok=True)
    errors, counts = [], {}
    for suite in SUITES:
        part = parts / ('cls-part-'+suite)
        try:
            if part.exists():
                for item in part.iterdir():
                    dest = root/suite if item.name==suite else root/'diagnostics'/suite/item.name
                    dest.parent.mkdir(parents=True,exist_ok=True)
                    if item.is_dir(): shutil.copytree(item,dest,dirs_exist_ok=True)
                    else: shutil.copy2(item,dest)
            require((part/'candidate.txt').read_text().strip()==sha,'candidate SHA mismatch')
            counts[suite]=validate(suite,json.loads((root/suite/'summary.json').read_text()))
        except Exception as e:
            errors.append(f'{suite}: {e!r}')
    if build!='success' or measure!='success': errors.append('Build or measurement job failed')
    (root/'candidate.txt').write_text(sha+'\n')
    (root/'validation.json').write_text(json.dumps({'errors':errors,'counts':counts,'expected':72},indent=2))
    return errors

class FailureTests(unittest.TestCase):
    def test_partial_failure_preserves_raw(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d); part=p/'parts'/'cls-part-traces'
            (part/'traces').mkdir(parents=True)
            (part/'candidate.txt').write_text('abc')
            (part/'traces'/'summary.json').write_text('[]')
            (part/'traces'/'partial.json').write_text('{}')
            errors=assemble(p/'parts',p/'out','abc',measure='failure')
            self.assertTrue(errors)
            self.assertTrue((p/'out'/'traces'/'partial.json').exists())
            self.assertFalse((p/'out'/'diagnostics'/'traces'/'traces').exists())
            self.assertTrue((p/'out'/'validation.json').exists())
    def test_duplicate_and_invalid(self):
        rows=[{'arm':a,'round':i,'cls':0.01} for a,i in SUITES['traces']]
        self.assertEqual(validate('traces',rows),12)
        with self.assertRaises(ValueError): validate('traces',rows[:-1]+[rows[0]])
        rows[0]['cls']=float('nan')
        with self.assertRaises(ValueError): validate('traces',rows)

if __name__=='__main__':
    if sys.argv[1:]==['--test']: unittest.main(argv=[sys.argv[0]])
    else:
        errors=assemble(pathlib.Path('parts'),pathlib.Path('combined'),os.environ['EXPECTED_SHA'],os.environ['BUILD_RESULT'],os.environ['MEASURE_RESULT'])
        if errors: raise SystemExit(str(errors))
