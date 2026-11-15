/* Pixpote — 15 décors en pixel art, dessinés par le code (96 x 72 pixels)
   Chaque décor a un fond fixe (draw), une animation derrière le personnage (back)
   et éventuellement une animation devant (front : pluie, neige, feuilles...). */
(function () {
  'use strict';
  const W = 96, H = 72;

  // ---------- Outils de dessin ----------
  function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x | 0, y | 0, w | 0, h | 0); }
  function P(c, x, y, col) { c.fillStyle = col; c.fillRect(x | 0, y | 0, 1, 1); }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function bands(c, y0, y1, cols) { // dégradé en bandes
    const n = cols.length, h = (y1 - y0) / n;
    cols.forEach((col, i) => R(c, 0, Math.round(y0 + i * h), W, Math.ceil(h) + 1, col));
    // tramage entre les bandes
    for (let i = 1; i < n; i++) { const y = Math.round(y0 + i * h); for (let x = 0; x < W; x += 2) P(c, x + (i % 2), y, cols[i - 1]); }
  }
  function circle(c, cx, cy, r, col) {
    for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y) + 0.35); R(c, cx - w, cy + y, w * 2 + 1, 1, col); }
  }
  function dither(c, x, y, w, h, c1, c2) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P(c, x + i, y + j, (i + j) % 2 ? c1 : c2); }
  function glow(c, cx, cy, r, col, a) { c.globalAlpha = a; circle(c, cx, cy, r, col); c.globalAlpha = a * 0.7; circle(c, cx, cy, Math.round(r * 0.6), col); c.globalAlpha = 1; }
  function tree(c, x, y, r, cols) { // feuillu rond
    R(c, x - 1, y, 3, 14, '#5b3b2a'); P(c, x - 1, y + 2, '#7a5238');
    circle(c, x, y - 2, r, cols[2]); circle(c, x - 2, y - 4, r - 2, cols[1]); circle(c, x - 3, y - 6, Math.max(1, r - 5), cols[0]);
  }
  function pine(c, x, yTop, h, col, col2) {
    for (let i = 0; i < h; i++) { const w = Math.floor(i * 0.45) + 1 - (i % 4 === 3 ? 1 : 0); R(c, x - w, yTop + i, w * 2 + 1, 1, i % 4 < 2 ? col : (col2 || col)); }
    R(c, x - 1, yTop + h, 2, 3, '#3d2a22');
  }
  function mountains(c, base, amp, freq, phase, col, seed) {
    const r = rng(seed);
    const pts = []; for (let k = 0; k < 8; k++) pts.push(r());
    for (let x = 0; x < W; x++) {
      const h = Math.sin(x * freq + phase) * amp * 0.6 + Math.sin(x * freq * 2.3 + phase * 2) * amp * 0.4 + amp;
      R(c, x, Math.round(base - h), 1, Math.round(h) + 30, col);
    }
  }
  function stars(c, seed, n, yMax, t) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(r() * W), y = Math.floor(r() * yMax), k = r();
      const on = t === undefined ? true : ((t + Math.floor(k * 40)) % 40) > 4;
      if (!on) continue;
      P(c, x, y, k > 0.85 ? '#ffffff' : (k > 0.5 ? '#dfe6ff' : '#9fa8d6'));
      if (k > 0.93 && t !== undefined && ((t + i) % 20) < 10) { P(c, x - 1, y, '#9fa8d6'); P(c, x + 1, y, '#9fa8d6'); P(c, x, y - 1, '#9fa8d6'); P(c, x, y + 1, '#9fa8d6'); }
    }
  }
  function fire(c, x, y, t, s) { // feu animé, base en (x,y)
    s = s || 1;
    const r = rng(Math.floor(t / 2) + 7);
    glow(c, x, y - 4 * s, 12 * s, '#ffb347', 0.12);
    for (let i = -4 * s; i <= 4 * s; i++) {
      const h = Math.round((7 - Math.abs(i) * 1.2 / s) * s + r() * 3 * s);
      for (let j = 0; j < h; j++) {
        const f = j / h;
        P(c, x + i, y - j, f < 0.35 ? '#ffe27a' : f < 0.7 ? '#ff9b3d' : '#e5482f');
      }
    }
    if (r() > 0.5) P(c, x + Math.round((r() - 0.5) * 6), y - 10 * s - Math.round(r() * 3), '#ffcf6a');
  }
  function window_(c, x, y, w, h, frame, inner) {
    R(c, x - 2, y - 2, w + 4, h + 4, frame); R(c, x, y, w, h, inner);
  }
  function books(c, x, y, w, h, seed) {
    const r = rng(seed); const cols = ['#c44d4d', '#3e6fb5', '#e0b341', '#4f9a62', '#8c5bb5', '#e07f3b', '#2f4f6f', '#b5a07a', '#d16f9a'];
    let i = x;
    while (i < x + w - 1) {
      const bw = 1 + Math.floor(r() * 3), bh = h - Math.floor(r() * 4);
      if (i + bw > x + w) break;
      const col = cols[Math.floor(r() * cols.length)];
      R(c, i, y + h - bh, bw, bh, col);
      if (bw > 1) R(c, i, y + h - bh + 2, bw, 1, '#f3e6c8');
      i += bw + (r() > 0.85 ? 1 : 0);
    }
  }
  function cloud(c, x, y, s) {
    circle(c, x, y, 3 * s, '#ffffff'); circle(c, x + 4 * s, y - 1, 4 * s, '#ffffff'); circle(c, x + 8 * s, y, 3 * s, '#ffffff');
    R(c, x - 2 * s, y + 1, 12 * s, 2 * s, '#ffffff'); R(c, x - 2 * s, y + 2 * s, 12 * s, 1, '#e3ecf7');
  }
  function rain(c, t, n, col, slope) {
    const r = rng(99);
    for (let i = 0; i < n; i++) {
      const x0 = r() * (W + 20), sp = 3 + r() * 2, y = ((r() * H + t * sp) % (H + 10)) - 5, x = (x0 - y * (slope || 0.3)) % (W + 20);
      P(c, x, y, col); P(c, x - (slope ? 0.3 : 0), y + 1, col); if (r() > 0.5) P(c, x - 0.6, y + 2, col);
    }
  }
  function snow(c, t, n) {
    const r = rng(42);
    for (let i = 0; i < n; i++) {
      const x0 = r() * W, sp = 0.4 + r() * 0.7, ph = r() * 6;
      const y = (r() * H + t * sp) % H, x = (x0 + Math.sin(t / 8 + ph) * 2 + W) % W;
      P(c, x, y, r() > 0.3 ? '#ffffff' : '#dce8f5');
      if (i % 5 === 0) P(c, x + 1, y, '#eef4fb');
    }
  }

  // ---------- Les décors ----------
  const DECORS = [
    {
      id: 'chambre', nom: 'Ma chambre', emoji: '🛏️',
      draw(c) {
        R(c, 0, 0, W, 54, '#b9a6dd'); dither(c, 0, 50, W, 1, '#a693cc', '#b9a6dd'); R(c, 0, 51, W, 3, '#8f7bb8');
        for (let x = 4; x < W; x += 12) R(c, x, 0, 1, 50, '#b09cd6');
        R(c, 0, 54, W, 18, '#a8724c'); for (let y = 57; y < H; y += 4) R(c, 0, y, W, 1, '#8f5f3e'); for (let y = 54; y < H; y += 4) for (let x = (y * 7) % 23; x < W; x += 23) R(c, x, y, 1, 4, '#8f5f3e');
        // fenêtre au crépuscule
        window_(c, 6, 8, 22, 24, '#f4efe6', '#f3a76b');
        R(c, 6, 8, 22, 6, '#6e5aa8'); R(c, 6, 14, 22, 5, '#c977a8'); R(c, 6, 19, 22, 5, '#f08f7a');
        circle(c, 20, 26, 3, '#ffd88a'); R(c, 6, 28, 22, 4, '#4b3d6e');
        R(c, 16, 8, 2, 24, '#f4efe6'); R(c, 6, 19, 22, 1, '#f4efe6');
        R(c, 4, 33, 26, 2, '#e3d8c6');
        // lit
        R(c, 66, 36, 30, 4, '#7a4f35'); R(c, 66, 36, 3, 20, '#7a4f35');
        R(c, 69, 41, 27, 8, '#f5f1ea'); R(c, 69, 46, 27, 10, '#5e8fd0'); for (let x = 70; x < 96; x += 4) R(c, x, 48, 2, 2, '#86b0e6');
        R(c, 71, 40, 10, 5, '#ffffff'); R(c, 71, 44, 10, 1, '#d8d2e6');
        // poster
        R(c, 74, 6, 16, 20, '#2d2b44'); circle(c, 82, 14, 4, '#f2c94c'); R(c, 76, 20, 12, 2, '#e46f6f'); R(c, 76, 23, 8, 1, '#8fd0c8');
        // plante
        R(c, 34, 44, 7, 8, '#c86a4a'); R(c, 34, 44, 7, 1, '#e08460');
        [[37, 36], [34, 39], [40, 38], [36, 41], [39, 34], [33, 42]].forEach(([x, y]) => { R(c, x, y, 3, 2, '#4f9d55'); P(c, x, y, '#79c26f'); });
        // tapis
        R(c, 24, 66, 48, 6, '#d9677a'); for (let x = 26; x < 72; x += 4) R(c, x, 68, 2, 2, '#f0a3b0');
      },
      back(c, t) { // guirlande lumineuse
        for (let x = 2; x < W; x += 6) {
          const y = 3 + Math.round(Math.sin(x / 9) * 1.5);
          P(c, x, y - 1, '#5b4a7a');
          const on = ((x + Math.floor(t / 6)) % 3) !== 0;
          P(c, x, y, on ? ['#ffe37a', '#ff9bb3', '#9fe0ff'][x % 3] : '#7d6c99');
        }
      }
    },
    {
      id: 'cafe', nom: 'Le petit café', emoji: '☕',
      draw(c) {
        R(c, 0, 0, W, 58, '#a55a43');
        for (let y = 0; y < 58; y += 4) { R(c, 0, y, W, 1, '#8a4636'); for (let x = (y % 8 ? 0 : 5); x < W; x += 10) R(c, x, y, 1, 4, '#8a4636'); }
        // grande vitrine
        window_(c, 4, 10, 30, 30, '#3a2a24', '#9ccbe4');
        R(c, 4, 30, 30, 10, '#7d9fb8'); R(c, 8, 26, 6, 14, '#5c7a94'); R(c, 20, 22, 8, 18, '#6b8aa4'); for (let y = 25; y < 38; y += 3) { P(c, 10, y, '#ffe9a8'); P(c, 23, y, '#ffe9a8'); P(c, 25, y + 1, '#ffe9a8'); }
        R(c, 18, 10, 2, 30, '#3a2a24');
        R(c, 2, 6, 34, 4, '#c8443c'); for (let x = 2; x < 36; x += 4) R(c, x, 6, 2, 4, '#f2ece0'); for (let x = 2; x < 36; x += 4) P(c, x + 1, 10, '#c8443c');
        // ardoise
        R(c, 66, 8, 26, 22, '#6b4a35'); R(c, 68, 10, 22, 18, '#2e3a33');
        R(c, 71, 12, 10, 1, '#f4f1e8'); R(c, 71, 16, 14, 1, '#d8e8d8'); R(c, 71, 19, 11, 1, '#d8e8d8'); R(c, 71, 22, 13, 1, '#d8e8d8'); R(c, 71, 25, 8, 1, '#f2c0c0');
        // étagère et bocaux
        R(c, 64, 36, 30, 2, '#5a3a28'); [[66, '#e8c26b'], [72, '#c1784a'], [78, '#8fb36b'], [84, '#e8c26b'], [89, '#d17a6b']].forEach(([x, col]) => { R(c, x, 30, 4, 6, '#d9e9ee'); R(c, x, 32, 4, 4, col); R(c, x, 29, 4, 1, '#6b4a35'); });
        // comptoir derrière
        R(c, 0, 58, W, 14, '#6b4430'); R(c, 0, 58, W, 2, '#8d5d42');
        // lampes suspendues
        [24, 74].forEach(x => { R(c, x, 0, 1, 6, '#2a2020'); R(c, x - 3, 6, 7, 3, '#2f5d4f'); R(c, x - 4, 9, 9, 1, '#2f5d4f'); P(c, x, 10, '#ffe6a0'); });
        // table et tasse au premier plan
        R(c, 8, 64, 20, 3, '#c79a6b'); R(c, 8, 67, 20, 1, '#9d7350');
        R(c, 13, 59, 7, 5, '#f4f1ea'); R(c, 20, 60, 2, 3, '#f4f1ea'); R(c, 14, 59, 5, 1, '#5b3826'); R(c, 11, 63, 11, 1, '#e3ded4');
      },
      back(c, t) {
        [24, 74].forEach(x => glow(c, x, 11, 8, '#ffd98a', 0.18));
        // vapeur
        for (let i = 0; i < 3; i++) { const k = (t + i * 5) % 15; P(c, 15 + i + Math.round(Math.sin((t + i * 4) / 3)), 57 - k, k < 10 ? '#f7f3ec' : '#d9cfc2'); }
      }
    },
    {
      id: 'parc', nom: 'Le banc du parc', emoji: '🌳',
      draw(c) {
        bands(c, 0, 44, ['#7ec3f0', '#8fcdf2', '#a3d7f4', '#b9e1f5']);
        mountains(c, 44, 3, 0.09, 1, '#a9cfa0', 3);
        R(c, 0, 42, W, 30, '#6fbf5a'); dither(c, 0, 42, W, 2, '#8dd06f', '#6fbf5a');
        for (let i = 0; i < 40; i++) { const r = rng(i + 3); P(c, Math.floor(r() * W), 46 + Math.floor(r() * 26), '#5aa84a'); }
        // chemin
        for (let y = 50; y < H; y++) { const w = 6 + (y - 50) * 1.6; R(c, 48 - w / 2 + (y - 50) * 0.3, y, w, 1, y % 3 ? '#d9c08f' : '#cdb07c'); }
        tree(c, 10, 36, 11, ['#9ad66f', '#6fbf4a', '#4e9a3c']);
        tree(c, 86, 34, 12, ['#9ad66f', '#6fbf4a', '#4e9a3c']);
        tree(c, 70, 38, 7, ['#b5e07a', '#86c45a', '#5f9e45']);
        // banc
        R(c, 22, 44, 52, 3, '#a8683f'); R(c, 22, 48, 52, 3, '#a8683f'); R(c, 22, 46, 52, 1, '#7a4a2c'); R(c, 22, 51, 52, 1, '#7a4a2c');
        R(c, 20, 56, 56, 3, '#b8774a'); R(c, 20, 59, 56, 1, '#7a4a2c');
        [24, 70].forEach(x => { R(c, x, 44, 2, 22, '#3b3b45'); });
        // lampadaire
        R(c, 92, 30, 2, 30, '#34343f'); R(c, 89, 27, 8, 3, '#34343f'); R(c, 90, 30, 6, 2, '#fff1b3');
        // fleurs
        [[4, 62], [8, 66], [86, 64], [90, 68], [80, 70], [12, 70]].forEach(([x, y], i) => { P(c, x, y, ['#ff8fb1', '#ffe066', '#ffffff'][i % 3]); P(c, x, y + 1, '#3f8f3a'); });
      },
      back(c, t) {
        const x1 = ((t / 6) % (W + 30)) - 20, x2 = ((t / 9 + 60) % (W + 30)) - 20;
        cloud(c, x1, 10, 1); cloud(c, x2, 18, 1);
        const bx = (t * 0.7) % (W + 20) - 10, by = 8 + Math.round(Math.sin(t / 4) * 2);
        const f = Math.floor(t / 3) % 2;
        P(c, bx, by, '#3b3446'); P(c, bx - 1, by - f, '#3b3446'); P(c, bx + 1, by - f, '#3b3446');
      }
    },
    {
      id: 'toit', nom: 'Sur les toits', emoji: '🌙',
      draw(c) {
        bands(c, 0, 52, ['#141a3d', '#1b2350', '#252e63', '#323b76', '#46498a']);
        stars(c, 5, 40, 40);
        circle(c, 78, 12, 6, '#f6f0c8'); circle(c, 80, 10, 5, '#fffbe6'); P(c, 76, 14, '#e6dfb0'); P(c, 79, 15, '#e6dfb0');
        // silhouette de la ville
        const r = rng(11);
        let x = 0;
        while (x < W) { const w = 8 + Math.floor(r() * 10), h = 10 + Math.floor(r() * 18); R(c, x, 56 - h, w, h + 4, '#2a2648'); for (let wy = 56 - h + 3; wy < 54; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) if (r() > 0.55) R(c, wx, wy, 1, 2, '#ffd56b'); x += w + 1; }
        R(c, 16, 26, 2, 12, '#3a3560'); R(c, 13, 26, 8, 1, '#3a3560'); R(c, 14, 23, 1, 3, '#3a3560');
        // toit en tuiles au premier plan
        for (let y = 54; y < H; y++) R(c, 0, y, W, 1, (y % 3 === 0) ? '#6e2f2f' : '#8e3c38');
        for (let y = 54; y < H; y += 3) for (let x = (y % 6 ? 0 : 3); x < W; x += 6) R(c, x, y, 1, 3, '#5c2626');
        R(c, 0, 53, W, 1, '#a65049');
        R(c, 80, 40, 9, 14, '#7b3a33'); R(c, 79, 39, 11, 2, '#5c2b27'); for (let y = 42; y < 54; y += 3) R(c, 80, y, 9, 1, '#6a302b');
      },
      back(c, t) {
        stars(c, 5, 40, 40, t);
        const k = t % 160; if (k < 8) { for (let i = 0; i < 4; i++) P(c, 20 + k * 3 - i, 6 + k - i * 0.5, i ? '#9fb0ff' : '#ffffff'); }
        const s = Math.floor(t / 10) % 4; for (let i = 0; i < 4; i++) P(c, 84 + i * 0, 36 - i * 2 - s, '#8d8aa8');
        P(c, 86, 32 - s, '#8d8aa8');
      }
    },
    {
      id: 'neige', nom: 'Le chalet sous la neige', emoji: '❄️',
      draw(c) {
        bands(c, 0, 46, ['#4d5f9a', '#6a76b0', '#8f8fc4', '#b7a8cf', '#d6bcd0']);
        mountains(c, 42, 10, 0.06, 2, '#e9eef8', 8);
        mountains(c, 44, 6, 0.11, 0.5, '#c9d3e8', 9);
        R(c, 0, 46, W, 26, '#f2f6fc'); dither(c, 0, 46, W, 1, '#dbe5f2', '#f2f6fc');
        for (let y = 50; y < H; y += 5) for (let x = (y * 3) % 17; x < W; x += 17) R(c, x, y, 6, 1, '#dbe5f2');
        pine(c, 8, 20, 30, '#2f6b55', '#25594a'); pine(c, 20, 28, 22, '#2f6b55', '#25594a'); pine(c, 90, 22, 28, '#2f6b55', '#25594a');
        [[8, 22], [20, 30], [90, 24]].forEach(([x, y]) => { for (let i = 0; i < 24; i += 4) R(c, x - Math.floor(i * 0.45), y + i, Math.floor(i * 0.45) + 1, 1, '#f2f6fc'); });
        // chalet
        R(c, 66, 30, 22, 18, '#8a5638'); for (let y = 32; y < 48; y += 3) R(c, 66, y, 22, 1, '#6e432b');
        for (let i = 0; i < 9; i++) R(c, 62 + i, 30 - i, 30 - i * 2, 1, '#f2f6fc');
        R(c, 62, 30, 30, 2, '#dbe5f2');
        R(c, 70, 35, 6, 6, '#ffd36b'); R(c, 72, 35, 1, 6, '#6e432b'); R(c, 70, 37, 6, 1, '#6e432b');
        R(c, 80, 38, 5, 10, '#5b3824'); R(c, 84, 18, 3, 8, '#6a4a3c');
      },
      back(c, t) {
        glow(c, 73, 38, 7, '#ffd36b', 0.15);
        const s = Math.floor(t / 6) % 4; P(c, 85, 15 - s, '#d8d4e6'); P(c, 86, 13 - s, '#cfcae0'); P(c, 85, 11 - s, '#c4bfd6');
      },
      front(c, t) { snow(c, t, 45); }
    },
    {
      id: 'plage', nom: 'Plage au coucher du soleil', emoji: '🌅',
      draw(c) {
        bands(c, 0, 38, ['#5a3f8a', '#8a4a96', '#c4588f', '#ec7b78', '#f7a467', '#fbc66a']);
        circle(c, 66, 36, 9, '#ffe08a'); circle(c, 66, 36, 6, '#fff1b8');
        R(c, 0, 38, W, 16, '#3f5fa0'); for (let y = 39; y < 54; y += 2) R(c, 0, y, W, 1, '#4a6db0');
        for (let y = 38; y < 54; y += 2) { const w = 14 - (y - 38) / 2; R(c, 66 - w / 2, y, w, 1, '#f7c46e'); }
        R(c, 0, 54, W, 18, '#f0cf96'); dither(c, 0, 54, W, 2, '#f6dcaa', '#f0cf96');
        for (let i = 0; i < 30; i++) { const r = rng(i * 3); P(c, Math.floor(r() * W), 57 + Math.floor(r() * 15), '#dcb47c'); }
        // parasol
        R(c, 13, 34, 1, 32, '#7a5a40');
        for (let i = 0; i < 6; i++) R(c, 13 - 12 + i * 2, 34 - i, 25 - i * 4, 1, i % 2 ? '#ffffff' : '#e5524a');
        R(c, 2, 35, 24, 1, '#c63f38');
        // seau et étoile de mer
        R(c, 80, 63, 6, 5, '#4fb3d9'); R(c, 80, 62, 6, 1, '#7fd0ef'); R(c, 79, 61, 1, 2, '#3a3a3a');
        P(c, 88, 68, '#f08a5d'); P(c, 87, 69, '#f08a5d'); P(c, 89, 69, '#f08a5d'); P(c, 88, 69, '#f08a5d'); P(c, 88, 70, '#f08a5d');
      },
      back(c, t) {
        for (let y = 40; y < 54; y += 3) { const off = (t + y * 3) % 24; R(c, (off * 4) % W, y, 3, 1, '#7d9be0'); R(c, (off * 4 + 45) % W, y + 1, 2, 1, '#7d9be0'); }
        const k = Math.sin(t / 6); R(c, 0, 53 + Math.round(k), W, 1, '#ffffff'); dither(c, 0, 54 + Math.round(k), W, 1, '#f0cf96', '#e8f2ff');
        const bx = (t * 0.5) % (W + 10) - 5; P(c, bx, 16, '#3a2a4a'); P(c, bx - 1, 15, '#3a2a4a'); P(c, bx + 1, 15, '#3a2a4a');
      }
    },
    {
      id: 'biblio', nom: 'La bibliothèque', emoji: '📚',
      draw(c) {
        R(c, 0, 0, W, 60, '#5a3a2a');
        for (let s = 0; s < 4; s++) {
          const y = 2 + s * 14;
          R(c, 0, y + 11, W, 2, '#7a5038'); R(c, 0, y + 13, W, 1, '#3e271c');
          books(c, 2, y, 30, 11, s * 13 + 1); books(c, 64, y, 30, 11, s * 17 + 5);
          if (s < 2) books(c, 34, y, 28, 11, s * 7 + 3);
        }
        [0, 32, 62, 94].forEach(x => R(c, x, 0, 2, 60, '#7a5038'));
        // lampe
        R(c, 84, 50, 2, 10, '#c9a24a'); R(c, 80, 44, 10, 6, '#3f7a5a'); R(c, 79, 49, 12, 1, '#2e5c43'); R(c, 82, 60, 6, 1, '#c9a24a');
        // sol
        R(c, 0, 60, W, 12, '#8a3b3b'); for (let x = 0; x < W; x += 6) R(c, x, 62, 3, 1, '#b25252'); for (let x = 3; x < W; x += 6) R(c, x, 66, 3, 1, '#b25252');
        R(c, 0, 60, W, 1, '#3e271c');
        // pile de livres
        R(c, 8, 62, 12, 3, '#3e6fb5'); R(c, 9, 59, 10, 3, '#e0b341'); R(c, 8, 56, 11, 3, '#c44d4d'); R(c, 9, 57, 9, 1, '#f3e6c8');
      },
      back(c, t) {
        glow(c, 85, 52, 12, '#ffd98a', 0.16);
        // poussière qui flotte dans la lumière
        for (let i = 0; i < 5; i++) { const k = (t + i * 13) % 40; P(c, 78 + i * 3 + Math.round(Math.sin((t + i * 7) / 5)), 58 - k / 2, '#ffe9b0'); }
      }
    },
    {
      id: 'feu', nom: 'Feu de camp', emoji: '🔥',
      draw(c) {
        bands(c, 0, 44, ['#0f1430', '#151c40', '#1e2650', '#2a2f5c']);
        stars(c, 21, 35, 34);
        for (let i = 0; i < 12; i++) pine(c, i * 9 + 3, 18 + (i * 7) % 10, 26, '#162a2a', '#13232a');
        R(c, 0, 46, W, 26, '#24402f'); dither(c, 0, 46, W, 2, '#1d3527', '#24402f');
        for (let i = 0; i < 30; i++) { const r = rng(i + 50); P(c, Math.floor(r() * W), 48 + Math.floor(r() * 24), '#2e5139'); }
        // tente
        for (let i = 0; i < 18; i++) R(c, 12 - i, 34 + i, i * 2 + 1, 1, i % 6 < 3 ? '#e07b39' : '#c96a2f');
        for (let i = 0; i < 12; i++) R(c, 12 - Math.floor(i / 2), 40 + i, i + 1, 1, '#4a2a1e');
        // bûches pour s'asseoir et cercle de pierres
        R(c, 66, 66, 22, 3, '#6a4128'); R(c, 66, 66, 22, 1, '#8a5a3a');
        [[68, 62], [72, 63], [76, 63], [80, 63], [84, 62], [70, 60], [86, 60]].forEach(([x, y]) => R(c, x, y, 3, 2, '#6f7480'));
        R(c, 72, 60, 12, 2, '#5b3a24'); R(c, 74, 59, 8, 1, '#7a5034');
      },
      back(c, t) {
        stars(c, 21, 35, 34, t);
        glow(c, 78, 54, 26, '#ff9b3d', 0.1);
        fire(c, 78, 60, t, 1);
        for (let i = 0; i < 4; i++) { const k = (t * 1.5 + i * 11) % 30; P(c, 76 + i * 2 + Math.round(Math.sin((t + i * 9) / 3) * 2), 48 - k, k < 20 ? '#ffcf6a' : '#e5482f'); }
      }
    },
    {
      id: 'lac', nom: 'Au bord du lac', emoji: '🏞️',
      draw(c) {
        bands(c, 0, 34, ['#9fd4f5', '#b4ddf6', '#cbe7f5', '#f3e7d2']);
        mountains(c, 34, 14, 0.05, 0.3, '#8c9cc8', 12);
        for (let x = 0; x < W; x++) { const h = Math.sin(x * 0.05 + 0.3) * 14 * 0.6 + Math.sin(x * 0.05 * 2.3 + 0.6) * 14 * 0.4 + 14; if (h > 20) R(c, x, Math.round(34 - h), 1, Math.round(h - 20), '#f2f4fa'); }
        mountains(c, 38, 6, 0.09, 2.2, '#5f8f7a', 13);
        R(c, 0, 38, W, 22, '#4f8fbf');
        for (let y = 38; y < 60; y++) if (y % 2 === 0) R(c, 0, y, W, 1, '#5b9bcb');
        // reflets des montagnes
        for (let x = 0; x < W; x += 2) { const h = Math.sin(x * 0.09 + 2.2) * 6 * 0.6 + Math.sin(x * 0.09 * 2.3 + 4.4) * 6 * 0.4 + 6; R(c, x, 38, 1, Math.round(h * 0.7), '#4b7f8a'); }
        // ponton
        for (let y = 56; y < H; y++) { const w = 30 + (y - 56) * 2.5; R(c, 48 - w / 2, y, w, 1, (y % 4 === 0) ? '#7a5236' : '#a87048'); }
        R(c, 33, 56, 30, 1, '#c48a5c');
        [30, 64].forEach(x => R(c, x, 52, 3, 8, '#6b4630'));
        // roseaux
        [[4, 50], [7, 48], [10, 51], [86, 49], [89, 47], [92, 50]].forEach(([x, y]) => { R(c, x, y, 1, 10, '#6c8f3a'); R(c, x, y - 3, 1, 3, '#7a4a2c'); });
      },
      back(c, t) {
        for (let i = 0; i < 6; i++) { const x = (i * 17 + t / 2) % W, y = 42 + (i * 5) % 14; R(c, x, y, 4, 1, '#a9d4f0'); }
        const dx = 80 - (t / 4) % 110; if (dx > -6) { R(c, dx, 46, 4, 2, '#7a5a3a'); R(c, dx + 3, 44, 2, 2, '#2f6b4a'); P(c, dx + 5, 45, '#f2b33c'); R(c, dx - 1, 48, 6, 1, '#7fb8e0'); }
      }
    },
    {
      id: 'automne', nom: "Forêt d'automne", emoji: '🍂',
      draw(c) {
        bands(c, 0, 46, ['#f2dcb5', '#f5e3c2', '#f7ead0']);
        [6, 22, 74, 90, 58, 38].forEach((x, i) => R(c, x - 1, 0, 3 + (i % 2), 50, '#6b4a38'));
        const cols = [['#ffd36b', '#f29b38', '#c9562f'], ['#ffb85c', '#e2672f', '#a8402a'], ['#f5e07a', '#e0b53a', '#b07a2a']];
        [[8, 14, 13, 0], [24, 22, 11, 1], [40, 10, 10, 2], [58, 16, 12, 0], [76, 12, 13, 1], [92, 20, 11, 2]].forEach(([x, y, r, k]) => {
          circle(c, x, y, r, cols[k][2]); circle(c, x - 2, y - 2, r - 2, cols[k][1]); circle(c, x - 3, y - 4, r - 6, cols[k][0]);
        });
        R(c, 0, 48, W, 24, '#b9763d'); dither(c, 0, 48, W, 2, '#c9864a', '#b9763d');
        for (let i = 0; i < 90; i++) { const r = rng(i + 77); P(c, Math.floor(r() * W), 50 + Math.floor(r() * 22), ['#e2672f', '#f2b33c', '#a8402a', '#d98a3a'][i % 4]); }
        // champignons
        [[14, 60], [82, 64]].forEach(([x, y]) => { R(c, x, y, 2, 3, '#f4ecd8'); R(c, x - 2, y - 2, 6, 2, '#d94f3c'); P(c, x - 1, y - 2, '#ffffff'); P(c, x + 2, y - 1, '#ffffff'); });
      },
      front(c, t) {
        const r = rng(5);
        for (let i = 0; i < 14; i++) {
          const x0 = r() * W, sp = 0.35 + r() * 0.4, ph = r() * 6;
          const y = (r() * H + t * sp) % H, x = (x0 + Math.sin(t / 7 + ph) * 4 + W) % W;
          const col = ['#e2672f', '#f2b33c', '#c9562f'][i % 3];
          P(c, x, y, col); P(c, x + (Math.floor(t / 4 + i) % 2 ? 1 : -1), y, col);
        }
      }
    },
    {
      id: 'salon', nom: 'Le coin du feu', emoji: '🛋️',
      draw(c) {
        R(c, 0, 0, W, 56, '#3f5f58'); for (let x = 0; x < W; x += 6) R(c, x, 0, 2, 56, '#45685f');
        for (let y = 4; y < 54; y += 8) for (let x = 3; x < W; x += 6) P(c, x + (y % 16 ? 0 : 1), y, '#d8c38a');
        R(c, 0, 56, W, 16, '#7a4e36'); for (let y = 58; y < H; y += 3) R(c, 0, y, W, 1, '#6a4230');
        // cheminée
        R(c, 2, 24, 30, 32, '#b5a28c'); R(c, 0, 22, 34, 3, '#8a7a68'); for (let y = 27; y < 56; y += 4) for (let x = 2 + (y % 8 ? 0 : 3); x < 32; x += 6) R(c, x, y, 1, 3, '#9e8c77');
        R(c, 8, 34, 18, 22, '#1e1716'); R(c, 7, 33, 20, 1, '#8a7a68');
        R(c, 11, 52, 12, 2, '#5b3a24');
        // cadre
        R(c, 66, 8, 20, 14, '#c9a24a'); R(c, 68, 10, 16, 10, '#87b4d6'); R(c, 68, 16, 16, 4, '#5f9a5a'); circle(c, 80, 13, 2, '#fff1b8');
        // canapé derrière le personnage
        R(c, 30, 40, 54, 20, '#a8434f'); R(c, 28, 44, 4, 20, '#8e3540'); R(c, 82, 44, 4, 20, '#8e3540');
        R(c, 30, 40, 54, 2, '#c45a66'); for (let x = 42; x < 82; x += 13) R(c, x, 42, 1, 16, '#8e3540');
        R(c, 74, 46, 7, 7, '#e8c26b'); R(c, 75, 47, 5, 5, '#f2d58a');
        // tapis
        R(c, 20, 66, 64, 6, '#e0b878'); for (let x = 22; x < 84; x += 5) R(c, x, 68, 2, 2, '#c99a58');
        // lampadaire
        R(c, 90, 22, 1, 40, '#2f2a2a'); R(c, 86, 16, 9, 7, '#f2e2b8'); R(c, 87, 62, 7, 1, '#2f2a2a');
      },
      back(c, t) {
        glow(c, 17, 48, 18, '#ff9b3d', 0.12);
        fire(c, 17, 51, t, 1);
        glow(c, 90, 20, 10, '#ffe6a0', 0.15);
      }
    },
    {
      id: 'cuisine', nom: 'La cuisine', emoji: '🍲',
      draw(c) {
        R(c, 0, 0, W, 50, '#f4f1ea');
        for (let y = 18; y < 50; y += 4) for (let x = 0; x < W; x += 4) { R(c, x, y, 4, 1, '#d8e3ea'); R(c, x, y, 1, 4, '#d8e3ea'); if ((x / 4 + y / 4) % 5 === 0) R(c, x + 1, y + 1, 3, 3, '#9fc6de'); }
        // placards hauts
        R(c, 0, 0, 30, 16, '#8fb89a'); R(c, 66, 0, 30, 16, '#8fb89a'); [2, 16, 68, 82].forEach(x => { R(c, x, 2, 12, 12, '#a3c9ad'); P(c, x + (x < 40 ? 10 : 1), 12, '#5b6b5f'); });
        // fenêtre
        window_(c, 36, 4, 24, 14, '#f4f1ea', '#a8daf5'); R(c, 36, 12, 24, 6, '#9ad08a'); R(c, 47, 4, 2, 14, '#f4f1ea');
        R(c, 34, 18, 28, 2, '#e3ddd0');
        // ustensiles suspendus
        R(c, 4, 22, 22, 1, '#7a7a85'); [6, 11, 16, 21].forEach((x, i) => { R(c, x, 23, 1, 6, '#9a9aa5'); if (i % 2) R(c, x - 1, 29, 3, 2, '#9a9aa5'); else circle(c, x, 30, 1, '#9a9aa5'); });
        // plan de travail
        R(c, 0, 50, W, 4, '#c79a6b'); R(c, 0, 54, W, 18, '#6f8fa8'); for (let x = 0; x < W; x += 16) { R(c, x, 56, 1, 16, '#5a7890'); R(c, x + 6, 60, 4, 1, '#d8d8de'); }
        // casserole
        R(c, 70, 42, 14, 8, '#c64a3c'); R(c, 69, 41, 16, 2, '#e05e4f'); R(c, 84, 43, 6, 1, '#3a3a3a'); R(c, 75, 39, 4, 2, '#3a3a3a');
        // bocaux et plante
        R(c, 8, 42, 5, 8, '#e9e3d4'); R(c, 8, 44, 5, 6, '#e0b341'); R(c, 15, 44, 5, 6, '#e9e3d4'); R(c, 15, 46, 5, 4, '#c1784a');
        R(c, 88, 44, 6, 6, '#d9775a'); [[89, 40], [91, 38], [92, 41], [88, 42]].forEach(([x, y]) => R(c, x, y, 2, 3, '#4f9d55'));
      },
      back(c, t) {
        for (let i = 0; i < 4; i++) { const k = (t + i * 6) % 18; P(c, 73 + i * 3 + Math.round(Math.sin((t + i * 5) / 3)), 38 - k, k < 12 ? '#ffffff' : '#e4e8ee'); }
      }
    },
    {
      id: 'jardin', nom: 'Le jardin fleuri', emoji: '🌻',
      draw(c) {
        bands(c, 0, 40, ['#8ecff5', '#a5daf6', '#c2e6f7']);
        circle(c, 82, 10, 6, '#ffe27a'); circle(c, 82, 10, 4, '#fff3b0');
        tree(c, 14, 30, 13, ['#a8dc7a', '#78c25a', '#4e9a3c']);
        R(c, 0, 40, W, 32, '#78c25a');
        // clôture
        for (let x = 2; x < W; x += 6) { R(c, x, 36, 4, 16, '#fbf8f2'); P(c, x, 36, '#78c25a'); P(c, x + 3, 36, '#78c25a'); R(c, x, 51, 4, 1, '#d6d0c4'); }
        R(c, 0, 40, W, 2, '#ece6da'); R(c, 0, 47, W, 2, '#ece6da');
        R(c, 0, 52, W, 20, '#6cb44f'); dither(c, 0, 52, W, 1, '#5aa043', '#6cb44f');
        // tournesols
        [[28, 30], [68, 28], [76, 32]].forEach(([x, y]) => { R(c, x, y, 1, 24, '#3f8a3a'); R(c, x + 1, y + 10, 3, 2, '#4f9d55'); circle(c, x, y, 3, '#f7c531'); circle(c, x, y, 1, '#6b3f22'); });
        // massif de fleurs
        const r = rng(8);
        for (let i = 0; i < 55; i++) { const x = Math.floor(r() * W), y = 56 + Math.floor(r() * 16); P(c, x, y + 1, '#3f8a3a'); P(c, x, y, ['#ff7aa2', '#ffffff', '#ffd23f', '#b38cf0', '#ff8a5c'][i % 5]); }
      },
      back(c, t) {
        [[0, 20, 1], [40, 30, 2]].forEach(([o, y0, k]) => {
          const x = (t * 0.6 + o) % (W + 10) - 5, y = y0 + Math.round(Math.sin(t / 5 + k) * 4), f = Math.floor(t / 2) % 2;
          const col = k === 1 ? '#ffffff' : '#f2a33c';
          P(c, x, y, '#3a2a2a'); if (f) { P(c, x - 1, y - 1, col); P(c, x + 1, y - 1, col); } else { P(c, x - 1, y, col); P(c, x + 1, y, col); }
        });
      }
    },
    {
      id: 'pluie', nom: 'Ville sous la pluie', emoji: '🌧️',
      draw(c) {
        bands(c, 0, 50, ['#2e3550', '#3a4262', '#4a5274', '#5c6386']);
        const r = rng(31); let x = -2;
        while (x < W) {
          const w = 10 + Math.floor(r() * 12), h = 20 + Math.floor(r() * 26), col = ['#3f3a56', '#4a3f5c', '#38405a'][Math.floor(r() * 3)];
          R(c, x, 56 - h, w, h, col);
          for (let wy = 56 - h + 3; wy < 52; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) R(c, wx, wy, 2, 3, r() > 0.45 ? '#f7c86b' : '#2c2a3e');
          x += w;
        }
        // rue mouillée
        R(c, 0, 56, W, 16, '#2b2d3d'); for (let y = 58; y < H; y += 2) for (let i = 0; i < 6; i++) R(c, (i * 17 + y * 3) % W, y, 3, 1, '#c99a4a');
        R(c, 0, 56, W, 1, '#55586e');
        // lampadaire
        R(c, 84, 24, 2, 34, '#1f2030'); R(c, 80, 22, 8, 2, '#1f2030'); R(c, 80, 24, 4, 2, '#fff1b3');
        // café éclairé à gauche
        R(c, 0, 34, 24, 22, '#5a3a3a'); R(c, 2, 40, 20, 12, '#ffcf7a'); R(c, 0, 32, 26, 3, '#2f6b55'); for (let i = 0; i < 26; i += 4) R(c, i, 35, 2, 1, '#2f6b55');
        R(c, 6, 44, 3, 8, '#7a4a3a'); R(c, 14, 43, 4, 9, '#4a3a5a');
      },
      back(c, t) {
        glow(c, 82, 28, 14, '#fff1b3', 0.12);
        glow(c, 12, 46, 14, '#ffcf7a', 0.08);
      },
      front(c, t) {
        rain(c, t, 60, 'rgba(190,210,255,0.55)', 0.25);
        for (let i = 0; i < 5; i++) { const k = (t + i * 7) % 12; if (k < 4) { const x = (i * 23 + 7) % W; P(c, x - k, 70, '#9fb4e0'); P(c, x + k, 70, '#9fb4e0'); } }
      }
    },
    {
      id: 'train', nom: 'Voyage en train', emoji: '🚆',
      draw(c) {
        R(c, 0, 0, W, 72, '#2f5547'); R(c, 0, 44, W, 28, '#7a5236'); for (let x = 0; x < W; x += 8) R(c, x, 44, 1, 28, '#6a4630');
        R(c, 0, 44, W, 2, '#c9a24a');
        R(c, 0, 0, W, 4, '#24443a'); R(c, 4, 4, 88, 2, '#c9a24a'); for (let x = 6; x < 92; x += 4) R(c, x, 6, 1, 2, '#c9a24a');
        // fenêtre (cadre)
        R(c, 4, 10, 88, 30, '#e8e0cc'); R(c, 6, 12, 84, 26, '#9fd4f5'); R(c, 47, 10, 2, 30, '#e8e0cc');
        // dossier de siège derrière le personnage
        R(c, 28, 42, 40, 30, '#a8343f'); R(c, 30, 40, 36, 3, '#c24a55'); for (let y = 46; y < 72; y += 5) for (let x = 31; x < 66; x += 5) P(c, x, y, '#8e2a34');
        R(c, 34, 42, 28, 6, '#f2ecdf');
      },
      back(c, t) {
        // paysage qui défile
        c.save(); c.beginPath(); c.rect(6, 12, 41, 26); c.rect(49, 12, 41, 26); c.clip();
        R(c, 6, 12, 84, 14, '#a5dbf6'); R(c, 6, 20, 84, 6, '#c8e8f6');
        for (let x = 6; x < 90; x++) { const xx = x + t * 0.3; const h = Math.sin(xx * 0.07) * 4 + Math.sin(xx * 0.023) * 3 + 8; R(c, x, Math.round(34 - h), 1, Math.round(h) + 6, '#7cbf6a'); }
        for (let x = 6; x < 90; x++) { const xx = x + t * 0.9; const h = Math.sin(xx * 0.11) * 2 + 3; R(c, x, Math.round(38 - h), 1, Math.round(h) + 2, '#4e9a4a'); }
        const r = rng(3);
        for (let i = 0; i < 6; i++) { const x = ((i * 31 - t * 1.6) % 140 + 140) % 140 - 10; const k = r(); if (k > 0.5) { circle(c, x, 30, 3, '#3f8a3a'); R(c, x, 33, 1, 4, '#5b3b2a'); } else { R(c, x, 22, 1, 16, '#5b4a3a'); R(c, x - 2, 23, 5, 1, '#5b4a3a'); } }
        const cx = ((t * 0.15) % 110) - 10; cloud(c, 90 - cx, 16, 1);
        c.restore();
      }
    }
  ];

  // ---------- Rendu ----------
  const cache = {};
  function staticLayer(id) {
    if (cache[id]) return cache[id];
    const d = DECORS.find(x => x.id === id) || DECORS[0];
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    d.draw(c);
    cache[id] = cv; return cv;
  }

  window.Decors = {
    W, H, LIST: DECORS.map(d => ({ id: d.id, nom: d.nom, emoji: d.emoji })),
    get(id) { return DECORS.find(d => d.id === id) || DECORS[0]; },
    drawBack(ctx, id, t) { const d = this.get(id); ctx.drawImage(staticLayer(d.id), 0, 0); if (d.back) d.back(ctx, t); },
    drawFront(ctx, id, t) { const d = this.get(id); if (d.front) d.front(ctx, t); },
    random(exclude) { const l = DECORS.filter(d => d.id !== exclude); return l[Math.floor(Math.random() * l.length)].id; }
  };
})();
