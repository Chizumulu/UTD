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
