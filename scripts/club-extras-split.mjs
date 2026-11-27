import {createHash} from 'node:crypto';
import {minifyJs} from './minify-pages-assets.mjs';

export async function splitClubExtras(app,sponsorCssUrl){
 if(!/^club-sponsors\.css\?v=[a-f0-9]{16}$/.test(sponsorCssUrl))throw Error('Invalid sponsor CSS URL');
 const unique=s=>{if(app.split(s).length!==2)throw Error('Expected unique club extras source: '+s);return app.indexOf(s)};
 const take=(start,end)=>{const a=unique(start),b=unique(end);if(b<=a)throw Error('Invalid club extras boundaries');const block=app.slice(a,b);app=app.slice(0,a)+app.slice(b);return block};
 const replace=(before,after)=>{unique(before);app=app.replace(before,()=>after)};
 const sponsors=take('  function renderTeamStoryTab() {','  function renderTeamStaffTab() {');
 const postponed=take('  function getAllPostponedMatches() {','  function openPostponedMatchesModal() {');
 const code=await minifyJs('(function(){\n'+sponsors+postponed+'\nwindow.__utdClubExtras={sponsors:renderTeamStoryTab,postponed:renderPostponedMatchesModal};\n})();');
 const file='club-extras.js',url=file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16);
 replace('  function renderTeamStaffTab() {',`  function loadClubExtras(){
    return loadOptionalAsset('${url}',()=>!!window.__utdClubExtras);
  }
  let clubSponsorCssReady=false;
  let clubSponsorLoadFailed=false;
  function loadClubSponsors(){
    return Promise.all([loadClubExtras(),loadOptionalAsset('${sponsorCssUrl}',null,true)]).then(()=>{clubSponsorCssReady=true;}).catch(error=>{clubSponsorLoadFailed=true;throw error;});
  }
  function retryClubSponsors(){
    clubSponsorLoadFailed=false;
    renderTeamStoryTab();
  }
  function renderTeamStoryTab(){
    const panel=document.getElementById('teamInfoStoryTab');
    if(!panel)return;
    if(window.__utdClubExtras&&clubSponsorCssReady){window.__utdClubExtras.sponsors();setupTeamInfoRevealObserver();return;}
    // Route restoration and other rerenders must not silently consume the
    // error state or start a second request before the user chooses Retry.
    if(clubSponsorLoadFailed)return;
    loadFeaturePanel(panel,loadClubSponsors,()=>{
      if(currentView==='squad'&&currentTeamInfoKey==='Chizumulu United FC'&&currentTeamInfoTab==='story'&&!archiveMode)renderTeamStoryTab();
    },retryClubSponsors);
  }
  function renderTeamStaffTab() {`);
 replace('    renderTeamStoryTab();\n    renderSquadView();','    renderSquadView();');
 replace("    if (tab === 'predict') renderPathFinder();","    if (tab === 'story' && currentTeamInfoKey === 'Chizumulu United FC') renderTeamStoryTab();\n    if (tab === 'predict') renderPathFinder();");
 replace('  function openPostponedMatchesModal() {',`  function renderPostponedMatchesModal(){
    const panel=document.getElementById('postponedMatchesBody');
    if(!panel)return;
    if(window.__utdClubExtras){window.__utdClubExtras.postponed();return;}
    loadFeaturePanel(panel,loadClubExtras,()=>{
      if(document.getElementById('postponedMatchesModal')?.style.display==='flex')renderPostponedMatchesModal();
    },renderPostponedMatchesModal);
  }
  function openPostponedMatchesModal() {`);
 return {app,file,code};
}
