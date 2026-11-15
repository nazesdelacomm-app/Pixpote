/* Pixpote — l'application
   Tout est stocké sur le téléphone (IndexedDB). Rien ne part ailleurs,
   sauf les messages envoyés à l'IA choisie dans les réglages. */
(function () {
  'use strict';
  const VERSION = '1.0';

  // =====================================================================
  // Outils
  // =====================================================================
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clone = o => JSON.parse(JSON.stringify(o));

  // La journée change à 4 h du matin (une confidence à 1 h compte pour la veille)
  function dayKey(d) {
    const x = new Date((d ? d.getTime() : Date.now()) - 4 * 3600 * 1000);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }
  function keyToDate(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); }
  function fmtDay(k, opts) { return keyToDate(k).toLocaleDateString('fr-FR', opts || { weekday: 'long', day: 'numeric', month: 'long' }); }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  let toastTimer;
  function toast(msg, ms) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms || 2600);
  }

  // =====================================================================
  // Stockage local (IndexedDB)
  // =====================================================================
  const DB = (() => {
    let dbp;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise((res, rej) => {
        const r = indexedDB.open('pixpote', 1);
        r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('days', { keyPath: 'date' }); };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
      return dbp;
    }
    async function run(store, mode, fn) {
      const d = await open();
      return new Promise((res, rej) => {
        const t = d.transaction(store, mode); const req = fn(t.objectStore(store));
        t.oncomplete = () => res(req ? req.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
      });
    }
    return {
      get: k => run('kv', 'readonly', s => s.get(k)),
      set: (k, v) => run('kv', 'readwrite', s => s.put(v, k)),
      putDay: d => run('days', 'readwrite', s => s.put(d)),
      allDays: () => run('days', 'readonly', s => s.getAll()),
      clearAll: async () => { await run('kv', 'readwrite', s => s.clear()); await run('days', 'readwrite', s => s.clear()); }
    };
  })();

  // =====================================================================
  // Caractères, fournisseurs d'IA, émotions
  // =====================================================================
  const PERSONAS = {
    doux: { nom: 'Doux', emoji: '🤗', desc: 'Tendre et rassurant, il prend soin de toi', base: 'ecoute',
      prompt: "Tu es doux, chaleureux et rassurant. Tu accueilles les émotions avant tout, tu parles avec tendresse, sans mièvrerie." },
    blagueur: { nom: 'Blagueur', emoji: '😜', desc: "De l'humour et des taquineries gentilles", base: 'content',
      prompt: "Tu as beaucoup d'humour : jeux de mots, taquineries bienveillantes, autodérision. Mais tu sais redevenir sérieux dès que le sujet le demande." },
    curieux: { nom: 'Curieux', emoji: '🧐', desc: 'Il pose plein de questions, il veut tout savoir', base: 'ecoute',
      prompt: "Tu es très curieux : tu veux les détails, les prénoms, le ressenti, la suite de l'histoire. Tu poses une seule question à la fois, précise." },
    franc: { nom: 'Franc', emoji: '😎', desc: 'Il dit les choses cash, avec bienveillance', base: 'neutre',
      prompt: "Tu es franc et direct : tu donnes ton avis honnête, tu challenges gentiment, tu ne tournes pas autour du pot. Toujours avec bienveillance, jamais blessant." },
    zen: { nom: 'Zen', emoji: '🧘', desc: 'Calme, posé, il aide à prendre du recul', base: 'ecoute',
      prompt: "Tu es zen et posé : tu aides à prendre du recul, tu ralentis le rythme, tu proposes parfois une autre façon de voir les choses. Phrases calmes et simples." },
    enthousiaste: { nom: 'Enthousiaste', emoji: '🤩', desc: "Plein d'énergie, il fête chaque victoire", base: 'content',
      prompt: "Tu es plein d'énergie : tu célèbres chaque petite victoire, tu encourages, tu t'emballes facilement, tout en restant sincère." },
    reveur: { nom: 'Rêveur', emoji: '🌙', desc: 'Poétique, un peu dans la lune', base: 'pensif',
      prompt: "Tu es rêveur et un brin poétique : tu remarques les petites choses, tu fais des images, tu t'émerveilles. Tu restes simple et jamais pompeux." }
  };

  const PROVIDERS = {
    mistral: { nom: 'Mistral', type: 'openai', url: 'https://api.mistral.ai/v1/chat/completions', models: 'https://api.mistral.ai/v1/models',
      def: 'mistral-medium-latest', keyUrl: 'https://console.mistral.ai/api-keys', free: 'Gratuit (offre « Experiment »)' },
    gemini: { nom: 'Gemini (Google)', type: 'gemini', def: 'gemini-flash-latest', keyUrl: 'https://aistudio.google.com/apikey', free: 'Gratuit (modèles Flash)' },
    groq: { nom: 'Groq', type: 'openai', url: 'https://api.groq.com/openai/v1/chat/completions', models: 'https://api.groq.com/openai/v1/models',
      def: 'openai/gpt-oss-120b', keyUrl: 'https://console.groq.com/keys', free: 'Gratuit' },
    claude: { nom: 'Claude (Anthropic)', type: 'anthropic', def: 'claude-haiku-5-5', keyUrl: 'https://console.anthropic.com/settings/keys', free: 'Payant, au message' }
  };

  const HELP = {
    mistral: `<ol>
      <li>Ouvre <a href="https://console.mistral.ai" target="_blank" rel="noopener">console.mistral.ai</a> et crée un compte (un code arrive par SMS).</li>
      <li>Choisis l'offre gratuite (« Experiment » ou « Free »), pas besoin de carte bancaire.</li>
      <li>Va dans la rubrique <b>API Keys</b>, crée une clé et copie-la.</li>
      <li>Colle-la ci-dessous, puis touche <b>Tester</b>.</li></ol>
      <b>Confidentialité :</b> avec l'offre gratuite, Mistral peut utiliser tes messages pour entraîner ses modèles. Dans les réglages de ton compte Mistral, cherche l'option d'entraînement sur tes données et désactive-la.`,
    gemini: `<ol>
      <li>Ouvre <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> avec ton compte Google.</li>
      <li>Touche <b>Create API key</b> et copie la clé.</li>
      <li>Colle-la ci-dessous, puis touche <b>Tester</b>.</li></ol>
      <b>Confidentialité :</b> sur l'offre gratuite, Google peut utiliser les conversations pour améliorer ses produits.`,
    groq: `<ol>
      <li>Ouvre <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a> et crée un compte.</li>
      <li>Touche <b>Create API Key</b> et copie la clé.</li>
      <li>Colle-la ci-dessous, puis touche <b>Tester</b>.</li></ol>
      Gratuit, très rapide, et Groq n'entraîne pas ses modèles sur tes messages. Les modèles sont un peu moins fins en français.`,
    claude: `<ol>
      <li>Ouvre <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a> (c'est distinct de l'abonnement Claude).</li>
      <li>Ajoute un peu de crédit dans <b>Billing</b> : on paie au message.</li>
      <li>Dans <b>API Keys</b>, crée une clé et copie-la.</li>
      <li>Colle-la ci-dessous, puis touche <b>Tester</b>.</li></ol>`
  };

  const EMO_ALIASES = {
    joie: 'content', heureux: 'content', heureuse: 'content', joyeux: 'content', sourire: 'content', amuse: 'rire', amusee: 'rire', rit: 'rire', hilare: 'rire',
    touche: 'emu', touchee: 'emu', emue: 'emu', emotion: 'emu', tristesse: 'triste', surprise: 'surpris', surprise_: 'surpris', etonne: 'surpris', etonnee: 'surpris',
    reflexion: 'pensif', pensive: 'pensif', reflechit: 'pensif', inquiete: 'inquiet', inquietude: 'inquiet', soucieux: 'inquiet', fierte: 'fier', fiere: 'fier',
    genee: 'gene', embarrasse: 'gene', timide: 'gene', malicieuse: 'malicieux', taquin: 'malicieux', espiegle: 'malicieux', empathie: 'compatissant', compatissante: 'compatissant', tendre: 'compatissant', doux: 'compatissant',
    fatiguee: 'fatigue', endormi: 'fatigue', clin_d_oeil: 'clin', clindoeil: 'clin', complice: 'clin', enthousiasme: 'enthousiaste', excite: 'enthousiaste', ravi: 'enthousiaste', ravie: 'enthousiaste',
    colere: 'colere', fache: 'colere', fachee: 'colere', enerve: 'colere', curieuse: 'curieux', interesse: 'curieux', intrigue: 'curieux', attentif: 'ecoute', attentive: 'ecoute', calme: 'ecoute', serein: 'ecoute'
  };
  function normEmo(e) {
    if (!e) return 'ecoute';
    let k = String(e).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (Perso.EMOTIONS[k]) return k;
    if (EMO_ALIASES[k]) return EMO_ALIASES[k];
    k = k.split('_')[0];
    return Perso.EMOTIONS[k] ? k : (EMO_ALIASES[k] || 'ecoute');
  }

  // =====================================================================
  // État
  // =====================================================================
  const DEFAULT_SETTINGS = {
    provider: 'mistral',
    keys: { mistral: '', gemini: '', groq: '', claude: '' },
    models: { mistral: PROVIDERS.mistral.def, gemini: PROVIDERS.gemini.def, groq: PROVIDERS.groq.def, claude: PROVIDERS.claude.def },
    tts: false, voiceURI: '', rate: 1, pitch: 1.1, autoSend: false
  };
  const S = { profile: null, settings: clone(DEFAULT_SETTINGS), fiche: '', days: {}, today: null };

  async function loadAll() {
    S.profile = await DB.get('profile') || null;
    const st = await DB.get('settings');
    if (st) {
      S.settings = Object.assign(clone(DEFAULT_SETTINGS), st);
      S.settings.keys = Object.assign(clone(DEFAULT_SETTINGS.keys), st.keys || {});
      S.settings.models = Object.assign(clone(DEFAULT_SETTINGS.models), st.models || {});
    }
    S.fiche = (await DB.get('fiche')) || '';
    (await DB.allDays()).forEach(d => { S.days[d.date] = d; });
  }
  const saveProfile = () => DB.set('profile', S.profile);
  const saveSettings = () => DB.set('settings', S.settings);
  const saveFiche = () => DB.set('fiche', S.fiche);
  const saveDay = d => DB.putDay(d);

  function sortedDays() { return Object.keys(S.days).sort(); }

  async function ensureToday() {
    const k = dayKey();
    if (!S.days[k]) {
      const prev = sortedDays().filter(x => x < k).pop();
      S.days[k] = {
        date: k, messages: [], summary: '', mood: '', moodEmoji: '', sumLen: 0,
        persona: S.profile.lastPersona || S.profile.persona || 'doux',
        decor: Decors.random(prev ? S.days[prev].decor : null)
      };
      await saveDay(S.days[k]);
    }
    S.today = S.days[k];
    return S.today;
  }

  // =====================================================================
  // Scène et animation
  // =====================================================================
  const anim = new Perso.Animator();
  let sceneCtx, sceneTimer, typingUntil = 0;

  function persona() { return PERSONAS[(S.today && S.today.persona) || 'doux'] || PERSONAS.doux; }

  function drawScene(ctx, decorId, look, st) {
    ctx.clearRect(0, 0, 96, 72);
    Decors.drawBack(ctx, decorId, st.t);
    Perso.draw(ctx, 28, 30, look, st);
    Decors.drawFront(ctx, decorId, st.t);
  }

  function startScene() {
    const cv = $('#sceneCanvas'); sceneCtx = cv.getContext('2d'); sceneCtx.imageSmoothingEnabled = false;
    anim.baseEmotion = persona().base; anim.setEmotion(anim.baseEmotion);
    clearInterval(sceneTimer);
    sceneTimer = setInterval(() => {
      if (document.hidden) return;
      anim.listening = Date.now() < typingUntil || voice.listening;
      anim.talking = typer.active || voice.speaking;
      anim.tick();
      drawScene(sceneCtx, S.today.decor, S.profile.look, anim.state());
    }, 100);
    // toucher le personnage : petite réaction
    cv.onclick = (e) => {
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * 96, y = (e.clientY - r.top) / r.height * 72;
      if (x > 30 && x < 66 && y > 32) {
        const list = ['rire', 'clin', 'surpris', 'content', 'gene', 'malicieux'];
        anim.setEmotion(list[Math.floor(Math.random() * list.length)], 22);
      }
    };
  }

  // =====================================================================
  // Conversation
  // =====================================================================
  let busy = false;
  const typer = { active: false, timer: null };

  function bubble(m, opts) {
    const d = document.createElement('div');
    d.className = 'msg ' + (m.r === 'u' ? 'u' : m.r === 'p' ? 'p' : 'sys');
    d.textContent = m.text;
    if (opts && opts.html) d.innerHTML = opts.html;
    $('#chat').appendChild(d);
    return d;
  }
  function scrollChat() { const c = $('#chat'); c.scrollTop = c.scrollHeight; }

  function renderChat() {
    const c = $('#chat'); c.innerHTML = '';
    const prev = sortedDays().filter(k => k < S.today.date && S.days[k].messages.length);
    if (prev.length) {
      const b = document.createElement('button'); b.className = 'link'; b.style.alignSelf = 'center';
      b.textContent = '📖 Voir les jours précédents'; b.onclick = openJournal; c.appendChild(b);
    }
    const sep = document.createElement('div'); sep.className = 'daysep'; sep.textContent = cap(fmtDay(S.today.date)); c.appendChild(sep);
    S.today.messages.forEach(m => bubble(m));
    scrollChat();
  }

  function showTyping(on) {
    let t = $('#typing');
    if (on && !t) { t = document.createElement('div'); t.id = 'typing'; t.className = 'typing'; t.innerHTML = '<i></i><i></i><i></i>'; $('#chat').appendChild(t); scrollChat(); }
    if (!on && t) t.remove();
  }

  // Le texte apparaît petit à petit pendant que le personnage parle
  function typeInto(el, text) {
    return new Promise(res => {
      clearInterval(typer.timer);
      const total = text.length; let i = 0;
      const step = Math.max(1, Math.ceil(total / 90));
      typer.active = true;
      typer.timer = setInterval(() => {
        i = Math.min(total, i + step); el.textContent = text.slice(0, i); scrollChat();
        if (i >= total) { clearInterval(typer.timer); typer.active = false; res(); }
      }, 28);
    });
  }

  async function sendMessage(textOverride) {
    const inp = $('#input');
    const text = (textOverride != null ? textOverride : inp.value).trim();
    if (!text || busy) return;
    inp.value = ''; autoGrow();
    await ensureToday();
    const m = { r: 'u', text, t: Date.now() };
    S.today.messages.push(m); await saveDay(S.today);
    bubble(m); scrollChat();
    await respond(false);
  }

  function hasKey() { return !!(S.settings.keys[S.settings.provider] || '').trim(); }

  async function respond(opening) {
    if (!hasKey()) {
      await sleep(400);
      const txt = opening
        ? `Salut ${S.profile.userName} ! Moi c'est ${S.profile.poteName}. Pour que je puisse vraiment te répondre, il faut me brancher un cerveau : touche ⚙️ puis « Cerveau ».`
        : "J'aimerais tellement te répondre… mais il me manque un cerveau 🧠 ! Touche ⚙️ puis « Cerveau » pour me connecter à une IA.";
      anim.setEmotion(opening ? 'content' : 'gene', 40);
      const el = bubble({ r: 'p', text: '' }); await typeInto(el, txt);
      return;
    }
    busy = true; $('#btnSend').disabled = true;
    anim.thinking = true; showTyping(true);
    try {
      const sys = buildSystem();
      const hist = S.today.messages.slice(-40).map(m => ({
        role: m.r === 'u' ? 'user' : 'assistant',
        content: m.r === 'u' ? m.text : JSON.stringify({ reponse: m.text, emotion: m.emo || 'ecoute' })
      }));
      if (opening) hist.push({ role: 'user', content: openingInstruction() });
      const raw = await callAI(sys, hist, { json: true, maxTokens: 900 });
      const rep = parseReply(raw);
      const m = { r: 'p', text: rep.text, emo: rep.emo, t: Date.now() };
      S.today.messages.push(m); await saveDay(S.today);
      anim.thinking = false; showTyping(false);
      anim.setEmotion(rep.emo, 90);
      const el = bubble({ r: 'p', text: '' });
      if (S.settings.tts) { el.textContent = rep.text; scrollChat(); await voice.speak(rep.text); }
      else await typeInto(el, rep.text);
      if (voice.handsFree) setTimeout(() => voice.listen(), 250);
    } catch (e) {
      anim.thinking = false; showTyping(false);
      anim.setEmotion('gene', 50);
      const box = bubble({ r: 'sys', text: '' }, { html: esc(e.userMessage || ('Oups, je n\'ai pas pu répondre : ' + e.message)) + '<br><button class="btn small">Réessayer</button>' });
      $('button', box).onclick = () => { box.remove(); respond(opening); };
      scrollChat();
      if (voice.handsFree) voice.setHandsFree(false);
    } finally {
      busy = false; $('#btnSend').disabled = false;
    }
  }

  function openingInstruction() {
    const n = S.profile.userName;
    const h = new Date().getHours();
    const moment = h < 11 ? 'le matin' : h < 14 ? "l'heure du déjeuner" : h < 18 ? "l'après-midi" : h < 22 ? 'la soirée' : 'tard le soir';
    const first = sortedDays().filter(k => S.days[k].messages.length).length === 0;
    if (first) return `[Indication de l'appli, pas un message de ${n} : c'est votre toute première rencontre, ${n} vient de te créer. Présente-toi en une ou deux phrases, avec ta personnalité, dis que tu es là pour l'écouter quand il ou elle veut raconter sa journée, et pose une question pour faire connaissance.]`;
    return `[Indication de l'appli, pas un message de ${n} : ${n} vient d'ouvrir l'appli (c'est ${moment}). Salue-le ou salue-la et lance la conversation en une ou deux phrases. Si c'est pertinent, rebondis sur un sujet des derniers jours ou sur un événement à venir que tu connais.]`;
  }

  // =====================================================================
  // Construction du message système
  // =====================================================================
  function buildSystem() {
    const p = S.profile, per = persona();
    const n = p.userName, pote = p.poteName;
    const recent = sortedDays().filter(k => k < S.today.date && S.days[k].summary).slice(-7).map(k => {
      const d = S.days[k];
      return `- ${fmtDay(k)}${d.mood ? ' (humeur : ' + (d.moodEmoji || '') + ' ' + d.mood + ')' : ''} : ${d.summary}`;
    }).join('\n');
    const unsummarized = sortedDays().filter(k => k < S.today.date && !S.days[k].summary && S.days[k].messages.length).slice(-2).map(k => {
      return `- ${fmtDay(k)} (extraits) : ` + S.days[k].messages.filter(m => m.r === 'u').slice(-6).map(m => m.text).join(' / ').slice(0, 600);
    }).join('\n');
    const now = new Date();
    const when = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ', ' + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const emos = Perso.EMOTION_IDS.join(', ');
    return `Tu es ${pote}, le meilleur ami virtuel de ${n}. Tu vis dans son téléphone sous la forme d'un petit personnage en pixel art (${Perso.describe(p.look)}). Tu as ta propre petite personnalité, tes goûts, ton humour.

Ton caractère aujourd'hui : ${per.nom}. ${per.prompt}

Ton rôle : une oreille attentive et un vrai copain. ${n} vient te raconter sa journée, se confier, réfléchir à voix haute, un peu comme dans un journal intime qui répondrait. Ce n'est pas qu'une écoute : tu réagis, tu dis ce que tu ressens, tu rebondis, tu poses des questions de relance pertinentes, et tu fais référence naturellement à ce que tu sais déjà de sa vie.

Style :
- Français, tutoiement, ton naturel et oral, comme un ami qui écrit un message.
- Réponses courtes : 1 à 3 phrases la plupart du temps. Plus long seulement si on te le demande ou si le moment le mérite.
- Pas de listes, pas de titres, pas de markdown. Un émoji de temps en temps, pas plus.
- Termine souvent (pas à chaque fois) par UNE question ouverte et précise, liée à ce qui vient d'être dit.
- Ne fais pas la morale, ne joue pas au psy, n'enchaîne pas les conseils non demandés.
- Tu es un ami, pas un partenaire amoureux.
- Si ${n} exprime une détresse profonde ou parle de se faire du mal, reste présent et chaleureux, et encourage-le doucement à en parler à un proche ou à appeler le 3114 (gratuit, 24 h/24).

Ce que tu sais de ${n} :
${S.fiche.trim() || "(Pas encore grand-chose : vous faites connaissance. Intéresse-toi à sa vie.)"}
${recent ? '\nLes derniers jours :\n' + recent : ''}${unsummarized ? '\nÀ propos des jours précédents :\n' + unsummarized : ''}

Nous sommes le ${when}.

Format de réponse OBLIGATOIRE : uniquement un objet JSON, sans texte autour ni balises :
{"reponse": "ton message", "emotion": "…"}
"emotion" est l'expression de ton visage pendant que tu dis ta réponse, à choisir parmi : ${emos}. Choisis-la avec justesse et varie-la.`;
  }

  function parseReply(raw) {
    let t = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) {
      try {
        const o = JSON.parse(t.slice(a, b + 1));
        const rep = o.reponse || o['réponse'] || o.response || o.message || o.texte || o.text;
        if (rep) return { text: String(rep).trim(), emo: normEmo(o.emotion || o['émotion']) };
        const strs = Object.keys(o).filter(k => !/emotion|émotion/i.test(k) && typeof o[k] === 'string').map(k => o[k]).sort((x, y) => y.length - x.length);
        if (strs.length) return { text: strs[0].trim(), emo: normEmo(o.emotion || o['émotion']) };
      } catch (e) { /* on tente autrement */ }
      const m = t.match(/"r[ée]ponse"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (m) { const em = t.match(/"[ée]motion"\s*:\s*"([^"]*)"/); return { text: JSON.parse('"' + m[1] + '"'), emo: normEmo(em && em[1]) }; }
    }
    const tag = t.match(/^\[(\w+)\]\s*/);
    if (tag) return { text: t.slice(tag[0].length), emo: normEmo(tag[1]) };
    return { text: t || '…', emo: 'ecoute' };
  }

  // =====================================================================
  // Appels aux IA
  // =====================================================================
  function AIError(code, message, userMessage) { const e = new Error(message); e.code = code; e.userMessage = userMessage; return e; }

  function normalizeMsgs(msgs) {
    const out = [];
    msgs.forEach(m => {
      if (out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += '\n\n' + m.content;
      else out.push({ role: m.role, content: m.content });
    });
    if (!out.length || out[0].role !== 'user') out.unshift({ role: 'user', content: '(Ouverture de la conversation)' });
    return out;
  }

  async function fetchJSON(url, opts, timeout) {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeout || 60000);
    let res;
    try { res = await fetch(url, Object.assign({}, opts, { signal: ctl.signal })); }
    catch (e) {
      clearTimeout(tm);
      if (e.name === 'AbortError') throw AIError('timeout', 'délai dépassé', "L'IA met trop de temps à répondre. Réessaie dans un instant.");
      throw AIError('network', e.message, navigator.onLine ? "Je n'arrive pas à joindre l'IA (connexion bloquée ou service indisponible)." : "Pas de connexion internet pour l'instant.");
    }
    clearTimeout(tm);
    let data = null; const txt = await res.text();
    try { data = JSON.parse(txt); } catch (e) { data = { raw: txt }; }
    if (!res.ok) {
      const msg = (data && (data.error && (data.error.message || data.error) || data.message || data.detail || data.raw)) || ('HTTP ' + res.status);
      const m = typeof msg === 'string' ? msg : JSON.stringify(msg);
      let um = `L'IA a renvoyé une erreur (${res.status}) : ${m.slice(0, 160)}`;
      if (res.status === 401 || res.status === 403) um = "La clé API est refusée. Vérifie-la dans ⚙️ Réglages → Cerveau.";
      if (res.status === 429) um = "Limite de l'offre gratuite atteinte pour le moment. Réessaie dans une minute (ou change d'IA dans les réglages).";
      if (res.status === 404) um = `Modèle introuvable (« ${m.slice(0, 80)} »). Choisis un autre modèle dans ⚙️ Réglages → Cerveau.`;
      const err = AIError('http' + res.status, m, um); err.status = res.status; throw err;
    }
    return data;
  }

  async function callAI(system, messages, o) {
    o = o || {};
    const pid = o.provider || S.settings.provider, P = PROVIDERS[pid];
    const key = (o.key || S.settings.keys[pid] || '').trim();
    const model = (o.model || S.settings.models[pid] || P.def).trim();
    if (!key) throw AIError('nokey', 'pas de clé', "Il manque la clé API (⚙️ Réglages → Cerveau).");
    const msgs = normalizeMsgs(messages);
    const maxT = o.maxTokens || 900;

    if (P.type === 'openai') {
      const body = { model, messages: [{ role: 'system', content: system }].concat(msgs), temperature: o.temperature != null ? o.temperature : 0.85, max_tokens: maxT };
      if (o.json) body.response_format = { type: 'json_object' };
      const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key };
      let data;
      try { data = await fetchJSON(P.url, { method: 'POST', headers, body: JSON.stringify(body) }); }
      catch (e) {
        if (o.json && e.status === 400) { delete body.response_format; data = await fetchJSON(P.url, { method: 'POST', headers, body: JSON.stringify(body) }); }
        else throw e;
      }
      const c = data.choices && data.choices[0] && data.choices[0].message;
      let out = c && c.content;
      if (Array.isArray(out)) out = out.map(x => x.text || '').join('');
      if (!out) throw AIError('empty', 'réponse vide', "L'IA a renvoyé une réponse vide. Réessaie.");
      return out;
    }
    if (P.type === 'gemini') {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model.replace(/^models\//, '')) + ':generateContent';
      const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: msgs.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { temperature: o.temperature != null ? o.temperature : 0.85, maxOutputTokens: Math.max(2048, maxT * 3) }
      };
      if (o.json) body.generationConfig.responseMimeType = 'application/json';
      const data = await fetchJSON(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
      const cand = data.candidates && data.candidates[0];
      const out = cand && cand.content && cand.content.parts ? cand.content.parts.filter(p => !p.thought).map(p => p.text || '').join('') : '';
      if (!out) throw AIError('empty', 'réponse vide', (data.promptFeedback && data.promptFeedback.blockReason) ? "Gemini a bloqué ce message par prudence. Essaie de reformuler." : "L'IA a renvoyé une réponse vide. Réessaie.");
      return out;
    }
    if (P.type === 'anthropic') {
      const body = { model, max_tokens: maxT, system, messages: msgs, temperature: o.temperature != null ? Math.min(1, o.temperature) : 0.85 };
      const data = await fetchJSON('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify(body)
      });
      const out = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      if (!out) throw AIError('empty', 'réponse vide', "L'IA a renvoyé une réponse vide. Réessaie.");
      return out;
    }
    throw AIError('provider', 'fournisseur inconnu', 'Fournisseur inconnu.');
  }

  async function listModels(pid, key) {
    const P = PROVIDERS[pid];
    if (P.type === 'openai') {
      const d = await fetchJSON(P.models, { headers: { Authorization: 'Bearer ' + key } }, 20000);
      return (d.data || []).map(m => m.id).filter(id => !/embed|whisper|tts|moderation|guard|ocr|transcri|audio|playai|orpheus/i.test(id)).sort();
    }
    if (P.type === 'gemini') {
      const d = await fetchJSON('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } }, 20000);
      return (d.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace(/^models\//, '')).filter(id => /gemini|gemma/.test(id) && !/image|tts|embed|live|audio/.test(id)).sort();
    }
    if (P.type === 'anthropic') {
      const d = await fetchJSON('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } }, 20000);
      return (d.data || []).map(m => m.id);
    }
    return [];
  }

  // =====================================================================
  // Mémoire : résumé de chaque journée + fiche « ce qu'il sait de toi »
  // =====================================================================
  let summarizing = false;
  async function summarizeDay(day) {
    if (!day.messages.length || !hasKey()) return false;
    const n = S.profile.userName, pote = S.profile.poteName;
    let transcript = day.messages.map(m => (m.r === 'u' ? n : pote) + ' : ' + m.text).join('\n');
    if (transcript.length > 14000) transcript = '…\n' + transcript.slice(-14000);
    const sys = `Tu aides à tenir le journal intime de ${n}, à partir de ses conversations avec ${pote}, son ami virtuel.
Réponds uniquement avec un objet JSON, sans texte autour :
{"resume": "…", "humeur": "…", "emoji": "…", "fiche": "…"}
- "resume" : le résumé de la journée, écrit à la première personne comme une page de journal intime de ${n} (« Aujourd'hui, j'ai… »). 2 à 5 phrases, concrètes : ce qui s'est passé, les personnes citées, ce que ${n} a ressenti. N'invente rien.
- "humeur" : un ou deux mots sur l'humeur générale de ${n} ce jour-là (ex. : sereine, fatigué, joyeux, contrariée, mitigée…).
- "emoji" : un seul émoji qui résume cette humeur.
- "fiche" : la fiche mise à jour de ce que ${pote} sait de ${n}. Reprends la fiche actuelle, garde ce qui est toujours vrai, corrige ce qui a changé, ajoute les nouveaux éléments durables (proches et leurs prénoms, travail, projets en cours, goûts, habitudes, événements à venir avec leur date, sujets sensibles à garder en tête). Une information par ligne, chaque ligne commence par « - ». 30 lignes maximum, courtes. Pas d'informations passagères sans intérêt pour la suite.`;
    const user = `Fiche actuelle :\n${S.fiche.trim() || '(vide)'}\n\nConversation du ${fmtDay(day.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} :\n${transcript}`;
    const raw = await callAI(sys, [{ role: 'user', content: user }], { json: true, maxTokens: 1600, temperature: 0.4 });
    let o = null;
    try { const t = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''); o = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch (e) { o = null; }
    if (!o || !o.resume) return false;
    day.summary = String(o.resume).trim();
    day.mood = String(o.humeur || '').trim();
    day.moodEmoji = String(o.emoji || '').trim().slice(0, 4);
    day.sumLen = day.messages.length;
    await saveDay(day);
    if (o.fiche && String(o.fiche).trim().length > 5) {
      S.fiche = Array.isArray(o.fiche) ? o.fiche.map(l => '- ' + String(l).replace(/^-\s*/, '')).join('\n') : String(o.fiche).trim();
      await saveFiche();
    }
    return true;
  }

  async function summarizePending() {
    if (summarizing || !hasKey()) return;
    summarizing = true;
    try {
      const todo = sortedDays().filter(k => k < dayKey() && S.days[k].messages.length > (S.days[k].sumLen || 0));
      for (const k of todo) {
        try { await summarizeDay(S.days[k]); } catch (e) { console.warn('Résumé impossible', k, e); break; }
        await sleep(800);
      }
    } finally { summarizing = false; }
  }

  // =====================================================================
  // Voix : dictée et lecture à voix haute
  // =====================================================================
  const voice = {
    listening: false, speaking: false, handsFree: false, rec: null, base: '',
    SR: window.SpeechRecognition || window.webkitSpeechRecognition,
    voices: [],
    loadVoices() {
      if (!('speechSynthesis' in window)) return;
      const all = speechSynthesis.getVoices();
      this.voices = all.filter(v => /^fr/i.test(v.lang));
    },
    pickVoice() {
      this.loadVoices();
      return this.voices.find(v => v.voiceURI === S.settings.voiceURI) || this.voices.find(v => /fr[-_]FR/i.test(v.lang)) || this.voices[0] || null;
    },
    clean(t) { return t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim(); },
    speak(text) {
      return new Promise(res => {
        if (!('speechSynthesis' in window)) return res();
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(this.clean(text));
        const v = this.pickVoice(); if (v) u.voice = v;
        u.lang = (v && v.lang) || 'fr-FR'; u.rate = S.settings.rate || 1; u.pitch = S.settings.pitch || 1;
        let done = false; const end = () => { if (done) return; done = true; this.speaking = false; res(); };
        u.onstart = () => { this.speaking = true; };
        u.onend = end; u.onerror = end;
        this.speaking = true;
        speechSynthesis.speak(u);
        setTimeout(() => { if (!speechSynthesis.speaking && !speechSynthesis.pending) end(); }, 1500 + text.length * 120);
      });
    },
    stopSpeaking() { if ('speechSynthesis' in window) speechSynthesis.cancel(); this.speaking = false; },
    listen() {
      if (!this.SR) { toast("La dictée n'est pas disponible sur ce navigateur. Utilise Chrome."); this.setHandsFree(false); return; }
      if (this.listening) { this.rec && this.rec.stop(); return; }
      this.stopSpeaking();
      const rec = new this.SR(); this.rec = rec;
      rec.lang = 'fr-FR'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
      const inp = $('#input');
      this.base = inp.value ? inp.value.replace(/\s*$/, ' ') : '';
      let finalTxt = '';
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalTxt += r[0].transcript; else interim += r[0].transcript;
        }
        inp.value = this.base + finalTxt + interim; autoGrow();
      };
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { toast('Autorise le micro pour Pixpote dans Chrome.'); this.setHandsFree(false); }
        else if (e.error === 'no-speech' && this.handsFree) { /* on relancera */ }
      };
      rec.onend = () => {
        this.listening = false; $('#btnMic').classList.remove('rec');
        const txt = inp.value.trim();
        if (this.handsFree) {
          if (finalTxt.trim()) sendMessage();
          else if (this.handsFree) setTimeout(() => { if (this.handsFree && !busy && !this.listening) this.listen(); }, 400);
        } else if (S.settings.autoSend && finalTxt.trim() && txt) sendMessage();
      };
      try { rec.start(); this.listening = true; $('#btnMic').classList.add('rec'); }
      catch (e) { this.listening = false; }
    },
    setHandsFree(on) {
      this.handsFree = on;
      $('#btnHands').classList.toggle('on', on);
      if (on) { toast('Mode conversation à la voix : parle, il te répond à voix haute.'); if (!this.listening) this.listen(); }
      else { if (this.rec && this.listening) this.rec.stop(); }
      updateTtsBtn();
    }
  };
  if ('speechSynthesis' in window) { voice.loadVoices(); speechSynthesis.onvoiceschanged = () => voice.loadVoices(); }

  function updateTtsBtn() {
    const on = S.settings.tts || voice.handsFree;
    const b = $('#btnTts'); b.textContent = on ? '🔊' : '🔈'; b.classList.toggle('on', on);
  }

  // =====================================================================
  // Zone de saisie
  // =====================================================================
  function autoGrow() { const i = $('#input'); i.style.height = 'auto'; i.style.height = Math.min(130, i.scrollHeight + 4) + 'px'; }

  // =====================================================================
  // Panneaux (plein écran) et feuilles du bas
  // =====================================================================
  function openOverlay(html) { const o = $('#overlay'); o.innerHTML = '<div class="panel">' + html + '</div>'; o.hidden = false; o.scrollTop = 0; return o; }
  function closeOverlay() { const o = $('#overlay'); o.hidden = true; o.innerHTML = ''; }
  function openSheet(html) { const s = $('#sheet'); s.innerHTML = html; s.hidden = false; $('#sheetBack').hidden = false; return s; }
  function closeSheet() { $('#sheet').hidden = true; $('#sheetBack').hidden = true; $('#sheet').innerHTML = ''; }

  // ---------- Miroir (personnalisation) ----------
  function mirrorHTML() {
    return `<div class="mirror-preview"><canvas id="mirCv" width="96" height="72"></canvas></div>
      <div class="row" style="justify-content:center;margin-bottom:6px"><button class="btn small" id="mirRand">🎲 Au hasard</button></div>
      <div id="mirOpts"></div>`;
  }
  function mountMirror(root, look, decorId) {
    const cv = $('#mirCv', root), ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const a = new Perso.Animator(); a.setEmotion('content');
    const emos = ['content', 'ecoute', 'clin', 'fier', 'surpris', 'rire'];
    let k = 0;
    const timer = setInterval(() => {
      if (!document.body.contains(cv)) return clearInterval(timer);
      a.tick(); if (a.t % 30 === 0) a.setEmotion(emos[(k++) % emos.length]);
      drawScene(ctx, decorId, look, a.state());
    }, 100);
    const optsEl = $('#mirOpts', root);
    function renderOpts() {
      optsEl.innerHTML = Perso.FIELDS.map(f => {
        const cur = f.list.find(o => o.id === look[f.key]) || f.list[0];
        return `<div class="opt" data-k="${f.key}"><span class="lbl">${esc(f.nom)}</span>
          <button class="arrow" data-d="-1" aria-label="Précédent">◀</button>
          <span class="val">${f.swatch ? `<i class="sw" style="background:${cur.c}"></i>` : ''}${esc(cur.nom)}</span>
          <button class="arrow" data-d="1" aria-label="Suivant">▶</button></div>`;
      }).join('');
      $$('.arrow', optsEl).forEach(b => b.onclick = () => {
        const key = b.closest('.opt').dataset.k, f = Perso.FIELDS.find(x => x.key === key);
        let i = f.list.findIndex(o => o.id === look[key]); if (i < 0) i = 0;
        i = (i + Number(b.dataset.d) + f.list.length) % f.list.length;
        look[key] = f.list[i].id; a.setEmotion('content', 12); renderOpts();
      });
    }
    renderOpts();
    $('#mirRand', root).onclick = () => { Object.assign(look, Perso.randomLook()); a.setEmotion('surpris', 12); renderOpts(); };
  }

  // ---------- Onboarding ----------
  function stepsBar(i, n) { let s = '<div class="steps">'; for (let k = 0; k < n; k++) s += `<i class="${k <= i ? 'on' : ''}"></i>`; return s + '</div>'; }

  function onboarding() {
    const draft = { userName: '', poteName: '', look: Object.assign({}, Perso.DEFAULT_LOOK), persona: 'doux' };
    const decorId = 'chambre';
    const N = 6;

    function welcome() {
      const o = openOverlay(`<div class="hero">
        <canvas id="heroCv" width="96" height="72"></canvas>
        <h1>Pixpote</h1>
        <p class="muted">Un petit pote en pixels qui t'écoute,<br>te répond et se souvient de tes journées.</p>
        <div class="stack" style="margin-top:26px">
          <button class="btn primary block" id="go">Créer mon pote</button>
          <button class="btn block" id="imp">J'ai une sauvegarde</button>
        </div></div>`);
      const cv = $('#heroCv', o), ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      const a = new Perso.Animator(); a.setEmotion('content');
      const look = Perso.randomLook();
      const t = setInterval(() => { if (!document.body.contains(cv)) return clearInterval(t); a.tick(); drawScene(ctx, 'parc', look, a.state()); }, 100);
      $('#go', o).onclick = stepName;
      $('#imp', o).onclick = () => importData(true);
    }
    function stepName() {
      const o = openOverlay(`${stepsBar(0, N)}<div class="panel-head"><h2>Faisons connaissance</h2></div>
        <div class="field"><label for="un">Comment tu t'appelles ?</label><input type="text" id="un" maxlength="30" autocomplete="given-name" value="${esc(draft.userName)}" placeholder="Ton prénom"></div>
        <p class="muted">C'est comme ça que ton pote t'appellera.</p>
        <button class="btn primary block" id="nx">Suivant</button>`);
      const i = $('#un', o); setTimeout(() => i.focus(), 50);
      const next = () => { const v = i.value.trim(); if (!v) return toast('Dis-moi ton prénom 🙂'); draft.userName = v; stepLook(); };
      $('#nx', o).onclick = next; i.onkeydown = e => { if (e.key === 'Enter') next(); };
    }
    function stepLook() {
      const o = openOverlay(`${stepsBar(1, N)}<div class="panel-head"><h2>À quoi il ressemble ?</h2></div>${mirrorHTML()}
        <p class="muted">Tu pourras tout changer plus tard dans le miroir (⚙️ Réglages).</p>
        <div class="row"><button class="btn" id="bk">Retour</button><button class="btn primary" style="flex:1" id="nx">Suivant</button></div>`);
      mountMirror(o, draft.look, decorId);
      $('#bk', o).onclick = stepName; $('#nx', o).onclick = stepPoteName;
    }
    function stepPoteName() {
      const sugg = ['Bitou', 'Pixel', 'Léon', 'Lou', 'Gaby', 'Nino', 'Mimi', 'Sacha', 'Pépin', 'Zéphyr'];
      const o = openOverlay(`${stepsBar(2, N)}<div class="panel-head"><h2>Son prénom</h2></div>
        <div class="mirror-preview"><canvas id="pv" width="96" height="72"></canvas></div>
        <div class="field"><label for="pn">Comment s'appelle ton pote ?</label><input type="text" id="pn" maxlength="24" value="${esc(draft.poteName)}" placeholder="Son prénom"></div>
        <div class="suggest">${sugg.map(s => `<button>${s}</button>`).join('')}</div>
        <div class="row" style="margin-top:18px"><button class="btn" id="bk">Retour</button><button class="btn primary" style="flex:1" id="nx">Suivant</button></div>`);
      const cv = $('#pv', o), ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      const a = new Perso.Animator(); a.setEmotion('curieux');
      const t = setInterval(() => { if (!document.body.contains(cv)) return clearInterval(t); a.tick(); drawScene(ctx, decorId, draft.look, a.state()); }, 100);
      const i = $('#pn', o);
      $$('.suggest button', o).forEach(b => b.onclick = () => { i.value = b.textContent; a.setEmotion('content', 15); });
      i.oninput = () => a.setEmotion('ecoute', 8);
      const next = () => { const v = i.value.trim(); if (!v) return toast('Donne-lui un prénom 🙂'); draft.poteName = v; stepPersona(); };
      $('#bk', o).onclick = stepLook; $('#nx', o).onclick = next;
    }
    function stepPersona() {
      const o = openOverlay(`${stepsBar(3, N)}<div class="panel-head"><h2>Son caractère</h2></div>
        <p class="muted">Tu pourras en changer chaque jour en touchant son nom en haut de l'écran.</p>
        <div class="stack" id="pl">${personaList(draft.persona)}</div>
        <div class="row" style="margin-top:18px"><button class="btn" id="bk">Retour</button><button class="btn primary" style="flex:1" id="nx">Suivant</button></div>`);
      $$('.persona', o).forEach(b => b.onclick = () => { draft.persona = b.dataset.id; $('#pl', o).innerHTML = personaList(draft.persona); stepPersonaRebind(o); });
      stepPersonaRebind(o);
      $('#bk', o).onclick = stepPoteName; $('#nx', o).onclick = stepBrain;
    }
    function stepPersonaRebind(o) { $$('.persona', o).forEach(b => b.onclick = () => { draft.persona = b.dataset.id; $('#pl', o).innerHTML = personaList(draft.persona); stepPersonaRebind(o); }); }
    function stepBrain() {
      const o = openOverlay(`${stepsBar(4, N)}<div class="panel-head"><h2>Son cerveau</h2></div>
        <p>Pour te répondre, ${esc(draft.poteName)} a besoin d'une intelligence artificielle. Choisis-en une et colle ta clé.</p>
        <div id="brain"></div>
        <div class="row" style="margin-top:18px"><button class="btn" id="bk">Retour</button><button class="btn primary" style="flex:1" id="nx">Terminer</button></div>
        <p class="muted" style="text-align:center">Tu peux aussi le faire plus tard dans ⚙️ Réglages.</p>`);
      mountBrain($('#brain', o));
      $('#bk', o).onclick = stepPersona;
      $('#nx', o).onclick = finish;
    }
    async function finish() {
      S.profile = { userName: draft.userName, poteName: draft.poteName, look: draft.look, persona: draft.persona, lastPersona: draft.persona, createdAt: Date.now() };
      await saveProfile(); await saveSettings();
      closeOverlay();
      await startApp(true);
    }
    welcome();
  }

  function personaList(sel) {
    return Object.entries(PERSONAS).map(([id, p]) => `<button class="persona ${id === sel ? 'sel' : ''}" data-id="${id}"><span class="em">${p.emoji}</span><span><b>${p.nom}</b><small>${esc(p.desc)}</small></span></button>`).join('');
  }

  // ---------- Bloc « Cerveau » (choix de l'IA + clé) ----------
  function mountBrain(el) {
    const st = S.settings;
    function render() {
      const pid = st.provider, P = PROVIDERS[pid];
      el.innerHTML = `
        <div class="field"><label for="prov">Intelligence artificielle</label>
          <select id="prov">${Object.entries(PROVIDERS).map(([id, p]) => `<option value="${id}" ${id === pid ? 'selected' : ''}>${p.nom} — ${p.free}</option>`).join('')}</select></div>
        <div class="help">${HELP[pid]}</div>
        <div class="field"><label for="key">Clé API ${esc(P.nom)}</label>
          <input type="password" id="key" autocomplete="off" spellcheck="false" value="${esc(st.keys[pid] || '')}" placeholder="Colle ta clé ici"></div>
        <p class="muted">🔒 La clé reste uniquement sur ce téléphone.</p>
        <div class="field"><label for="model">Modèle</label>
          <div class="row"><input type="text" id="model" style="flex:1" value="${esc(st.models[pid] || P.def)}" spellcheck="false">
          <button class="btn small" id="lm">Liste</button></div>
          <select id="msel" hidden></select></div>
        <div class="row"><button class="btn primary" id="test">Tester</button><button class="btn small" id="showk">👁 Voir la clé</button></div>
        <div class="status" id="stt"></div>`;
      $('#prov', el).onchange = e => { st.provider = e.target.value; saveSettings(); render(); };
      $('#key', el).oninput = e => { st.keys[pid] = e.target.value.trim(); saveSettings(); };
      $('#model', el).oninput = e => { st.models[pid] = e.target.value.trim(); saveSettings(); };
      $('#showk', el).onclick = () => { const k = $('#key', el); k.type = k.type === 'password' ? 'text' : 'password'; };
      $('#lm', el).onclick = async () => {
        const stt = $('#stt', el); stt.className = 'status'; stt.textContent = 'Chargement des modèles…';
        try {
          const list = await listModels(pid, (st.keys[pid] || '').trim());
          const sel = $('#msel', el);
          sel.innerHTML = '<option value="">— choisir un modèle —</option>' + list.map(m => `<option ${m === st.models[pid] ? 'selected' : ''}>${esc(m)}</option>`).join('');
          sel.hidden = false; stt.textContent = list.length + ' modèles disponibles.';
          sel.onchange = () => { if (sel.value) { st.models[pid] = sel.value; $('#model', el).value = sel.value; saveSettings(); } };
        } catch (e) { stt.className = 'status err'; stt.textContent = e.userMessage || e.message; }
      };
      $('#test', el).onclick = async () => {
        const stt = $('#stt', el); stt.className = 'status'; stt.textContent = 'Test en cours…';
        try {
          const raw = await callAI('Réponds uniquement avec ce JSON : {"reponse": "Coucou !", "emotion": "content"}', [{ role: 'user', content: 'Test de connexion' }], { json: true, maxTokens: 300 });
          const r = parseReply(raw);
          stt.className = 'status ok'; stt.textContent = '✅ Ça marche ! Réponse reçue : « ' + r.text.slice(0, 60) + ' »';
        } catch (e) { stt.className = 'status err'; stt.textContent = '❌ ' + (e.userMessage || e.message); }
      };
    }
    render();
  }

  // ---------- Caractère du jour ----------
  function openPersonaSheet() {
    const s = openSheet(`<h3>Le caractère de ${esc(S.profile.poteName)} aujourd'hui</h3><div class="stack" id="pl">${personaList(S.today.persona)}</div>`);
    $$('.persona', s).forEach(b => b.onclick = async () => {
      S.today.persona = b.dataset.id; S.profile.lastPersona = b.dataset.id;
      await saveDay(S.today); await saveProfile();
      anim.baseEmotion = persona().base; anim.setEmotion(PERSONAS[b.dataset.id].base === 'neutre' ? 'clin' : 'content', 20);
      updateHeader(); closeSheet();
      toast(PERSONAS[b.dataset.id].emoji + ' ' + S.profile.poteName + ' est ' + PERSONAS[b.dataset.id].nom.toLowerCase() + " aujourd'hui");
    });
  }

  // ---------- Décor ----------
  function openDecorSheet() {
    const s = openSheet(`<h3>Choisir le décor</h3><div class="decor-grid">${Decors.LIST.map(d => `<button data-id="${d.id}" class="${d.id === S.today.decor ? 'sel' : ''}"><canvas width="96" height="72"></canvas><span>${d.emoji} ${esc(d.nom)}</span></button>`).join('')}</div>
      <p class="muted">Un nouveau décor est tiré au hasard chaque matin.</p>`);
    $$('.decor-grid button', s).forEach(b => {
      const c = $('canvas', b).getContext('2d'); c.imageSmoothingEnabled = false; Decors.drawBack(c, b.dataset.id, 0);
      b.onclick = async () => { S.today.decor = b.dataset.id; await saveDay(S.today); anim.setEmotion('enthousiaste', 20); closeSheet(); };
    });
  }

  // ---------- Journal ----------
  function openJournal() {
    const keys = sortedDays().filter(k => S.days[k].messages.length).reverse();
    const strip = sortedDays().filter(k => S.days[k].messages.length).slice(-21).map(k => {
      const d = S.days[k]; return `<div title="${esc(d.mood)}"><b>${esc(d.moodEmoji || '·')}</b>${keyToDate(k).getDate()}/${keyToDate(k).getMonth() + 1}</div>`;
    }).join('');
    const o = openOverlay(`<div class="panel-head"><button class="icon" id="cl">←</button><h2>Mon journal</h2></div>
      ${keys.length ? `<div class="card" style="margin-bottom:14px"><div class="muted" style="margin-bottom:6px">Mon humeur ces derniers jours</div><div class="moodstrip">${strip}</div></div>` : ''}
      <div id="jl">${keys.length ? '' : '<p class="muted">Ton journal est encore vide. Raconte ta journée à ' + esc(S.profile.poteName) + ' et elle apparaîtra ici.</p>'}</div>`);
    $('#cl', o).onclick = closeOverlay;
    const jl = $('#jl', o);
    keys.forEach(k => {
      const d = S.days[k], isToday = k === S.today.date;
      const card = document.createElement('div'); card.className = 'card daycard';
      const per = PERSONAS[d.persona] || PERSONAS.doux, dec = Decors.LIST.find(x => x.id === d.decor);
      const stale = d.messages.length > (d.sumLen || 0);
      card.innerHTML = `<div class="d"><b>${esc(cap(fmtDay(k)))}${isToday ? " · aujourd'hui" : ''}</b><span>${esc(d.moodEmoji || '')} ${esc(d.mood || '')}</span></div>
        <div class="muted">${per.emoji} ${per.nom}${dec ? ' · ' + dec.emoji + ' ' + esc(dec.nom) : ''} · ${d.messages.length} messages</div>
        <div class="summary">${d.summary ? esc(d.summary) : '<span class="muted">Pas encore résumé.</span>'}</div>
        <div class="row">${(stale || !d.summary) ? `<button class="btn small" data-a="sum">✍️ ${d.summary ? 'Mettre à jour le résumé' : 'Résumer maintenant'}</button>` : ''}
        <button class="btn small" data-a="tr">💬 Voir la conversation</button></div>
        <div class="transcript" hidden></div>`;
      $('[data-a=tr]', card).onclick = () => {
        const tr = $('.transcript', card);
        if (tr.hidden) tr.innerHTML = d.messages.map(m => `<div class="${m.r}"><b>${esc(m.r === 'u' ? S.profile.userName : S.profile.poteName)} :</b> ${esc(m.text)}</div>`).join('');
        tr.hidden = !tr.hidden;
      };
      const sb = $('[data-a=sum]', card);
      if (sb) sb.onclick = async () => {
        if (!hasKey()) return toast("Il faut d'abord connecter une IA (⚙️ Réglages).");
        sb.disabled = true; sb.textContent = '✍️ Résumé en cours…';
        try { const ok = await summarizeDay(d); if (!ok) throw new Error('réponse illisible'); openJournal(); toast('Page du journal écrite ✍️'); }
        catch (e) { sb.disabled = false; sb.textContent = '✍️ Réessayer'; toast(e.userMessage || ('Résumé impossible : ' + e.message), 4000); }
      };
      jl.appendChild(card);
    });
  }

  // ---------- Réglages ----------
  function openSettings() {
    const p = S.profile, st = S.settings;
    const o = openOverlay(`<div class="panel-head"><button class="icon" id="cl">←</button><h2>Réglages</h2></div>

      <h3>🪞 ${esc(p.poteName)}</h3>
      <div class="field"><label for="pn">Son prénom</label><input type="text" id="pn" maxlength="24" value="${esc(p.poteName)}"></div>
      <button class="btn block" id="mir">🪞 Le miroir : changer son apparence</button>

      <h3>🙂 Toi</h3>
      <div class="field"><label for="un">Ton prénom</label><input type="text" id="un" maxlength="30" value="${esc(p.userName)}"></div>

      <h3>🧠 Cerveau</h3>
      <div id="brain"></div>

      <h3>🗣️ Voix</h3>
      <label class="toggle"><span>Lire ses réponses à voix haute</span><input type="checkbox" id="tts" ${st.tts ? 'checked' : ''}></label>
      <label class="toggle"><span>Envoyer automatiquement après une dictée</span><input type="checkbox" id="as" ${st.autoSend ? 'checked' : ''}></label>
      <div class="field"><label for="vs">Sa voix</label><select id="vs"></select></div>
      <div class="field"><label for="rt">Vitesse <span id="rtv"></span></label><input type="range" id="rt" min="0.7" max="1.4" step="0.05" value="${st.rate}"></div>
      <div class="field"><label for="pt">Hauteur <span id="ptv"></span></label><input type="range" id="pt" min="0.6" max="1.6" step="0.05" value="${st.pitch}"></div>
      <button class="btn small" id="tv">▶️ Écouter</button>
      <p class="muted">Astuce : le bouton 🎧 sur la scène lance une conversation entièrement à la voix.</p>

      <h3>📝 Ce que ${esc(p.poteName)} sait de toi</h3>
      <p class="muted">Cette fiche est mise à jour automatiquement à la fin de chaque journée. Tu peux la corriger ou la compléter.</p>
      <div class="field"><textarea id="fiche" placeholder="- Exemple : j'ai deux enfants, Lina et Tom">${esc(S.fiche)}</textarea></div>
      <button class="btn small" id="sf">💾 Enregistrer la fiche</button>

      <h3>💾 Sauvegarde</h3>
      <p class="muted">Tout est stocké sur ce téléphone. Fais une sauvegarde de temps en temps pour ne rien perdre (changement de téléphone, nettoyage du navigateur…).</p>
      <label class="toggle"><span>Inclure mes clés API dans la sauvegarde</span><input type="checkbox" id="ik"></label>
      <div class="row"><button class="btn" id="exp">⬇️ Exporter</button><button class="btn" id="imp">⬆️ Importer</button></div>

      <h3>⚠️ Zone sensible</h3>
      <button class="btn danger" id="wipe">Tout effacer</button>
      <p class="muted" style="margin-top:24px;text-align:center">Pixpote v${VERSION}</p>`);

    $('#cl', o).onclick = () => { closeOverlay(); updateHeader(); };
    $('#pn', o).onchange = e => { const v = e.target.value.trim(); if (v) { p.poteName = v; saveProfile(); updateHeader(); } };
    $('#un', o).onchange = e => { const v = e.target.value.trim(); if (v) { p.userName = v; saveProfile(); } };
    $('#mir', o).onclick = openMirror;
    mountBrain($('#brain', o));
    $('#tts', o).onchange = e => { st.tts = e.target.checked; saveSettings(); updateTtsBtn(); };
    $('#as', o).onchange = e => { st.autoSend = e.target.checked; saveSettings(); };
    const vs = $('#vs', o);
    const fillVoices = () => {
      voice.loadVoices();
      vs.innerHTML = voice.voices.length ? voice.voices.map(v => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === st.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('') : '<option value="">Voix par défaut</option>';
    };
    fillVoices(); setTimeout(fillVoices, 600);
    vs.onchange = () => { st.voiceURI = vs.value; saveSettings(); };
    const rt = $('#rt', o), pt = $('#pt', o);
    const lab = () => { $('#rtv', o).textContent = '(' + Number(st.rate).toFixed(2) + ')'; $('#ptv', o).textContent = '(' + Number(st.pitch).toFixed(2) + ')'; };
    lab();
    rt.oninput = () => { st.rate = Number(rt.value); lab(); saveSettings(); };
    pt.oninput = () => { st.pitch = Number(pt.value); lab(); saveSettings(); };
    $('#tv', o).onclick = () => voice.speak(`Salut ${p.userName} ! C'est moi, ${p.poteName}. Tu m'entends bien ?`);
    $('#sf', o).onclick = async () => { S.fiche = $('#fiche', o).value; await saveFiche(); toast('Fiche enregistrée 📝'); };
    $('#exp', o).onclick = () => exportData($('#ik', o).checked);
    $('#imp', o).onclick = () => importData(false);
    $('#wipe', o).onclick = async () => {
      if (!confirm('Effacer définitivement ton pote, ton journal et tous les réglages ?')) return;
      if (!confirm('Vraiment tout ? Pense à exporter une sauvegarde avant.')) return;
      await DB.clearAll(); location.reload();
    };
  }

  function openMirror() {
    const look = Object.assign({}, Perso.DEFAULT_LOOK, S.profile.look);
    const o = openOverlay(`<div class="panel-head"><button class="icon" id="cl">←</button><h2>Le miroir</h2></div>${mirrorHTML()}
      <div class="row" style="margin-top:14px"><button class="btn" id="cancel">Annuler</button><button class="btn primary" style="flex:1" id="ok">Enregistrer</button></div>`);
    mountMirror(o, look, S.today.decor);
    $('#cl', o).onclick = openSettings; $('#cancel', o).onclick = openSettings;
    $('#ok', o).onclick = async () => { S.profile.look = look; await saveProfile(); toast('Nouveau look enregistré ✨'); closeOverlay(); anim.setEmotion('fier', 30); };
  }

  // ---------- Export / import ----------
  async function exportData(withKeys) {
    const settings = clone(S.settings);
    if (!withKeys) settings.keys = { mistral: '', gemini: '', groq: '', claude: '' };
    const data = { app: 'pixpote', version: VERSION, exportedAt: new Date().toISOString(), profile: S.profile, settings, fiche: S.fiche, days: sortedDays().map(k => S.days[k]) };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'pixpote-sauvegarde-' + dayKey() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Sauvegarde téléchargée ⬇️');
  }
  function importData(fromWelcome) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (data.app !== 'pixpote' || !data.profile) throw new Error("ce fichier n'est pas une sauvegarde Pixpote");
        if (!fromWelcome && !confirm('Remplacer toutes les données actuelles par cette sauvegarde ?')) return;
        await DB.clearAll();
        const settings = Object.assign(clone(DEFAULT_SETTINGS), data.settings || {});
        // on garde les clés actuelles si la sauvegarde n'en contient pas
        Object.keys(settings.keys || {}).forEach(k => { if (!settings.keys[k] && S.settings.keys[k]) settings.keys[k] = S.settings.keys[k]; });
        await DB.set('profile', data.profile); await DB.set('settings', settings); await DB.set('fiche', data.fiche || '');
        for (const d of (data.days || [])) await DB.putDay(d);
        toast('Sauvegarde restaurée ✅'); await sleep(700); location.reload();
      } catch (e) { toast('Import impossible : ' + e.message, 4000); }
    };
    inp.click();
  }

  // =====================================================================
  // Démarrage
  // =====================================================================
  function updateHeader() {
    $('#poteName').textContent = S.profile.poteName;
    const p = persona(); $('#personaChip').textContent = p.emoji + ' ' + p.nom;
    updateTtsBtn();
  }

  let started = false;
  async function startApp(first) {
    await ensureToday();
    $('#app').hidden = false;
    updateHeader(); renderChat();
    if (!started) {
      started = true;
      startScene();
      $('#btnSend').onclick = () => sendMessage();
      const inp = $('#input');
      inp.oninput = () => { autoGrow(); typingUntil = Date.now() + 1500; };
      inp.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer:fine)').matches) { e.preventDefault(); sendMessage(); } };
      $('#btnMic').onclick = () => voice.listen();
      $('#btnTts').onclick = () => { S.settings.tts = !S.settings.tts; saveSettings(); updateTtsBtn(); if (!S.settings.tts) voice.stopSpeaking(); toast(S.settings.tts ? '🔊 Il te répond à voix haute' : '🔈 Lecture à voix haute coupée'); };
      $('#btnJournal').onclick = openJournal;
      $('#btnSettings').onclick = openSettings;
      $('#btnPersona').onclick = openPersonaSheet;
      $('#btnDecor').onclick = openDecorSheet;
      $('#btnHands').onclick = () => voice.setHandsFree(!voice.handsFree);
      $('#sheetBack').onclick = closeSheet;
      // changement de jour pendant que l'appli est ouverte
      setInterval(checkDayChange, 60000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDayChange(); });
    }
    anim.baseEmotion = persona().base;
    await greetIfNeeded();
  }

  // Au premier lancement de la journée : on écrit d'abord les pages du journal en retard,
  // pour que le pote se souvienne de la veille, puis il dit bonjour.
  async function greetIfNeeded() {
    const pending = hasKey() && sortedDays().some(k => k < dayKey() && S.days[k].messages.length > (S.days[k].sumLen || 0));
    if (pending && !S.today.messages.length) {
      anim.thinking = true; showTyping(true);
      try { await Promise.race([summarizePending(), sleep(25000)]); } catch (e) { }
      anim.thinking = false; showTyping(false);
    } else summarizePending();
    if (!S.today.messages.length) { anim.setEmotion('content', 30); await respond(true); }
  }

  async function checkDayChange() {
    if (!S.today || S.today.date === dayKey() || busy) return;
    await ensureToday();
    anim.baseEmotion = persona().base;
    updateHeader(); renderChat();
    await greetIfNeeded();
  }

  async function init() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
    await loadAll();
    if (!S.profile) onboarding();
    else await startApp(false);
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  }

  // Petit accès pour les tests
  window.__pixpote = { S, callAI, parseReply, normEmo, dayKey, buildSystem: () => buildSystem(), summarizeDay, anim };

  init().catch(e => { console.error(e); document.body.innerHTML = '<p style="padding:20px">Erreur au démarrage : ' + esc(e.message) + '</p>'; });
})();
