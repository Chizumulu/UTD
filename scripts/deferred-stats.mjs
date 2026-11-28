// Deployment-only lazy statistics. Preserve classic-script global lexical bindings.
const stats = [["multiGoalGamesData","computeMultiGoalGames"],["goalsByPositionData","computeGoalsByPositionData"],["assistsByPositionData","computeAssistsByPositionData"],["playerGoalTimelines","computePlayerGoalTimelines"]];
export function deferOptionalStats(data, app) {
  for (const [name, compute] of stats) {
    const declaration = 'const '+name+' = '+compute+'();';
    if (data.split(declaration).length !== 2) throw Error('Expected unique statistic: '+name);
    const getter = 'getDeferred_'+name;
    data = data.replace(declaration, 'let '+name+';\nfunction '+getter+'() { return '+name+' ??= '+compute+'(); }');
    // Replace only executable references, not comments or typeof guards.
    const guarded = new RegExp("typeof "+name+" !== 'undefined'", 'g');
    app = app.replace(guarded, "typeof "+getter+" === 'function'");
    const lines = app.split('\n');
    let count = 0;
    app = lines.map(line => {
      if (line.trimStart().startsWith('//')) return line;
      return line.replace(new RegExp('\\b'+name+'\\b','g'), () => { count++; return getter+'()'; });
    }).join('\n');
    if (count !== (name === 'assistsByPositionData' ? 2 : 1)) throw Error('Unexpected statistic references: '+name+' '+count);
  }
  return {data, app};
}

// Feature-only literals move into their existing content-hashed lazy modules.
// Fail closed if a declaration changes shape or gains a shared executable use.
export function splitOptionalData(data) {
  const assets = {};
  for (const name of ['extraVenues','teamSponsors']) {
    const pattern = new RegExp('^const '+name+' = \\[\\n[\\s\\S]*?^\\];[ \\t]*$', 'gm');
    const matches = [...data.matchAll(pattern)];
    if (matches.length !== 1) throw Error('Expected unique optional data array: '+name);
    assets[name] = matches[0][0];
    data = data.replace(pattern, '');
    assertNoOptionalDataReference(data, name);
  }
  return {data, ...assets};
}
export function assertNoOptionalDataReference(source, name) {
  const reference = new RegExp('\\b'+name+'\\b');
  const unexpected = source.split('\\n').filter(line => !line.trimStart().startsWith('//') && reference.test(line));
  if (unexpected.length) throw Error('Unexpected shared reference to optional data: '+name);
}
