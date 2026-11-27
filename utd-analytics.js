/* UTD feature analytics. No new page_view events or GA/GTM configuration changes. */
(function (root) {
  'use strict';
  const DESTINATION = 'G-N6GC687TZD';
  const valid = (v, choices, fallback) => choices.includes(v) ? v : fallback;
  const token = v => typeof v === 'string' && /^[a-zA-Z0-9._-]{1,90}$/.test(v) ? v : '';
  const language = v => valid(v, ['ko','en','ny'], 'ko');
  const cupIds = ['faCup2627','mmbelwaCup'];
  function screenInfo(state) {
    const raw = String(state.route || '').split('?')[0].replace(/^#?\/?/, '').replace(/\/+$/, '');
    const parts = raw.split('/');
    const head = parts[0] || 'home';
    const group = valid(head, ['home','league','rounds','stats','scorers','predict','compare','club','venues','report','cup','archive','match','seo'], 'home');
    const p = {screen_group:group,screen_key:group};
    const add = (name,value) => { if (value) p[name]=value; };
    let tab = '';
    switch (group) {
      case 'rounds':
        tab = parts[1] === 'month' ? 'month' : 'week';
        if (tab === 'week' && /^\d{1,3}$/.test(parts[1] || '')) add('round_key','round'+parts[1]);
        if (tab === 'month' && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(parts[2] || '')) add('round_key',parts[2]);
        break;
      case 'stats': tab=valid(parts[1],['rank','analysis','compare'],'rank'); break;
      case 'predict': tab=valid(parts[1],['outlook','trend','race','model'],'outlook'); break;
      case 'club':
        add('team_id',token(parts[1]));
        tab=valid(parts[2],['overview','story','squad','honors','results','predict','analysis'],'overview');
        break;
      case 'compare':
        add('team_id',token(parts[1]));add('opponent_id',token(parts[2]));break;
      case 'cup':
        add('competition_id',valid(state.cupId,cupIds,'unknown'));
        tab=valid(state.cupTab,['about','schedule','teams','prize','bracket'],'about');break;
      case 'archive': tab=valid(parts[1],['main','weekly','clubs'],'main');break;
      case 'seo':
        tab=valid(parts[1],['matches','league','teams','players','cup'],'other');
        if (tab==='matches' && parts[2]==='2026-27' && token(parts[3])) {tab='match';add('match_id',token(parts[3]));}
        if (tab==='teams' && token(parts[2])) {tab='team';add('team_id',token(parts[2]));}
        if (tab==='cup') add('competition_id','faCup2627');
        break;
      case 'match':
        if (parts[1] === 'id') add('match_id',token(parts[2]));
        else if (/^\d{4}$/.test(parts[1] || '')) {
          add('team_id',token(parts[2]));add('opponent_id',token(parts[3]));
        }
        break;
    }
    if(tab) p.screen_tab=tab;
    p.screen_key=[group,p.competition_id,p.team_id,p.screen_tab,p.opponent_id,p.round_key,p.match_id].filter(Boolean).join('/').slice(0,100);
    return p;
  }
  function makeTracker(env) {
    let last=null, lang='ko';
    const base=()=>env.location.origin+env.location.pathname;
    function referrerOrigin() {
      try { const u=new URL(env.document?.referrer || ''); return ['http:','https:'].includes(u.protocol)?u.origin:''; } catch (_) { return ''; }
    }
    function emit(name, params) {
      try {
        if (typeof env.gtag !== 'function') return false;
        env.gtag('event',name,{...params,site_language:lang,page_location:base(),page_referrer:referrerOrigin(),send_to:DESTINATION});
        return true;
      } catch (_) { return false; }
    }
    function screen(state) {
      try {
        const next=screenInfo(state);
        lang=language(state.language);
        if(last && JSON.stringify(last)===JSON.stringify(next)) return false;
        const entry_type=last?'navigation':'entry';
        if(!emit('utd_screen_view',{...next,entry_type})) return false;
        last=next;
        return true;
      } catch (_) { return false; }
    }
    function action(name, value) {
      // Explicit finite action set. Never send arbitrary search text, URLs, names,
      // subscription endpoints, sharing text, or visitor identifiers.
      const kinds={
        utd_player_open:['scorer','squad','former_squad'],
        utd_highlight_click:['youtube'],
        utd_poster_download:['result','preview','lineup','other'],
        utd_share_complete:['native','clipboard'],
        utd_notification_subscribe:['web_push'],
        utd_notification_unsubscribe:['web_push'],
        utd_calendar_download:['next','remaining'],
        utd_pwa_install:['browser']
      };
      if(!Object.hasOwn(kinds,name)||!kinds[name].includes(value))return false;
      try { const requested=new URLSearchParams(env.location.search || '').get('lang'); lang=language(requested || env.document?.documentElement?.lang || lang); } catch (_) {}
      return emit(name,{...(last||{screen_group:'home',screen_key:'home'}),action_type:value});
    }
    return {screen,action};
  }
  if(typeof module==='object'&&module.exports)module.exports={screenInfo,makeTracker};
  else if(root&&!root.UTDAnalytics) {
    root.UTDAnalytics=makeTracker(root);
    const seo=root.document.currentScript?.dataset.utdSeo;
    if (seo) {
      root.UTDAnalytics.screen({route:'seo/'+seo,language:'ko'});
      function seoHighlight(event) {
        try {
          if(event.type==='auxclick'&&event.button!==1)return;
          const link=event.target.closest?.('a[data-utd-highlight]');
          if(link&&['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(new URL(link.href).hostname))root.UTDAnalytics.action('utd_highlight_click','youtube');
        } catch (_) {}
      }
      root.document.addEventListener('click',seoHighlight);
      root.document.addEventListener('auxclick',seoHighlight);
    }
  }
})(typeof window==='undefined'?null:window);
