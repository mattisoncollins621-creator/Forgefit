/* ---------- animated exercise figures (original line drawings, no video, works offline) ----------
   A side-view figure is posed by its hip, torso angle, foot and hand positions; knees and elbows are
   solved like real joints (two-bone IK). Each movement pattern is two poses (start, end) played as a
   loop with short holds. Angles: 0 = straight down, 90 = forward (facing right), 180 = straight up. */
const AN = { torso: 29, ua: 15, fa: 14, th: 20, sh: 19, head: 6.4, neck: 4, floor: 92 };
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
function mix(A, B, k) {
  const m = (a, b) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  return { h: m(A.h, B.h), t: lerp(A.t, B.t, k), hd: lerp(A.hd || 0, B.hd || 0, k), f: A.f.map((p, i) => m(p, B.f[i])), w: A.w.map((p, i) => m(p, B.w[i])), kp: A.kp, ep: A.ep };
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
  glute_bridge: { d: 2.4, a: P({ h: [54, 86], t: -90, f: [[76, FLR], [78, FLR]], w: [[40, 90], [42, 90]], kp: [0, -1] }), b: P({ h: [54, 76], t: -68, f: [[76, FLR], [78, FLR]], w: [[40, 90], [42, 90]], kp: [0, -1] }) },
  leg_press: { d: 2.6, a: P({ h: [34, 72], t: -135, f: [[50, 49], [52, 48]], w: [[32, 74], [33, 74]], kp: [-.3, -1] }), b: P({ h: [34, 72], t: -135, f: [[58, 42], [60, 41]], w: [[32, 74], [33, 74]], kp: [-.3, -1] }), pr: [{ k: 'sled', at: 'f0' }, { k: 'seatback', x1: 6, y1: 46, x2: 36, y2: 76 }] },
  leg_ext: { d: 2.4, a: P({ h: [36, 64], t: 172, f: [[54, 84], [56, 84]], w: [[40, 70], [42, 70]], kp: [1, -.4] }), b: P({ h: [36, 64], t: 172, f: [[74, 62], [76, 61]], w: [[40, 70], [42, 70]], kp: [1, -.4] }), pr: [{ k: 'seat', x: 22, y: 66, w: 22 }, { k: 'pad', at: 'f0' }] },
  leg_curl: { d: 2.4, a: P({ h: [52, 62], t: -90, f: [[90, 63], [91, 62]], w: [[18, 66], [19, 66]], kp: [0, 1] }), b: P({ h: [52, 62], t: -90, f: [[76, 44], [77, 43]], w: [[18, 66], [19, 66]], kp: [0, 1] }), pr: [{ k: 'bench', x: 8, y: 66, w: 64 }, { k: 'pad', at: 'f0' }] },
  calf: { d: 1.8, a: P({ h: [46, 52.8], t: 180, f: [[47, FLR], [49, FLR]], w: [[46, 66], [48, 65]] }), b: P({ h: [46, 48], t: 180, f: [[47, FLR - 4.6], [49, FLR - 4.6]], w: [[46, 61], [48, 60]] }), pr: [{ k: 'db', at: 'w0', r: 3.6 }], toe: true },
  bench: { d: 2.4, a: P({ h: [56, 60], t: -90, f: [[72, FLR], [70, FLR]], w: [[31, 33], [32, 32]], ep: [0, 1] }), b: P({ h: [56, 60], t: -90, f: [[72, FLR], [70, FLR]], w: [[31, 52], [32, 51]], ep: [0, 1] }), pr: [{ k: 'bar', at: 'w0', r: 8 }, { k: 'bench', x: 14, y: 63, w: 50 }] },
  incline: { d: 2.4, a: P({ h: [56, 64], t: -124, f: [[72, FLR], [70, FLR]], w: [[36, 22], [37, 21]], ep: [0, 1] }), b: P({ h: [56, 64], t: -124, f: [[72, FLR], [70, FLR]], w: [[34, 42], [35, 41]], ep: [0, 1] }), pr: [{ k: 'bar', at: 'w0', r: 8 }, { k: 'incline', x1: 18, y1: 36, x2: 58, y2: 68 }] },
  db_bench: { d: 2.4, a: P({ h: [56, 60], t: -90, f: [[72, FLR], [70, FLR]], w: [[33, 33], [34, 32]], ep: [0, 1] }), b: P({ h: [56, 60], t: -90, f: [[72, FLR], [70, FLR]], w: [[33, 52], [34, 51]], ep: [0, 1] }), pr: [{ k: 'db', at: 'w0', r: 4 }, { k: 'bench', x: 14, y: 63, w: 50 }] },
  fly: { d: 2.6, a: P({ h: [56, 60], t: -90, f: [[72, FLR], [70, FLR]], w: [[33, 33], [34, 32]], ep: [0, 1] }), b: P({ h: [56, 60], t: -90, f: [[72, FLR], [70, FLR]], w: [[33, 58], [34, 57]], ep: [-.2, 1] }), pr: [{ k: 'db', at: 'w0', r: 4 }, { k: 'bench', x: 14, y: 63, w: 50 }] },
  pushup: { d: 2.2, a: P({ h: [50.4, 74.7], t: -114, f: [[86, FLR - .6], [88, FLR - 1]], w: [[24, AN.floor], [26, AN.floor - .5]], ep: [1, -.4] }), b: P({ h: [47.3, 85.6], t: -97, f: [[86, FLR - .6], [88, FLR - 1]], w: [[24, AN.floor], [26, AN.floor - .5]], ep: [1, -.4] }), toe: 'push' },
  dip: { d: 2.4, a: P({ h: [46, 54], t: 178, f: [[38, 84], [40, 84]], w: [[47, 54], [49, 53]], ep: [-1, 0], kp: [1, 0] }), b: P({ h: [42, 72], t: 165, f: [[34, 95], [36, 95]], w: [[48, 54], [50, 53]], ep: [-1, 0], kp: [1, 0] }), pr: [{ k: 'bars', y: 54 }], nofloor: true },
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
  skull: { d: 2.4, a: P({ h: [56, 60], t: -90, f: [[72, FLR], [70, FLR]], w: [[33, 33], [34, 32]], ep: [0, 1] }), b: P({ h: [56, 60], t: -90, f: [[72, FLR], [70, FLR]], w: [[19, 46], [20, 45]], ep: [1, -1] }), pr: [{ k: 'bar', at: 'w0', r: 7.5 }, { k: 'bench', x: 14, y: 63, w: 50 }] },
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
  nordic: { d: 3, a: P({ h: [46, 58], t: 180, f: [[20, 88], [22, 88]], w: [[50, 60], [52, 59]], kp: [0, 1], ep: [1, 1] }), b: P({ h: [46, 58], t: 118, f: [[20, 88], [22, 88]], w: [[72, 70], [74, 69]], kp: [0, 1], ep: [1, 1] }), kneel: 'nordic', pr: [{ k: 'pad', at: 'f0' }] },
  superman: { d: 2.4, a: P({ h: [52, 86], t: -90, f: [[90, 88], [92, 88]], w: [[10, 88], [12, 88]] }), b: P({ h: [52, 86], t: -104, f: [[88, 80], [90, 80]], w: [[12, 74], [14, 74]] }) },
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
/* ---------- drawing ---------- */
const pt = p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
const pl = ps => 'M' + ps.map(pt).join('L');
function frontFig(k, m) {                            // facing the viewer (lateral raises)
  const a = lerp(m.fa[0], m.fa[1], k), cx = 50, hipY = 52.8, shY = 24, sw = 9;
  let s = `<path class="fl" d="M10 ${AN.floor}H90"/>`;
  s += `<path class="lg" d="${pl([[cx - 4, hipY], [cx - 5, 72], [cx - 5, FLR]])}"/><path class="lg" d="${pl([[cx + 4, hipY], [cx + 5, 72], [cx + 5, FLR]])}"/>`;
  s += `<path class="tr" d="${pl([[cx, hipY], [cx, shY]])}"/><path class="tr" d="${pl([[cx - sw, shY], [cx + sw, shY]])}"/><circle class="hd" cx="${cx}" cy="${shY - 10.6}" r="${AN.head}"/>`;
  [-1, 1].forEach(sg => {
    const S = [cx + sg * sw, shY], E = add(S, [Math.sin(a * Math.PI / 180) * AN.ua * sg, Math.cos(a * Math.PI / 180) * AN.ua]), W = add(E, [Math.sin((a + 14) * Math.PI / 180) * AN.fa * sg, Math.cos((a + 14) * Math.PI / 180) * AN.fa]);
    s += `<path class="ar" d="${pl([S, E, W])}"/>`;
    if (m.cable) s += `<path class="cb" d="${pl([[cx - sg * 6, AN.floor - 1], W])}"/>`; else s += `<circle class="db" cx="${W[0].toFixed(1)}" cy="${W[1].toFixed(1)}" r="3.2"/>`;
  });
  return s;
}
function figMarkup(name, k) {
  const m = MOVES[name]; if (!m) return '';
  if (m.front) return frontFig(k, { fa: name === 'cable_raise' ? [10, 80] : [8, 84], cable: name === 'cable_raise' });
  const P0 = mix(m.a, m.b, k), J = solve(P0), lift = m.shrug ? lerp(0, 3.4, k) : 0;
  if (lift) { J.S = [J.S[0], J.S[1] - lift]; J.head = [J.head[0], J.head[1] - lift * .4]; J.arms.forEach(a => { a[0] = J.S; a[1] = [a[1][0], a[1][1] - lift]; a[2] = [a[2][0], a[2][1] - lift]; }); }
  const at = w => w === 'w0' ? J.arms[0][2] : w === 'f0' ? J.legs[0][2] : w === 'f1' ? J.legs[1][2] : w === 'hip' ? add(P0.h, v2(P0.t + 90, 6)) : w === 'back' ? add(add(J.S, v2(J.t, -2.5)), v2(J.t + 90, 4.5)) : w === 'front' ? add(add(J.S, v2(J.t, -2)), v2(J.t - 90, 5.5)) : J.arms[0][2];
  const foot = (leg, far) => {
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
  const limb = (pts, cls) => `<path class="${cls}" d="${pl(pts)}"/>`;
  let s = m.nofloor ? '' : `<path class="fl" d="M4 ${AN.floor}H96"/>`;
  s += back;
  s += limb([...J.legs[1], foot(J.legs[1])[1]], 'lg far') + limb(J.arms[1], 'ar far');
  s += limb([P0.h, J.S], 'tr') + `<circle class="hd" cx="${J.head[0].toFixed(1)}" cy="${J.head[1].toFixed(1)}" r="${AN.head}"/>`;
  s += limb([...J.legs[0], foot(J.legs[0])[1]], 'lg') + limb(J.arms[0], 'ar');
  return s + front;
}
/* timing: hold at the start, move, hold at the end, come back */
function animK(m, t) {
  const c = (t / (m.d * 1000)) % 1, e = x => (1 - Math.cos(Math.PI * x)) / 2;
  if (m.nohold || m.breathe) return m.breathe ? .5 - .5 * Math.cos(c * 2 * Math.PI) : e(c < .5 ? c * 2 : 2 - c * 2);
  return c < .12 ? 0 : c < .5 ? e((c - .12) / .38) : c < .62 ? 1 : e(1 - (c - .62) / .38);
}
function figSvg(ex, cls) {
  const mv = moveOf(ex); if (!mv) return '';
  return `<svg class="anim ${cls || ''}" viewBox="0 -14 100 110" data-mv="${mv}" aria-hidden="true">${figMarkup(mv, 0)}</svg>`;
}
/* small tiles zoom in on the figure: union of its outline across the whole movement, floor kept in view */
const FIT = {};
function fitBox(el, mv) {
  const r = el.getBoundingClientRect(), asp = r.width / r.height, key = mv + '|' + asp.toFixed(2);
  if (!FIT[key]) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    [0, .25, .5, .75, 1].forEach(k => {
      el.innerHTML = figMarkup(mv, k);
      el.querySelectorAll(':scope > :not(.fl)').forEach(c => { try { const b = c.getBBox(); if (!b.width && !b.height) return; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); } catch (e) { } });
    });
    if (x0 > x1) { FIT[key] = '0 -14 100 110'; } else {
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
      el.innerHTML = figMarkup(mv, animK(m, t + (+el.dataset.off || 0)));
    });
  }
  requestAnimationFrame(frame);
})();
