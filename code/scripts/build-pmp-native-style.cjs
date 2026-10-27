// Preserve the reviewed diagram geometry; scope every rule to native supplements.
const fs = require('fs'), path = require('path'), postcss = require('postcss')
const root = path.resolve(__dirname, '..')
const c = JSON.parse(fs.readFileSync(path.join(root, 'pm-content/pmp/source/course.json')))
const html = [...c.nodes.map(n => n.supplement || ''), ...c.cases.map(c => c.debrief)].join('\n')
const used = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)))
const source = postcss.parse(fs.readFileSync(path.join(root, 'pm-content/pmp/template/style.css'), 'utf8'))
const output = postcss.root()
source.walkRules(rule => {
  const selectors = rule.selectors.filter(s => used.has(s.match(/^\.([\w-]+)/)?.[1]))
  if (!selectors.length) return
  const copy = rule.clone({ selector: selectors.map(s => '.pmp-supplement ' + s).join(',') })
  copy.walkDecls('font-family', d => { d.value = /Gowun|SUITE/.test(d.value) ? 'var(--font-heading)' : 'var(--font-reading),sans-serif' })
  let current = copy, parent = rule.parent
  while (parent && parent.type !== 'root') {
    if (parent.type !== 'atrule' || !['media', 'supports'].includes(parent.name)) return
    const wrapper = postcss.atRule({name:parent.name, params:parent.params});wrapper.append(current);current=wrapper;parent=parent.parent
  }
  output.append(current)
})
const vars=[...new Set([...output.toString().matchAll(/var\((--[\w-]+)/g)].map(m=>m[1]))].sort()
fs.writeFileSync(path.join(root, 'src/app/pmp-content.css'), '/* Generated scoped diagram styles. Run scripts/build-pmp-native-style.cjs. */\n' + output.toString() + '\n')
console.log('Scoped PMP rules:', output.nodes.length, 'tokens:', vars.join(','))
