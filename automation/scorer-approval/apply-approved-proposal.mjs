import fs from "node:fs";
import { parse } from "acorn";

const proposalPath = process.env.PROPOSAL_PATH || "work/scorer-proposal.json";
const sourcePath = process.env.DATA_PATH || "data.js";
const proposal = JSON.parse(fs.readFileSync(proposalPath, "utf8"));
const source = fs.readFileSync(sourcePath, "utf8");

validateProposal(proposal);
const ast = parse(source, { ecmaVersion: "latest", sourceType: "script", allowHashBang: true });
const declarations = findDeclarations(ast);
const roundsData = literalValue(declarations.roundsData, source);
const scheduledRounds = literalValue(declarations.scheduledRounds, source);
const matchDetails = declarations.matchDetails ? literalValue(declarations.matchDetails, source) : {};
const location = findFixture(proposal, roundsData || {}, scheduledRounds || {});
if (!location) throw new Error("No unique scheduled/completed fixture matched the approved teams.");

const goalsHome = formatScorers(proposal.goals.filter(g => g.side === "home"));
const goalsAway = formatScorers(proposal.goals.filter(g => g.side === "away"));
const edits = [];

if (roundsData && Object.prototype.hasOwnProperty.call(roundsData, location.roundKey)) {
  const detailsDecl = declarations.matchDetails;
  if (!detailsDecl || !matchDetails || !Array.isArray(matchDetails[location.roundKey])) {
    throw new Error("The completed round has no matchDetails entry; refusing an unsafe data.js edit.");
  }
  const roundNode = objectProperty(declarations.matchDetails, location.roundKey);
  const entries = roundNode && roundNode.value && roundNode.value.type === "ArrayExpression" ? roundNode.value.elements : [];
  const target = entries[location.matchIndex];
  const parsedTarget = target && literalValueNode(target, source);
  if (!target || !parsedTarget || typeof parsedTarget.match !== "string") {
    throw new Error("Could not safely locate the matching matchDetails record.");
  }
  const resultText = parsedTarget.match;
  const scoreRegex = /(\d+)\s*:\s*(\d+)/;
  const scores = resultText.match(scoreRegex);
  if (!scores || Number(scores[1]) !== proposal.homeScore || Number(scores[2]) !== proposal.awayScore) {
    throw new Error("data.js score differs from the approved final score; manual reconciliation is required.");
  }
  edits.push(propertyEdit(source, target, "scorersHome", goalsHome));
  edits.push(propertyEdit(source, target, "scorersAway", goalsAway));
} else {
  const roundsDecl = declarations.scheduledRounds;
  const roundNode = objectProperty(roundsDecl, location.roundKey);
  const fixtures = roundNode && roundNode.value && roundNode.value.type === "ArrayExpression" ? roundNode.value.elements : [];
  const target = fixtures.filter(Boolean)[location.matchIndex];
  if (!target) throw new Error("Could not locate the scheduled fixture in data.js.");
  edits.push(propertyEdit(source, target, "homeScore", proposal.homeScore));
  edits.push(propertyEdit(source, target, "awayScore", proposal.awayScore));
  edits.push(propertyEdit(source, target, "scorersHome", goalsHome));
  edits.push(propertyEdit(source, target, "scorersAway", goalsAway));
}

let updated = source;
for (const edit of edits.filter(Boolean).sort((a, b) => b.start - a.start)) {
  updated = updated.slice(0, edit.start) + edit.text + updated.slice(edit.end);
}
if (updated === source) {
  console.log("Approved scorer data already matches data.js; no changes needed.");
  process.exit(0);
}
fs.writeFileSync(sourcePath, updated, "utf8");
console.log("Updated " + location.roundKey + " with " + goalsHome + " / " + goalsAway);

function validateProposal(p) {
  if (!p || !p.id || !p.home || !p.away || p.home === p.away) throw new Error("Invalid proposal metadata.");
  if (!Number.isInteger(p.homeScore) || !Number.isInteger(p.awayScore) || !Array.isArray(p.goals)) {
    throw new Error("Invalid proposal score or goal list.");
  }
  const counts = { home: 0, away: 0 };
  for (const goal of p.goals) {
    if (!["home", "away"].includes(goal.side) || !String(goal.name || "").trim()) throw new Error("Invalid goal entry.");
    const count = Number(goal.count || 1);
    if (!Number.isInteger(count) || count < 1 || count > 10) throw new Error("Invalid goal count.");
    counts[goal.side] += count;
  }
  if (counts.home !== p.homeScore || counts.away !== p.awayScore) throw new Error("Goal list does not reconcile to final score.");
}

function findDeclarations(program) {
  const found = {};
  for (const statement of program.body) {
    if (statement.type !== "VariableDeclaration") continue;
    for (const decl of statement.declarations) {
      if (decl.id.type === "Identifier" &&
          ["roundsData", "scheduledRounds", "matchDetails"].includes(decl.id.name)) {
        found[decl.id.name] = decl.init;
      }
    }
  }
  if (!found.roundsData || !found.scheduledRounds) throw new Error("Required round data declarations were not found.");
  return found;
}

function literalValue(node, text) {
  return node ? literalValueNode(node, text) : undefined;
}

function literalValueNode(node, text) {
  if (!node) return undefined;
  if (node.type === "Literal") return node.value;
  if (node.type === "UnaryExpression" && node.operator === "-") return -literalValueNode(node.argument, text);
  if (node.type === "ArrayExpression") return node.elements.map(el => literalValueNode(el, text));
  if (node.type === "ObjectExpression") {
    const out = {};
    for (const prop of node.properties) {
      if (prop.type !== "Property" || prop.computed || prop.kind !== "init") continue;
      const key = prop.key.name ?? prop.key.value;
      out[key] = literalValueNode(prop.value, text);
    }
    return out;
  }
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return undefined;
}

function objectProperty(objectNode, key) {
  if (!objectNode || objectNode.type !== "ObjectExpression") return null;
  return objectNode.properties.find(p => p.type === "Property" &&
    (p.key.name ?? p.key.value) === key) || null;
}

function findFixture(p, completed, scheduled) {
  const hits = [];
  for (const [roundKey, list] of Object.entries(completed)) {
    if (!Array.isArray(list)) continue;
    const matchIndex = list.filter(m => m && !m.byeKo && !m.byeEn).findIndex(m =>
      sameTeam(m.homeEn || m.homeKo, p.home) && sameTeam(m.awayEn || m.awayKo, p.away));
    if (matchIndex >= 0) hits.push({ roundKey, matchIndex, kind: "completed" });
  }
  for (const [roundKey, list] of Object.entries(scheduled)) {
    if (!Array.isArray(list)) continue;
    const matchIndex = list.filter(m => m && !m.byeKo && !m.byeEn).findIndex(m =>
      sameTeam(m.homeEn || m.homeKo, p.home) && sameTeam(m.awayEn || m.awayKo, p.away));
    if (matchIndex >= 0) hits.push({ roundKey, matchIndex, kind: "scheduled" });
  }
  if (hits.length !== 1) return null;
  return hits[0];
}

function sameTeam(left, right) {
  const a = tokens(left), b = tokens(right);
  if (!a.length || !b.length) return false;
  return a.every(t => b.includes(t)) || b.every(t => a.includes(t));
}

function tokens(value) {
  return String(value || "").normalize("NFKD").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)
    .filter(t => t && !["fc", "sc", "afc", "club", "football"].includes(t));
}

function formatScorers(goals) {
  const byPlayer = new Map();
  for (const g of goals) {
    const name = String(g.name).trim().toUpperCase();
    const item = byPlayer.get(name) || { count: 0, ownGoal: true };
    item.count += Number(g.count || 1);
    item.ownGoal = item.ownGoal && Boolean(g.ownGoal);
    byPlayer.set(name, item);
  }
  return Array.from(byPlayer, ([name, info]) => {
    const notes = [];
    if (info.count > 1) notes.push(info.count + "골");
    if (info.ownGoal) notes.push("자책골");
    return name + (notes.length ? " (" + notes.join(" ") + ")" : "");
  }).join(", ") || "없음";
}

function propertyEdit(text, object, key, value) {
  const existing = objectProperty(object, key);
  const encoded = JSON.stringify(value);
  if (existing) return { start: existing.value.start, end: existing.value.end, text: encoded };
  const close = object.end - 1;
  const hasProperties = object.properties.length > 0;
  const before = text.slice(object.start, close).trimEnd();
  const comma = hasProperties && !before.endsWith(",") ? "," : "";
  return { start: close, end: close, text: comma + "\n      " + key + ": " + encoded + "\n    " };
}
