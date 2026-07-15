"use strict";

const Axiom = {
  state: { q: "", tab: "summary", lang: "en", results: null, suggestIdx: -1, chatMode: false },
  el: {},
  _st: null,
  conversation: { messages: [], summary: "", maxMessages: 18, maxSummaryChars: 3000 },

  init() {
    this.el = {
      home: document.getElementById("home"),
      homeForm: document.getElementById("homeForm"),
      homeInput: document.getElementById("homeInput"),
      homeClear: document.getElementById("homeClear"),
      homeSuggest: document.getElementById("homeSuggest"),
      homeChips: document.getElementById("homeChips"),
      recentBlock: document.getElementById("recentBlock"),
      recentList: document.getElementById("recentList"),
      results: document.getElementById("results"),
      tbForm: document.getElementById("tbForm"),
      tbInput: document.getElementById("tbInput"),
      tbHome: document.getElementById("tbHome"),
      spinner: document.getElementById("spinner"),
      statusText: document.getElementById("statusText"),
      mainCol: document.getElementById("mainCol"),
      sideCol: document.getElementById("sideCol"),
      layout: document.getElementById("layout"),
      tabs: document.getElementById("tabs"),
      settingsBtn: document.getElementById("settingsBtn"),
      themeBtn: document.getElementById("themeBtn"),
      settingsModal: document.getElementById("settingsModal"),
      toast: document.getElementById("toast"),
    };

    Settings.load();
    this.loadConversation();
    this.renderChips();
    this.renderRecent();
    this.bind();
    this.applyTheme();
    this.applyPrivacyBadge();

    const p = new URLSearchParams(location.search);
    const q = p.get("q");
    if (q) this.search(q);
    else this.el.homeInput.focus();
  },

  bind() {
    this.el.homeForm.addEventListener("submit", e => { e.preventDefault(); this.search(this.el.homeInput.value); });
    this.el.homeInput.addEventListener("input", () => {
      this.el.homeClear.style.display = this.el.homeInput.value ? "flex" : "none";
      this.debounceSuggest();
    });
    this.el.homeInput.addEventListener("keydown", e => this.suggestKeys(e, this.el.homeInput, this.el.homeSuggest));
    this.el.homeClear.addEventListener("click", () => {
      this.el.homeInput.value = "";
      this.el.homeInput.focus();
      this.el.homeClear.style.display = "none";
      this.hideSuggest();
    });
    this.el.homeSuggest.addEventListener("click", e => {
      const li = e.target.closest("li");
      if (li) {
        this.el.homeInput.value = li.dataset.q;
        this.search(li.dataset.q);
      }
    });

    this.el.tbForm.addEventListener("submit", e => { e.preventDefault(); this.search(this.el.tbInput.value); });
    this.el.tbHome.addEventListener("click", e => { e.preventDefault(); this.goHome(); });

    this.el.tabs.addEventListener("click", e => {
      const t = e.target.closest(".tab");
      if (t) this.setTab(t.dataset.tab);
    });
    this.el.mainCol.addEventListener("click", e => {
      const p = e.target.closest("[data-gototab]");
      if (p) this.setTab(p.dataset.gototab);
      const send = e.target.closest("[data-sendchat]");
      if (send) this.sendChat(send.dataset.sendchat);
      const ask = e.target.closest("[data-askfollow]");
      if (ask) this.askFollowUp(ask.dataset.askfollow);
    });

    this.el.settingsBtn.addEventListener("click", () => Settings.open());
    this.el.themeBtn.addEventListener("click", () => Settings.toggleTheme());
    document.getElementById("closeSettings").addEventListener("click", () => Settings.close());
    document.getElementById("cancelSettings").addEventListener("click", () => Settings.close());
    document.getElementById("saveSettings").addEventListener("click", () => Settings.save());
    document.getElementById("clearHistoryBtn").addEventListener("click", () => { History.clear(); this.renderRecent(); toast("History cleared"); });

    document.getElementById("settingsModal").addEventListener("click", e => { if (e.target.id === "settingsModal") Settings.close(); });

    this.el.recentList.addEventListener("click", e => {
      const x = e.target.closest(".x");
      if (x) {
        e.stopPropagation();
        History.remove(parseInt(x.dataset.i));
        this.renderRecent();
        return;
      }
      const item = e.target.closest(".recent-item");
      if (item) this.search(item.dataset.q);
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        if (this.el.settingsModal.classList.contains("show")) { Settings.close(); return; }
        if (!this.el.results.classList.contains("hidden")) this.goHome();
      }
      if (e.key === "/" && !/input|textarea/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        (this.el.results.classList.contains("hidden") ? this.el.homeInput : this.el.tbInput).focus();
      }
    });
  },

  async search(q) {
    q = (q || "").trim();
    if (!q) return;

    this.state.q = q;
    this.state.chatMode = false;
    this.addConversationMessage("user", q);
    History.add(q);
    this.renderRecent();

    this.el.home.classList.add("hidden");
    this.el.results.classList.remove("hidden");
    this.el.tbInput.value = q;
    this.el.mainCol.innerHTML = "";
    this.el.sideCol.innerHTML = "";
    this.el.sideCol.classList.add("hidden");
    this.el.layout.classList.remove("has-panel");

    ["web", "knowledge", "images", "academic", "code", "summary", "chat"].forEach(id => {
      const el = document.getElementById("cnt-" + id);
      if (el) el.textContent = "";
    });

    this.setTab("summary", true);
    this.loading(true, "Searching the web…");

    const u = new URL(location);
    u.searchParams.set("q", q);
    history.replaceState(null, "", u);
    document.title = q + " — Axiom";

    const s = Settings.obj;
    const data = {
      instantAnswer: null,
      knowledge: null,
      web: [],
      images: [],
      related: [],
      academic: [],
      code: [],
      books: [],
      archive: [],
      encyclopedia: [],
      wikidata: null,
      summary: null,
      source: "keyless",
      webError: null,
      primaryDone: false
    };
    this.state.results = data;

    let renderT = null;
    const scheduleRender = () => {
      clearTimeout(renderT);
      renderT = setTimeout(() => {
        if (this.state.results !== data) return;
        if (data.primaryDone) this.loading(false);
        this.rebuildSummary(data);
        this.render();
      }, 60);
    };
    const finishPrimary = () => { data.primaryDone = true; scheduleRender(); };

    this.fetchInstant(q).then(r => { data.instantAnswer = r; scheduleRender(); }).catch(() => {});

    this.fetchWikiSearch(q, s.lang).then(r => {
      data.web = r.results || [];
      if (r.knowledge && !data.knowledge) data.knowledge = r.knowledge;
      data.source = "Wikipedia";
      finishPrimary();
    }).catch(e => { data.webError = e.message; finishPrimary(); });

    this.fetchWikiSummary(q, s.lang).then(r => { if (r) { data.knowledge = r; scheduleRender(); } }).catch(() => {});
    this.fetchImages(q).then(r => { data.images = r || []; scheduleRender(); }).catch(() => {});
    this.fetchWikidata(q, s.lang).then(r => { data.wikidata = r; scheduleRender(); }).catch(() => {});
    this.fetchCrossref(q).then(r => { data.academic = r || []; scheduleRender(); }).catch(() => {});
    this.fetchGithub(q).then(r => { data.code = r || []; scheduleRender(); }).catch(() => {});
    this.fetchOpenLibrary(q).then(r => { data.books = r || []; scheduleRender(); }).catch(() => {});
    this.fetchArchive(q).then(r => { data.archive = r || []; scheduleRender(); }).catch(() => {});
    this.fetchEncyclopedia(q).then(r => { data.encyclopedia = r || []; scheduleRender(); }).catch(() => {});

    setTimeout(() => {
      if (this.state.results === data && !data.primaryDone) {
        data.primaryDone = true;
        this.loading(false);
        this.render();
      }
    }, 9000);
  },

  async sendChat(text) {
    const q = String(text || "").trim();
    if (!q) return;
    this.addConversationMessage("user", q);
    this.state.chatMode = true;
    this.setTab("chat", true);
    this.loading(true, "Talking to local LLM…");
    this.renderChatLoading();

    try {
      const answer = await this.askLocalLLM(q);
      this.addConversationMessage("assistant", answer);
      this.conversation.summary = this.shrinkConversationSummary(this.conversation.summary, q, answer);
      this.saveConversation();
      this.loading(false);
      this.renderChat();
      this.setStatus("Chat ready · local LLM");
    } catch (e) {
      this.loading(false);
      this.renderChatError(String(e && e.message ? e.message : e));
    }
  },

  async askFollowUp(text) {
    await this.sendChat(text);
  },

  async askLocalLLM(userText) {
    const facts = this.collectFactsForLLM();
    const url = Settings.obj.llmUrl.replace(/\/$/, "") + "/v1/chat/completions";
    const messages = [
      { role: "system", content: Settings.obj.systemPrompt },
      { role: "system", content: `Conversation summary:\n${this.conversation.summary || "None yet."}` },
      { role: "system", content: `Useful source facts:\n${facts.join("\n") || "No source facts available."}` },
      ...this.conversation.messages.slice(-12).map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: userText }
    ];

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Settings.obj.llmModel,
        messages,
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 700,
        stream: false
      })
    });

    if (!res.ok) throw new Error("Local LLM is not reachable. Check LM Studio and the base URL.");
    const data = await res.json();
    const out = data.choices?.[0]?.message?.content || "";
    if (!out.trim()) throw new Error("Local LLM returned an empty response.");
    return out.trim();
  },

  collectFactsForLLM() {
    const d = this.state.results;
    if (!d) return [];
    const facts = [];
    const push = (src, title, text, url) => {
      if (!text) return;
      const t = String(text).replace(/\s+/g, " ").trim();
      if (t.length < 20) return;
      facts.push(`${src}: ${title || "Untitled"} — ${t.slice(0, 280)}${url ? " (" + url + ")" : ""}`);
    };

    if (d.instantAnswer?.abstract) push("DuckDuckGo", d.instantAnswer.heading || "Instant answer", d.instantAnswer.abstract, d.instantAnswer.url);
    if (d.knowledge?.extract) push("Wikipedia", d.knowledge.title, d.knowledge.extract, d.knowledge.url);
    (d.web || []).slice(0, 5).forEach(r => push("Web", r.title, r.snippet, r.url));
    (d.academic || []).slice(0, 3).forEach(r => push("Crossref", r.title, r.snippet, r.url));
    (d.books || []).slice(0, 3).forEach(r => push("Open Library", r.title, r.snippet, r.url));
    (d.archive || []).slice(0, 4).forEach(r => push("Internet Archive", r.title, r.snippet, r.url));
    (d.encyclopedia || []).slice(0, 4).forEach(r => push("Encyclopedia.com", r.title, r.snippet, r.url));
    return facts;
  },

  loading(on, msg) {
    this.el.spinner.classList.toggle("show", on);
    if (msg) this.el.statusText.textContent = msg;
    if (!on) this.el.statusText.textContent = "";
  },

  setStatus(msg) { this.el.statusText.textContent = msg || ""; },

  async fetchInstant(q) {
    const url = "https://api.duckduckgo.com/?q=" + encodeURIComponent(q) + "&format=json&no_html=1&skip_disambig=1";
    let d = null;
    for (let attempt = 0; attempt < 2 && !d; attempt++) {
      try {
        const r = await fetch(url);
        const ct = r.headers.get("content-type") || "";
        if (!r.ok || !ct.includes("json")) { await this.delay(250 * attempt); continue; }
        d = await r.json();
      } catch {
        await this.delay(250 * attempt);
      }
    }
    if (!d) return null;
    const out = {
      type: d.AnswerType,
      answer: d.Answer || d.Definition,
      abstract: d.AbstractText || d.Abstract,
      source: d.AbstractSource,
      url: d.AbstractURL,
      heading: d.Heading,
      image: d.Image ? ("https://duckduckgo.com" + d.Image) : null,
      related: []
    };
    if (d.Image && /^https?:/.test(d.Image)) out.image = d.Image;
    if (d.RelatedTopics) {
      for (const t of d.RelatedTopics) {
        if (t.Topics) {
          for (const st of t.Topics) {
            if (st.FirstURL && st.Text) out.related.push({ text: st.Text, url: st.FirstURL });
          }
        } else if (t.FirstURL && t.Text) {
          out.related.push({ text: t.Text, url: t.FirstURL });
        }
        if (out.related.length >= 8) break;
      }
    }
    if (!out.answer && !out.abstract && out.related.length === 0) return null;
    return out;
  },

  async fetchWikiSearch(q, lang) {
    const L = this.wikiLang(lang);
    const url = "https://" + L + ".wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=" + encodeURIComponent(q) + "&gsrlimit=15&prop=extracts|info|pageimages&inprop=url&exintro=1&explaintext=1&exsentences=2&piprop=thumbnail&pithumbsize=120";
    const r = await fetch(url);
    if (!r.ok) throw new Error("Wikipedia search failed");
    const d = await r.json();
    const pages = d.query?.pages ? Object.values(d.query.pages) : [];
    pages.sort((a, b) => (a.index || 99) - (b.index || 99));
    const results = pages.map(p => ({
      title: p.title,
      url: p.fullurl || ("https://" + L + ".wikipedia.org/wiki/" + encodeURIComponent(p.title.replace(/ /g, "_"))),
      snippet: (p.extract || "").replace(/\n/g, " "),
      thumb: p.thumbnail?.source,
      host: L + ".wikipedia.org",
      isWiki: true
    }));
    let knowledge = null;
    if (pages[0]) {
      const top = pages[0];
      knowledge = { title: top.title, url: top.fullurl, extract: top.extract, thumb: top.thumbnail?.source, host: L + ".wikipedia.org", lang: L };
    }
    return { results, knowledge };
  },

  async fetchWikiSummary(q, lang) {
    const L = this.wikiLang(lang);
    const title = q.replace(/ /g, "_");
    const url = "https://" + L + ".wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title);
    const r = await fetch(url);
    if (!r.ok) {
      const s = await this.fetchWikiSearch(q, lang);
      return s.knowledge || null;
    }
    const d = await r.json();
    if (d.type === "disambiguation") {
      const s = await this.fetchWikiSearch(q, lang);
      return s.knowledge || null;
    }
    return {
      title: d.title,
      url: d.content_urls?.desktop?.page,
      extract: d.extract,
      thumb: d.thumbnail?.source,
      desc: d.description,
      host: L + ".wikipedia.org",
      lang: L
    };
  },

  async fetchImages(q) {
    const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=" + encodeURIComponent(q) + "&gsrnamespace=6&gsrlimit=30&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=400";
    const r = await fetch(url);
    if (!r.ok) throw new Error("Image search failed");
    const d = await r.json();
    const pages = d.query?.pages ? Object.values(d.query.pages) : [];
    const imgs = [];
    for (const p of pages) {
      const ii = p.imageinfo?.[0];
      if (!ii?.thumburl) continue;
      const title = (p.title || "").replace(/^File:/, "").replace(/\.(jpg|jpeg|png|gif|svg|webp)$/i, "").replace(/_/g, " ");
      imgs.push({
        thumb: ii.thumburl,
        full: ii.url,
        title,
        page: "https://commons.wikimedia.org/wiki/" + encodeURIComponent(p.title.replace(/ /g, "_"))
      });
      if (imgs.length >= 24) break;
    }
    return imgs;
  },

  async fetchWikidata(q, lang) {
    const L = this.wikiLang(lang);
    const url = "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=" + encodeURIComponent(q) + "&language=" + L + "&format=json&origin=*&limit=1";
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    const e = d.search?.[0];
    if (!e) return null;
    return { id: e.id, label: e.label, desc: e.description, url: "https://www.wikidata.org/wiki/" + e.id, host: "wikidata.org" };
  },

  async fetchCrossref(q) {
    const url = "https://api.crossref.org/works?query=" + encodeURIComponent(q) + "&rows=8&select=title,author,abstract,URL,published,container-title,type";
    const r = await fetch(url);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.message?.items || []).map(it => {
      const auth = (it.author || []).slice(0, 2).map(a => (a.family || a.name || "")).join(", ") + (it.author && it.author.length > 2 ? " et al." : "");
      const yr = it.published?.["date-parts"]?.[0]?.[0];
      let abs = (it.abstract || "").replace(/<[^>]+>/g, "").replace(/\n/g, " ").trim();
      return {
        title: (it.title || [])[0] || "Untitled",
        url: it.URL,
        snippet: abs || ((it["container-title"] || [])[0] || "") + (auth ? " · " + auth : "") + (yr ? " · " + yr : ""),
        authors: auth,
        year: yr,
        venue: (it["container-title"] || [])[0],
        host: "crossref.org"
      };
    });
  },

  async fetchGithub(q) {
    const url = "https://api.github.com/search/repositories?q=" + encodeURIComponent(q) + "&sort=stars&order=desc&per_page=8";
    const r = await fetch(url);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.items || []).map(it => ({
      title: it.full_name,
      url: it.html_url,
      snippet: (it.description || "No description") + " · " + (it.language || "code"),
      stars: it.stargazers_count,
      lang: it.language,
      host: "github.com"
    }));
  },

  async fetchOpenLibrary(q) {
    const url = "https://openlibrary.org/search.json?q=" + encodeURIComponent(q) + "&limit=6&fields=title,author_name,first_publish_year,cover_i,key";
    const r = await fetch(url);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.docs || []).map(b => ({
      title: b.title,
      url: "https://openlibrary.org" + b.key,
      snippet: (b.author_name || ["Unknown"]).slice(0, 2).join(", ") + (b.first_publish_year ? " · " + b.first_publish_year : ""),
      author: (b.author_name || [])[0],
      year: b.first_publish_year,
      thumb: b.cover_i ? ("https://covers.openlibrary.org/b/id/" + b.cover_i + "-M.jpg") : null,
      host: "openlibrary.org"
    }));
  },

  async fetchArchive(q) {
    const query = `(${this.archiveSafe(q)}) AND (mediatype:texts OR mediatype:movies OR mediatype:audio OR mediatype:image)`;
    const url = "https://archive.org/advancedsearch.php?q=" + encodeURIComponent(query) +
      "&fl[]=identifier&fl[]=title&fl[]=description&fl[]=creator&fl[]=year&fl[]=date&fl[]=subject&fl[]=mediatype&rows=8&page=1&output=json";
    const r = await fetch(url);
    if (!r.ok) return [];
    const d = await r.json();
    const docs = d.response?.docs || [];
    return docs.map(x => {
      const desc = [x.creator, x.year || x.date, x.subject, x.description].filter(Boolean).join(" · ");
      return {
        title: x.title || x.identifier || "Untitled",
        url: "https://archive.org/details/" + x.identifier,
        snippet: desc || "Internet Archive item",
        host: "archive.org"
      };
    });
  },

  archiveSafe(q) {
    return String(q || "").replace(/["']/g, "").trim() || "*";
  },

  async fetchEncyclopedia(q) {
    const url = "https://www.encyclopedia.com/search?query=" + encodeURIComponent(q);
    try {
      const r = await fetch(url, { mode: "cors" });
      if (!r.ok) return [];
      const html = await r.text();
      const out = [];
      const titleRe = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
      const titles = [];
      let m;
      while ((m = titleRe.exec(html)) && titles.length < 10) {
        const title = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const href = m[1];
        if (title && href) titles.push({ title, href });
      }
      const paras = [];
      while ((m = pRe.exec(html)) && paras.length < 20) {
        const sn = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (sn) paras.push(sn);
      }
      for (let i = 0; i < Math.min(6, titles.length); i++) {
        out.push({
          title: titles[i].title,
          url: titles[i].href.startsWith("http") ? titles[i].href : "https://www.encyclopedia.com" + titles[i].href,
          snippet: paras[i] || "Encyclopedia.com result",
          host: "encyclopedia.com"
        });
      }
      return out;
    } catch {
      return [];
    }
  },

  compressFact(text) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    const first = clean.match(/[^.!?]+[.!?]/);
    const base = (first ? first[0] : clean).slice(0, 280);
    return base || "";
  },

  lowerStart(s) {
    s = String(s || "").trim();
    return s.charAt(0).toLowerCase() + s.slice(1);
  },

  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  composeHumanSummary(q, facts) {
    if (!facts.length) return "";
    const qText = q.trim();
    const openers = [
      `Here’s the clearest read on ${qText}.`,
      `Looking across the available sources, ${qText} comes into focus as a broader topic with a few consistent threads.`,
      `The sources together suggest a fuller picture of ${qText} than any single result can give.`
    ];
    const closers = [
      `Taken together, the evidence points to the same general idea even when the sources emphasize different details.`,
      `So the practical takeaway is that the topic is defined by a shared core idea, with each source adding a different angle.`,
      `In plain terms, the results agree on the main story and fill in the edges from different directions.`
    ];
    const sentences = [this.pick(openers)];
    for (const f of facts.slice(0, 5)) {
      const leadIns = [
        `One useful detail is that`,
        `Another point worth noting is that`,
        `A source-backed way to say it is that`,
        `The results also show that`
      ];
      let fact = this.lowerStart(f.fact);
      if (!/[.!?]$/.test(fact)) fact += ".";
      sentences.push(`${this.pick(leadIns)} ${fact}`);
    }
    sentences.push(this.pick(closers));
    while (sentences.length < 4 && facts[0]) {
      sentences.splice(1, 0, `In several sources, the most consistent idea is that ${this.lowerStart(facts[0].fact).replace(/[.!?]$/, "")}.`);
    }
    return sentences.join(" ");
  },

  rebuildSummary(data) {
    if (data.summary && data.summary.text) return;
    const q = this.state.q.trim();
    const terms = q.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const notes = [];
    const add = (source, label, url, text, weight = 1) => {
      if (!text) return;
      const clean = String(text).replace(/\s+/g, " ").trim();
      if (clean.length < 20) return;
      notes.push({ source, label, url, text: clean, weight });
    };

    add("DuckDuckGo", "Instant answer", data.instantAnswer?.url, data.instantAnswer?.abstract || data.instantAnswer?.answer, 5);
    add("Wikipedia", "Summary", data.knowledge?.url, data.knowledge?.extract, 6);
    for (const r of (data.web || []).slice(0, 5)) add(r.host || "Web", "Web result", r.url, r.snippet, 3);
    for (const a of (data.academic || []).slice(0, 3)) add("Crossref", "Academic", a.url, a.snippet, 2);
    for (const b of (data.books || []).slice(0, 3)) add("Open Library", "Book", b.url, b.snippet, 2);
    for (const x of (data.archive || []).slice(0, 4)) add("Internet Archive", "Archive", x.url, x.snippet, 3);
    for (const x of (data.encyclopedia || []).slice(0, 4)) add("Encyclopedia.com", "Encyclopedia", x.url, x.snippet, 3);

    const ranked = notes.map(n => {
      const t = n.text.toLowerCase();
      const termHits = terms.reduce((sum, w) => sum + (t.includes(w) ? 1 : 0), 0);
      const lengthScore = Math.min(n.text.length / 120, 2);
      return { ...n, score: termHits * 2 + lengthScore + n.weight };
    }).sort((a, b) => b.score - a.score);

    const picked = [];
    for (const n of ranked) {
      if (picked.length >= 5) break;
      if (picked.some(p => this.sim(p.text, n.text) > 0.48)) continue;
      picked.push(n);
    }

    const facts = picked.map(p => ({
      source: p.source,
      url: p.url,
      fact: this.compressFact(p.text, q)
    })).filter(x => x.fact);

    const text = this.composeHumanSummary(q, facts);
    const cites = [];
    const seen = new Map();

    if (facts.length) {
      for (const f of facts) {
        const key = f.url || f.source;
        if (!seen.has(key)) {
          seen.set(key, cites.length + 1);
          cites.push({ n: cites.length + 1, name: f.source, url: f.url });
        }
      }
    }

    data.summary = {
      text: text || "I could not build a summary from the available sources.",
      cites
    };
  },

  loadConversation() {
    if (Settings.obj.privacy) {
      this.conversation.messages = [];
      this.conversation.summary = "";
      return;
    }
    try {
      this.conversation.messages = JSON.parse(Store.get("axiom_chat_messages", "[]")) || [];
      this.conversation.summary = Store.get("axiom_chat_summary", "") || "";
    } catch {
      this.conversation.messages = [];
      this.conversation.summary = "";
    }
  },

  saveConversation() {
    if (Settings.obj.privacy) return;
    Store.set("axiom_chat_messages", JSON.stringify(this.conversation.messages.slice(-this.conversation.maxMessages)));
    Store.set("axiom_chat_summary", this.conversation.summary.slice(0, this.conversation.maxSummaryChars));
  },

  addConversationMessage(role, content) {
    const msg = { role, content: String(content || "").trim(), time: Date.now() };
    if (!msg.content) return;
    this.conversation.messages.push(msg);
    if (this.conversation.messages.length > this.conversation.maxMessages) {
      this.conversation.messages = this.conversation.messages.slice(-this.conversation.maxMessages);
    }
    this.saveConversation();
  },

  clearConversation() {
    this.conversation.messages = [];
    this.conversation.summary = "";
    Store.remove("axiom_chat_messages");
    Store.remove("axiom_chat_summary");
  },

  buildConversationContext() {
    const summary = this.conversation.summary ? `Previous conversation summary: ${this.conversation.summary}\n\n` : "";
    const turns = this.conversation.messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
    return summary + turns;
  },

  shrinkConversationSummary(previousSummary, userText, assistantText) {
    const parts = [];
    if (previousSummary) parts.push(previousSummary.trim());
    parts.push(`User asked about: ${userText.trim()}.`);
    parts.push(`Assistant answered: ${assistantText.trim()}`);
    return parts.join(" ").slice(0, this.conversation.maxSummaryChars);
  },

  async debounceSuggest() {
    clearTimeout(this._st);
    this._st = setTimeout(() => this.loadSuggest(), 180);
  },

  async loadSuggest() {
    const q = this.el.homeInput.value.trim();
    if (q.length < 2) {
      this.hideSuggest();
      return;
    }
    try {
      const L = this.wikiLang(Settings.obj.lang);
      const url = "https://" + L + ".wikipedia.org/w/api.php?action=opensearch&format=json&origin=*&limit=8&search=" + encodeURIComponent(q);
      const r = await fetch(url);
      if (!r.ok) return;
      const d = await r.json();
      const terms = d[1] || [];
      if (!terms.length) {
        this.hideSuggest();
        return;
      }
      this.el.homeSuggest.innerHTML = terms.map(t => `<li data-q="${this.esc(t)}"><svg class="s-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>${this.esc(t)}</li>`).join("");
      this.el.homeSuggest.classList.add("show");
      this.state.suggestIdx = -1;
    } catch {
      this.hideSuggest();
    }
  },

  suggestKeys(e, input, list) {
    const lis = list.querySelectorAll("li");
    if (!lis.length || !list.classList.contains("show")) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.state.suggestIdx = (this.state.suggestIdx + 1) % lis.length;
      this.highlightSug(lis);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.state.suggestIdx = (this.state.suggestIdx - 1 + lis.length) % lis.length;
      this.highlightSug(lis);
    } else if (e.key === "Enter" && this.state.suggestIdx >= 0) {
      e.preventDefault();
      const li = lis[this.state.suggestIdx];
      if (li) {
        input.value = li.dataset.q;
        this.search(li.dataset.q);
      }
    }
  },

  highlightSug(lis) {
    lis.forEach((li, i) => li.classList.toggle("active", i === this.state.suggestIdx));
  },

  hideSuggest() {
    this.el.homeSuggest.classList.remove("show");
    this.el.homeSuggest.innerHTML = "";
    this.state.suggestIdx = -1;
  },

  render() {
    const d = this.state.results;
    if (!d) return;
    this.setStatus("About " + d.web.length + " results · via " + d.source);
    document.getElementById("cnt-web").textContent = d.web.length || "";
    document.getElementById("cnt-knowledge").textContent = d.knowledge ? "1" : "";
    document.getElementById("cnt-images").textContent = d.images.length || "";
    document.getElementById("cnt-academic").textContent = d.academic?.length || "";
    document.getElementById("cnt-code").textContent = d.code?.length || "";
    document.getElementById("cnt-summary").textContent = (d.summary && (d.summary.cites?.length || d.summary.text)) ? "✓" : "";
    document.getElementById("cnt-chat").textContent = this.conversation.messages.length ? String(this.conversation.messages.length) : "";
    this.renderTab();
  },

  setTab(tab, silent) {
    this.state.tab = tab;
    this.el.tabs.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    if (!silent) this.renderTab();
  },

  renderTab() {
    const d = this.state.results;
    if (!d) return;
    const tab = this.state.tab;

    if (tab === "summary") {
      this.el.sideCol.classList.add("hidden");
      this.el.layout.classList.remove("has-panel");
      this.renderSummary(d);
    } else if (tab === "web") {
      this.renderWeb(d);
    } else if (tab === "academic") {
      this.renderAcademic(d);
    } else if (tab === "code") {
      this.renderCode(d);
    } else if (tab === "knowledge") {
      this.renderKnowledgeTab(d);
    } else if (tab === "images") {
      this.el.sideCol.classList.add("hidden");
      this.el.layout.classList.remove("has-panel");
      this.renderImages(d);
    } else if (tab === "chat") {
      this.el.sideCol.classList.add("hidden");
      this.el.layout.classList.remove("has-panel");
      this.renderChat();
    }
  },

  renderWeb(d) {
    let html = "";
    if (d.instantAnswer && (d.instantAnswer.answer || d.instantAnswer.abstract)) {
      const ia = d.instantAnswer;
      html += `<div class="ia show"><div class="ia-label">Instant answer</div>`;
      if (ia.answer) html += `<div class="ia-answer">${this.esc(ia.answer)}</div>`;
      if (ia.abstract) html += `<div class="ia-sub">${this.esc(ia.abstract)}</div>`;
      if (ia.url) html += `<a class="kp-link" href="${this.safeUrl(ia.url)}" target="_blank" rel="noopener noreferrer">Source: ${this.esc(ia.source || "DuckDuckGo")} →</a>`;
      html += `</div>`;
    }

    if (d.webError) {
      html += `<div class="err-box"><b>Web results unavailable.</b> ${this.esc(d.webError)}</div>`;
    } else if (d.web.length === 0) {
      html += this.emptyState("No web results", "Try different keywords.");
    } else {
      for (const r of d.web) html += this.resultCard(r);
    }

    if (d.instantAnswer?.related?.length) {
      html += `<div class="related"><h4>Related</h4><div class="related-list">`;
      for (const t of d.instantAnswer.related) {
        html += `<a href="${this.safeUrl(t.url)}" target="_blank" rel="noopener noreferrer">${this.esc(this.trunc(t.text, 46))}</a>`;
      }
      html += `</div></div>`;
    }

    if (d.books && d.books.length) {
      html += `<div class="related"><h4>Books · Open Library</h4><div class="src-list">`;
      for (const b of d.books) html += this.resultCard(b, "book");
      html += `</div></div>`;
    }

    if (d.archive && d.archive.length) {
      html += `<div class="related"><h4>Internet Archive</h4><div class="src-list">`;
      for (const a of d.archive) html += this.resultCard(a, "archive");
      html += `</div></div>`;
    }

    if (d.encyclopedia && d.encyclopedia.length) {
      html += `<div class="related"><h4>Encyclopedia.com</h4><div class="src-list">`;
      for (const e of d.encyclopedia) html += this.resultCard(e, "encyclopedia");
      html += `</div></div>`;
    }

    if (d.instantAnswer?.related?.length) {
      html += `<div class="ai-tabs">`;
      html += `<button class="ai-pill" data-askfollow="Explain this in simpler language">Simplify</button>`;
      html += `<button class="ai-pill" data-askfollow="Give more detail using the same sources">More detail</button>`;
      html += `<button class="ai-pill" data-askfollow="What are the main disagreements in the sources?">Source conflicts</button>`;
      html += `</div>`;
    }

    this.el.mainCol.innerHTML = html;
    this.applyNewtab(this.el.mainCol);
  },

  renderKnowledgeTab(d) {
    let html = "";
    if (d.instantAnswer?.abstract) {
      const ia = d.instantAnswer;
      html += `<div class="ia show"><div class="ia-label">From ${this.esc(ia.source || "DuckDuckGo")}</div><div class="ia-answer" style="font-size:22px">${this.esc(ia.heading || this.state.q)}</div><div class="ia-def">${this.esc(ia.abstract)}</div>${ia.url ? `<a class="kp-link" href="${this.safeUrl(ia.url)}" target="_blank" rel="noopener noreferrer">Read more →</a>` : ""}</div>`;
    }
    if (d.knowledge) {
      const k = d.knowledge;
      html += `<div class="result" style="border:none;padding-top:0">`;
      if (k.thumb) html += `<img src="${this.safeUrl(k.thumb)}" style="float:right;width:180px;border-radius:10px;margin:0 0 12px 16px;max-width:50%" alt="">`;
      html += `<div class="r-title" style="color:var(--text);font-size:24px;font-family:var(--font-display)">${this.esc(k.title)}</div>`;
      if (k.desc) html += `<div class="kp-desc">${this.esc(k.desc)}</div>`;
      html += `<div class="r-snip" style="margin-top:10px">${this.esc(k.extract || "")}</div><a class="kp-link" href="${this.safeUrl(k.url)}" target="_blank" rel="noopener noreferrer">Open on Wikipedia →</a></div>`;
    }
    if (!d.knowledge && !d.instantAnswer?.abstract) html += this.emptyState("No knowledge entry", "No encyclopedia summary found for this query.");
    this.el.mainCol.innerHTML = html;
    this.applyNewtab(this.el.mainCol);
  },

  renderKnowledge(k) {
    let html = `<div class="kp">`;
    if (k.thumb) html += `<img class="kp-img" src="${this.safeUrl(k.thumb)}" alt="" onerror="this.style.display='none'">`;
    html += `<div class="kp-body"><div class="kp-title">${this.esc(k.title)}</div>`;
    if (k.desc) html += `<div class="kp-desc">${this.esc(k.desc)}</div>`;
    html += `<div class="kp-extract">${this.esc(k.extract || "")}</div>`;
    html += `<a class="kp-link" href="${this.safeUrl(k.url)}" target="_blank" rel="noopener noreferrer">Read more →</a>`;
    html += `<div class="kp-meta">via ${this.esc(k.host || "Wikipedia")}</div></div></div>`;
    this.el.sideCol.innerHTML = html;
    this.applyNewtab(this.el.sideCol);
  },

  renderImages(d) {
    if (!d.images.length) {
      this.el.mainCol.innerHTML = this.emptyState("No images", "No images found for this query.");
      return;
    }
    let html = `<div class="img-grid">`;
    for (const im of d.images) {
      html += `<a class="img-card" href="${this.safeUrl(im.full || im.thumb)}" target="_blank" rel="noopener noreferrer"><img src="${this.safeUrl(im.thumb)}" loading="lazy" alt="${this.esc(im.title)}" onerror="this.parentNode.style.display='none'"><div class="img-cap">${this.esc(this.trunc(im.title, 40))}</div></a>`;
    }
    html += `</div>`;
    this.el.mainCol.innerHTML = html;
    this.applyNewtab(this.el.mainCol);
  },

  renderSummary(d) {
    const s = d.summary;
    let html = this.renderConversationPanel();
    html += `<div class="ai-card">`;
    html += `<div class="ai-head"><span class="ai-robot">AI</span><div><div class="ai-title">Axiom AI Summary</div><div class="ai-sub">On-device · ${this.esc(this.state.q)} · synthesized from ${s ? s.cites.length : 0} sources</div></div></div>`;
    if (!s || (!s.text && !s.cites?.length)) {
      html += `<div class="ai-body"><div class="ai-loading">Gathering sources…</div></div></div>`;
      this.el.mainCol.innerHTML = html;
      return;
    }
    html += `<div class="ai-body"><p class="ai-text">${this.esc(s.text || "")}</p></div>`;
    if (s.cites?.length) {
      html += `<div class="ai-cites"><div class="ai-cites-label">Sources</div><ol>`;
      for (const c of s.cites) html += `<li><a href="${this.safeUrl(c.url || "#")}" target="_blank" rel="noopener noreferrer">${this.esc(c.name)}</a></li>`;
      html += `</ol></div>`;
    }
    html += `</div>`;
    html += `<div class="ai-tabs"><button class="ai-pill" data-gototab="web">Web (${d.web.length})</button><button class="ai-pill" data-gototab="academic">Academic (${d.academic?.length || 0})</button><button class="ai-pill" data-gototab="code">Code (${d.code?.length || 0})</button><button class="ai-pill" data-gototab="images">Images (${d.images.length})</button><button class="ai-pill" data-gototab="chat">Continue conversation</button></div>`;
    this.el.mainCol.innerHTML = html;
    this.applyNewtab(this.el.mainCol);
  },

  renderConversationPanel() {
    const msgs = this.conversation.messages;
    if (!msgs.length) return "";
    let html = `<div class="ai-card"><div class="ai-head"><span class="ai-robot">AI</span><div><div class="ai-title">Conversation</div><div class="ai-sub">Persistent local context</div></div></div><div class="ai-body">`;
    for (const m of msgs.slice(-10)) {
      html += `<div class="ai-fact"><strong>${m.role === "user" ? "You" : "Axiom"}:</strong> ${this.esc(m.content)}</div>`;
    }
    html += `<div class="ai-tabs"><button class="ai-pill" data-sendchat="Continue from the last answer with more detail">Continue</button><button class="ai-pill" data-sendchat="Explain the last result more naturally">Rewrite</button><button class="ai-pill" data-sendchat="Summarize the conversation so far">Summarize</button></div>`;
    html += `</div></div>`;
    return html;
  },

  renderChatLoading() {
    this.el.mainCol.innerHTML = `<div class="ai-card"><div class="ai-head"><span class="ai-robot">AI</span><div><div class="ai-title">Local LLM</div><div class="ai-sub">Talking to your private model</div></div></div><div class="ai-body"><div class="ai-loading">Generating a response…</div></div></div>`;
  },

  renderChatError(msg) {
    this.el.mainCol.innerHTML = `<div class="ai-card"><div class="ai-head"><span class="ai-robot">AI</span><div><div class="ai-title">Local LLM</div><div class="ai-sub">Connection problem</div></div></div><div class="ai-body"><div class="err-box"><b>Could not reach your local model.</b> ${this.esc(msg)}</div></div></div>`;
  },

  renderChat() {
    let html = this.renderConversationPanel();
    html += `<div class="ai-card"><div class="ai-head"><span class="ai-robot">AI</span><div><div class="ai-title">Private LLM Chat</div><div class="ai-sub">${this.esc(Settings.obj.llmUrl)} · ${this.esc(Settings.obj.llmModel)}</div></div></div>`;
    html += `<div class="ai-body">`;
    html += `<div class="field"><label>Ask a follow-up</label><div class="hint">The model uses the conversation summary plus the latest source facts.</div><input id="chatInput" placeholder="Type a question or ask for a rewrite…"></div>`;
    html += `<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" id="chatSend">Send</button><button class="btn ghost" id="chatClear">Clear conversation</button></div>`;
    if (this.conversation.summary) {
      html += `<div class="src-info" style="margin-top:16px"><b style="color:var(--text)">Conversation memory.</b> ${this.esc(this.conversation.summary)}</div>`;
    }
    html += `</div></div>`;
    this.el.mainCol.innerHTML = html;
    this.applyNewtab(this.el.mainCol);

    const input = document.getElementById("chatInput");
    const send = document.getElementById("chatSend");
    const clear = document.getElementById("chatClear");
    if (input) {
      input.focus();
      input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.sendChat(input.value);
        }
      });
    }
    if (send && input) send.addEventListener("click", () => this.sendChat(input.value));
    if (clear) clear.addEventListener("click", () => {
      this.clearConversation();
      this.renderChat();
      toast("Conversation cleared");
    });
  },

  renderAcademic(d) {
    if (!d.academic || !d.academic.length) {
      this.el.mainCol.innerHTML = this.emptyState("No academic papers", "No scholarly works found on Crossref for this query.");
      return;
    }
    let html = `<div class="src-list">`;
    for (const a of d.academic) html += this.resultCard(a, "academic");
    html += `</div><div class="src-foot">via Crossref — ${d.academic.length} of the most relevant papers</div>`;
    this.el.mainCol.innerHTML = html;
    this.applyNewtab(this.el.mainCol);
  },

  renderCode(d) {
    if (!d.code || !d.code.length) {
      this.el.mainCol.innerHTML = this.emptyState("No repositories", "No GitHub repositories matched this query.");
      return;
    }
    let html = `<div class="src-list">`;
    for (const c of d.code) html += this.resultCard(c, "code");
    html += `</div><div class="src-foot">via GitHub — sorted by stars</div>`;
    this.el.mainCol.innerHTML = html;
    this.applyNewtab(this.el.mainCol);
  },

  resultCard(r, badge) {
    const host = r.host || this.hostOf(r.url);
    const fav = r.thumb
      ? `<img class="r-fav" src="${this.safeUrl(r.thumb)}" onerror="this.style.display='none'">`
      : this.favHtml(host);
    const b = badge ? `<span class="src-badge b-${this.esc(badge)}">${this.esc(badge === "academic" ? "Academic" : badge === "code" ? "GitHub" : badge === "book" ? "Open Library" : badge === "archive" ? "Archive" : badge === "encyclopedia" ? "Encyclopedia" : "Web")}</span>` : "";
    let snip = r.snippet || "";
    if (r.age) snip = `<span class="date">${this.esc(r.age)} — </span>${this.esc(snip)}`;
    else snip = this.esc(snip);

    let meta = "";
    if (r.stars != null) meta = ` <span class="r-meta">★ ${this.esc(r.stars.toLocaleString())}</span>`;
    if (r.points != null) meta = ` <span class="r-meta">▲ ${this.esc(String(r.points))}</span>`;
    return `<div class="result">${b}<div class="r-url">${fav}<span class="r-host">${this.esc(host)}</span> <span style="color:var(--muted-2)">${this.esc(this.prettyUrl(r.url))}</span></div><a class="r-title" href="${this.safeUrl(r.url)}" target="_blank" rel="noopener noreferrer">${this.esc(r.title)}</a><div class="r-snip">${snip}${meta}</div></div>`;
  },

  favHtml(host) {
    const ch = (host || "?").replace(/^www\./, "")[0] || "?";
    return `<span class="r-fav-ph">${this.esc(ch.toUpperCase())}</span>`;
  },

  applyNewtab(container) {
    if (Settings.obj.newtab) return;
    container.querySelectorAll('a[target="_blank"]').forEach(a => a.removeAttribute("target"));
  },

  emptyState(title, msg) {
    return `<div class="empty-state"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><h3>${this.esc(title)}</h3><p>${this.esc(msg)}</p></div>`;
  },

  renderChips() {
    const c = ["quantum entanglement", "speed of light", "black hole", "photosynthesis", "Theory of Relativity", "DNA replication", "capital of Brazil", "Pi digits"];
    this.el.homeChips.innerHTML = c.map(x => `<button class="chip" type="button">${this.esc(x)}</button>`).join("");
    this.el.homeChips.addEventListener("click", e => {
      const b = e.target.closest(".chip");
      if (b) this.search(b.textContent);
    });
  },

  renderRecent() {
    if (!Settings.obj.history) {
      this.el.recentBlock.classList.add("hidden");
      return;
    }
    const h = History.list();
    if (!h.length) {
      this.el.recentBlock.classList.add("hidden");
      return;
    }
    this.el.recentBlock.classList.remove("hidden");
    this.el.recentList.innerHTML = h.map((q, i) => `<span class="recent-item" data-q="${this.esc(q)}">${this.esc(q)}<span class="x" data-i="${i}">×</span></span>`).join("");
  },

  goHome() {
    this.el.results.classList.add("hidden");
    this.el.home.classList.remove("hidden");
    this.el.homeInput.value = "";
    this.el.homeClear.style.display = "none";
    this.hideSuggest();
    const u = new URL(location);
    u.searchParams.delete("q");
    history.replaceState(null, "", u);
    document.title = "Axiom — Search";
    this.el.homeInput.focus();
  },

  applyTheme() {
    document.documentElement.setAttribute("data-theme", Settings.obj.theme);
    const ic = document.getElementById("themeIcon");
    if (Settings.obj.theme === "light") {
      ic.innerHTML = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
    } else {
      ic.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    }
  },

  applyPrivacyBadge() {
    const on = Settings.obj.privacy;
    document.getElementById("privacyBadge").classList.toggle("show", on);
  },

  async askLocalLLM(userText) {
    const facts = this.collectFactsForLLM();
    const url = Settings.obj.llmUrl.replace(/\/$/, "") + "/v1/chat/completions";
    const messages = [
      { role: "system", content: Settings.obj.systemPrompt },
      { role: "system", content: `Conversation summary:\n${this.conversation.summary || "None yet."}` },
      { role: "system", content: `Useful source facts:\n${facts.join("\n") || "No source facts available."}` },
      ...this.conversation.messages.slice(-12).map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: userText }
    ];

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Settings.obj.llmModel,
        messages,
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 700,
        stream: false
      })
    });

    if (!res.ok) throw new Error("Local LLM is not reachable. Check LM Studio and the base URL.");
    const data = await res.json();
    const out = data.choices?.[0]?.message?.content || "";
    if (!out.trim()) throw new Error("Local LLM returned an empty response.");
    return out.trim();
  },

  collectFactsForLLM() {
    const d = this.state.results;
    if (!d) return [];
    const facts = [];
    const push = (src, title, text, url) => {
      if (!text) return;
      const t = String(text).replace(/\s+/g, " ").trim();
      if (t.length < 20) return;
      facts.push(`${src}: ${title || "Untitled"} — ${t.slice(0, 280)}${url ? " (" + url + ")" : ""}`);
    };

    if (d.instantAnswer?.abstract) push("DuckDuckGo", d.instantAnswer.heading || "Instant answer", d.instantAnswer.abstract, d.instantAnswer.url);
    if (d.knowledge?.extract) push("Wikipedia", d.knowledge.title, d.knowledge.extract, d.knowledge.url);
    (d.web || []).slice(0, 5).forEach(r => push("Web", r.title, r.snippet, r.url));
    (d.academic || []).slice(0, 3).forEach(r => push("Crossref", r.title, r.snippet, r.url));
    (d.books || []).slice(0, 3).forEach(r => push("Open Library", r.title, r.snippet, r.url));
    (d.archive || []).slice(0, 4).forEach(r => push("Internet Archive", r.title, r.snippet, r.url));
    (d.encyclopedia || []).slice(0, 4).forEach(r => push("Encyclopedia.com", r.title, r.snippet, r.url));
    return facts;
  },

  setSystemPromptDefaults() {
    return [
      "You are Axiom, a helpful private local assistant.",
      "Write naturally, like a human.",
      "Do not copy source wording.",
      "Use fresh sentences and clear transitions.",
      "If the facts are weak, say so plainly.",
      "Use 5 to 8 complete sentences unless the user asks for less.",
      "Continue the conversation using the prior context."
    ].join(" ");
  },

  delay(ms) { return new Promise(r => setTimeout(r, ms)); },
  wikiLang(l) { l = l || "en"; return ["en", "es", "fr", "de", "it", "pt", "nl", "ru", "ja", "zh", "ar", "hi"].includes(l) ? l : "en"; },
  hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } },
  prettyUrl(u) { try { const x = new URL(u); return x.pathname + x.search; } catch { return u; } },
  esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[c]));
  },
  trunc(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; },
  safeUrl(u) { u = String(u || ""); return /^https?:\/\//i.test(u) ? u : "#"; },
  sim(a, b) {
    a = String(a || "").toLowerCase();
    b = String(b || "").toLowerCase();
    const wa = new Set(a.split(/\W+/));
    const wb = b.split(/\W+/);
    let o = 0;
    for (const w of wb) if (wa.has(w)) o++;
    return o / Math.max(wb.length, 1);
  }
};

const Store = (function () {
  let ls = null, mem = {}, privacy = false;
  try {
    const t = "__axiom_t__";
    ls = window.localStorage;
    ls.setItem(t, "1");
    ls.removeItem(t);
  } catch {
    ls = null;
  }
  return {
    get(key, dflt) {
      if (ls && !privacy) {
        try {
          const v = ls.getItem("axiom_" + key);
          return v === null ? dflt : v;
        } catch {}
      }
      return (key in mem) ? mem[key] : dflt;
    },
    set(key, val) {
      if (privacy) { mem[key] = val; return; }
      if (ls) {
        try { ls.setItem("axiom_" + key, val); return; } catch {}
      }
      mem[key] = val;
    },
    remove(key) {
      if (ls && !privacy) {
        try { ls.removeItem("axiom_" + key); return; } catch {}
      }
      delete mem[key];
    },
    setPrivacy(on) { privacy = !!on; if (on) mem = {}; },
    isPrivacy() { return privacy; },
  };
})();

const Settings = {
  defaults: {
    theme: "dark",
    lang: "en",
    newtab: true,
    history: true,
    privacy: false,
    llmUrl: "http://127.0.0.1:1234",
    llmModel: "local-model",
    systemPrompt: Axiom.setSystemPromptDefaults()
  },
  obj: {},

  load() {
    try { this.obj = { ...this.defaults, ...JSON.parse(Store.get("settings", "{}")) }; }
    catch { this.obj = { ...this.defaults }; }
    if (!this.obj.systemPrompt) this.obj.systemPrompt = Axiom.setSystemPromptDefaults();
    Store.setPrivacy(this.obj.privacy);
  },

  open() {
    document.getElementById("setLang").value = this.obj.lang;
    document.getElementById("setNewtab").checked = this.obj.newtab;
    document.getElementById("setHistory").checked = this.obj.history;
    document.getElementById("setPrivacy").checked = this.obj.privacy;
    document.getElementById("setLlmUrl").value = this.obj.llmUrl;
    document.getElementById("setLlmModel").value = this.obj.llmModel;
    document.getElementById("setSystemPrompt").value = this.obj.systemPrompt;
    document.getElementById("settingsModal").classList.add("show");
  },

  close() { document.getElementById("settingsModal").classList.remove("show"); },

  save() {
    this.obj.lang = document.getElementById("setLang").value;
    this.obj.newtab = document.getElementById("setNewtab").checked;
    this.obj.history = document.getElementById("setHistory").checked;
    this.obj.llmUrl = document.getElementById("setLlmUrl").value.trim() || this.defaults.llmUrl;
    this.obj.llmModel = document.getElementById("setLlmModel").value.trim() || this.defaults.llmModel;
    this.obj.systemPrompt = document.getElementById("setSystemPrompt").value.trim() || Axiom.setSystemPromptDefaults();
    const newPrivacy = document.getElementById("setPrivacy").checked;
    this.obj.privacy = newPrivacy;
    Store.setPrivacy(newPrivacy);
    if (!newPrivacy) this.persist();
    this.close();
    Axiom.renderRecent();
    Axiom.applyPrivacyBadge();
    toast(newPrivacy ? "Privacy mode on — nothing will be saved" : "Settings saved");
  },

  toggleTheme() {
    this.obj.theme = this.obj.theme === "light" ? "dark" : "light";
    this.persist();
    Axiom.applyTheme();
  },

  persist() { Store.set("settings", JSON.stringify(this.obj)); },
};

const History = {
  list() { try { return JSON.parse(Store.get("history", "[]")); } catch { return []; } },
  add(q) {
    if (!Settings.obj.history || Store.isPrivacy()) return;
    let h = this.list();
    h = h.filter(x => x.toLowerCase() !== q.toLowerCase());
    h.unshift(q);
    if (h.length > 12) h = h.slice(0, 12);
    Store.set("history", JSON.stringify(h));
  },
  clear() { Store.remove("history"); },
  remove(i) {
    let h = this.list();
    h.splice(i, 1);
    Store.set("history", JSON.stringify(h));
  }
};

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 1900);
}

document.addEventListener("DOMContentLoaded", () => Axiom.init());
