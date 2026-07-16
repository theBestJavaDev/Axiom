"use strict";

const SITE_SEEDS = [
  ["google.com","Google"],["youtube.com","YouTube"],["facebook.com","Facebook"],["instagram.com","Instagram"],["reddit.com","Reddit"],["wikipedia.org","Wikipedia"],["x.com","X"],["whatsapp.com","WhatsApp"],["yahoo.com","Yahoo"],["amazon.com","Amazon"],["tiktok.com","TikTok"],["duckduckgo.com","DuckDuckGo"],["bing.com","Bing"],["linkedin.com","LinkedIn"],["netflix.com","Netflix"],["microsoft.com","Microsoft"],["msn.com","MSN"],["live.com","Live"],["fandom.com","Fandom"],["pinterest.com","Pinterest"],["weather.com","Weather"],["twitch.tv","Twitch"],["yandex.ru","Yandex"],["github.com","GitHub"],["canva.com","Canva"],["discord.com","Discord"],["spotify.com","Spotify"],["naver.com","Naver"],["apple.com","Apple"],["office.com","Office"],["paypal.com","PayPal"],["brave.com","Brave"],["imdb.com","IMDb"],["claude.ai","Claude"],["roblox.com","Roblox"],["aliexpress.com","AliExpress"],["vk.com","VK"],["ebay.com","eBay"],["chatgpt.com","ChatGPT"],["gemini.google.com","Gemini"],["temu.com","Temu"],["microsoftonline.com","Microsoft 365"],["openai.com","OpenAI"],["mozilla.org","Mozilla"],["walmart.com","Walmart"],["zoom.us","Zoom"],["booking.com","Booking"],["tripadvisor.com","Tripadvisor"],["etsy.com","Etsy"],["wellsfargo.com","Wells Fargo"],["chase.com","Chase"],["target.com","Target"],["bestbuy.com","Best Buy"],["cnn.com","CNN"],["bbc.com","BBC"],["nytimes.com","NYTimes"],["washingtonpost.com","Washington Post"],["theguardian.com","The Guardian"],["forbes.com","Forbes"],["bloomberg.com","Bloomberg"],["quora.com","Quora"],["stackoverflow.com","Stack Overflow"],["crunchyroll.com","Crunchyroll"],["t-mobile.com","T-Mobile"],["att.com","AT&T"],["verizon.com","Verizon"],["oracle.com","Oracle"],["adobe.com","Adobe"],["salesforce.com","Salesforce"],["dropbox.com","Dropbox"],["drive.google.com","Google Drive"],["news.google.com","Google News"],["maps.google.com","Google Maps"],["docs.google.com","Google Docs"],["forms.google.com","Google Forms"],["calendar.google.com","Google Calendar"],["photos.google.com","Google Photos"],["play.google.com","Google Play"],["translate.google.com","Google Translate"],["support.google.com","Google Support"],["github.io","GitHub Pages"],["medium.com","Medium"],["substack.com","Substack"],["patreon.com","Patreon"],["t.me","Telegram"],["discord.gg","Discord Invites"],["reuters.com","Reuters"],["apnews.com","AP News"],["espn.com","ESPN"],["stackexchange.com","Stack Exchange"],["hulu.com","Hulu"],["soundcloud.com","SoundCloud"],["pandora.com","Pandora"],["shutterstock.com","Shutterstock"],["unsplash.com","Unsplash"],["openlibrary.org","Open Library"],["archive.org","Internet Archive"],["encyclopedia.com","Encyclopedia.com"],["crossref.org","Crossref"],["wikidata.org","Wikidata"],["w3schools.com","W3Schools"]
];

const Axiom = {
  state:{q:"",tab:"summary",results:null,suggestIdx:-1,siteCount:5000,viewer:null},
  el:{},
  init(){
    this.el={home:home,homeForm:homeForm,homeInput:homeInput,homeClear:homeClear,homeSuggest:homeSuggest,homeChips:homeChips,recentBlock:recentBlock,recentList:recentList,results:results,tbForm:tbForm,tbInput:tbInput,tbHome:tbHome,spinner:spinner,statusText:statusText,mainCol:mainCol,sideCol:sideCol,layout:layout,tabs:tabs,settingsBtn:settingsBtn,themeBtn:themeBtn,settingsModal:settingsModal,toast:toast};
    Settings.load(); this.renderChips(); this.renderRecent(); this.bind(); this.applyTheme();
    const q=new URLSearchParams(location.search).get("q"); if(q) this.search(q); else homeInput.focus();
  },
  bind(){
    homeForm.onsubmit=e=>{e.preventDefault();this.search(homeInput.value)};
    homeInput.oninput=()=>{homeClear.style.display=homeInput.value?"flex":"none";this.debounceSuggest()};
    homeInput.onkeydown=e=>this.suggestKeys(e,homeInput,homeSuggest);
    homeClear.onclick=()=>{homeInput.value="";homeInput.focus();homeClear.style.display="none";this.hideSuggest()};
    homeSuggest.onclick=e=>{const li=e.target.closest("li"); if(li){homeInput.value=li.dataset.q;this.search(li.dataset.q)}};

    tbForm.onsubmit=e=>{e.preventDefault();this.search(tbInput.value)}; tbHome.onclick=e=>{e.preventDefault();this.goHome()};
    tabs.onclick=e=>{const t=e.target.closest(".tab"); if(t) this.setTab(t.dataset.tab)};
    mainCol.onclick=e=>{
      const s=e.target.closest("[data-search]");
      const o=e.target.closest("[data-open]");
      if(s) this.search(s.dataset.search);
      if(o) this.openSite(o.dataset.open,o.dataset.title||o.dataset.open,o.dataset.embed==="1");
    };
    settingsBtn.onclick=()=>Settings.open(); themeBtn.onclick=()=>Settings.toggleTheme();
    closeSettings.onclick=()=>Settings.close(); cancelSettings.onclick=()=>Settings.close(); saveSettings.onclick=()=>Settings.save();
    clearHistoryBtn.onclick=()=>{History.clear();this.renderRecent();this.toastMsg("History cleared")};
    settingsModal.onclick=e=>{if(e.target.id==="settingsModal") Settings.close()};
    recentList.onclick=e=>{const x=e.target.closest(".x"); if(x){e.stopPropagation(); History.remove(parseInt(x.dataset.i)); this.renderRecent(); return;} const item=e.target.closest(".recent-item"); if(item) this.search(item.dataset.q);};
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&settingsModal.classList.contains("show")) Settings.close(); if(e.key==="/"&&!/input|textarea/i.test(document.activeElement.tagName)){e.preventDefault();(results.classList.contains("hidden")?homeInput:tbInput).focus();}});
  },
  async search(q){
    q=(q||"").trim(); if(!q) return;
    this.state.q=q; History.add(q); this.renderRecent();
    home.classList.add("hidden"); results.classList.remove("hidden"); tbInput.value=q; mainCol.innerHTML=""; sideCol.innerHTML=""; sideCol.classList.add("hidden"); layout.classList.remove("has-panel");
    ["web","knowledge","images","academic","code","summary","sites"].forEach(id=>{const el=document.getElementById("cnt-"+id); if(el) el.textContent=""});
    this.setTab("summary",true); this.loading(true,"Searching…");
    const u=new URL(location); u.searchParams.set("q",q); history.replaceState(null,"",u); document.title=q+" — Axiom";
    const data={instantAnswer:null,knowledge:null,web:[],images:[],academic:[],code:[],books:[],archive:[],encyclopedia:[],sites:[],summary:null,primaryDone:false,webError:null};
    this.state.results=data;
    let rt=null, schedule=()=>{clearTimeout(rt); rt=setTimeout(()=>{if(this.state.results!==data) return; if(data.primaryDone) this.loading(false); this.rebuildSummary(data); this.render()},60)}, finish=()=>{data.primaryDone=true; schedule()};
    this.fetchInstant(q).then(r=>{data.instantAnswer=r; schedule()}).catch(()=>{});
    this.fetchWikiSearch(q,Settings.obj.lang).then(r=>{data.web=r.results||[]; if(r.knowledge&&!data.knowledge) data.knowledge=r.knowledge; finish()}).catch(e=>{data.webError=e.message; finish()});
    this.fetchWikiSummary(q,Settings.obj.lang).then(r=>{if(r){data.knowledge=r; schedule()}}).catch(()=>{});
    this.fetchImages(q).then(r=>{data.images=r||[]; schedule()}).catch(()=>{});
    this.fetchWikidata(q,Settings.obj.lang).then(r=>{data.wikidata=r; schedule()}).catch(()=>{});
    this.fetchCrossref(q).then(r=>{data.academic=r||[]; schedule()}).catch(()=>{});
    this.fetchGithub(q).then(r=>{data.code=r||[]; schedule()}).catch(()=>{});
    this.fetchOpenLibrary(q).then(r=>{data.books=r||[]; schedule()}).catch(()=>{});
    this.fetchArchive(q).then(r=>{data.archive=r||[]; schedule()}).catch(()=>{});
    this.fetchEncyclopedia(q).then(r=>{data.encyclopedia=r||[]; schedule()}).catch(()=>{});
    this.buildSiteDirectory(q).then(r=>{data.sites=r||[]; schedule()}).catch(()=>{});
    setTimeout(()=>{if(this.state.results===data&&!data.primaryDone){data.primaryDone=true; this.loading(false); this.render()}},9000);
  },
  relevanceScore(q, text, rankBoost=0){
    q=q.toLowerCase(); text=(text||"").toLowerCase();
    const terms=q.split(/\s+/).filter(x=>x.length>2);
    let score=rankBoost;
    if(text.includes(q)) score+=20;
    for(const t of terms) if(text.includes(t)) score+=4;
    const words=new Set(text.split(/\W+/).filter(Boolean));
    let hit=0; for(const t of terms) if(words.has(t)) hit++;
    score += hit * 3;
    score += Math.min(text.length/400,2);
    return score;
  },
  async buildSiteDirectory(q){
    const n=Math.max(100, Math.min(100000, parseInt(Settings.obj.siteCount||5000,10)||5000));
    const list=SITE_SEEDS.slice(0, Math.min(n, SITE_SEEDS.length));
    const ql=q.toLowerCase();
    const scored=list.map(([domain,name],i)=>({domain,name,url:"https://"+domain,title:name,snippet:domain,embed:this.canEmbed(domain),score:this.relevanceScore(q,domain+" "+name,Math.max(0,(list.length-i)/1000)) + (ql.includes(domain.split(".")[0])?10:0)}));
    return scored.sort((a,b)=>b.score-a.score).slice(0, Math.min(80, scored.length));
  },
  canEmbed(domain){
    return !/^(google|youtube|facebook|instagram|x|twitter|linkedin|github|wikipedia|reddit|amazon|netflix|microsoft|apple|paypal|tiktok)\./i.test(domain) && !/google\.com|youtube\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|linkedin\.com|github\.com|wikipedia\.org|reddit\.com|amazon\.com|netflix\.com|microsoft\.com|apple\.com|paypal\.com|tiktok\.com/i.test(domain);
  },
  openSite(url,title,embed){
    this.state.viewer={url,title,embed};
    this.sideOpen({title,url,embed});
  },
  sideOpen(s){
    this.el.sideCol.classList.remove("hidden");
    this.el.layout.classList.add("has-panel");
    const embedHtml = s.embed ? `<iframe class="viewer-frame" src="${this.safeUrl(s.url)}" loading="lazy"></iframe>` : `<div class="iframe-blocked">This site may block embedding. Use the button below to open it in a new tab.</div>`;
    this.el.sideCol.innerHTML = `<div class="panel"><h3>${this.esc(s.title||s.url)}</h3><div class="meta">${this.esc(s.url)}</div><div class="launch"><button class="btn primary" data-open="${this.esc(s.url)}" data-embed="0">Open</button><button class="btn" id="openInside">Try inside Axiom</button></div><div class="viewer"><div class="viewer-head"><div class="u">${this.esc(s.url)}</div><button class="btn" id="closeViewer">Close</button></div>${embedHtml}</div></div>`;
    const iframe=this.el.sideCol.querySelector(".viewer-frame");
    if(iframe){ iframe.onerror=()=>{iframe.replaceWith(Object.assign(document.createElement("div"),{className:"iframe-blocked",textContent:"This site blocked embedding."}))}; }
    closeViewer.onclick=()=>{this.el.sideCol.classList.add("hidden"); this.el.layout.classList.remove("has-panel"); this.el.sideCol.innerHTML=""};
    openInside.onclick=()=>window.open(s.url,"_blank");
    this.applyNewtab(this.el.sideCol);
  },
  loading(on,msg){spinner.classList.toggle("show",on); statusText.textContent=on?(msg||"Loading…"):""},
  setStatus(msg){statusText.textContent=msg||""},
  async fetchInstant(q){ const r=await fetch("https://api.duckduckgo.com/?q="+encodeURIComponent(q)+"&format=json&no_html=1&skip_disambig=1"); if(!r.ok) return null; const d=await r.json(); return {abstract:d.AbstractText||d.Abstract,answer:d.Answer,heading:d.Heading,url:d.AbstractURL,source:d.AbstractSource,related:(d.RelatedTopics||[]).flatMap(t=>t.Topics||[t]).filter(x=>x.FirstURL&&x.Text).slice(0,8)}; },
  async fetchWikiSearch(q,lang){ const L=this.wikiLang(lang); const url="https://"+L+".wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch="+encodeURIComponent(q)+"&gsrlimit=12&prop=extracts|info|pageimages&inprop=url&exintro=1&explaintext=1&exsentences=2&piprop=thumbnail&pithumbsize=120"; const r=await fetch(url); const d=await r.json(); const pages=d.query?.pages?Object.values(d.query.pages):[]; pages.sort((a,b)=>(a.index||99)-(b.index||99)); return {results:pages.map(p=>({title:p.title,url:p.fullurl||("https://"+L+".wikipedia.org/wiki/"+encodeURIComponent(p.title.replace(/ /g,"_"))),snippet:(p.extract||"").replace(/\n/g," "),thumb:p.thumbnail?.source,host:L+".wikipedia.org"})), knowledge:pages[0]?{title:pages[0].title,url:pages[0].fullurl,extract:pages[0].extract,thumb:pages[0].thumbnail?.source,host:L+".wikipedia.org",lang:L}:null}; },
  async fetchWikiSummary(q,lang){ const L=this.wikiLang(lang); const url="https://"+L+".wikipedia.org/api/rest_v1/page/summary/"+encodeURIComponent(q.replace(/ /g,"_")); const r=await fetch(url); if(!r.ok) {const s=await this.fetchWikiSearch(q,lang); return s.knowledge||null;} const d=await r.json(); if(d.type==="disambiguation"){const s=await this.fetchWikiSearch(q,lang); return s.knowledge||null;} return {title:d.title,url:d.content_urls?.desktop?.page,extract:d.extract,thumb:d.thumbnail?.source,desc:d.description,host:L+".wikipedia.org",lang:L}; },
  async fetchImages(q){ const url="https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch="+encodeURIComponent(q)+"&gsrnamespace=6&gsrlimit=24&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=400"; const r=await fetch(url); const d=await r.json(); const pages=d.query?.pages?Object.values(d.query.pages):[]; return pages.map(p=>({thumb:p.imageinfo?.[0]?.thumburl,full:p.imageinfo?.[0]?.url,title:(p.title||"").replace(/^File:/,"").replace(/\.[a-z]+$/i,"").replace(/_/g," "),host:"commons.wikimedia.org"})).filter(x=>x.thumb).slice(0,24); },
  async fetchWikidata(q,lang){ const L=this.wikiLang(lang); const r=await fetch("https://www.wikidata.org/w/api.php?action=wbsearchentities&search="+encodeURIComponent(q)+"&language="+L+"&format=json&origin=*&limit=1"); const d=await r.json(); const e=d.search?.[0]; return e?{id:e.id,label:e.label,desc:e.description,url:"https://www.wikidata.org/wiki/"+e.id,host:"wikidata.org"}:null; },
  async fetchCrossref(q){ const r=await fetch("https://api.crossref.org/works?query="+encodeURIComponent(q)+"&rows=8&select=title,author,abstract,URL,published,container-title,type"); if(!r.ok) return []; const d=await r.json(); return (d.message?.items||[]).map(it=>({title:(it.title||[])[0]||"Untitled",url:it.URL,snippet:(it.abstract||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()||((it["container-title"]||[])[0]||""),host:"crossref.org"})); },
  async fetchGithub(q){ const r=await fetch("https://api.github.com/search/repositories?q="+encodeURIComponent(q)+"&sort=stars&order=desc&per_page=8"); if(!r.ok) return []; const d=await r.json(); return (d.items||[]).map(it=>({title:it.full_name,url:it.html_url,snippet:(it.description||"No description")+" · "+(it.language||"code"),stars:it.stargazers_count,host:"github.com"})); },
  async fetchOpenLibrary(q){ const r=await fetch("https://openlibrary.org/search.json?q="+encodeURIComponent(q)+"&limit=6&fields=title,author_name,first_publish_year,cover_i,key"); if(!r.ok) return []; const d=await r.json(); return (d.docs||[]).map(b=>({title:b.title,url:"https://openlibrary.org"+b.key,snippet:(b.author_name||["Unknown"]).slice(0,2).join(", ")+(b.first_publish_year?" · "+b.first_publish_year:""),thumb:b.cover_i?("https://covers.openlibrary.org/b/id/"+b.cover_i+"-M.jpg"):null,host:"openlibrary.org"})); },
  async fetchArchive(q){ const query=`(${this.archiveSafe(q)}) AND (mediatype:texts OR mediatype:movies OR mediatype:audio OR mediatype:image)`; const url="https://archive.org/advancedsearch.php?q="+encodeURIComponent(query)+"&fl[]=identifier&fl[]=title&fl[]=description&fl[]=creator&fl[]=year&fl[]=date&fl[]=subject&fl[]=mediatype&rows=8&page=1&output=json"; const r=await fetch(url); if(!r.ok) return []; const d=await r.json(); return (d.response?.docs||[]).map(x=>({title:x.title||x.identifier||"Untitled",url:"https://archive.org/details/"+x.identifier,snippet:[x.creator,x.year||x.date,x.subject,x.description].filter(Boolean).join(" · ")||"Internet Archive item",host:"archive.org"})); },
  archiveSafe(q){ return String(q||"").replace(/["']/g,"").trim()||"*"; },
  async fetchEncyclopedia(q){ try{ const r=await fetch("https://www.encyclopedia.com/search?query="+encodeURIComponent(q)); if(!r.ok) return []; const h=await r.text(); const items=[]; const re=/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,700}?<p[^>]*>([\s\S]*?)<\/p>/gi; let m; while((m=re.exec(h))&&items.length<6){ const title=m[2].replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim(); const snip=m[3].replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim(); if(title&&snip) items.push({title,url:m[1].startsWith("http")?m[1]:"https://www.encyclopedia.com"+m[1],snippet:snip,host:"encyclopedia.com"}); } return items; }catch{return []} },
  async buildSiteDirectory(q){
    const sites=[]; const seed=SITE_SEEDS.map(([domain,name],i)=>({domain,name,url:"https://"+domain,host:domain,title:name,snippet:"Popular site",embed:this.canEmbed(domain),score:this.relevanceScore(q,domain+" "+name,Math.max(0,200-i)/20)}));
    sites.push(...seed);
    const extra=[...this.state.results?.web||[],...this.state.results?.academic||[],...this.state.results?.books||[],...this.state.results?.archive||[],...this.state.results?.encyclopedia||[]].map(x=>({domain:this.hostOf(x.url),name:x.title,url:x.url,title:x.title,snippet:x.snippet||"",embed:true,score:this.relevanceScore(q,(x.title||"")+" "+(x.snippet||"")+" "+(x.url||""),5)}));
    sites.push(...extra.filter(x=>x.url));
    return sites.sort((a,b)=>b.score-a.score).slice(0,120);
  },
  relevanceScore(q,text,bonus=0){ q=q.toLowerCase(); text=(text||"").toLowerCase(); const terms=q.split(/\s+/).filter(x=>x.length>2); let s=bonus; if(text.includes(q)) s+=18; for(const t of terms) if(text.includes(t)) s+=4; const words=new Set(text.split(/\W+/).filter(Boolean)); let hit=0; for(const t of terms) if(words.has(t)) hit++; return s+hit*3+Math.min(text.length/450,2); },
  render(){ const d=this.state.results; if(!d) return; statusText.textContent="About "+(d.web.length+d.archive.length+d.encyclopedia.length+d.sites.length)+" results"; cnt-web.textContent=d.web.length||""; cnt-knowledge.textContent=d.knowledge?1:""; cnt-images.textContent=d.images.length||""; cnt-academic.textContent=d.academic.length||""; cnt-code.textContent=d.code.length||""; cnt-summary.textContent=d.summary?.text?"✓":""; cnt-sites.textContent=d.sites.length||""; this.renderTab(); },
  setTab(tab,silent){ this.state.tab=tab; tabs.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===tab)); if(!silent) this.renderTab(); },
  renderTab(){ const d=this.state.results; if(!d) return; const t=this.state.tab; if(t==="summary") this.renderSummary(d); else if(t==="web") this.renderWeb(d); else if(t==="sites") this.renderSites(d); else if(t==="academic") this.renderAcademic(d); else if(t==="code") this.renderCode(d); else if(t==="images") this.renderImages(d); else if(t==="knowledge") this.renderKnowledgeTab(d); },
  renderSummary(d){ let html=`<div class="ai-card"><div class="ai-head"><span class="ai-robot">AI</span><div><div class="ai-title">Axiom Summary</div><div class="ai-sub">${this.esc(this.state.q)} · ${d.summary?.cites?.length||0} sources</div></div></div><div class="ai-body">`; html+=d.summary?.text?`<div>${this.esc(d.summary.text)}</div>`:`<div>Gathering sources…</div>`; if(d.summary?.cites?.length){ html+=`<ol style="margin-top:14px;padding-left:20px">`; for(const c of d.summary.cites) html+=`<li><a href="${this.safeUrl(c.url)}" target="_blank" rel="noopener noreferrer">${this.esc(c.name)}</a></li>`; html+=`</ol>` } html+=`<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-search="${this.esc(this.state.q+" site:google.com")}">Search Google</button><button class="btn" data-search="${this.esc(this.state.q+" site:wikipedia.org")}">Wikipedia</button><button class="btn" data-search="${this.esc(this.state.q+" site:archive.org")}">Archive</button></div></div></div>`; this.el.mainCol.innerHTML=html; this.applyNewtab(this.el.mainCol); },
  renderWeb(d){ let html=""; if(d.webError) html+=`<div class="empty-state"><h3>Web results unavailable</h3><p>${this.esc(d.webError)}</p></div>`; else if(!d.web.length) html+=this.emptyState("No web results","Try different keywords."); else for(const r of d.web) html+=this.resultCard(r,"web"); if(d.archive.length){ html+=`<div class="result"><div class="src-badge b-archive">Archive</div>`; for(const a of d.archive.slice(0,6)) html+=this.resultCard(a,"archive"); html+=`</div>`; } if(d.encyclopedia.length){ html+=`<div class="result"><div class="src-badge b-encyclopedia">Encyclopedia</div>`; for(const e of d.encyclopedia.slice(0,6)) html+=this.resultCard(e,"encyclopedia"); html+=`</div>`; } this.el.mainCol.innerHTML=html; this.applyNewtab(this.el.mainCol); },
  renderSites(d){ if(!d.sites.length){ this.el.mainCol.innerHTML=this.emptyState("No site matches","Try a different query."); return; } this.el.mainCol.innerHTML=`<div class="site-list">`+d.sites.map(s=>`<div class="site-row"><div><div class="name">${this.esc(s.name)}</div><div class="domain">${this.esc(s.domain||this.hostOf(s.url))}</div></div><button class="open" data-open="${this.esc(s.url)}" data-title="${this.esc(s.name)}" data-embed="${s.embed?1:0}">Open</button></div>`).join("")+`</div>`; },
  renderAcademic(d){ this.el.mainCol.innerHTML=d.academic.length?d.academic.map(a=>this.resultCard(a,"academic")).join(""):this.emptyState("No academic papers","No scholarly works found."); },
  renderCode(d){ this.el.mainCol.innerHTML=d.code.length?d.code.map(c=>this.resultCard(c,"code")).join(""):this.emptyState("No repositories","No GitHub repositories matched."); },
  renderImages(d){ if(!d.images.length){ this.el.mainCol.innerHTML=this.emptyState("No images","No images found."); return; } this.el.mainCol.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">`+d.images.map(im=>`<a href="${this.safeUrl(im.full)}" target="_blank" rel="noopener noreferrer" style="border-radius:10px;overflow:hidden;background:var(--surface-3);aspect-ratio:4/3;border:1px solid var(--border)"><img src="${this.safeUrl(im.thumb)}" style="width:100%;height:100%;object-fit:cover"></a>`).join("")+`</div>`; },
  renderKnowledgeTab(d){ let html=""; if(d.knowledge){ const k=d.knowledge; html+=`<div class="ai-card"><div class="ai-head"><span class="ai-robot">K</span><div><div class="ai-title">${this.esc(k.title)}</div><div class="ai-sub">${this.esc(k.desc||k.host||"")}</div></div></div><div class="ai-body">${this.esc(k.extract||"")}</div></div>` } else html+=this.emptyState("No knowledge entry","No encyclopedia summary found."); this.el.mainCol.innerHTML=html; },
  resultCard(r,badge){ const b=badge?`<span class="src-badge b-${this.esc(badge)}">${this.esc(badge)}</span>`:""; return `<div class="result">${b}<div class="r-url"><span class="r-host">${this.esc(this.hostOf(r.url)||r.host||"")}</span><span style="color:var(--muted-2)">${this.esc(this.prettyUrl(r.url))}</span></div><a class="r-title" href="javascript:void(0)" data-open="${this.esc(r.url)}" data-title="${this.esc(r.title||r.url)}" data-embed="1">${this.esc(r.title||r.url)}</a><div class="r-snip">${this.esc(r.snippet||"")}${r.stars!=null?` <span class="r-meta">★ ${this.esc(String(r.stars))}</span>`:""}</div></div>`; },
  openSite(url,title,embed){ this.el.sideCol.classList.remove("hidden"); this.el.layout.classList.add("has-panel"); const frame=embed?`<iframe class="viewer-frame" src="${this.safeUrl(url)}" loading="lazy" referrerpolicy="no-referrer"></iframe>`:`<div class="iframe-blocked">This site may block embedding. Click open to view it in a new tab.</div>`; this.el.sideCol.innerHTML=`<div class="panel"><h3>${this.esc(title||url)}</h3><div class="meta">${this.esc(url)}</div><div class="launch"><button class="btn primary" data-open="${this.esc(url)}" data-title="${this.esc(title||url)}" data-embed="0">Open</button><button class="btn" id="closeViewer">Close</button></div><div class="viewer"><div class="viewer-head"><div class="u">${this.esc(url)}</div></div>${frame}</div></div>`; closeViewer.onclick=()=>{this.el.sideCol.classList.add("hidden"); this.el.layout.classList.remove("has-panel");}; this.applyNewtab(this.el.sideCol); },
  applyNewtab(container){ if(Settings.obj.newtab) return; container.querySelectorAll('a[target="_blank"]').forEach(a=>a.removeAttribute("target")); },
  emptyState(title,msg){ return `<div class="empty-state"><h3>${this.esc(title)}</h3><p>${this.esc(msg)}</p></div>`; },
  renderChips(){ const c=["google","youtube","wikipedia","reddit","github","news","maps","archive.org","encyclopedia.com","crossref","openlibrary","stack overflow","bing","duckduckgo","amazon","facebook"]; homeChips.innerHTML=c.map(x=>`<button class="chip" type="button">${this.esc(x)}</button>`).join(""); homeChips.onclick=e=>{const b=e.target.closest(".chip"); if(b) this.search(b.textContent)}; },
  renderRecent(){ const h=History.list(); recentBlock.classList.toggle("hidden",!Settings.obj.history||!h.length); recentList.innerHTML=h.map((q,i)=>`<span class="recent-item" data-q="${this.esc(q)}">${this.esc(q)} <span class="x" data-i="${i}">×</span></span>`).join(""); },
  goHome(){ results.classList.add("hidden"); home.classList.remove("hidden"); homeInput.value=""; homeClear.style.display="none"; this.hideSuggest(); const u=new URL(location); u.searchParams.delete("q"); history.replaceState(null,"",u); document.title="Axiom — Search"; homeInput.focus(); },
  applyTheme(){ document.documentElement.setAttribute("data-theme",Settings.obj.theme); },
  toastMsg(msg){ toast.textContent=msg; toast.classList.add("show"); clearTimeout(this._t); this._t=setTimeout(()=>toast.classList.remove("show"),1800) },
  hideSuggest(){ homeSuggest.classList.remove("show"); homeSuggest.innerHTML=""; this.state.suggestIdx=-1; },
  async loadSuggest(){ const q=homeInput.value.trim(); if(q.length<2){ this.hideSuggest(); return; } try{ const L=this.wikiLang(Settings.obj.lang); const r=await fetch("https://"+L+".wikipedia.org/w/api.php?action=opensearch&format=json&origin=*&limit=8&search="+encodeURIComponent(q)); const d=await r.json(); const terms=d[1]||[]; if(!terms.length){ this.hideSuggest(); return; } homeSuggest.innerHTML=terms.map(t=>`<li data-q="${this.esc(t)}">${this.esc(t)}</li>`).join(""); homeSuggest.classList.add("show"); this.state.suggestIdx=-1; }catch{ this.hideSuggest(); } },
  debounceSuggest(){ clearTimeout(this._st); this._st=setTimeout(()=>this.loadSuggest(),180) },
  suggestKeys(e,input,list){ const lis=list.querySelectorAll("li"); if(!lis.length||!list.classList.contains("show")) return; if(e.key==="ArrowDown"){e.preventDefault(); this.state.suggestIdx=(this.state.suggestIdx+1)%lis.length; this.highlightSug(lis)} else if(e.key==="ArrowUp"){e.preventDefault(); this.state.suggestIdx=(this.state.suggestIdx-1+lis.length)%lis.length; this.highlightSug(lis)} else if(e.key==="Enter"&&this.state.suggestIdx>=0){e.preventDefault(); const li=lis[this.state.suggestIdx]; if(li){input.value=li.dataset.q; this.search(li.dataset.q)}} },
  highlightSug(lis){ lis.forEach((li,i)=>li.classList.toggle("active",i===this.state.suggestIdx)) },
  loading(on,msg){ spinner.classList.toggle("show",on); if(msg) statusText.textContent=msg; if(!on) statusText.textContent="" },
  esc(s){ return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])) },
  safeUrl(u){ u=String(u||""); return /^https?:\/\//i.test(u)?u:"#"; },
  prettyUrl(u){ try{ const x=new URL(u); return x.pathname+x.search }catch{return u} },
  hostOf(u){ try{return new URL(u).hostname.replace(/^www\./,"")}catch{return""} },
  wikiLang(l){ return ["en","es","fr","de","it","pt","nl","ru","ja","zh","ar","hi"].includes(l||"en")?l:"en" },
  archiveSafe(q){ return String(q||"").replace(/["']/g,"").trim()||"*" }
};

const Store=(()=>{ let ls=null,mem={},privacy=false; try{ const t="__axiom_t__"; ls=localStorage; ls.setItem(t,"1"); ls.removeItem(t);}catch{} return {get(k,d){ if(ls&&!privacy){ try{ const v=ls.getItem("axiom_"+k); return v===null?d:v }catch{} } return (k in mem)?mem[k]:d }, set(k,v){ if(privacy){ mem[k]=v; return } if(ls){ try{ ls.setItem("axiom_"+k,v); return }catch{} } mem[k]=v }, remove(k){ if(ls&&!privacy){ try{ ls.removeItem("axiom_"+k); return }catch{} } delete mem[k] }, setPrivacy(on){ privacy=!!on; if(on) mem={} }, isPrivacy(){ return privacy } } })();

const Settings={defaults:{theme:"dark",lang:"en",newtab:true,history:true,siteCount:5000},obj:{},load(){ try{ this.obj={...this.defaults,...JSON.parse(Store.get("settings","{}"))} }catch{ this.obj={...this.defaults} } Store.setPrivacy(false) },open(){ setLang.value=this.obj.lang; setNewtab.checked=this.obj.newtab; setHistory.checked=this.obj.history; setSiteCount.value=this.obj.siteCount; settingsModal.classList.add("show") },close(){ settingsModal.classList.remove("show") },save(){ this.obj.lang=setLang.value; this.obj.newtab=setNewtab.checked; this.obj.history=setHistory.checked; this.obj.siteCount=parseInt(setSiteCount.value,10)||5000; Store.set("settings",JSON.stringify(this.obj)); this.close(); Axiom.renderRecent(); Axiom.toastMsg("Settings saved") },toggleTheme(){ this.obj.theme=this.obj.theme==="light"?"dark":"light"; Store.set("settings",JSON.stringify(this.obj)); Axiom.applyTheme() } };

const History={list(){ try{return JSON.parse(Store.get("history","[]"))}catch{return[]} },add(q){ if(!Settings.obj.history||Store.isPrivacy()) return; let h=this.list().filter(x=>x.toLowerCase()!==q.toLowerCase()); h.unshift(q); if(h.length>12) h=h.slice(0,12); Store.set("history",JSON.stringify(h)) },clear(){ Store.remove("history") },remove(i){ let h=this.list(); h.splice(i,1); Store.set("history",JSON.stringify(h)) } };

document.addEventListener("click",e=>{ const o=e.target.closest("[data-open]"); if(o){ e.preventDefault(); Axiom.openSite(o.dataset.open,o.dataset.title||o.dataset.open,o.dataset.embed==="1") } });
document.addEventListener("DOMContentLoaded",()=>Axiom.init());
