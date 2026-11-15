/* Pixpote — moteur du personnage en pixel art
   Le personnage est dessiné pixel par pixel dans une grille de 40 x 42.
   Tout est généré par le code : pas d'image à charger. */
(function () {
  'use strict';

  const FW = 40, FH = 42, OX = 4, OY = 2;
  const OUTLINE = '#2a1f2d';
  const DARK = '#1d1626';

  // ---------- Couleurs ----------
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
  const shade = (c, t = 0.25) => mix(c, '#1a1020', t);
  const light = (c, t = 0.3) => mix(c, '#ffffff', t);

  // ---------- Options de personnalisation ----------
  const SKINS = [
    { id: 'porcelaine', nom: 'Porcelaine', c: '#ffe2cc' },
    { id: 'claire', nom: 'Claire', c: '#f7cba6' },
    { id: 'doree', nom: 'Dorée', c: '#e9b48b' },
    { id: 'halee', nom: 'Hâlée', c: '#cf9468' },
    { id: 'mate', nom: 'Mate', c: '#a56c45' },
    { id: 'ebene', nom: 'Ébène', c: '#6e452e' }
  ];
  const HAIR_COLORS = [
    { id: 'noir', nom: 'Noir', c: '#2b2331' },
    { id: 'brun', nom: 'Brun', c: '#4d3024' },
    { id: 'chatain', nom: 'Châtain', c: '#7b4c2e' },
    { id: 'roux', nom: 'Roux', c: '#c25a2c' },
    { id: 'blond', nom: 'Blond', c: '#e2bb62' },
    { id: 'platine', nom: 'Platine', c: '#f0e1b2' },
    { id: 'poivre', nom: 'Poivre et sel', c: '#9c9aa3' },
    { id: 'blanc', nom: 'Blanc', c: '#e9e7ee' },
    { id: 'bleu', nom: 'Bleu', c: '#4677d0' },
    { id: 'rose', nom: 'Rose', c: '#e27cae' },
    { id: 'violet', nom: 'Violet', c: '#8758c4' },
    { id: 'vert', nom: 'Vert', c: '#47a874' }
  ];
  const EYE_COLORS = [
    { id: 'marron', nom: 'Marron', c: '#6b4226' },
    { id: 'noisette', nom: 'Noisette', c: '#9a7430' },
    { id: 'vert', nom: 'Vert', c: '#3e9150' },
    { id: 'bleu', nom: 'Bleu', c: '#3f7bd0' },
    { id: 'gris', nom: 'Gris', c: '#8090a0' },
    { id: 'noir', nom: 'Noir', c: '#2a2030' }
  ];
  const COLORS = [
    { id: 'rouge', nom: 'Rouge', c: '#d9544f' },
    { id: 'orange', nom: 'Orange', c: '#ef8a3c' },
    { id: 'moutarde', nom: 'Moutarde', c: '#e2b33c' },
    { id: 'vert', nom: 'Vert pomme', c: '#6cbf62' },
    { id: 'sapin', nom: 'Sapin', c: '#2f7a58' },
    { id: 'ciel', nom: 'Bleu ciel', c: '#62b0e3' },
    { id: 'bleu', nom: 'Bleu', c: '#3b6bd1' },
    { id: 'marine', nom: 'Marine', c: '#2c3e72' },
    { id: 'violet', nom: 'Violet', c: '#8a68d4' },
    { id: 'rose', nom: 'Rose', c: '#ea8cb7' },
    { id: 'gris', nom: 'Gris', c: '#8b909a' },
    { id: 'noir', nom: 'Noir', c: '#3b3a47' },
    { id: 'blanc', nom: 'Blanc', c: '#efedf2' },
    { id: 'beige', nom: 'Beige', c: '#d8c3a0' }
  ];
  const HAIR_STYLES = [
    { id: 'court', nom: 'Court' },
    { id: 'brosse', nom: 'En brosse' },
    { id: 'meche', nom: 'Mèche' },
    { id: 'milong', nom: 'Mi-long' },
    { id: 'long', nom: 'Long' },
    { id: 'carre', nom: 'Carré frange' },
    { id: 'queue', nom: 'Queue de cheval' },
    { id: 'chignon', nom: 'Chignon' },
    { id: 'couettes', nom: 'Couettes' },
    { id: 'boucle', nom: 'Bouclé' },
    { id: 'rase', nom: 'Rasé' },
    { id: 'chauve', nom: 'Chauve' }
  ];
  const BEARDS = [
    { id: 'aucune', nom: 'Aucune' },
    { id: 'trois', nom: 'Barbe de 3 jours' },
    { id: 'moustache', nom: 'Moustache' },
    { id: 'bouc', nom: 'Bouc' },
    { id: 'courte', nom: 'Barbe courte' },
    { id: 'longue', nom: 'Grande barbe' }
  ];
  const GLASSES = [
    { id: 'aucune', nom: 'Aucunes' },
    { id: 'rondes', nom: 'Rondes' },
    { id: 'carrees', nom: 'Carrées' },
    { id: 'soleil', nom: 'De soleil' }
  ];
  const TOPS = [
    { id: 'tshirt', nom: 'T-shirt' },
    { id: 'sweat', nom: 'Sweat à capuche' },
    { id: 'chemise', nom: 'Chemise' },
    { id: 'colroule', nom: 'Col roulé' },
    { id: 'raye', nom: 'Marinière' },
    { id: 'salopette', nom: 'Salopette' }
  ];
  const ACCESSORIES = [
    { id: 'aucun', nom: 'Aucun' },
    { id: 'bonnet', nom: 'Bonnet' },
    { id: 'casquette', nom: 'Casquette' },
    { id: 'bandeau', nom: 'Bandeau' },
    { id: 'casque', nom: 'Casque audio' },
    { id: 'fleur', nom: 'Fleur' },
    { id: 'noeud', nom: 'Nœud' },
    { id: 'boucles', nom: "Boucles d'oreilles" }
  ];

  // Champs éditables, dans l'ordre du « miroir »
  const FIELDS = [
    { key: 'skin', nom: 'Peau', list: SKINS, swatch: true },
    { key: 'hair', nom: 'Coiffure', list: HAIR_STYLES },
    { key: 'hairColor', nom: 'Cheveux', list: HAIR_COLORS, swatch: true },
    { key: 'eyes', nom: 'Yeux', list: EYE_COLORS, swatch: true },
    { key: 'beard', nom: 'Barbe', list: BEARDS },
    { key: 'glasses', nom: 'Lunettes', list: GLASSES },
    { key: 'top', nom: 'Haut', list: TOPS },
    { key: 'topColor', nom: 'Couleur du haut', list: COLORS, swatch: true },
    { key: 'acc', nom: 'Accessoire', list: ACCESSORIES },
    { key: 'accColor', nom: "Couleur de l'accessoire", list: COLORS, swatch: true }
  ];

  const DEFAULT_LOOK = {
    skin: 'claire', hair: 'court', hairColor: 'chatain', eyes: 'marron', beard: 'aucune',
    glasses: 'aucune', top: 'sweat', topColor: 'moutarde', acc: 'aucun', accColor: 'rouge'
  };

  function pick(list, id) { return (list.find(o => o.id === id) || list[0]); }
  function colorOf(list, id) { return pick(list, id).c; }

  function randomLook() {
    const r = l => l[Math.floor(Math.random() * l.length)].id;
    const look = {};
    FIELDS.forEach(f => { look[f.key] = r(f.list); });
    // un peu de bon sens : pas trop d'accessoires et de barbes partout
    if (Math.random() < 0.5) look.acc = 'aucun';
    if (Math.random() < 0.5) look.beard = 'aucune';
    if (Math.random() < 0.6) look.glasses = 'aucune';
    if (look.hairColor === 'bleu' || look.hairColor === 'rose' || look.hairColor === 'violet' || look.hairColor === 'vert') {
      if (Math.random() < 0.6) look.hairColor = r(HAIR_COLORS.slice(0, 6));
    }
    return look;
  }

  // ---------- Émotions ----------
  // eyes : open, closed, happy, wide, half, side, up, down, sparkle, wink, teary
  // brows : normal, up, sad, angry, flat, one
  // mouth : neutral, smile, bigsmile, laugh, o, smallo, sad, wavy, smirk, flat
  const EMOTIONS = {
    neutre:       { nom: 'neutre',        eyes: 'open',    brows: 'normal', mouth: 'neutral' },
    ecoute:       { nom: "à l'écoute",    eyes: 'open',    brows: 'normal', mouth: 'smile' },
    content:      { nom: 'content',       eyes: 'happy',   brows: 'normal', mouth: 'smile', blush: 1 },
    rire:         { nom: 'mort de rire',  eyes: 'happy',   brows: 'up',     mouth: 'laugh', blush: 1, bounce: true, fx: ['laugh'] },
    emu:          { nom: 'ému',           eyes: 'teary',   brows: 'sad',    mouth: 'smile', blush: 1 },
    triste:       { nom: 'triste',        eyes: 'down',    brows: 'sad',    mouth: 'sad', fx: ['tear'] },
    surpris:      { nom: 'surpris',       eyes: 'wide',    brows: 'up',     mouth: 'o', fx: ['bang'] },
    pensif:       { nom: 'pensif',        eyes: 'up',      brows: 'one',    mouth: 'flat', fx: ['dots'] },
    inquiet:      { nom: 'inquiet',       eyes: 'open',    brows: 'sad',    mouth: 'wavy', fx: ['sweat'] },
    fier:         { nom: 'fier',          eyes: 'happy',   brows: 'up',     mouth: 'bigsmile', fx: ['sparkle'] },
    gene:         { nom: 'gêné',          eyes: 'side',    brows: 'sad',    mouth: 'wavy', blush: 2, fx: ['sweat'] },
    malicieux:    { nom: 'malicieux',     eyes: 'half',    brows: 'one',    mouth: 'smirk' },
    compatissant: { nom: 'compatissant',  eyes: 'soft',    brows: 'sad',    mouth: 'smile', blush: 1 },
    fatigue:      { nom: 'fatigué',       eyes: 'half',    brows: 'flat',   mouth: 'smallo', fx: ['zzz'] },
    clin:         { nom: "clin d'œil",    eyes: 'wink',    brows: 'one',    mouth: 'bigsmile' },
    enthousiaste: { nom: 'enthousiaste',  eyes: 'sparkle', brows: 'up',     mouth: 'laugh', blush: 1, bounce: true, fx: ['sparkle'] },
    colere:       { nom: 'en colère',     eyes: 'open',    brows: 'angry',  mouth: 'sad', blush: 3, fx: ['vein'] },
    curieux:      { nom: 'curieux',       eyes: 'wide',    brows: 'one',    mouth: 'smallo', fx: ['question'] }
  };
  const EMOTION_IDS = Object.keys(EMOTIONS);

  // ---------- Tampon de dessin ----------
  function Buf() {
    this.c = new Array(FW * FH).fill(null);
    this.l = new Array(FW * FH).fill(null);
    this.dx = 0; this.dy = 0;
  }
  Buf.prototype.set = function (x, y, c, l) {
    x += OX + this.dx; y += OY + this.dy;
    if (x < 0 || y < 0 || x >= FW || y >= FH) return;
    const i = y * FW + x; this.c[i] = c; this.l[i] = l || 'x';
  };
  Buf.prototype.get = function (x, y) {
    x += OX + this.dx; y += OY + this.dy;
    if (x < 0 || y < 0 || x >= FW || y >= FH) return null;
    return this.l[y * FW + x];
  };
  Buf.prototype.del = function (x, y) {
    x += OX + this.dx; y += OY + this.dy;
    if (x < 0 || y < 0 || x >= FW || y >= FH) return;
    const i = y * FW + x; this.c[i] = null; this.l[i] = null;
  };
  Buf.prototype.row = function (y, x1, x2, c, l) { for (let x = x1; x <= x2; x++) this.set(x, y, c, l); };
  // ligne symétrique (miroir autour de l'axe central du visage)
  Buf.prototype.srow = function (y, x1, x2, c, l) { this.row(y, x1, x2, c, l); this.row(y, 31 - x2, 31 - x1, c, l); };
  Buf.prototype.spx = function (x, y, c, l) { this.set(x, y, c, l); this.set(31 - x, y, c, l); };
  Buf.prototype.rect = function (x, y, w, h, c, l) { for (let j = 0; j < h; j++) this.row(y + j, x, x + w - 1, c, l); };
  // remplit des lignes décrites par [y, x1, x2]
  Buf.prototype.spans = function (list, c, l, sym) {
    list.forEach(s => { if (sym) this.srow(s[0], s[1], s[2], c, l); else this.row(s[0], s[1], s[2], c, l); });
  };

  // ---------- Parties du corps ----------
  const HEAD = [[7, 11, 20], [8, 9, 22], [9, 8, 23], [10, 7, 24], [11, 7, 24], [12, 7, 24], [13, 7, 24], [14, 7, 24],
    [15, 7, 24], [16, 7, 24], [17, 7, 24], [18, 7, 24], [19, 7, 24], [20, 8, 23], [21, 9, 22], [22, 11, 20]];

  function drawBody(b, look, P) {
    const col = P.top, sd = shade(col, 0.22), lt = light(col, 0.18);
    const skin = P.skin, skinSd = shade(skin, 0.2);
    // cou
    b.rect(13, 22, 6, 4, skinSd, 'skin');
    // buste
    b.row(25, 10, 21, col, 'shirt');
    b.row(26, 8, 23, col, 'shirt');
    b.row(27, 7, 24, col, 'shirt');
    for (let y = 28; y <= 39; y++) b.row(y, 6, 25, col, 'shirt');
    // séparation des bras
    for (let y = 31; y <= 39; y++) { b.set(9, y, sd, 'shirt'); b.set(22, y, sd, 'shirt'); }
    // ombre sous les épaules
    b.row(39, 6, 25, sd, 'shirt');

    const t = look.top;
    if (t === 'tshirt' || t === 'raye') {
      b.row(25, 13, 18, skinSd, 'skin'); b.row(26, 14, 17, skinSd, 'skin');
      b.set(12, 25, sd, 'shirt'); b.set(19, 25, sd, 'shirt'); b.set(13, 26, sd, 'shirt'); b.set(18, 26, sd, 'shirt');
      b.row(27, 14, 17, sd, 'shirt');
      if (t === 'raye') {
        const stripe = col === '#efedf2' ? '#2c3e72' : '#f4f2ee';
        for (let y = 29; y <= 38; y += 3) b.row(y, 6, 25, stripe, 'shirt');
        b.row(28, 7, 24, col, 'shirt');
        for (let y = 31; y <= 38; y++) { b.set(9, y, shade(stripe, 0.25), 'shirt'); b.set(22, y, shade(stripe, 0.25), 'shirt'); }
        for (let y = 30; y <= 38; y += 3) { b.set(9, y, sd, 'shirt'); b.set(22, y, sd, 'shirt'); b.set(9, y + 1, sd, 'shirt'); b.set(22, y + 1, sd, 'shirt'); }
      }
    } else if (t === 'sweat') {
      // capuche derrière le cou
      b.row(23, 10, 12, sd, 'shirt'); b.row(23, 19, 21, sd, 'shirt');
      b.row(24, 9, 12, sd, 'shirt'); b.row(24, 19, 22, sd, 'shirt');
      b.row(25, 10, 12, lt, 'shirt'); b.row(25, 19, 21, lt, 'shirt');
      b.row(25, 13, 18, skinSd, 'skin');
      b.row(26, 12, 19, sd, 'shirt');
      // cordons
      for (let y = 27; y <= 31; y++) { b.set(13, y, '#f3efe8', 'shirt'); b.set(18, y, '#f3efe8', 'shirt'); }
      // poche ventrale
      b.row(34, 11, 20, sd, 'shirt');
      for (let y = 35; y <= 38; y++) { b.set(11, y, sd, 'shirt'); b.set(20, y, sd, 'shirt'); }
    } else if (t === 'chemise') {
      b.row(25, 13, 18, skinSd, 'skin'); b.row(26, 14, 17, skinSd, 'skin'); b.row(27, 15, 16, skinSd, 'skin');
      const coll = light(col, 0.45);
      b.row(25, 11, 12, coll, 'shirt'); b.row(25, 19, 20, coll, 'shirt');
      b.row(26, 11, 13, coll, 'shirt'); b.row(26, 18, 20, coll, 'shirt');
      b.row(27, 13, 14, coll, 'shirt'); b.row(27, 17, 18, coll, 'shirt');
      for (let y = 28; y <= 38; y++) b.set(15, y, sd, 'shirt');
      [30, 33, 36].forEach(y => b.set(16, y, light(col, 0.6), 'shirt'));
      b.row(31, 19, 21, sd, 'shirt'); b.set(19, 32, sd, 'shirt'); b.set(21, 32, sd, 'shirt'); // poche
    } else if (t === 'colroule') {
      b.rect(12, 21, 8, 5, col, 'shirt');
      b.row(22, 12, 19, sd, 'shirt'); b.row(24, 12, 19, sd, 'shirt');
      b.row(26, 11, 20, sd, 'shirt');
      for (let y = 28; y <= 38; y += 2) { b.set(12, y, lt, 'shirt'); b.set(19, y, lt, 'shirt'); }
    } else if (t === 'salopette') {
      const tee = '#f4f1ea', teeSd = shade(tee, 0.12);
      b.row(25, 10, 21, tee, 'shirt'); b.row(26, 8, 23, tee, 'shirt'); b.row(27, 7, 24, tee, 'shirt');
      for (let y = 28; y <= 39; y++) b.row(y, 6, 25, tee, 'shirt');
      for (let y = 31; y <= 39; y++) { b.set(9, y, teeSd, 'shirt'); b.set(22, y, teeSd, 'shirt'); }
      b.row(25, 13, 18, skinSd, 'skin'); b.row(26, 14, 17, skinSd, 'skin');
      b.row(27, 14, 17, teeSd, 'shirt');
      // bretelles et bavette
      for (let y = 26; y <= 31; y++) { b.row(y, 11, 12, col, 'shirt'); b.row(y, 19, 20, col, 'shirt'); }
      for (let y = 31; y <= 39; y++) b.row(y, 11, 20, col, 'shirt');
      b.row(31, 11, 20, sd, 'shirt');
      b.set(12, 32, '#f2c94c', 'shirt'); b.set(19, 32, '#f2c94c', 'shirt');
      b.row(35, 14, 17, sd, 'shirt'); b.set(14, 36, sd, 'shirt'); b.set(17, 36, sd, 'shirt'); b.row(37, 14, 17, sd, 'shirt');
      b.row(39, 11, 20, sd, 'shirt');
    }
  }

  function drawHead(b, P) {
    const s = P.skin, sd = shade(s, 0.16);
    b.spans(HEAD, s, 'skin');
    // oreilles
    for (let y = 14; y <= 17; y++) { b.set(6, y, sd, 'skin'); b.set(25, y, sd, 'skin'); }
    b.set(6, 15, shade(s, 0.28), 'skin'); b.set(25, 15, shade(s, 0.28), 'skin');
    // léger ombrage de la mâchoire
    b.row(22, 12, 19, sd, 'skin'); b.set(10, 21, sd, 'skin'); b.set(21, 21, sd, 'skin');
  }

  // ---------- Cheveux ----------
  // Calotte commune (le dessus du crâne)
  const CAP = [[4, 11, 20], [5, 9, 22], [6, 8, 23], [7, 7, 24], [8, 6, 25], [9, 6, 25]];

  function hairBack(b, style, c) {
    const sd = shade(c, 0.22);
    switch (style) {
      case 'milong':
        for (let y = 9; y <= 22; y++) b.srow(y, 5, 6, sd, 'hairb');
        b.srow(23, 6, 8, sd, 'hairb');
        break;
      case 'long':
        for (let y = 9; y <= 33; y++) b.srow(y, y > 24 ? 4 : 5, 7, sd, 'hairb');
        b.srow(34, 5, 7, sd, 'hairb');
        break;
      case 'carre':
        for (let y = 9; y <= 21; y++) b.srow(y, 5, 6, sd, 'hairb');
        b.srow(22, 5, 9, sd, 'hairb');
        break;
      case 'queue':
        // queue de cheval visible sur le côté droit
        b.row(9, 25, 27, c, 'hairb'); b.row(10, 25, 28, c, 'hairb'); b.row(11, 26, 29, c, 'hairb');
        for (let y = 12; y <= 18; y++) b.row(y, 26, 29, y % 3 === 0 ? sd : c, 'hairb');
        b.row(19, 27, 29, c, 'hairb'); b.row(20, 27, 28, c, 'hairb'); b.set(28, 21, c, 'hairb');
        break;
      case 'couettes':
        for (let y = 12; y <= 24; y++) { const w = y < 14 || y > 22 ? 1 : 0; b.srow(y, 2 + w, 5, y % 4 === 0 ? sd : c, 'hairb'); }
        b.srow(25, 3, 4, c, 'hairb');
        break;
      case 'boucle':
        b.spans([[1, 11, 20], [2, 8, 23], [3, 6, 25], [4, 5, 26], [5, 4, 27], [6, 3, 28]], c, 'hairb');
        for (let y = 7; y <= 20; y++) b.srow(y, 3, 6, c, 'hairb');
        b.srow(21, 4, 7, c, 'hairb'); b.srow(22, 5, 8, c, 'hairb');
        break;
      case 'chignon':
        b.spans([[0, 13, 18], [1, 12, 19], [2, 12, 19], [3, 13, 18]], c, 'hairb');
        b.set(14, 1, light(c, 0.3), 'hairb'); b.set(13, 2, light(c, 0.3), 'hairb');
        break;
    }
  }

  function hairFront(b, style, c) {
    const lt = light(c, 0.28), sd = shade(c, 0.2);
    const cap = () => { b.spans(CAP, c, 'hair'); b.row(5, 12, 15, lt, 'hair'); b.row(6, 10, 12, lt, 'hair'); };
    switch (style) {
      case 'court':
        cap();
        b.row(10, 6, 7, c, 'hair'); b.row(10, 13, 25, c, 'hair');
        b.row(11, 6, 7, c, 'hair'); b.row(11, 19, 25, c, 'hair');
        b.srow(12, 6, 7, c, 'hair'); b.srow(13, 6, 7, sd, 'hair');
        break;
      case 'brosse':
        cap();
        [9, 13, 17, 21].forEach(x => { b.row(3, x, x + 1, c, 'hair'); });
        [10, 14, 18, 21].forEach(x => { b.set(x, 2, c, 'hair'); });
        b.set(14, 3, lt, 'hair'); b.set(10, 3, lt, 'hair');
        b.row(10, 6, 8, c, 'hair'); b.row(10, 11, 12, c, 'hair'); b.row(10, 15, 17, c, 'hair'); b.row(10, 20, 25, c, 'hair');
        b.srow(11, 6, 7, c, 'hair'); b.srow(12, 6, 7, sd, 'hair');
        break;
      case 'meche':
        cap();
        b.row(10, 6, 19, c, 'hair'); b.row(10, 24, 25, c, 'hair');
        b.row(11, 6, 13, c, 'hair'); b.row(11, 24, 25, c, 'hair');
        b.row(12, 6, 9, c, 'hair'); b.set(25, 12, sd, 'hair');
        b.row(13, 6, 7, sd, 'hair');
        b.row(8, 14, 20, lt, 'hair');
        break;
      case 'milong':
        cap();
        b.row(10, 6, 10, c, 'hair'); b.row(10, 13, 18, c, 'hair'); b.row(10, 21, 25, c, 'hair');
        b.row(11, 6, 8, c, 'hair'); b.row(11, 23, 25, c, 'hair');
        for (let y = 12; y <= 21; y++) b.srow(y, 6, 7, y > 18 ? sd : c, 'hair');
        break;
      case 'long':
        cap();
        b.row(10, 6, 13, c, 'hair'); b.row(10, 18, 25, c, 'hair');
        b.row(11, 6, 10, c, 'hair'); b.row(11, 21, 25, c, 'hair');
        for (let y = 12; y <= 24; y++) b.srow(y, 6, 7, c, 'hair');
        for (let y = 25; y <= 31; y++) b.srow(y, 6, 8, y % 3 === 0 ? sd : c, 'hair');
        b.srow(32, 7, 8, c, 'hair');
        break;
      case 'carre':
        cap();
        b.row(10, 6, 25, c, 'hair');
        b.row(11, 6, 25, c, 'hair');
        b.row(11, 10, 11, sd, 'hair'); b.row(11, 15, 16, sd, 'hair'); b.row(11, 20, 21, sd, 'hair');
        for (let y = 12; y <= 21; y++) b.srow(y, 6, 7, c, 'hair');
        break;
      case 'queue':
        cap();
        b.row(10, 6, 8, c, 'hair'); b.row(10, 23, 25, c, 'hair');
        b.srow(11, 6, 7, c, 'hair'); b.srow(12, 6, 7, sd, 'hair');
        b.row(8, 13, 18, lt, 'hair');
        break;
      case 'chignon':
        cap();
        b.row(10, 6, 8, c, 'hair'); b.row(10, 23, 25, c, 'hair');
        b.srow(11, 6, 7, c, 'hair');
        b.row(4, 13, 18, sd, 'hair');
        break;
      case 'couettes':
        cap();
        b.row(10, 6, 25, c, 'hair');
        b.row(10, 11, 12, sd, 'hair'); b.row(10, 19, 20, sd, 'hair');
        b.srow(11, 6, 8, c, 'hair'); b.srow(12, 6, 7, c, 'hair');
        break;
      case 'boucle':
        b.spans([[3, 10, 21], [4, 8, 23], [5, 7, 24], [6, 6, 25], [7, 6, 25], [8, 6, 25], [9, 6, 25]], c, 'hair');
        b.row(10, 6, 8, c, 'hair'); b.row(10, 10, 12, c, 'hair'); b.row(10, 14, 17, c, 'hair'); b.row(10, 19, 21, c, 'hair'); b.row(10, 23, 25, c, 'hair');
        b.srow(11, 6, 7, c, 'hair'); b.set(15, 11, c, 'hair'); b.set(16, 11, c, 'hair');
        // texture des boucles
        for (let y = 2; y <= 22; y++) for (let x = 3; x <= 28; x++) {
          if ((x * 7 + y * 5) % 11 === 0) {
            const L = b.get(x, y);
            if (L === 'hair' || L === 'hairb') b.set(x, y, (x + y) % 2 ? lt : sd, L);
          }
        }
        break;
      case 'rase':
        b.spans([[7, 11, 20], [8, 9, 22], [9, 8, 23]], mix(c, P_SKIN_FOR_RASE, 0.35), 'hair');
        b.srow(10, 7, 8, mix(c, P_SKIN_FOR_RASE, 0.45), 'hair');
        break;
      case 'chauve':
        b.row(8, 12, 14, light(P_SKIN_FOR_RASE, 0.35), 'skin');
        break;
    }
  }
  let P_SKIN_FOR_RASE = '#f7cba6';

  // ombre des cheveux sur le front + col sur la peau
  function autoShade(b, P) {
    const s = P.skin;
    for (let y = 0; y < FH - 1; y++) for (let x = 0; x < FW; x++) {
      const i = y * FW + x, j = (y + 1) * FW + x;
      if ((b.l[i] === 'hair' || b.l[i] === 'hat') && b.l[j] === 'skin' && b.c[j] === s) b.c[j] = shade(s, 0.14);
      if (b.l[i] === 'skin' && b.l[j] === 'shirt') b.c[j] = shade(b.c[j], 0.12);
    }
  }

  // ---------- Barbe ----------
  function drawBeard(b, kind, P) {
    const c = P.hair, s = P.skin;
    if (kind === 'trois') {
      const st = mix(s, c, 0.38);
      for (let y = 18; y <= 22; y++) for (let x = 8; x <= 23; x++) {
        if (b.get(x, y) === 'skin' && (x + y) % 2 === 0 && !(y < 20 && x > 10 && x < 21)) b.set(x, y, st, 'skin');
      }
      b.srow(12, 7, 7, st, 'skin');
    } else if (kind === 'moustache') {
      b.row(18, 13, 18, c, 'beard'); b.set(12, 19, c, 'beard'); b.set(19, 19, c, 'beard');
    } else if (kind === 'bouc') {
      b.row(18, 13, 18, c, 'beard');
      b.row(21, 14, 17, c, 'beard'); b.row(22, 13, 18, c, 'beard'); b.row(23, 14, 17, c, 'beard');
    } else if (kind === 'courte' || kind === 'longue') {
      for (let y = 13; y <= 17; y++) b.srow(y, 7, 7, c, 'beard');
      b.srow(18, 7, 9, c, 'beard'); b.row(18, 13, 18, c, 'beard');
      b.srow(19, 7, 12, c, 'beard'); b.srow(20, 8, 13, c, 'beard');
      b.row(21, 9, 22, c, 'beard'); b.row(22, 10, 21, c, 'beard'); b.row(23, 12, 19, c, 'beard');
      b.row(20, 14, 17, c, 'beard');
      if (kind === 'longue') {
        b.row(24, 11, 20, c, 'beard'); b.row(25, 11, 20, c, 'beard'); b.row(26, 12, 19, c, 'beard');
        b.row(27, 13, 18, c, 'beard'); b.row(28, 14, 17, c, 'beard');
        for (let y = 22; y <= 27; y += 2) b.set(15 + (y % 4 === 0 ? 1 : 0), y, shade(c, 0.25), 'beard');
      }
      b.row(19, 13, 18, shade(c, 0.15), 'beard');
    }
  }

  // ---------- Visage ----------
  const EX = [11, 19]; // colonne gauche de chaque œil
  function drawEyes(b, kind, P, blink) {
    const iris = P.eye, W = '#ffffff';
    if (blink && kind !== 'happy' && kind !== 'wink') kind = 'closed';
    EX.forEach((ex, i) => {
      let k = kind;
      if (kind === 'wink') k = i === 0 ? 'open' : 'happy';
      switch (k) {
        case 'open': case 'teary': case 'soft':
          if (k === 'soft') { b.row(14, ex, ex + 1, shade(P.skin, 0.3), 'face'); b.set(ex, 15, DARK, 'face'); b.set(ex + 1, 15, DARK, 'face'); b.row(16, ex, ex + 1, iris, 'face'); }
          else {
            b.set(ex, 14, W, 'face'); b.set(ex + 1, 14, DARK, 'face');
            b.set(ex, 15, DARK, 'face'); b.set(ex + 1, 15, DARK, 'face');
            b.row(16, ex, ex + 1, iris, 'face');
          }
          if (k === 'teary') { b.row(17, ex, ex + 1, '#8fd3ff', 'face'); b.set(ex + 1, 14, '#bfe9ff', 'face'); }
          break;
        case 'side':
          b.set(ex + 1, 14, W, 'face'); b.set(ex + 2, 14, DARK, 'face');
          b.set(ex + 1, 15, DARK, 'face'); b.set(ex + 2, 15, DARK, 'face');
          b.row(16, ex + 1, ex + 2, iris, 'face');
          break;
        case 'up':
          b.set(ex, 13, W, 'face'); b.set(ex + 1, 13, DARK, 'face');
          b.set(ex, 14, DARK, 'face'); b.set(ex + 1, 14, DARK, 'face');
          b.row(15, ex, ex + 1, iris, 'face');
          break;
        case 'down':
          b.row(15, ex, ex + 1, DARK, 'face'); b.row(16, ex, ex + 1, iris, 'face');
          break;
        case 'closed':
          b.row(16, ex - (i === 0 ? 1 : 0), ex + 1 + (i === 1 ? 1 : 0), DARK, 'face');
          break;
        case 'happy':
          b.row(15, ex, ex + 1, DARK, 'face'); b.set(ex - 1, 16, DARK, 'face'); b.set(ex + 2, 16, DARK, 'face');
          break;
        case 'wide':
          b.row(13, ex, ex + 1, W, 'face');
          b.set(ex - 1, 14, W, 'face'); b.set(ex + 2, 14, W, 'face'); b.row(14, ex, ex + 1, DARK, 'face');
          b.set(ex - 1, 15, W, 'face'); b.set(ex + 2, 15, W, 'face'); b.row(15, ex, ex + 1, iris, 'face');
          b.row(16, ex, ex + 1, W, 'face');
          b.set(ex, 14, '#ffffff', 'face');
          break;
        case 'half':
          b.row(15, ex - (i === 0 ? 1 : 0), ex + 1 + (i === 1 ? 1 : 0), DARK, 'face');
          b.set(ex, 16, DARK, 'face'); b.set(ex + 1, 16, iris, 'face');
          break;
        case 'sparkle':
          b.set(ex, 14, W, 'face'); b.set(ex + 1, 14, W, 'face');
          b.set(ex, 15, W, 'face'); b.set(ex + 1, 15, DARK, 'face');
          b.row(16, ex, ex + 1, iris, 'face');
          b.set(ex - 1, 13, '#fff3a6', 'face');
          break;
      }
    });
  }

  function drawBrows(b, kind, P) {
    const c = shade(P.hair, P.hairLight ? 0.45 : 0.15);
    // [y externe, y milieu, y interne]
    const T = { normal: [12, 11, 11], up: [10, 9, 9], sad: [12, 12, 11], angry: [11, 12, 13], flat: [12, 12, 12] };
    const L = kind === 'one' ? T.normal : (T[kind] || T.normal);
    const R = kind === 'one' ? T.up : (T[kind] || T.normal);
    b.set(10, L[0], c, 'face'); b.set(11, L[1], c, 'face'); b.set(12, L[2], c, 'face');
    b.set(21, R[0], c, 'face'); b.set(20, R[1], c, 'face'); b.set(19, R[2], c, 'face');
  }

  function drawMouth(b, kind, P) {
    const m = mix(P.skin, '#4a1f2a', 0.62), tongue = '#e36d7e', D = '#5a2230';
    switch (kind) {
      case 'neutral': b.row(19, 15, 16, m, 'face'); break;
      case 'smile': b.set(14, 19, m, 'face'); b.row(20, 15, 16, m, 'face'); b.set(17, 19, m, 'face'); break;
      case 'bigsmile':
        b.row(19, 14, 17, D, 'face'); b.set(14, 20, D, 'face'); b.set(17, 20, D, 'face');
        b.row(20, 15, 16, tongue, 'face'); b.row(21, 15, 16, D, 'face');
        b.row(19, 15, 16, '#ffffff', 'face');
        break;
      case 'laugh':
        b.row(18, 13, 18, D, 'face'); b.row(19, 13, 18, D, 'face'); b.row(19, 14, 17, '#ffffff', 'face');
        b.set(13, 20, D, 'face'); b.set(18, 20, D, 'face'); b.row(20, 14, 17, D, 'face'); b.row(20, 15, 16, tongue, 'face');
        b.row(21, 14, 17, D, 'face');
        break;
      case 'o':
        b.row(18, 15, 16, D, 'face'); b.set(14, 19, D, 'face'); b.set(17, 19, D, 'face'); b.row(19, 15, 16, '#7a2b3b', 'face');
        b.set(14, 20, D, 'face'); b.set(17, 20, D, 'face'); b.row(20, 15, 16, '#7a2b3b', 'face'); b.row(21, 15, 16, D, 'face');
        break;
      case 'smallo': b.row(19, 15, 16, D, 'face'); b.row(20, 15, 16, D, 'face'); break;
      case 'sad': b.set(14, 20, m, 'face'); b.row(19, 15, 16, m, 'face'); b.set(17, 20, m, 'face'); break;
      case 'wavy': b.set(13, 20, m, 'face'); b.set(14, 19, m, 'face'); b.set(15, 20, m, 'face'); b.set(16, 19, m, 'face'); b.set(17, 20, m, 'face'); b.set(18, 19, m, 'face'); break;
      case 'smirk': b.row(19, 14, 16, m, 'face'); b.set(17, 18, m, 'face'); break;
      case 'flat': b.row(19, 14, 17, m, 'face'); break;
      case 'talk': b.row(19, 14, 17, D, 'face'); b.row(20, 15, 16, tongue, 'face'); break;
      case 'talk2': b.row(19, 15, 16, D, 'face'); b.row(20, 15, 16, D, 'face'); break;
    }
  }

  function drawBlush(b, level, P) {
    if (!level) return;
    const t = level === 3 ? 0.55 : level === 2 ? 0.5 : 0.32;
    const c = mix(P.skin, level === 3 ? '#e2342e' : '#ff5f86', t);
    b.row(18, 8, 9, c, 'face'); b.row(18, 22, 23, c, 'face');
    if (level >= 2) { b.row(17, 8, 9, c, 'face'); b.row(17, 22, 23, c, 'face'); }
  }

  // ---------- Lunettes ----------
  function drawGlasses(b, kind) {
    if (kind === 'aucune') return;
    const F = '#2c2833';
    EX.forEach(ex => {
      if (kind === 'rondes') {
        b.row(13, ex, ex + 1, F, 'glass'); b.row(17, ex, ex + 1, F, 'glass');
        for (let y = 14; y <= 16; y++) { b.set(ex - 1, y, F, 'glass'); b.set(ex + 2, y, F, 'glass'); }
      } else if (kind === 'carrees') {
        b.row(13, ex - 1, ex + 2, F, 'glass'); b.row(17, ex - 1, ex + 2, F, 'glass');
        for (let y = 14; y <= 16; y++) { b.set(ex - 1, y, F, 'glass'); b.set(ex + 2, y, F, 'glass'); }
      } else if (kind === 'soleil') {
        b.row(13, ex - 1, ex + 2, F, 'glass');
        for (let y = 14; y <= 16; y++) b.row(y, ex - 1, ex + 2, '#2f2a3a', 'glass');
        b.row(17, ex, ex + 1, '#2f2a3a', 'glass');
        b.set(ex, 14, '#8a7fb0', 'glass'); b.set(ex - 1, 14, '#5b5378', 'glass');
      }
    });
    b.row(14, 14, 17, F, 'glass');
    b.set(7, 14, F, 'glass'); b.set(24, 14, F, 'glass');
  }

  // ---------- Accessoires ----------
  function drawAccessory(b, kind, col, hairStyle) {
    const sd = shade(col, 0.25), lt = light(col, 0.3);
    if (kind === 'bonnet' || kind === 'casquette') {
      // le chapeau cache le haut des cheveux
      for (let y = -2; y < 8; y++) for (let x = 0; x < 32; x++) { const L = b.get(x, y); if (L === 'hair' || (L === 'hairb' && hairStyle === 'chignon')) b.del(x, y); }
    }
    if (kind === 'bonnet') {
      b.spans([[2, 11, 20], [3, 9, 22], [4, 8, 23], [5, 7, 24], [6, 7, 24], [7, 6, 25]], col, 'hat');
      b.row(8, 5, 26, sd, 'hat'); b.row(9, 5, 26, sd, 'hat');
      for (let x = 6; x <= 25; x += 2) { b.set(x, 8, shade(col, 0.4), 'hat'); }
      b.row(0, 14, 17, lt, 'hat'); b.row(1, 13, 18, lt, 'hat');
      b.row(4, 11, 13, lt, 'hat');
    } else if (kind === 'casquette') {
      b.spans([[3, 11, 20], [4, 9, 22], [5, 8, 23], [6, 7, 24], [7, 7, 24], [8, 6, 25]], col, 'hat');
      b.set(15, 2, sd, 'hat'); b.set(16, 2, sd, 'hat');
      b.row(9, 5, 26, sd, 'hat'); b.row(10, 7, 24, shade(col, 0.45), 'hat');
      b.row(5, 13, 18, lt, 'hat'); b.row(6, 14, 17, lt, 'hat');
    } else if (kind === 'bandeau') {
      b.row(8, 6, 25, col, 'hat'); b.row(9, 6, 25, sd, 'hat');
      b.row(7, 23, 25, col, 'hat'); b.set(26, 8, col, 'hat'); b.set(27, 9, col, 'hat'); b.set(27, 7, col, 'hat');
    } else if (kind === 'casque') {
      const C = '#34303d';
      b.row(2, 11, 20, C, 'hat'); b.set(10, 3, C, 'hat'); b.set(21, 3, C, 'hat'); b.set(9, 4, C, 'hat'); b.set(22, 4, C, 'hat');
      b.row(3, 11, 20, C, 'hat');
      for (let y = 5; y <= 12; y++) { b.set(y < 8 ? 7 : 5, y, C, 'hat'); b.set(y < 8 ? 24 : 26, y, C, 'hat'); }
      b.set(8, 4, C, 'hat'); b.set(23, 4, C, 'hat'); b.set(6, 7, C, 'hat'); b.set(25, 7, C, 'hat');
      for (let y = 12; y <= 18; y++) { b.row(y, 3, 6, col, 'hat'); b.row(y, 25, 28, col, 'hat'); }
      for (let y = 13; y <= 17; y++) { b.set(6, y, sd, 'hat'); b.set(25, y, sd, 'hat'); }
      b.set(4, 13, lt, 'hat'); b.set(27, 13, lt, 'hat');
    } else if (kind === 'fleur') {
      const cx = 22, cy = 6;
      b.row(cy - 1, cx, cx + 1, col, 'hat'); b.row(cy + 2, cx, cx + 1, col, 'hat');
      b.set(cx - 1, cy, col, 'hat'); b.set(cx - 1, cy + 1, col, 'hat'); b.set(cx + 2, cy, col, 'hat'); b.set(cx + 2, cy + 1, col, 'hat');
      b.row(cy, cx, cx + 1, '#f6d34a', 'hat'); b.row(cy + 1, cx, cx + 1, '#e8b830', 'hat');
      b.set(cx - 1, cy + 3, '#4f9d55', 'hat'); b.set(cx - 2, cy + 3, '#4f9d55', 'hat');
    } else if (kind === 'noeud') {
      b.row(3, 19, 20, col, 'hat'); b.row(3, 24, 25, col, 'hat');
      b.row(4, 19, 21, col, 'hat'); b.row(4, 23, 25, col, 'hat');
      b.row(5, 19, 25, col, 'hat'); b.row(6, 19, 21, col, 'hat'); b.row(6, 23, 25, col, 'hat');
      b.row(7, 19, 20, sd, 'hat'); b.row(7, 24, 25, sd, 'hat');
      b.set(22, 5, sd, 'hat'); b.set(22, 4, sd, 'hat'); b.set(22, 6, sd, 'hat');
      b.set(20, 4, lt, 'hat');
    } else if (kind === 'boucles') {
      const g = '#f2c84b';
      b.row(18, 5, 6, g, 'hat'); b.row(18, 25, 26, g, 'hat'); b.set(5, 19, '#d9a92c', 'hat'); b.set(26, 19, '#d9a92c', 'hat'); b.set(5, 20, g, 'hat'); b.set(26, 20, g, 'hat');
    }
  }

  // ---------- Contour automatique ----------
  function outline(b) {
    const add = [];
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      if (b.c[y * FW + x]) continue;
      const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < FW && yy < FH && b.c[yy * FW + xx];
      if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) add.push(y * FW + x);
    }
    add.forEach(i => { b.c[i] = OUTLINE; b.l[i] = 'line'; });
  }

  // ---------- Petits effets (après le contour) ----------
  function glyph(b, rows, x, y, col, ol) {
    const H = rows.length, Wd = rows[0].length;
    if (ol) {
      for (let j = -1; j <= H; j++) for (let i = -1; i <= Wd; i++) {
        const on = (jj, ii) => rows[jj] && rows[jj][ii] === '1';
        if (on(j, i)) continue;
        if (on(j - 1, i) || on(j + 1, i) || on(j, i - 1) || on(j, i + 1)) b.set(x + i, y + j, ol, 'fx');
      }
    }
    for (let j = 0; j < H; j++) for (let i = 0; i < Wd; i++) if (rows[j][i] === '1') b.set(x + i, y + j, col, 'fx');
  }
  const G = {
    z: ['1111', '0010', '0100', '1111'],
    zs: ['111', '010', '111'],
    q: ['111', '001', '011', '010', '000', '010'],
    bang: ['11', '11', '11', '00', '11'],
    star: ['010', '111', '010'],
    dot: ['1'],
    vein: ['01010', '11011', '00000', '11011', '01010'],
    drop: ['010', '111', '111', '010'],
    note: ['0011', '0101', '0100', '1100', '1100'],
    bubble: ['0110', '1111', '1111', '0110'],
    bubbleS: ['11', '11']
  };

  function drawFx(b, list, t, head) {
    b.dx = head[0]; b.dy = head[1];
    list.forEach(f => {
      switch (f) {
        case 'sparkle': {
          const ph = Math.floor(t / 3) % 2;
          glyph(b, ph ? G.star : G.dot, ph ? 1 : 2, ph ? 5 : 6, '#fff4a8', ph ? '#c9a33a' : null);
          glyph(b, ph ? G.dot : G.star, ph ? 30 : 29, ph ? 4 : 3, '#fff4a8', ph ? null : '#c9a33a');
          glyph(b, ph ? G.star : G.dot, ph ? 28 : 29, ph ? 19 : 20, '#ffffff', ph ? '#9fb7d8' : null);
          break;
        }
        case 'zzz': {
          const k = t % 24;
          glyph(b, G.zs, 25 + Math.floor(k / 8), 7 - Math.floor(k / 4), '#ffffff', OUTLINE);
          if (k > 10) glyph(b, G.z, 29 + Math.floor(k / 12), 3 - Math.floor((k - 10) / 5), '#ffffff', OUTLINE);
          break;
        }
        case 'question': glyph(b, G.q, 28, -1 + (Math.floor(t / 4) % 2), '#ffffff', OUTLINE); break;
        case 'bang': glyph(b, G.bang, 28, 0 + (Math.floor(t / 2) % 2), '#ffd84a', OUTLINE); break;
        case 'vein': glyph(b, G.vein, 21, 4, '#e8423c', null); break;
        case 'sweat': {
          const k = Math.floor(t / 3) % 4;
          glyph(b, G.drop, 25, 8 + k, '#8fd3ff', '#3b6fa8'); b.set(25, 9 + k, '#ffffff', 'fx');
          break;
        }
        case 'tear': {
          const k = Math.floor(t / 2) % 6;
          b.set(11, 17 + k, '#8fd3ff', 'fx'); if (k > 0) b.set(11, 16 + k, '#c6ecff', 'fx');
          b.set(20, 17 + ((k + 3) % 6), '#8fd3ff', 'fx');
          break;
        }
        case 'laugh': {
          const ph = Math.floor(t / 2) % 2;
          if (ph) { b.set(3, 12, '#ffffff', 'fx'); b.set(2, 11, '#ffffff', 'fx'); b.set(28, 12, '#ffffff', 'fx'); b.set(29, 11, '#ffffff', 'fx'); b.set(3, 15, '#ffffff', 'fx'); b.set(28, 15, '#ffffff', 'fx'); }
          break;
        }
        case 'notes': {
          const k = t % 30;
          if (k < 20) glyph(b, G.note, 27 + Math.floor(k / 10), 4 - Math.floor(k / 5), '#ffffff', OUTLINE);
          break;
        }
        case 'dots': case 'think': {
          const k = Math.floor(t / 4) % 4;
          glyph(b, G.bubbleS, 25, 4, '#ffffff', OUTLINE);
          glyph(b, G.bubble, 28, 0, '#ffffff', OUTLINE);
          if (f === 'think') {
            // bulle de pensée avec petits points qui s'allument
            glyph(b, ['11111111', '11111111', '11111111', '11111111'], 25, -6, '#ffffff', OUTLINE);
            for (let i = 0; i < 3; i++) b.set(27 + i * 2, -4, i < k ? '#7a6f8f' : '#d9d3e3', 'fx');
          }
          break;
        }
      }
    });
    b.dx = 0; b.dy = 0;
  }

  // ---------- Rendu complet ----------
  function palette(look) {
    const hairC = colorOf(HAIR_COLORS, look.hairColor);
    return {
      skin: colorOf(SKINS, look.skin),
      hair: hairC,
      hairLight: ['platine', 'blanc', 'blond', 'poivre'].includes(look.hairColor),
      eye: colorOf(EYE_COLORS, look.eyes),
      top: colorOf(COLORS, look.topColor),
      acc: colorOf(COLORS, look.accColor)
    };
  }

  /**
   * state : { emotion, t, blink, breath, nod, talking, thinking }
   */
  function render(look, state) {
    look = Object.assign({}, DEFAULT_LOOK, look || {});
    state = state || {};
    const P = palette(look);
    P_SKIN_FOR_RASE = P.skin;
    const emo = EMOTIONS[state.emotion] || EMOTIONS.neutre;
    const t = state.t || 0;
    const b = new Buf();

    let hy = 0;
    if (state.breath) hy += 1;
    if (state.nod) hy += 1;
    if (emo.bounce && Math.floor(t / 2) % 2) hy -= 1;
    if (state.emotion === 'triste') hy += 1;
    const head = [0, Math.max(-1, Math.min(1, hy))];

    // derrière
    b.dx = head[0]; b.dy = head[1];
    hairBack(b, look.hair, P.hair);
    b.dx = 0; b.dy = 0;
    drawBody(b, look, P);
    b.dx = head[0]; b.dy = head[1];
    drawHead(b, P);
    drawBeard(b, look.beard, P);
    drawBlush(b, emo.blush, P);
    let mouth = emo.mouth;
    if (state.talking) mouth = (Math.floor(t / 2) % 3 === 0) ? emo.mouth : (Math.floor(t / 2) % 3 === 1 ? 'talk' : 'talk2');
    drawEyes(b, emo.eyes, P, state.blink);
    drawBrows(b, emo.brows, P);
    drawMouth(b, mouth, P);
    hairFront(b, look.hair, P.hair);
    // la grande barbe passe devant le col
    if (look.beard === 'longue') { b.dx = head[0]; b.dy = head[1]; }
    drawGlasses(b, look.glasses);
    drawAccessory(b, look.acc, P.acc, look.hair);
    b.dx = 0; b.dy = 0;
    autoShade(b, P);
    outline(b);
    const fx = (emo.fx || []).slice();
    if (state.thinking) { const i = fx.indexOf('dots'); if (i >= 0) fx.splice(i, 1); fx.push('think'); }
    drawFx(b, fx, t, head);
    return b;
  }

  function draw(ctx, x, y, look, state, scale) {
    const s = scale || 1;
    const b = render(look, state);
    for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) {
      const c = b.c[j * FW + i];
      if (c) { ctx.fillStyle = c; ctx.fillRect(x + i * s, y + j * s, s, s); }
    }
  }

  // ---------- Animation (clignement, respiration, hochement, parole) ----------
  function Animator() {
    this.t = 0;
    this.nextBlink = 25 + Math.random() * 30;
    this.blinkLeft = 0;
    this.emotion = 'ecoute';
    this.emotionUntil = 0;
    this.baseEmotion = 'ecoute';
    this.talking = false;
    this.listening = false;
    this.thinking = false;
  }
  Animator.prototype.setEmotion = function (e, durationTicks) {
    if (!EMOTIONS[e]) e = 'ecoute';
    this.emotion = e;
    this.emotionUntil = durationTicks ? this.t + durationTicks : 0;
  };
  Animator.prototype.tick = function () {
    this.t++;
    if (this.blinkLeft > 0) this.blinkLeft--;
    else if (this.t >= this.nextBlink) { this.blinkLeft = 2; this.nextBlink = this.t + 30 + Math.random() * 40; if (Math.random() < 0.2) this.nextBlink = this.t + 4; }
    if (this.emotionUntil && this.t > this.emotionUntil) { this.emotion = this.baseEmotion; this.emotionUntil = 0; }
  };
  Animator.prototype.state = function () {
    const emo = this.thinking ? 'pensif' : (this.listening ? 'ecoute' : this.emotion);
    return {
      emotion: emo,
      t: this.t,
      blink: this.blinkLeft > 0,
      breath: Math.floor(this.t / 12) % 2 === 1,
      nod: this.listening && Math.floor(this.t / 5) % 2 === 1,
      talking: this.talking,
      thinking: this.thinking
    };
  };

  window.Perso = {
    W: FW, H: FH, FIELDS, EMOTIONS, EMOTION_IDS, DEFAULT_LOOK,
    render, draw, randomLook, Animator, mix, shade, light,
    describe(look) {
      look = Object.assign({}, DEFAULT_LOOK, look || {});
      return FIELDS.filter(f => !['skin', 'eyes', 'topColor', 'accColor'].includes(f.key))
        .map(f => f.nom + ' : ' + pick(f.list, look[f.key]).nom.toLowerCase()).join(', ');
    }
  };
})();
