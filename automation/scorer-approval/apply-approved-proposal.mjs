
import fs from "node:fs";
import { parse } from "acorn";

const proposalPath = process.env.PROPOSAL_PATH || "work/scorer-proposal.json";
const sourcePath = process.env.DATA_PATH || "data.js";

const proposal = JSON.parse(fs.readFileSync(proposalPath, "utf8"));
const source = fs.readFileSync(sourcePath, "utf8");

validateProposal(proposal);

const ast = parseDataDeclarations(source);

const declarations = findDeclarations(ast);
const roundsData = literalValue(declarations.roundsData, source);
const scheduledRounds = literalValue(declarations.scheduledRounds, source);
const matchDetails = declarations.matchDetails
  ? literalValue(declarations.matchDetails, source)
  : {};
const playerDirectory = declarations.playerDirectory
  ? literalValue(declarations.playerDirectory, source)
  : {};
const nameAliases = declarations.nameAliases
  ? literalValue(declarations.nameAliases, source)
  : {};

const location = findFixture(
  proposal,
  roundsData || {},
  scheduledRounds || {}
);

if (!location) {
  throw new Error(
    "No unique scheduled/completed fixture matched the approved teams."
  );
}

const goalsHome = formatScorers(
  proposal.goals.filter(g => g.side === "home"),
  nameAliases,
  playerDirectory
);

const goalsAway = formatScorers(
  proposal.goals.filter(g => g.side === "away"),
  nameAliases,
  playerDirectory
);

const edits = [];
if (!declarations.playerDirectory || !playerDirectory || !declarations.nameAliases || !nameAliases) {
  throw new Error("playerDirectory and nameAliases are required for Korean scorer names.");
}
edits.push(...playerDirectoryEdits(
  source,
  declarations.playerDirectory,
  playerDirectory,
  nameAliases,
  proposal.goals
));

if (location.kind === "completed") {
  const detailsDecl = declarations.matchDetails;

  if (
    !detailsDecl ||
    !matchDetails ||
    !Array.isArray(matchDetails[location.roundKey])
  ) {
    throw new Error(
      "The completed round has no matchDetails entry; refusing an unsafe data.js edit."
    );
  }

  // roundsData에서 해당 경기 객체를 가져옵니다.
  // 여기의 순번은 roundsData 내부에서만 사용합니다.
  const roundFixtures = (roundsData[location.roundKey] || [])
    .filter(m => m && !m.byeKo && !m.byeEn);

  const fixture = roundFixtures[location.matchIndex];

  if (
    !fixture ||
    typeof fixture.homeKo !== "string" ||
    typeof fixture.awayKo !== "string"
  ) {
    throw new Error(
      "Could not safely identify the completed fixture's Korean team names."
    );
  }

  // 중요:
  // matchDetails는 연기된 경기를 제외할 수 있으므로
  // roundsData의 배열 순번을 그대로 사용하지 않습니다.
  // 홈팀·원정팀 이름과 스코어를 기준으로 상세 기록을 찾습니다.
  const roundNode = objectProperty(
    declarations.matchDetails,
    location.roundKey
  );

  const entries =
    roundNode &&
    roundNode.value &&
    roundNode.value.type === "ArrayExpression"
      ? roundNode.value.elements
      : [];

  const target = findMatchDetailTarget(
    entries,
    source,
    fixture,
    proposal
  );

  if (!target) {
    throw new Error(
      "Could not uniquely match the fixture in matchDetails by teams and score. Manual reconciliation is required."
    );
  }

  const parsedTarget = literalValueNode(target, source);

  if (!parsedTarget || typeof parsedTarget.match !== "string") {
    throw new Error(
      "Could not safely read the matching matchDetails record."
    );
  }

  edits.push(propertyEdit(source, target, "scorersHome", goalsHome));
  edits.push(propertyEdit(source, target, "scorersAway", goalsAway));

} else {
  const roundsDecl = declarations.scheduledRounds;
  const roundNode = objectProperty(roundsDecl, location.roundKey);

  const fixtures =
    roundNode &&
    roundNode.value &&
    roundNode.value.type === "ArrayExpression"
      ? roundNode.value.elements
      : [];

  const target = fixtures.filter(
    m => m && !m.byeKo && !m.byeEn
  )[location.matchIndex];

  if (!target) {
    throw new Error(
      "Could not locate the scheduled fixture in data.js."
    );
  }

  edits.push(propertyEdit(source, target, "homeScore", proposal.homeScore));
  edits.push(propertyEdit(source, target, "awayScore", proposal.awayScore));
  edits.push(propertyEdit(source, target, "scorersHome", goalsHome));
  edits.push(propertyEdit(source, target, "scorersAway", goalsAway));
}

let updated = source;

for (const edit of edits.filter(Boolean).sort((a, b) => b.start - a.start)) {
  updated =
    updated.slice(0, edit.start) +
    edit.text +
    updated.slice(edit.end);
}

const archiveResult = archiveCompletedRounds(updated);
updated = archiveResult.source;

if (updated === source) {
  console.log(
    "Approved scorer data already matches data.js; no changes needed."
  );
  process.exit(0);
}

fs.writeFileSync(sourcePath, updated, "utf8");

console.log(
  "Updated " +
  location.roundKey +
  " with " +
  goalsHome +
  " / " +
  goalsAway +
  (archiveResult.archivedRounds.length
    ? "; archived " + archiveResult.archivedRounds.join(", ")
    : "")
);



// ============================================================
// Completed-round archival
// ============================================================

function archiveCompletedRounds(input) {
  let updated = input;
  const archivedRounds = [];

  while (true) {
    const ast = parseDataDeclarations(updated);
    const declarations = findDeclarations(ast);
    const completed = literalValue(declarations.roundsData, updated) || {};
    const scheduled = literalValue(declarations.scheduledRounds, updated) || {};
    const completedPositions = Object.keys(completed)
      .map(key => Number(key.match(/^round(\d+)$/)?.[1]))
      .filter(Number.isInteger);
    const nextPosition = completedPositions.length
      ? Math.max(...completedPositions) + 1
      : 1;
    const nextKey = "round" + nextPosition;
    const fixtures = scheduled[nextKey];

    // Only archive consecutive rounds. A later round can finish first because
    // of postponed fixtures, but it must not advance the site's round counter
    // past an earlier round that is still awaiting an approved result.
    if (!Array.isArray(fixtures)) break;
    const playedFixtures = fixtures.filter(match =>
      match &&
      !match.byeKo &&
      !match.byeEn &&
      match.postponed !== true &&
      String(match.status || "").toLowerCase() !== "postponed"
    );
    if (
      !playedFixtures.length ||
      !playedFixtures.every(match =>
        Number.isInteger(match.homeScore) &&
        Number.isInteger(match.awayScore) &&
        match.homeScore >= 0 &&
        match.awayScore >= 0
      )
    ) {
      break;
    }

    const scheduledProperty = objectProperty(
      declarations.scheduledRounds,
      nextKey
    );
    const roundsObject = declarations.roundsData;
    if (!scheduledProperty || !roundsObject || roundsObject.type !== "ObjectExpression") {
      throw new Error("Could not safely locate round data for automatic archival.");
    }

    const propertyText = updated.slice(
      scheduledProperty.start,
      scheduledProperty.end
    );
    const scheduledProperties = declarations.scheduledRounds.properties;
    const propertyIndex = scheduledProperties.indexOf(scheduledProperty);
    let removeStart = scheduledProperty.start;
    let removeEnd = scheduledProperty.end;

    if (propertyIndex < scheduledProperties.length - 1) {
      const comma = updated.indexOf(",", scheduledProperty.end);
      if (comma >= 0 && comma < scheduledProperties[propertyIndex + 1].start) {
        removeEnd = comma + 1;
      }
    } else if (propertyIndex > 0) {
      const comma = updated.indexOf(",", scheduledProperties[propertyIndex - 1].end);
      if (comma >= 0 && comma < scheduledProperty.start) {
        removeStart = comma;
      }
    }

    const roundsClose = roundsObject.end - 1;
    const lastRoundProperty = roundsObject.properties.at(-1);
    const existingTail = lastRoundProperty
      ? updated.slice(lastRoundProperty.end, roundsClose)
      : "";
    const needsSeparator = Boolean(lastRoundProperty && !/^\s*,/.test(existingTail));
    const editsForArchive = [
      {
        start: roundsClose,
        end: roundsClose,
        text: (needsSeparator ? "," : "") + "\n  " + propertyText + ",\n"
      },
      {
        start: removeStart,
        end: removeEnd,
        text: ""
      }
    ].sort((a, b) => b.start - a.start);

    for (const edit of editsForArchive) {
      updated =
        updated.slice(0, edit.start) +
        edit.text +
        updated.slice(edit.end);
    }
    archivedRounds.push(nextKey);
  }

  return { source: updated, archivedRounds };
}

// ============================================================
// Proposal validation
// ============================================================

function validateProposal(p) {
  if (
    !p ||
    !p.id ||
    !p.home ||
    !p.away ||
    p.home === p.away
  ) {
    throw new Error("Invalid proposal metadata.");
  }

  if (
    !Number.isInteger(p.homeScore) ||
    !Number.isInteger(p.awayScore) ||
    !Array.isArray(p.goals)
  ) {
    throw new Error("Invalid proposal score or goal list.");
  }

  const counts = {
    home: 0,
    away: 0
  };

  for (const goal of p.goals) {
    if (
      !["home", "away"].includes(goal.side) ||
      !String(goal.name || "").trim()
    ) {
      throw new Error("Invalid goal entry.");
    }

    const count = Number(goal.count || 1);

    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > 10
    ) {
      throw new Error("Invalid goal count.");
    }

    counts[goal.side] += count;
  }

  if (
    counts.home !== p.homeScore ||
    counts.away !== p.awayScore
  ) {
    throw new Error(
      "Goal list does not reconcile to final score."
    );
  }
}


// ============================================================
// AST helpers
// ============================================================
// Parse only the data declarations used by this updater. The site helpers below
// the player directory are unrelated to result updates and may use syntax newer
// than the Acorn version installed in the GitHub Actions runner.
function parseDataDeclarations(text) {
  const boundary = text.indexOf("\nfunction toTitleCase(");
  if (boundary < 0) {
    throw new Error("Could not locate the end of the data declarations in data.js.");
  }
  return parse(text.slice(0, boundary), {
    ecmaVersion: "latest",
    sourceType: "script",
    allowHashBang: true
  });
}


function findDeclarations(program) {
  const found = {};

  for (const statement of program.body) {
    if (statement.type !== "VariableDeclaration") continue;

    for (const decl of statement.declarations) {
      if (
        decl.id.type === "Identifier" &&
        [
          "roundsData",
          "scheduledRounds",
          "matchDetails",
          "playerDirectory",
          "nameAliases"
        ].includes(decl.id.name)
      ) {
        found[decl.id.name] = decl.init;
      }
    }
  }

  if (!found.roundsData || !found.scheduledRounds) {
    throw new Error(
      "Required round data declarations were not found."
    );
  }

  return found;
}

function literalValue(node, text) {
  return node ? literalValueNode(node, text) : undefined;
}

function literalValueNode(node, text) {
  if (!node) return undefined;

  if (node.type === "Literal") {
    return node.value;
  }

  if (
    node.type === "UnaryExpression" &&
    node.operator === "-"
  ) {
    return -literalValueNode(node.argument, text);
  }

  if (node.type === "ArrayExpression") {
    return node.elements.map(el =>
      literalValueNode(el, text)
    );
  }

  if (node.type === "ObjectExpression") {
    const out = {};

    for (const prop of node.properties) {
      if (
        prop.type !== "Property" ||
        prop.computed ||
        prop.kind !== "init"
      ) {
        continue;
      }

      const key = prop.key.name ?? prop.key.value;
      out[key] = literalValueNode(prop.value, text);
    }

    return out;
  }

  if (
    node.type === "TemplateLiteral" &&
    node.expressions.length === 0
  ) {
    return node.quasis[0].value.cooked;
  }

  return undefined;
}

function objectProperty(objectNode, key) {
  if (!objectNode || objectNode.type !== "ObjectExpression") {
    return null;
  }

  return objectNode.properties.find(
    p =>
      p.type === "Property" &&
      (p.key.name ?? p.key.value) === key
  ) || null;
}


// ============================================================
// Fixture matching
// ============================================================

function findFixture(p, completed, scheduled) {
  const hits = [];

  for (const [roundKey, list] of Object.entries(completed)) {
    if (!Array.isArray(list)) continue;

    const matchIndex = list
      .filter(m => m && !m.byeKo && !m.byeEn)
      .findIndex(m =>
        sameTeam(m.homeEn || m.homeKo, p.home) &&
        sameTeam(m.awayEn || m.awayKo, p.away)
      );

    if (matchIndex >= 0) {
      hits.push({
        roundKey,
        matchIndex,
        kind: "completed"
      });
    }
  }

  for (const [roundKey, list] of Object.entries(scheduled)) {
    if (!Array.isArray(list)) continue;

    const matchIndex = list
      .filter(m => m && !m.byeKo && !m.byeEn)
      .findIndex(m =>
        sameTeam(m.homeEn || m.homeKo, p.home) &&
        sameTeam(m.awayEn || m.awayKo, p.away)
      );

    if (matchIndex >= 0) {
      hits.push({
        roundKey,
        matchIndex,
        kind: "scheduled"
      });
    }
  }

  if (hits.length !== 1) return null;

  return hits[0];
}

function sameTeam(left, right) {
  const a = tokens(left);
  const b = tokens(right);

  if (!a.length || !b.length) return false;

  return (
    a.every(t => b.includes(t)) ||
    b.every(t => a.includes(t))
  );
}

function tokens(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(t =>
      t &&
      !["fc", "sc", "afc", "club", "football"].includes(t)
    );
}


// ============================================================
// matchDetails matching
// ============================================================

function findMatchDetailTarget(entries, source, fixture, proposal) {
  const candidates = [];

  for (const entry of entries) {
    if (!entry) continue;

    const detail = literalValueNode(entry, source);

    if (!detail || typeof detail.match !== "string") {
      continue;
    }

    const parsed = parseMatchLabel(detail.match);

    if (!parsed) continue;

    if (
      !sameKoreanTeam(parsed.home, fixture.homeKo) ||
      !sameKoreanTeam(parsed.away, fixture.awayKo)
    ) {
      continue;
    }

    if (
      parsed.homeScore !== proposal.homeScore ||
      parsed.awayScore !== proposal.awayScore
    ) {
      continue;
    }

    candidates.push(entry);
  }

  // 둘 이상 일치하면 임의로 수정하지 않습니다.
  return candidates.length === 1 ? candidates[0] : null;
}

function parseMatchLabel(value) {
  const match = String(value).match(
    /^\s*(.*?)\s+(\d+)\s*:\s*(.*?)\s+(\d+)\s*$/
  );

  if (!match) return null;

  return {
    home: match[1],
    homeScore: Number(match[2]),
    away: match[3],
    awayScore: Number(match[4])
  };
}

function sameKoreanTeam(shortName, fullName) {
  const a = normalizeKoreanTeam(shortName);
  const b = normalizeKoreanTeam(fullName);

  if (!a || !b) return false;

  return (
    a === b ||
    a.startsWith(b) ||
    b.startsWith(a)
  );
}

function normalizeKoreanTeam(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/FC|SC|AFC/gi, "")
    .replace(/[^가-힣a-zA-Z0-9]/g, "")
    .toLowerCase();
}


// ============================================================
// Scorer formatting
// ============================================================

function scorerIdentity(value) {
  return String(value || "").normalize("NFKD").toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function resolveDirectoryPlayer(name, aliases, directory) {
  let canonical = String(name || "").trim();
  const seen = new Set();
  for (let i = 0; i < 5; i++) {
    const key = canonical.toUpperCase();
    if (seen.has(key) || !aliases[key]) break;
    seen.add(key);
    canonical = String(aliases[key]).trim();
  }
  const target = scorerIdentity(canonical);
  const found = Object.entries(directory || {}).find(([key, player]) =>
    scorerIdentity(key) === target || scorerIdentity(player?.nameEn) === target
  );
  return found
    ? { key: found[0], nameEn: found[1]?.nameEn || canonical, nameKo: found[1]?.nameKo || "" }
    : { key: canonical.toUpperCase(), nameEn: canonical, nameKo: "" };
}

function playerDirectoryEdits(source, directoryNode, directory, aliases, goals) {
  const updates = new Map();
  for (const goal of goals) {
    const player = resolveDirectoryPlayer(goal.name, aliases, directory);
    if (player.nameKo) continue; // Keep the existing vetted Korean spelling.
    const nameKo = String(goal.nameKo || "").trim();
    if (!nameKo) continue; // No reliable Korean source was supplied; preserve the English scorer.
    const key = player.key.toUpperCase();
    if (!directory[key] && !updates.has(key)) {
      updates.set(key, {
        nameKo,
        nameEn: String(goal.name || "").trim()
      });
    }
  }
  return Array.from(updates, ([key, value]) =>
    propertyEdit(source, directoryNode, key, value)
  );
}

function formatScorers(goals, aliases, directory) {
  const byPlayer = new Map();

  for (const g of goals) {
    const resolved = resolveDirectoryPlayer(g.name, aliases, directory);
    const name = String(resolved.nameEn || g.name).trim().toUpperCase();
    const ownGoal = Boolean(g.ownGoal);
    const key = scorerIdentity(name) + "|" + ownGoal;

    const item = byPlayer.get(key) || { name, count: 0, ownGoal };
    item.count += Number(g.count || 1);
    byPlayer.set(key, item);
  }

  return Array.from(byPlayer.values(), info => {
    const notes = [];

    if (info.count > 1) notes.push(info.count + "골");
    if (info.ownGoal) notes.push("자책골");

    return info.name + (notes.length ? " (" + notes.join(" ") + ")" : "");
  }).join(", ") || "없음";
}


// ============================================================
// Source editing
// ============================================================

function propertyEdit(text, object, key, value) {
  const existing = objectProperty(object, key);
  const encoded = JSON.stringify(value);

  if (existing) {
    return {
      start: existing.value.start,
      end: existing.value.end,
      text: encoded
    };
  }

  const close = object.end - 1;
  const hasProperties = object.properties.length > 0;
  const before = text.slice(object.start, close).trimEnd();

  const comma =
    hasProperties && !before.endsWith(",")
      ? ","
      : "";

  return {
    start: close,
    end: close,
    text:
      comma +
      "\n      " +
      key +
      ": " +
      encoded +
      "\n    "
  };
}
