/* ---------- animated exercise figures (original line drawings, no video, works offline) ----------
   A side-view figure is posed by its hip, torso angle, foot and hand positions; knees and elbows are
   solved like real joints (two-bone IK). Each movement pattern is two poses (start, end), drawn as a
   filled body and played with real rep timing. Angles: 0 = straight down, 90 = forward (facing right), 180 = straight up. */
const AN = { torso: 29, ua: 15, fa: 14, th: 20, sh: 19, head: 5.4, neck: 3.6, floor: 92 };
const v2 = (a, l) => [Math.sin(a * Math.PI / 180) * l, Math.cos(a * Math.PI / 180) * l];
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const lerp = (a, b, k) => a + (b - a) * k;
function ik(root, tgt, a, b, pref) {                 // knee/elbow position for a two-bone limb
  let dx = tgt[0] - root[0], dy = tgt[1] - root[1], d = Math.hypot(dx, dy) || .001;
  const dc = clamp(d, Math.abs(a - b) + .01, a + b - .01), base = Math.atan2(dy, dx), ca = Math.acos(clamp((a * a + dc * dc - b * b) / (2 * a * dc), -1, 1));
  const c1 = [root[0] + Math.cos(base + ca) * a, root[1] + Math.sin(base + ca) * a], c2 = [root[0] + Math.cos(base - ca) * a, root[1] + Math.sin(base - ca) * a];
  const s = p => (p[0] - root[0]) * pref[0] + (p[1] - root[1]) * pref[1], j = s(c1) >= s(c2) ? c1 : c2;
  const jd = Math.hypot(tgt[0] - j[0], tgt[1] - j[1]) || .001, end = d > a + b ? [j[0] + (tgt[0] - j[0]) / jd * b, j[1] + (tgt[1] - j[1]) / jd * b] : tgt;
  return [j, end];
}
/* pose: h hip [x,y] · t torso angle · f [near ankle, far ankle] · w [near wrist, far wrist] · kp/ep bend preference */
function solve(P) {
  const S = add(P.h, v2(P.t, AN.torso)), head = add(S, v2(P.t + (P.hd || 0), AN.neck + AN.head));
  const leg = (A, k) => { const [K, E] = ik(P.h, A, AN.th, AN.sh, P.kp || [1, 0]); return [P.h, K, E]; };
  const arm = (W) => { const [E, H] = ik(S, W, AN.ua, AN.fa, P.ep || [0, 1]); return [S, E, H]; };
  return { S, head, legs: P.f.map(leg), arms: P.w.map(arm), t: P.t };
}
const FLR = AN.floor - 1.6;                            // ankle height when standing on the floor
const stand = (x = 46) => ({ h: [x, FLR - 38.6], t: 180, f: [[x + 1, FLR], [x + 3, FLR]], w: [[x + 1, FLR - 39], [x + 3, FLR - 40]] });
const P = (o, base) => Object.assign({}, base || {}, o);
/* props: bar (plate disc at a joint), db (dumbbell), cable (pulley → hand), bench / box / pad / rack (static shapes) */
const MOVES = {
  squat: { d: 2.6, a: P({ h: [44, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[41, 25], [43, 24]], ep: [0, 1] }), b: P({ h: [33, 70], t: 138, f: [[47, FLR], [49, FLR]], w: [[30, 44], [32, 43]], ep: [0, 1] }), pr: [{ k: 'bar', at: 'back', r: 8 }] },
  front_squat: { d: 2.6, a: P({ h: [44, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[52, 24], [54, 23]], ep: [1, .5] }), b: P({ h: [35, 70], t: 158, f: [[47, FLR], [49, FLR]], w: [[52, 42], [54, 41]], ep: [1, .5] }), pr: [{ k: 'bar', at: 'front', r: 8 }] },
  goblet: { d: 2.6, a: P({ h: [44, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[52, 31], [53, 30]], ep: [.3, 1] }), b: P({ h: [35, 70], t: 158, f: [[47, FLR], [49, FLR]], w: [[52, 50], [53, 49]], ep: [.3, 1] }), pr: [{ k: 'db', at: 'w0', r: 4.4 }] },
  bw_squat: { d: 2.4, a: P({ h: [44, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[47, 66], [49, 65]] }), b: P({ h: [34, 70], t: 145, f: [[47, FLR], [49, FLR]], w: [[70, 50], [72, 49]], ep: [0, 1] }) },
  box_squat: { d: 2.8, a: P({ h: [44, 52.8], t: 180, f: [[49, FLR], [51, FLR]], w: [[41, 25], [43, 24]], ep: [0, 1] }), b: P({ h: [30, 68], t: 140, f: [[49, FLR], [51, FLR]], w: [[28, 42], [30, 41]], ep: [0, 1] }), pr: [{ k: 'bar', at: 'back', r: 8 }, { k: 'box', x: 18, y: 70, w: 16, h: 22 }] },
  lunge: { d: 3, a: P({ h: [46, 52.8], t: 180, f: [[49, FLR], [47, FLR]], w: [[47, 66], [49, 65]] }), b: P({ h: [42, 66], t: 176, f: [[56, FLR], [24, FLR - 3]], w: [[42, 80], [44, 79]] }), pr: [{ k: 'db', at: 'w0', r: 3.4 }] },
  split_squat: { d: 3, a: P({ h: [48, 55], t: 178, f: [[56, FLR], [16, 64]], w: [[48, 69], [50, 68]], kp: [1, 0] }), b: P({ h: [44, 68], t: 170, f: [[56, FLR], [16, 64]], w: [[43, 82], [45, 81]] }), pr: [{ k: 'db', at: 'w0', r: 3.4 }, { k: 'bench', x: 4, y: 64, w: 24 }] },
  step_up: { d: 3, a: P({ h: [40, 58], t: 170, f: [[56, 69], [36, FLR]], w: [[42, 72], [44, 71]] }), b: P({ h: [54, 31], t: 180, f: [[56, 69], [57, 69]], w: [[55, 45], [57, 44]] }), pr: [{ k: 'db', at: 'w0', r: 3.4 }, { k: 'box', x: 48, y: 70.6, w: 24, h: 21.4 }] },
  hinge: { d: 2.8, a: P({ h: [30, 58], t: 112, f: [[46, FLR], [48, FLR]], w: [[54, 83], [56, 82]] }), b: P({ h: [44, 52.8], t: 180, f: [[46, FLR], [48, FLR]], w: [[46, 66], [48, 65]] }), pr: [{ k: 'bar', at: 'w0', r: 8 }] },
  rdl: { d: 2.8, a: P({ h: [44, 52.8], t: 180, f: [[46, FLR], [48, FLR]], w: [[46, 66], [48, 65]] }), b: P({ h: [33, 56], t: 105, f: [[46, FLR], [48, FLR]], w: [[58, 74], [60, 73]] }), pr: [{ k: 'bar', at: 'w0', r: 8 }] },
  db_rdl: { d: 2.8, a: P({ h: [44, 52.8], t: 180, f: [[46, FLR], [48, FLR]], w: [[46, 66], [48, 65]] }), b: P({ h: [33, 56], t: 105, f: [[46, FLR], [48, FLR]], w: [[58, 75], [60, 74]] }), pr: [{ k: 'db', at: 'w0', r: 3.6 }] },
  good_morning: { d: 2.8, a: P({ h: [44, 52.8], t: 180, f: [[46, FLR], [48, FLR]], w: [[41, 25], [43, 24]], ep: [0, 1] }), b: P({ h: [34, 55], t: 100, f: [[46, FLR], [48, FLR]], w: [[58, 56], [60, 55]], ep: [-1, 1] }), pr: [{ k: 'bar', at: 'back', r: 8 }] },
  hip_thrust: { d: 2.6, a: P({ h: [42, 80], t: -116, f: [[68, FLR], [70, FLR]], w: [[34, 78], [36, 77]], kp: [0, -1], ep: [0, 1] }), b: P({ h: [46, 63], t: -90, f: [[68, FLR], [70, FLR]], w: [[40, 62], [42, 61]], kp: [0, -1], ep: [0, 1] }), pr: [{ k: 'bar', at: 'hip', r: 8 }, { k: 'bench', x: 2, y: 67, w: 18 }] },
  glute_bridge: { d: 2.4, a: P({ h: [54, 86], t: -90, f: [[76, FLR], [78, FLR]], w: [[51, 89.6], [53, 89.4]], kp: [0, -1], ep: [0, -1] }), b: P({ h: [54, 76], t: -68, f: [[76, FLR], [78, FLR]], w: [[51, 89.6], [53, 89.4]], kp: [0, -1], ep: [0, -1], hd: -22 }) },
  leg_press: { d: 2.6, a: P({ h: [34, 72], t: -135, f: [[50, 49], [52, 48]], w: [[32, 74], [33, 74]], kp: [-.3, -1] }), b: P({ h: [34, 72], t: -135, f: [[58, 42], [60, 41]], w: [[32, 74], [33, 74]], kp: [-.3, -1] }), pr: [{ k: 'sled', at: 'f0' }, { k: 'seatback', x1: 6, y1: 46, x2: 36, y2: 76 }] },
  leg_ext: { d: 2.4, a: P({ h: [36, 64], t: 172, f: [[54, 84], [56, 84]], w: [[40, 70], [42, 70]], kp: [1, -.4] }), b: P({ h: [36, 64], t: 172, f: [[74, 62], [76, 61]], w: [[40, 70], [42, 70]], kp: [1, -.4] }), pr: [{ k: 'seat', x: 22, y: 66, w: 22 }, { k: 'pad', at: 'f0' }] },
  leg_curl: { d: 2.4, a: P({ h: [52, 62], t: -90, f: [[90, 63], [91, 62]], w: [[18, 66], [19, 66]], kp: [0, 1] }), b: P({ h: [52, 62], t: -90, f: [[76, 44], [77, 43]], w: [[18, 66], [19, 66]], kp: [0, 1] }), pr: [{ k: 'bench', x: 8, y: 66, w: 64 }, { k: 'pad', at: 'f0' }] },
  calf: { d: 1.8, a: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[46, 66], [48, 65]] }), b: P({ h: [46, 48], t: 180, f: [[47, FLR - 4.6], [49, FLR - 4.6]], w: [[46, 61], [48, 60]] }), pr: [{ k: 'db', at: 'w0', r: 3.6 }], toe: true },
  bench: { d: 2.4, a: P({ h: [56, 58.9], t: -90, f: [[72, FLR], [70, FLR]], w: [[31, 33], [32, 32]], ep: [0, 1] }), b: P({ h: [56, 58.9], t: -90, f: [[72, FLR], [70, FLR]], w: [[35, 52], [36, 51]], ep: [0, 1] }), pr: [{ k: 'bar', at: 'w0', r: 8 }, { k: 'bench', x: 14, y: 63, w: 50 }] },
  incline: { d: 2.4, a: P({ h: [56, 64], t: -124, f: [[72, FLR], [70, FLR]], w: [[36, 22], [37, 21]], ep: [0, 1] }), b: P({ h: [56, 64], t: -124, f: [[72, FLR], [70, FLR]], w: [[34, 42], [35, 41]], ep: [0, 1] }), pr: [{ k: 'bar', at: 'w0', r: 8 }, { k: 'incline', x1: 18, y1: 36, x2: 58, y2: 68 }] },
  db_bench: { d: 2.4, a: P({ h: [56, 58.9], t: -90, f: [[72, FLR], [70, FLR]], w: [[33, 33], [34, 32]], ep: [0, 1] }), b: P({ h: [56, 58.9], t: -90, f: [[72, FLR], [70, FLR]], w: [[35, 52], [36, 51]], ep: [0, 1] }), pr: [{ k: 'db', at: 'w0', r: 4 }, { k: 'bench', x: 14, y: 63, w: 50 }] },
  fly: { d: 2.6, a: P({ h: [56, 58.9], t: -90, f: [[72, FLR], [70, FLR]], w: [[33, 33], [34, 32]], ep: [0, 1] }), b: P({ h: [56, 58.9], t: -90, f: [[72, FLR], [70, FLR]], w: [[33, 58], [34, 57]], ep: [-.2, 1] }), pr: [{ k: 'db', at: 'w0', r: 4 }, { k: 'bench', x: 14, y: 63, w: 50 }] },
  pushup: { d: 2.2, a: P({ h: [50.4, 74.7], t: -114, f: [[86, FLR - .6], [88, FLR - 1]], w: [[24, AN.floor], [26, AN.floor - .5]], ep: [1, -.4] }), b: P({ h: [47.3, 85.6], t: -97, f: [[86, FLR - .6], [88, FLR - 1]], w: [[24, AN.floor], [26, AN.floor - .5]], ep: [1, -.4] }), toe: 'push' },
  dip: { d: 2.4, a: P({ h: [46, 54], t: 176, f: [[29, 77], [31, 76]], w: [[47, 54], [49, 53]], ep: [-1, 0], kp: [1, 0] }), b: P({ h: [42, 70], t: 160, f: [[26, 93], [28, 92]], w: [[48, 54], [50, 53]], ep: [-1, 0], kp: [1, 0] }), pr: [{ k: 'bars', y: 54 }], nofloor: true },
  ohp: { d: 2.4, a: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[52, 23], [54, 22]], ep: [1, .3] }), b: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[47, -4], [49, -5]], ep: [1, 0] }), pr: [{ k: 'bar', at: 'w0', r: 8 }] },
  db_ohp: { d: 2.4, a: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[52, 20], [54, 19]], ep: [1, .3] }), b: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[48, -3], [50, -4]], ep: [1, 0] }), pr: [{ k: 'db', at: 'w0', r: 3.8 }] },
  lat_raise: { d: 2.2, a: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[47, 51], [49, 50]], ep: [1, 0] }), b: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[46, 25], [48, 24]], ep: [0, 1] }), pr: [{ k: 'db', at: 'w0', r: 3.4 }], front: true },
  front_raise: { d: 2.2, a: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[49, 52], [51, 51]] }), b: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[75, 22], [77, 21]], ep: [0, 1] }), pr: [{ k: 'db', at: 'w0', r: 3.4 }] },
  rear_fly: { d: 2.4, a: P({ h: [38, 56], t: 112, f: [[46, FLR], [48, FLR]], w: [[62, 66], [64, 65]], ep: [1, 0] }), b: P({ h: [38, 56], t: 112, f: [[46, FLR], [48, FLR]], w: [[56, 34], [58, 33]], ep: [-1, 0] }), pr: [{ k: 'db', at: 'w0', r: 3.4 }] },
  row: { d: 2.4, a: P({ h: [34, 56], t: 112, f: [[46, FLR], [48, FLR]], w: [[60, 76], [62, 75]] }), b: P({ h: [34, 56], t: 112, f: [[46, FLR], [48, FLR]], w: [[48, 62], [50, 61]], ep: [-1, -1] }), pr: [{ k: 'bar', at: 'w0', r: 8 }] },
  db_row: { d: 2.4, a: P({ h: [24, 50], t: 100, f: [[22, FLR], [30, FLR]], w: [[52, 78], [58, 64]], ep: [-1, 0] }), b: P({ h: [24, 50], t: 100, f: [[22, FLR], [30, FLR]], w: [[40, 62], [58, 64]], ep: [-1, -.3] }), pr: [{ k: 'db', at: 'w0', r: 3.8 }, { k: 'bench', x: 44, y: 64, w: 44 }] },
  cable_row: { d: 2.4, a: P({ h: [30, 76], t: 166, f: [[66, 82], [68, 82]], w: [[66, 62], [68, 61]], kp: [0, -1] }), b: P({ h: [30, 76], t: 186, f: [[66, 82], [68, 82]], w: [[42, 62], [44, 61]], kp: [0, -1], ep: [-1, 0] }), pr: [{ k: 'cable', from: [92, 70] }, { k: 'seat', x: 18, y: 78, w: 26 }, { k: 'block', x: 70, y: 76, w: 6, h: 16 }] },
  pulldown: { d: 2.4, a: P({ h: [42, 70], t: 176, f: [[60, FLR], [62, FLR]], w: [[46, 8], [48, 7]], kp: [1, -.6], ep: [-1, 0] }), b: P({ h: [42, 70], t: 190, f: [[60, FLR], [62, FLR]], w: [[48, 30], [50, 29]], kp: [1, -.6], ep: [-1, 0] }), pr: [{ k: 'cable', from: [48, 2] }, { k: 'seat', x: 30, y: 72, w: 22 }] },
  pullup: { d: 2.8, a: P({ h: [44, 60], t: 180, f: [[36, 92], [38, 92]], w: [[48, 2], [50, 1]], ep: [-1, 0], kp: [1, 0] }), b: P({ h: [44, 42], t: 176, f: [[36, 76], [38, 76]], w: [[48, 2], [50, 1]], ep: [-1, 0], kp: [1, 0] }), pr: [{ k: 'hibar', y: 2 }], nofloor: true },
  inv_row: { d: 2.4, a: P({ h: [50, 70], t: -110, f: [[84, FLR], [86, FLR]], w: [[26, 44], [28, 43]], ep: [0, 1] }), b: P({ h: [48, 60], t: -100, f: [[84, FLR], [86, FLR]], w: [[26, 44], [28, 43]], ep: [0, 1] }), pr: [{ k: 'hibar', y: 44, x1: 14, x2: 40 }] },
  shrug: { d: 2, a: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[46, 66], [48, 65]] }), b: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[46, 62], [48, 61]] }), pr: [{ k: 'bar', at: 'w0', r: 8 }], shrug: true },
  upright_row: { d: 2.4, a: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[50, 64], [52, 63]] }), b: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[52, 30], [54, 29]], ep: [-1, -.6] }), pr: [{ k: 'bar', at: 'w0', r: 8 }] },
  curl: { d: 2.2, a: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[49, 65], [51, 64]] }), b: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[56, 32], [58, 31]], ep: [-.3, 1] }), pr: [{ k: 'bar', at: 'w0', r: 7.5 }] },
  db_curl: { d: 2.2, a: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[49, 65], [51, 64]] }), b: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[56, 32], [58, 31]], ep: [-.3, 1] }), pr: [{ k: 'db', at: 'w0', r: 3.4 }] },
  cable_curl: { d: 2.2, a: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[50, 65], [52, 64]] }), b: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[56, 32], [58, 31]], ep: [-.3, 1] }), pr: [{ k: 'cable', from: [74, 90] }] },
  preacher: { d: 2.2, a: P({ h: [34, 66], t: 168, f: [[50, FLR], [52, FLR]], w: [[66, 54], [67, 53]], ep: [0, 1], kp: [1, -.4] }), b: P({ h: [34, 66], t: 168, f: [[50, FLR], [52, FLR]], w: [[46, 30], [47, 29]], ep: [0, 1], kp: [1, -.4] }), pr: [{ k: 'bar', at: 'w0', r: 7.5 }, { k: 'incline', x1: 40, y1: 38, x2: 62, y2: 54 }, { k: 'seat', x: 22, y: 68, w: 20 }] },
  pushdown: { d: 2.2, a: P({ h: [46, 52.8], t: 176, f: [[47, FLR], [49, FLR]], w: [[58, 36], [60, 35]], ep: [-.2, 1] }), b: P({ h: [46, 52.8], t: 176, f: [[47, FLR], [49, FLR]], w: [[54, 62], [56, 61]], ep: [-.2, 1] }), pr: [{ k: 'cable', from: [62, 0] }] },
  oh_ext: { d: 2.4, a: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[36, 12], [38, 11]], ep: [.4, -1] }), b: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[50, -6], [52, -7]], ep: [.4, -1] }), pr: [{ k: 'db', at: 'w0', r: 4 }] },
  skull: { d: 2.4, a: P({ h: [56, 58.9], t: -90, f: [[72, FLR], [70, FLR]], w: [[33, 33], [34, 32]], ep: [0, 1] }), b: P({ h: [56, 58.9], t: -90, f: [[72, FLR], [70, FLR]], w: [[19, 46], [20, 45]], ep: [1, -1] }), pr: [{ k: 'bar', at: 'w0', r: 7.5 }, { k: 'bench', x: 14, y: 63, w: 50 }] },
  bench_dip: { d: 2.4, a: P({ h: [34, 66], t: 178, f: [[64, FLR], [66, FLR]], w: [[30, 64], [32, 63]], ep: [-1, 0], kp: [1, -1] }), b: P({ h: [34, 80], t: 178, f: [[64, FLR], [66, FLR]], w: [[30, 64], [32, 63]], ep: [-1, 0], kp: [1, -1] }), pr: [{ k: 'bench', x: 8, y: 64, w: 26 }] },
  crunch: { d: 2.2, a: P({ h: [54, 86], t: -90, f: [[74, FLR], [76, FLR]], w: [[38, 82], [40, 82]], kp: [0, -1], ep: [0, -1] }), b: P({ h: [54, 86], t: -122, f: [[74, FLR], [76, FLR]], w: [[42, 72], [44, 72]], kp: [0, -1], ep: [0, -1] }) },
  situp: { d: 2.6, a: P({ h: [54, 86], t: -90, f: [[74, FLR], [76, FLR]], w: [[38, 82], [40, 82]], kp: [0, -1], ep: [0, -1] }), b: P({ h: [54, 86], t: -170, f: [[74, FLR], [76, FLR]], w: [[56, 66], [58, 66]], kp: [0, -1], ep: [1, 0] }) },
  cable_crunch: { d: 2.4, a: P({ h: [40, 70], t: 165, f: [[21, FLR], [23, FLR]], w: [[52, 37], [53, 36]], kp: [1, 1], ep: [1, 1] }), b: P({ h: [36, 70], t: 112, f: [[21, FLR], [23, FLR]], w: [[68, 56], [69, 55]], kp: [1, 1], ep: [1, 1] }), pr: [{ k: 'cable', from: [70, -10] }], kneel: true },
  plank: { d: 3.2, a: P({ h: [48, 81.6], t: -103, f: [[86, FLR - .6], [88, FLR - 1]], w: [[6, 90], [8, 89.5]], ep: [0, 1] }), b: P({ h: [48, 80.4], t: -103, f: [[86, FLR - .6], [88, FLR - 1]], w: [[6, 90], [8, 89.5]], ep: [0, 1] }), toe: 'push', breathe: true },
  side_plank: { d: 3.2, a: P({ h: [48, 81.6], t: -103, f: [[86, FLR], [87, FLR - 2.4]], w: [[6, 90], [22, 47]], ep: [0, 1] }), b: P({ h: [48, 79.6], t: -103, f: [[86, FLR], [87, FLR - 2.4]], w: [[6, 90], [22, 45]], ep: [0, 1] }), breathe: true },
  rollout: { d: 3, a: P({ h: [40, 70], t: 125, f: [[22, FLR], [24, FLR]], w: [[62, 84], [64, 83]], kp: [1, 1] }), b: P({ h: [46, 79], t: 96, f: [[22, FLR], [24, FLR]], w: [[94, 85], [96, 84]], kp: [1, 1] }), pr: [{ k: 'wheel', at: 'w0' }], kneel: true },
  leg_raise: { d: 2.8, a: P({ h: [44, 60], t: 180, f: [[44, 96], [46, 96]], w: [[46, 2], [48, 1]], ep: [-1, 0] }), b: P({ h: [42, 60], t: 184, f: [[80, 58], [82, 57]], w: [[46, 2], [48, 1]], ep: [-1, 0] }), pr: [{ k: 'hibar', y: 2 }], nofloor: true },
  twist: { d: 1.6, a: P({ h: [44, 84], t: -140, f: [[66, 80], [68, 80]], w: [[44, 64], [46, 64]], kp: [0, -1], ep: [1, 1] }), b: P({ h: [44, 84], t: -140, f: [[66, 80], [68, 80]], w: [[36, 70], [38, 70]], kp: [0, -1], ep: [1, 1] }), pr: [{ k: 'db', at: 'w0', r: 3.6 }], nohold: true },
  chop: { d: 2.6, a: P({ h: [46, 52.8], t: 180, f: [[44, FLR], [52, FLR]], w: [[66, 14], [67, 14]], ep: [0, 1] }), b: P({ h: [44, 54], t: 166, f: [[44, FLR], [52, FLR]], w: [[32, 70], [33, 70]], ep: [0, 1] }), pr: [{ k: 'cable', from: [86, 4] }] },
  pallof: { d: 2.6, a: P({ h: [46, 52.8], t: 180, f: [[44, FLR], [52, FLR]], w: [[56, 32], [57, 32]], ep: [-1, 0] }), b: P({ h: [46, 52.8], t: 180, f: [[44, FLR], [52, FLR]], w: [[74, 32], [75, 32]], ep: [0, 1] }), pr: [{ k: 'cable', from: [94, 32] }] },
  kickback: { d: 2.2, a: P({ h: [46, 52.8], t: 170, f: [[48, FLR], [50, FLR]], w: [[66, 40], [67, 40]], ep: [0, 1] }), b: P({ h: [46, 52.8], t: 158, f: [[48, FLR], [22, 76]], w: [[66, 40], [67, 40]], ep: [0, 1] }), pr: [{ k: 'cable', from: [4, 90], at: 'f1' }, { k: 'post', x: 70, y1: 20, y2: 92 }] },
  pull_through: { d: 2.6, a: P({ h: [56, 58], t: 120, f: [[48, FLR], [50, FLR]], w: [[36, 84], [38, 83]] }), b: P({ h: [44, 52.8], t: 180, f: [[48, FLR], [50, FLR]], w: [[52, 66], [54, 65]] }), pr: [{ k: 'cable', from: [4, 90] }] },
  carry: { d: 1.6, a: P({ h: [44, 52.8], t: 180, f: [[52, FLR], [38, FLR]], w: [[42, 67], [46, 66]] }), b: P({ h: [48, 52.8], t: 180, f: [[42, FLR], [58, FLR]], w: [[48, 67], [50, 66]] }), pr: [{ k: 'db', at: 'w0', r: 4 }], nohold: true },
  nordic: { d: 3.2, a: P({ h: [44, 70.4], t: 180, f: [[25, 89.4], [27, 89.4]], w: [[52, 60], [54, 59]], kp: [0, 1], ep: [1, 1] }), b: P({ h: [58.5, 76.9], t: 132, f: [[25, 89.4], [27, 89.4]], w: [[80, 76], [82, 75]], kp: [0, 1], ep: [1, 0] }), kneel: 'nordic', pr: [{ k: 'pad', at: 'f0' }] },
  superman: { d: 2.4, a: P({ h: [58, 86.4], t: -90, f: [[96.5, 88.6], [98.5, 88.4]], w: [[1, 88.4], [3, 88]], ep: [0, -1] }), b: P({ h: [58, 86.6], t: -100, f: [[96, 80.5], [98, 80]], w: [[2, 75.5], [4, 75]], ep: [0, -1] }), vb: '-10 -14 120 110' },
  tib: { d: 1.8, a: P({ h: [40, 50], t: 184, f: [[47, FLR], [49, FLR]], w: [[38, 64], [40, 63]] }), b: P({ h: [40, 50], t: 184, f: [[47, FLR], [49, FLR]], w: [[38, 64], [40, 63]] }), toe: 'tib', pr: [{ k: 'post', x: 28, y1: 10, y2: 92 }] },
  face_pull: { d: 2.4, a: P({ h: [44, 52.8], t: 180, f: [[44, FLR], [50, FLR]], w: [[74, 20], [75, 20]], ep: [0, 1] }), b: P({ h: [44, 52.8], t: 180, f: [[44, FLR], [50, FLR]], w: [[54, 14], [55, 14]], ep: [-1, -.4] }), pr: [{ k: 'cable', from: [96, 16] }] },
  cable_raise: { d: 2.2, a: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[49, 64], [51, 63]] }), b: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[46, 25], [48, 24]], ep: [0, 1] }), pr: [{ k: 'cable', from: [60, 92] }], front: true }
};
/* which movement each exercise uses */
const EX_MOVE = {
  bb_bench: 'bench', incline_bb_bench: 'incline', db_press: 'db_bench', incline_db_press: 'incline', machine_chest_press: 'bench', cable_fly: 'fly', pushups: 'pushup', dips: 'dip',
  ohp: 'ohp', db_shoulder_press: 'db_ohp', db_lat_raise: 'lat_raise', cable_lat_raise: 'cable_raise', landmine_press: 'ohp', face_pull: 'face_pull', rear_delt_fly: 'rear_fly',
  bb_row: 'row', pendlay_row: 'row', pullups: 'pullup', db_row: 'db_row', lat_pulldown: 'pulldown', seated_cable_row: 'cable_row', deadlift: 'hinge', superman: 'superman',
  bb_squat: 'squat', front_squat: 'front_squat', bulgarian_split: 'split_squat', goblet_squat: 'goblet', leg_press: 'leg_press', leg_extension: 'leg_ext', walking_lunge: 'lunge', bw_squat: 'bw_squat',
  rdl: 'rdl', db_rdl: 'db_rdl', leg_curl: 'leg_curl', bb_hip_thrust: 'hip_thrust', glute_bridge: 'glute_bridge', standing_calf_raise: 'calf', db_calf_raise: 'calf', bw_calf_raise: 'calf',
  bb_curl: 'curl', incline_curl: 'db_curl', hammer_curl: 'db_curl', cable_curl: 'cable_curl', cgbp: 'bench', skullcrusher: 'skull', tri_pushdown: 'pushdown', oh_tri_ext: 'oh_ext',
  ab_rollout: 'rollout', hanging_leg_raise: 'leg_raise', cable_crunch: 'cable_crunch', crunch: 'crunch', decline_bb_bench: 'bench', decline_db_press: 'db_bench', db_chest_fly: 'fly',
  low_high_cable_fly: 'front_raise', high_low_cable_fly: 'fly', floor_press: 'bench', landmine_chest_press: 'ohp', tbar_row: 'row', cs_db_row: 'db_row', straight_arm_pulldown: 'pushdown',
  meadows_row: 'db_row', rack_pull: 'hinge', inverted_row: 'inv_row', bb_shrug: 'shrug', db_shrug: 'shrug', cable_upright_row: 'upright_row', db_front_raise: 'front_raise', arnold_press: 'db_ohp',
  cable_y_raise: 'cable_raise', cable_egyptian_raise: 'cable_raise', bb_upright_row: 'upright_row', face_pull_press: 'face_pull', bench_dips: 'bench_dip', db_skullcrusher: 'skull', oh_cable_tri_ext: 'oh_ext',
  jm_press: 'skull', tate_press: 'skull', single_arm_cable_curl: 'cable_curl', reverse_bb_curl: 'curl', preacher_curl: 'preacher', incline_hammer_curl: 'db_curl', bayesian_curl: 'cable_curl', spider_curl: 'db_curl',
  farmers_walk: 'carry', box_squat: 'box_squat', zercher_squat: 'front_squat', hack_squat: 'squat', heel_goblet_squat: 'goblet', db_step_up: 'step_up', sissy_squat: 'bw_squat',
  good_morning: 'good_morning', seated_leg_curl: 'leg_curl', nordic_curl: 'nordic', sl_db_rdl: 'db_rdl', ghr: 'nordic', cable_kickback: 'kickback', cable_pull_through: 'pull_through',
  deficit_reverse_lunge: 'lunge', db_sumo_squat: 'goblet', sl_hip_thrust: 'hip_thrust', curtsy_lunge: 'lunge', seated_calf_raise: 'calf', donkey_calf_raise: 'calf', tib_raise: 'tib',
  bicycle_crunch: 'crunch', plank: 'plank', situp: 'situp', side_plank: 'side_plank', pallof_press: 'pallof', captains_chair_raise: 'leg_raise', cable_woodchop: 'chop', russian_twist: 'twist',
  dragon_flag: 'leg_raise', decline_situp: 'situp'
};
const moveOf = ex => ex && MOVES[EX_MOVE[ex.id] || ''] ? EX_MOVE[ex.id] : null;
/* ---------- how each movement is performed ----------
   con 'ba': the lift (concentric) runs from pose b back to a, e.g. a squat stands up from the bottom.
   prone: lying face down. alt: switch legs every rep. mid: an extra pose for the middle of the rep
   (curved paths, e.g. the bench bar path). seq: some joints lead, others follow (deadlift: knees, then hips). */
'squat front_squat goblet bw_squat box_squat lunge split_squat rdl db_rdl good_morning bench incline db_bench fly pushup dip skull bench_dip rollout nordic'.split(' ').forEach(n => MOVES[n].con = 'ba');
'pushup plank side_plank superman leg_curl'.split(' ').forEach(n => MOVES[n].prone = true);
'lunge step_up'.split(' ').forEach(n => MOVES[n].alt = true);
MOVES.hinge.seq = { t: [.32, 1], w: [0, .9] };         // off the floor the knees straighten first, then the hips drive through
MOVES.rdl.seq = MOVES.db_rdl.seq = { t: [0, .85] };    // hips lead, the knees barely change
MOVES.ohp.mid = { w: [[55, 8], [57, 7]], hd: 9 };       // the bar travels around the face, head moves back out of the way
MOVES.db_ohp.mid = { w: [[54, 6], [56, 5]] };
function poseAt(m, k, rep) {
  let A = m.a, B = m.b, M = m.mid || {};
  if (m.alt && rep % 2) { const sw = p => p.f ? Object.assign({}, p, { f: [p.f[1], p.f[0]] }) : p; A = sw(A); B = sw(B); M = sw(M); }
  const kk = ch => { const w = m.seq && m.seq[ch]; if (!w) return k; const x = clamp((k - w[0]) / (w[1] - w[0]), 0, 1); return x * x * (3 - 2 * x); };
  const q = (a, b, mv, x) => mv == null ? lerp(a, b, x) : (1 - x) * (1 - x) * a + 2 * x * (1 - x) * (2 * mv - (a + b) / 2) + x * x * b;
  const q2 = (a, b, mv, x) => [q(a[0], b[0], mv && mv[0], x), q(a[1], b[1], mv && mv[1], x)];
  return {
    h: q2(A.h, B.h, M.h, kk('h')), t: q(A.t, B.t, M.t, kk('t')), hd: q(A.hd || 0, B.hd || 0, M.hd, kk('t')), c: q(A.c || 0, B.c || 0, M.c, kk('t')),
    f: A.f.map((p, i) => q2(p, B.f[i], M.f && M.f[i], kk('f'))), w: A.w.map((p, i) => q2(p, B.w[i], M.w && M.w[i], kk('w'))), kp: A.kp, ep: A.ep
  };
}
/* ---------- drawing: a filled, tapered body with muscle bellies, a real head, hands and shoes ---------- */
const vsub = (p, q) => [p[0] - q[0], p[1] - q[1]], vmul = (p, s) => [p[0] * s, p[1] * s], vdot = (p, q) => p[0] * q[0] + p[1] * q[1];
const vunit = p => { const l = Math.hypot(p[0], p[1]) || .001; return [p[0] / l, p[1] / l]; };
const vnrm = d => [-d[1], d[0]];
const pt = p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
const pl = ps => 'M' + ps.map(pt).join('L');
function bblob(ps) {                                  // smooth closed outline through the points (Catmull-Rom)
  const n = ps.length; let d = 'M' + pt(ps[0]);
  for (let i = 0; i < n; i++) {
    const p0 = ps[(i + n - 1) % n], p1 = ps[i], p2 = ps[(i + 1) % n], p3 = ps[(i + 2) % n];
    d += 'C' + pt(add(p1, vmul(vsub(p2, p0), 1 / 6))) + ' ' + pt(vsub(p2, vmul(vsub(p3, p1), 1 / 6))) + ' ' + pt(p2);
  }
  return d + 'Z';
}
function bseg(p, q, r1, r2, bA, bB, at) {            // limb p→q: end radii, muscle belly on each side at fraction `at`
  const v = vsub(q, p), d = vunit(v), n = vnrm(d), m = add(p, vmul(v, at));
  return bblob([add(p, vmul(n, r1)), add(m, vmul(n, bA)), add(q, vmul(n, r2)), add(q, vmul(d, r2 * .9)), vsub(q, vmul(n, r2)), vsub(m, vmul(n, bB)), vsub(p, vmul(n, r1)), vsub(p, vmul(d, r1 * .9))]);
}
function bshoe(A, T, K) {                             // ankle → toe; the sole is on the side away from the knee
  const v = vsub(T, A), L = Math.hypot(v[0], v[1]) || 1, u = vunit(v); let s = vnrm(u); if (vdot(s, vsub(K, A)) > 0) s = vmul(s, -1);
  const Q = (a, b) => add(A, add(vmul(u, a), vmul(s, b)));
  return bblob([Q(-1.2, -1.3), Q(-2.1, .5), Q(-1.5, 1.6), Q(L * .45, 1.7), Q(L + .6, 1.45), Q(L + .9, .3), Q(L * .62, -.8), Q(1.2, -1.6)]);
}
function legPath(L, toe) {                           // thigh with quads/hamstrings, shin with the calf at the back
  const [H, K, A] = L, n = vnrm(vunit(vsub(A, K))), back = vdot(n, vsub(toe, A)) < 0;
  return bseg(H, K, 3.7, 2.55, 4.15, 3.9, .36) + bseg(K, A, 2.5, 1.45, back ? 3.35 : 2.35, back ? 2.35 : 3.35, .3) + bshoe(A, toe, K);
}
function armPath(R) {                                // deltoid/biceps, tapered forearm, fist
  const [S, E, W] = R, d = vunit(vsub(W, E)), F = add(W, vmul(d, .9));
  return bseg(S, E, 2.85, 1.9, 2.85, 2.75, .36) + bseg(E, W, 2.1, 1.3, 2.4, 2.25, .26) + `M${pt(add(F, [1.75, 0]))}a1.75 1.75 0 1 0 -3.5 0a1.75 1.75 0 1 0 3.5 0Z`;
}
function torsoPath(H, S, nf, c, br) {                // glutes, lower back curve, upper back; belly and chest in front
  const M = add(vmul(add(H, S), .5), vmul(nf, -c));
  const at = f => { const a = (1 - f) * (1 - f), b = 2 * f * (1 - f), e = f * f; return [a * H[0] + b * M[0] + e * S[0], a * H[1] + b * M[1] + e * S[1]]; };
  const side = f => { const g = clamp(f, 0, 1), n = vnrm(vunit(add(vmul(vsub(M, H), 2 * (1 - g)), vmul(vsub(S, M), 2 * g)))); return vdot(n, nf) >= 0 ? n : vmul(n, -1); };
  const o = (f, off) => add(at(f), vmul(side(f), off)), ch = 1 + br * .045;
  return bblob([o(1.05, 1.6), o(.92, 3.5 * ch), o(.76, 4.75 * ch), o(.56, 3.75), o(.34, 3.75), o(.13, 3.95), o(-.05, 2.7),
    o(-.1, -1.9), o(.01, -4.8), o(.2, -4.15), o(.42, -3.35), o(.64, -3.95), o(.86, -4.1), o(1.03, -2.5)]);
}
function headPath(C, up, fw) {                       // cranium, nape, jaw and chin so the face reads
  const Q = (a, b) => add(C, add(vmul(up, a), vmul(fw, b)));
  return bblob([Q(5.5, .2), Q(3.9, -3.9), Q(.2, -5.2), Q(-3, -3.3), Q(-4.6, .4), Q(-5.2, 2.3), Q(-3.6, 4.3), Q(.4, 5.2), Q(3.7, 3.7)]);
}
/* each body part is drawn twice: a tile-coloured outline underneath, then the fill. Segments of one part merge
   seamlessly; a part in front (an arm across the torso) keeps a thin edge. */
const part = (d, cls) => `<path class="ol" d="${d}"/>` + d.split(/(?<=Z)/).map(x => `<path class="${cls}" d="${x}"/>`).join('');
function frontFig(k, m, br) {                        // facing the viewer (lateral raises)
  const a = lerp(m.fa[0], m.fa[1], k), cx = 50, hipY = 52.8, shY = 24, ch = 1 + br * .03;
  let s = `<path class="fl" d="M10 ${AN.floor}H90"/><ellipse class="shd" cx="${cx}" cy="${AN.floor}" rx="13" ry="1.5"/>`;
  [-1, 1].forEach(g => {
    const Hh = [cx + g * 3.7, hipY + 1], K = [cx + g * 4.3, 72.4], A = [cx + g * 4.7, FLR];
    const fx = cx + g * 5.3, fy = AN.floor - 1.3;
    s += part(bseg(Hh, K, 3.8, 2.6, 4.2, 3.7, .36) + bseg(K, A, 2.5, 1.5, 3, 2.7, .3) + `M${(fx + 2.7).toFixed(1)} ${fy}a2.7 1.5 0 1 0 -5.4 0a2.7 1.5 0 1 0 5.4 0Z`, 'bn');
  });
  const R = [[2.6, shY - 2], [8.8, shY + .6], [8.6 * ch, shY + 6.5], [6.3, shY + 15.5], [5.5, shY + 21.5], [6.7, hipY - 1.5], [5.8, hipY + 3.4], [1.5, hipY + 4.6]];
  s += part(bblob([...R, ...R.slice().reverse().map(([x, y]) => [-x, y])].map(([x, y]) => [cx + x, y])) + bseg([cx, shY], [cx, shY - 6], 2.3, 2.1, 2.3, 2.3, .5)
    + bblob([[0, 5.9], [3.9, 4.6], [5, .6], [4.2, -3.6], [1.8, -5.6], [-1.8, -5.6], [-4.2, -3.6], [-5, .6], [-3.9, 4.6]].map(([x, y]) => [cx + x, shY - 10.2 - y])), 'bn');
  [-1, 1].forEach(g => {
    const S = [cx + g * 7.4, shY + 1.6], E = add(S, [Math.sin(a * Math.PI / 180) * AN.ua * g, Math.cos(a * Math.PI / 180) * AN.ua]), W = add(E, [Math.sin((a + 14) * Math.PI / 180) * AN.fa * g, Math.cos((a + 14) * Math.PI / 180) * AN.fa]);
    s += part(armPath([S, E, W]), 'bn');
    if (m.cable) s += `<path class="cb" d="${pl([[cx - g * 6, AN.floor - 1], W])}"/>`; else s += `<circle class="db" cx="${W[0].toFixed(1)}" cy="${W[1].toFixed(1)}" r="3.3"/>`;
  });
  return s;
}
function figMarkup(name, k, rep, br) {
  const m = MOVES[name]; if (!m) return ''; br = br || 0;
  if (m.front) return frontFig(k, { fa: name === 'cable_raise' ? [10, 80] : [8, 84], cable: name === 'cable_raise' }, br);
  const P0 = poseAt(m, k, rep || 0), J = solve(P0), lift = m.shrug ? lerp(0, 3.4, k) : 0;
  if (lift) { J.S = [J.S[0], J.S[1] - lift]; J.head = [J.head[0], J.head[1] - lift * .4]; J.arms.forEach(a => { a[0] = J.S; a[1] = [a[1][0], a[1][1] - lift]; a[2] = [a[2][0], a[2][1] - lift]; }); }
  const at = w => w === 'w0' ? J.arms[0][2] : w === 'f0' ? J.legs[0][2] : w === 'f1' ? J.legs[1][2] : w === 'hip' ? add(P0.h, v2(P0.t + 90, 6)) : w === 'back' ? add(add(J.S, v2(J.t, -2.5)), v2(J.t + 90, 4.5)) : w === 'front' ? add(add(J.S, v2(J.t, -2)), v2(J.t - 90, 5.5)) : J.arms[0][2];
  const foot = (leg) => {
    const A = leg[2];
    if (m.toe === true) return [A, [A[0] + 6.6, AN.floor - .6]];
    if (m.toe === 'push') return [A, [A[0] + 1.5, AN.floor]];
    if (m.toe === 'tib') { const up = lerp(0, 1, k); return [A, [A[0] + 6.6, AN.floor - .6 - up * 4.2]]; }
    if (m.kneel === 'nordic') return [A, [A[0] - 6, A[1] + 1]];
    if (m.kneel) return [A, [A[0] - 5.5, AN.floor - .4]];
    if (m.nofloor || m.legs === 'hang') return [A, [A[0] + 2, A[1] + 6]];
    const lying = Math.abs(J.t) < 140 && J.t < 0 && A[1] < AN.floor - 4;  // feet in the air (leg curl / press)
    return lying ? [A, add(A, v2(J.t > -100 ? 160 : 120, 6))] : [A, [A[0] + 6.6, A[1] + .2]];
  };
  let back = '', front = '';
  (m.pr || []).forEach(p => {
    if (p.k === 'bench') back += `<rect class="eq" x="${p.x}" y="${p.y}" width="${p.w}" height="3.2" rx="1.4"/><path class="eqd" d="M${p.x + 4} ${p.y + 3}V${AN.floor}M${p.x + p.w - 4} ${p.y + 3}V${AN.floor}"/>`;
    else if (p.k === 'incline') back += `<path class="eqw" d="M${p.x1} ${p.y1}L${p.x2} ${p.y2}"/><path class="eqd" d="M${p.x2 - 4} ${p.y2}V${AN.floor}M${(p.x1 + p.x2) / 2} ${(p.y1 + p.y2) / 2 + 2}V${AN.floor}"/>`;
    else if (p.k === 'box') back += `<rect class="eq" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="1.6"/>`;
    else if (p.k === 'block') back += `<rect class="eqd2" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="1"/>`;
    else if (p.k === 'seat') back += `<rect class="eq" x="${p.x}" y="${p.y}" width="${p.w}" height="3.4" rx="1.4"/><path class="eqd" d="M${p.x + p.w / 2} ${p.y + 3}V${AN.floor}"/>`;
    else if (p.k === 'seatback') back += `<path class="eqw" d="M${p.x1} ${p.y1}L${p.x2} ${p.y2}"/><path class="eqd" d="M${p.x2} ${p.y2}V${AN.floor}"/>`;
    else if (p.k === 'hibar') back += `<path class="eqw" d="M${p.x1 ?? 26} ${p.y}H${p.x2 ?? 74}"/>${p.x1 == null ? `<path class="eqd" d="M28 ${p.y}V${AN.floor}M72 ${p.y}V${AN.floor}"/>` : `<path class="eqd" d="M${p.x1 + 2} ${p.y}V${AN.floor}"/>`}`;
    else if (p.k === 'bars') back += `<path class="eqw" d="M30 ${p.y}H70"/><path class="eqd" d="M34 ${p.y}V${AN.floor}M66 ${p.y}V${AN.floor}"/>`;
    else if (p.k === 'post') back += `<path class="eqd" d="M${p.x} ${p.y1}V${p.y2}"/>`;
    else if (p.k === 'cable') { const H = at(p.at || 'w0'); back += `<circle class="pul" cx="${p.from[0]}" cy="${p.from[1]}" r="2.2"/>`; front += `<path class="cb" d="${pl([p.from, H])}"/>`; }
    else if (p.k === 'bar') { const c = at(p.at); front += `<circle class="pl" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${p.r}"/><circle class="plh" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="1.6"/>`; }
    else if (p.k === 'db') { const c = at(p.at); front += `<circle class="db" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${p.r}"/>`; }
    else if (p.k === 'wheel') { const c = at('w0'); front += `<circle class="pl" cx="${c[0].toFixed(1)}" cy="${(AN.floor - 6).toFixed(1)}" r="6"/>`; }
    else if (p.k === 'sled') { const A = J.legs[0][2], dx = A[0] - P0.h[0], dy = A[1] - P0.h[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * 9, ny = dx / L * 9, o = [A[0] + dx / L * 3, A[1] + dy / L * 3]; front += `<path class="eqw" d="M${(o[0] - nx).toFixed(1)} ${(o[1] - ny).toFixed(1)}L${(o[0] + nx).toFixed(1)} ${(o[1] + ny).toFixed(1)}"/>`; }
    else if (p.k === 'pad') { const A = at(p.at); front += `<circle class="pad" cx="${A[0].toFixed(1)}" cy="${A[1].toFixed(1)}" r="3"/>`; }
  });
  const fs = m.prone ? -1 : 1, nf = vmul(v2(J.t - 90, 1), fs), ha = J.t + (P0.hd || 0) + (J.t > 90 && J.t < 200 ? (180 - J.t) * .3 : 0), hup = v2(ha, 1), hfw = vmul(v2(ha - 90, 1), fs);
  const HC = add(add(J.S, vmul(hup, AN.neck + AN.head)), vmul(hfw, .5));
  let s = '';
  if (!m.nofloor) {                                    // floor line and a soft contact shadow under whatever touches it
    const xs = [...J.legs.map(l => l[2]), ...J.arms.map(a => a[2]), P0.h].filter(p => p[1] > AN.floor - 14).map(p => p[0]);
    const x0 = xs.length ? Math.min(...xs) : P0.h[0], x1 = xs.length ? Math.max(...xs) : P0.h[0];
    s += `<path class="fl" d="M4 ${AN.floor}H96"/><ellipse class="shd" cx="${((x0 + x1) / 2 + 2).toFixed(1)}" cy="${AN.floor}" rx="${((x1 - x0) / 2 + 9).toFixed(1)}" ry="1.6"/>`;
  }
  s += back;
  s += part(legPath(J.legs[1], foot(J.legs[1])[1]) + armPath(J.arms[1]), 'bf');
  s += part(torsoPath(P0.h, J.S, nf, P0.c || 0, br) + bseg(add(J.S, vmul(hup, 1)), HC, 2.1, 2, 2.2, 2.2, .5) + headPath(HC, hup, hfw), 'bn');
  s += part(legPath(J.legs[0], foot(J.legs[0])[1]), 'bn') + part(armPath(J.arms[0]), 'bn');
  return s + front;
}
/* timing, like a real rep: pause at the top, lower under control, brief pause, drive back up */
function animK(m, t) {
  const n = t / (m.d * 1150), rep = Math.floor(n), c = n - rep;
  if (m.breathe) return [.5 - .5 * Math.cos(c * 2 * Math.PI), rep];
  if (m.nohold) return [(1 - Math.cos(2 * Math.PI * c)) / 2, rep];
  const L = .17, E = .44, B = .05, C = 1 - L - E - B;
  const lower = x => (1 - Math.cos(Math.PI * x)) / 2, drive = x => { const u = Math.pow(x, .72); return u * u * (3 - 2 * u); };
  const x = c < L ? 1 : c < L + E ? 1 - lower((c - L) / E) : c < L + E + B ? 0 : drive((c - L - E - B) / C);
  return [m.con === 'ba' ? 1 - x : x, rep];
}
function figSvg(ex, cls) {
  const mv = moveOf(ex); if (!mv) return '';
  return `<svg class="anim ${cls || ''}" viewBox="${MOVES[mv].vb || '0 -14 100 110'}" data-mv="${mv}" aria-hidden="true">${figMarkup(mv, 0)}</svg>`;
}
/* small tiles zoom in on the figure: union of its outline across the whole movement, floor kept in view */
const FIT = {};
function fitBox(el, mv) {
  const r = el.getBoundingClientRect(), asp = r.width / r.height, key = mv + '|' + asp.toFixed(2);
  if (!FIT[key]) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    [0, .25, .5, .75, 1].forEach(k => {
      el.innerHTML = figMarkup(mv, k);
      el.querySelectorAll(':scope > :not(.fl):not(.shd)').forEach(c => { try { const b = c.getBBox(); if (!b.width && !b.height) return; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); } catch (e) { } });
    });
    if (x0 > x1) { FIT[key] = MOVES[mv].vb || '0 -14 100 110'; } else {
      const fl = MOVES[mv].nofloor ? y1 : Math.max(y1, AN.floor);
      let w = x1 - x0 + 10, h = fl - y0 + 10; const cx = (x0 + x1) / 2;
      if (w / h < asp) w = h * asp; else h = w / asp;
      if (h < 46) { h = 46; w = h * asp; }
      FIT[key] = [cx - w / 2, fl + 5 - h, w, h].map(v => +v.toFixed(1)).join(' ');
    }
  }
  el.setAttribute('viewBox', FIT[key]); el.dataset.fit = '1';
}
(function () {                                       // one loop animates every figure that's on screen
  let last = 0;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  function frame(t) {
    requestAnimationFrame(frame);
    if (document.hidden || t - last < 33) return; last = t;
    const els = document.querySelectorAll('svg.anim[data-mv]'); if (!els.length) return;
    const H = innerHeight;
    els.forEach(el => {
      const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > H) return;
      const mv = el.dataset.mv, m = MOVES[mv];
      if (!el.dataset.fit && el.closest('.thumb:not(.lg),.vfig')) fitBox(el, mv);
      if (still.matches) { if (el.dataset.st !== '1') { el.innerHTML = figMarkup(mv, 1); el.dataset.st = '1'; } return; }
      if (el.dataset.off == null) el.dataset.off = (Math.random() * 6000) | 0;   // figures don't move in lockstep
      const [k, rep] = animK(m, t + +el.dataset.off);
      el.innerHTML = figMarkup(mv, k, rep, Math.sin(t / 3800 * 2 * Math.PI));
    });
  }
  requestAnimationFrame(frame);
})();
