// Explicit feature ownership allowlists; a match is required at the leading
// compound of every selector branch. Shared layout, mixed branches, unknown
// selectors, keyframes and global variables stay critical.
const lead=(s)=>s.trim().replace(/^:root\[data-theme=["']dark["']\]\s+/,'');
const id=(s,n)=>new RegExp('^#(?:'+n+')(?:$|[\\s.:#>+~\\[])').test(s);
const cls=(s,n)=>new RegExp('^\\.(?:'+n+')(?:$|[\\s.:#>+~\\[])').test(s);

export const clubPolicies={
 club:s=>id(s,'myTeamInfoView|teamInfo(?:Overview|Record|Results|Youtube|Staff)Tab|squadGroups')||
  cls(s,'ti-(?:room|award|staff|yt|appear|gk|impact|assist|pair|am|pos|scorer|result)-[\\w-]+|ti-awards-card|ti-position-card|pcard(?:-[\\w-]+)?|squad-(?:card|pcard|former)(?:-[\\w-]+)?|sqt-[\\w-]+|team-(?:motto|kit|kits)-[\\w-]+'),
 pathfinder:s=>cls(s,'pf-[\\w-]+|path-finder-card'),
};
export const viewPolicies={
 rank:s=>id(s,'mainTable'),
 seasoncompare:s=>cls(s,'sc-(?:body|verdict|grid|head|row|label|val|chg|note)(?:-[\\w-]+)?|season-compare-card|prev-compare-board'),
 cup:s=>id(s,'cupViewContent')||cls(s,'cup-(?:hero|round|match-list|team|match-mid|score|when|venue|empty|back-btn|chips|chip|cl|new-badge|info|kv|br|bracket|tiers|tier|krw|team-chips|team-chip|rq|tl|fold|folds|rqb|view-toggle|rview|rd|rdraw|logo-fb)(?:-[\\w-]+)?'),
 archive:s=>cls(s,'archive-[\\w-]+')||id(s,'archiveMainPane|archiveWeeklyPane|archiveClubsPane|archiveTeamModal'),
 prediction:s=>id(s,'predictView')&&s!=='#predictView'||cls(s,'pt-[\\w-]+|rl-[\\w-]+|predict-(?:table|intro|meta|refresh-btn|my-summary)(?:-[\\w-]+)?'),
 venue:s=>cls(s,'venue-[\\w-]+')||id(s,'venueModeMap|venueModeTravel|venueMapModal'),
 teamcompare:s=>cls(s,'tc-[\\w-]+')||id(s,'teamCompareBody'),
 rounds:s=>id(s,'roundsView')&&s!=='#roundsView'||cls(s,'round-(?:toolbar|share-btn|tab-bar|tab-btn|half-bar|half-btn|half-empty|controls|mode-bar|quick-actions|mode-seg|mode-btn|tools|tools-actions|search-row|search-field|search-icon|search|search-filters|status-filters|mine-chip|favor-btn|adv)(?:-[\\w-]+)?'),
 scorers:s=>id(s,'scorersTable|scorersTableBody')||cls(s,'scorers-(?:mode-btn|col-team|team-group|nopk)(?:-[\\w-]+)?|multigoal-[\\w-]+|mgp-[\\w-]+'),
 report:s=>id(s,'reportViewContent')||cls(s,'report-(?:grid|card|badge|watch|paragraph|body|kickoff|kicker|headline|rival|poster)(?:-[\\w-]+)?'),
};
export const modalPolicies={
 players:s=>cls(s,'spm-(?:team|photo|number|name|tags|tag|loan|section|stat|award|assist|form|comp|impact)(?:-[\\w-]+)?|squad-player-modal-national-badge(?:-[\\w-]+)?'),
 matchdetail:s=>cls(s,'pp-[\\w-]+|mcenter(?:-[\\w-]+)?'),
 matchcompare:s=>cls(s,'mc-[\\w-]+'),
 fullrecord:s=>cls(s,'fullrec-(?:note|list|row|rank|photo|name|combo|arrow|sub|value)(?:-[\\w-]+)?'),
};
export const policies={...clubPolicies,...viewPolicies,...modalPolicies};
export function featureOwner(selector){
 const s=lead(selector);
 const owners=Object.entries(policies).filter(([,predicate])=>predicate(s)).map(([k])=>k);
 return owners.length===1?owners[0]:null;
}
