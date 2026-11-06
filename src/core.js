'use strict';
/* =====================================================================
   ForgeFit core: data, state, persistence, audio/haptics, timers
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KG = 0.45359237;
const DAY = 864e5;
const fmtDate = (t, o) => new Date(t).toLocaleDateString('en-US', o || { month: 'short', day: 'numeric' });
const fmtDT = t => fmtDate(t) + ' ' + new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const sod = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const ymd = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const APP_VER = '__APP_VER__';   // filled in by build.py from sw.js so the two can never disagree
const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- exercise database ---------- */
const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Biceps', 'Triceps', 'Core'];
const SPLIT_OF = {
  Chest: 'push upper full', Shoulders: 'push upper full', Triceps: 'push upper full',
  Back: 'pull upper full', Biceps: 'pull upper full',
  Quads: 'legs lower full', Hamstrings: 'legs lower full', Glutes: 'legs lower full', Calves: 'legs lower full',
  Core: 'push pull legs upper lower full'
};
const TEMPO_DEF = { compound: '2-0-1-0', isolation: '2-1-1-1', bodyweight: '2-0-1-0' };
const X = (id, name, primary, secondary, split, gear, orm, reps, sets, type, cue, o = {}) => ({
  id, name, primary, secondary, split: split.split(' '), gear: gear ? gear.split(' ') : [],
  default1RM: orm, reps, sets, type, cue, tempo: TEMPO_DEF[type] || '2-0-1-0', ...o
});
const BASE_EX = [
  // Chest
  X('bb_bench', 'Barbell Bench Press', 'Chest', ['Triceps', 'Shoulders'], 'push upper full', 'Barbell Bench', 235, 8, 4, 'compound', 'Pin shoulder blades back, touch lower chest, drive through your feet.', { alias: 'flat bench' }),
  X('incline_bb_bench', 'Incline Barbell Bench', 'Chest', ['Shoulders', 'Triceps'], 'push upper full', 'Barbell Bench', 195, 8, 3, 'compound', 'Bench at ~30°, bar to upper chest, elbows about 45° from torso.'),
  X('db_press', 'Dumbbell Flat Press (Total)', 'Chest', ['Triceps'], 'push upper full', 'Dumbbells Bench', 170, 10, 3, 'compound', 'Deep controlled stretch, press up and slightly in. Weight = both dumbbells combined.'),
  X('incline_db_press', 'Incline Dumbbell Press (Total)', 'Chest', ['Shoulders', 'Triceps'], 'push upper full', 'Dumbbells Bench', 150, 10, 3, 'compound', 'Bench ~30°, keep wrists stacked over elbows. Weight = both dumbbells.'),
  X('machine_chest_press', 'Machine Chest Press', 'Chest', ['Triceps', 'Shoulders'], 'push upper full', 'Machines', 200, 10, 3, 'compound', 'Handles level with mid-chest, shoulders down and back.'),
  X('cable_fly', 'Cable Chest Fly', 'Chest', [], 'push upper', 'Cables', 90, 12, 3, 'isolation', 'Soft elbows, hug a big tree, squeeze in the middle.'),
  X('pushups', 'Weighted / Deficit Push-Ups', 'Chest', ['Triceps', 'Core'], 'push upper full', 'Bodyweight', 0, 15, 3, 'bodyweight', 'Rigid plank, chest to floor, elbows ~45°. Weight = added load.', { bw: .64, seedReps: [10, 20, 30] }),
  X('dips', 'Dips (Bars / Chairs)', 'Chest', ['Triceps', 'Shoulders'], 'push upper', 'Bodyweight', 0, 10, 3, 'bodyweight', 'Lean slightly forward, lower until shoulders dip below elbows.', { bw: 1, seedReps: [3, 8, 14] }),
  // Shoulders
  X('ohp', 'Barbell Overhead Press', 'Shoulders', ['Triceps', 'Core'], 'push upper full', 'Barbell', 145, 8, 4, 'compound', 'Squeeze glutes, ribs down, press in a straight line, head through at the top.', { alias: 'overhead press' }),
  X('db_shoulder_press', 'Dumbbell Shoulder Press (Total)', 'Shoulders', ['Triceps'], 'push upper full', 'Dumbbells', 110, 10, 3, 'compound', 'Forearms vertical, press without flaring the ribs. Weight = both dumbbells.'),
  X('db_lat_raise', 'Dumbbell Lateral Raises (Total)', 'Shoulders', [], 'push upper', 'Dumbbells', 60, 12, 3, 'isolation', 'Lead with elbows, stop at shoulder height, no swinging.', { alias: 'lateral raise' }),
  X('cable_lat_raise', 'Cable Lateral Raise', 'Shoulders', [], 'push upper', 'Cables', 40, 12, 3, 'isolation', 'Constant tension, slow negative.'),
  X('landmine_press', 'Single-Arm Barbell Jammer Press', 'Shoulders', ['Chest', 'Core'], 'push upper', 'Barbell', 115, 10, 3, 'compound', 'Press up and forward along the arc, ribs stacked.'),
  X('face_pull', 'Cable Face Pull', 'Shoulders', ['Back'], 'pull upper', 'Cables', 70, 15, 3, 'isolation', 'Rope to eye level, pull apart, externally rotate at the end.'),
  X('rear_delt_fly', 'Rear Delt Fly (Total)', 'Shoulders', ['Back'], 'pull upper', 'Dumbbells', 40, 15, 3, 'isolation', 'Hinge, soft elbows, sweep wide.'),
  // Back
  X('bb_row', 'Barbell Bent-Over Row', 'Back', ['Biceps', 'Hamstrings'], 'pull upper full', 'Barbell', 205, 8, 4, 'compound', 'Hinge to ~45°, pull to lower ribs, keep spine neutral.', { alias: 'row' }),
  X('pendlay_row', 'Pendlay Row', 'Back', ['Biceps'], 'pull upper', 'Barbell', 195, 8, 3, 'compound', 'Dead-stop each rep on the floor, torso parallel.'),
  X('pullups', 'Pull-Ups / Chin-Ups (Added Wt)', 'Back', ['Biceps', 'Core'], 'pull upper full', 'PullupBar', 0, 8, 3, 'bodyweight', 'Start from a dead hang, chest to bar, control the descent. Weight = added load.', { bw: 1, seedReps: [3, 8, 13], alias: 'pull up' }),
  X('db_row', 'One-Arm Bench Dumbbell Row', 'Back', ['Biceps'], 'pull upper full', 'Dumbbells Bench', 100, 10, 3, 'compound', 'Pull elbow to hip, avoid twisting. Weight = one dumbbell x2 (total).'),
  X('lat_pulldown', 'Lat Pulldown', 'Back', ['Biceps'], 'pull upper full', 'Cables', 160, 10, 3, 'compound', 'Chest up, pull elbows down to ribs.'),
  X('seated_cable_row', 'Seated Cable Row', 'Back', ['Biceps'], 'pull upper full', 'Cables', 160, 10, 3, 'compound', 'Tall chest, row to navel, pause and squeeze.'),
  X('deadlift', 'Conventional Deadlift', 'Back', ['Hamstrings', 'Glutes', 'Core'], 'pull lower full', 'Barbell', 315, 5, 3, 'compound', 'Bar over midfoot, brace hard, push the floor away.'),
  X('superman', 'Superman / Back Extension', 'Back', ['Glutes'], 'pull full', 'Bodyweight', 0, 15, 3, 'bodyweight', 'Lift chest and legs, pause one second at the top.', { bw: 0, noE1: true }),
  // Quads
  X('bb_squat', 'Barbell Back Squat', 'Quads', ['Hamstrings', 'Glutes', 'Core'], 'legs lower full', 'Barbell', 275, 6, 4, 'compound', 'Brace, knees track over toes, hit depth, drive up.'),
  X('front_squat', 'Barbell Front Squat', 'Quads', ['Core', 'Glutes'], 'legs lower', 'Barbell', 215, 8, 3, 'compound', 'Elbows high, torso upright.'),
  X('bulgarian_split', 'Bulgarian Split Squat', 'Quads', ['Glutes', 'Hamstrings'], 'legs lower', 'Bench Dumbbells', 110, 10, 3, 'compound', 'Torso slightly forward, front shin vertical. Weight = both dumbbells.'),
  X('goblet_squat', 'Goblet Squat', 'Quads', ['Glutes', 'Core'], 'legs lower full', 'Dumbbells', 70, 12, 3, 'compound', 'Elbows inside knees at the bottom, chest tall.'),
  X('leg_press', 'Leg Press', 'Quads', ['Glutes', 'Hamstrings'], 'legs lower', 'Machines', 450, 10, 3, 'compound', 'Feet mid-platform, lower until hips start to tuck, never lock out hard.'),
  X('leg_extension', 'Leg Extension', 'Quads', [], 'legs lower', 'Machines', 150, 12, 3, 'isolation', 'Squeeze the quads at the top, slow lower.'),
  X('walking_lunge', 'Dumbbell Walking Lunge (Total)', 'Quads', ['Glutes', 'Hamstrings'], 'legs lower full', 'Dumbbells', 120, 10, 3, 'compound', 'Long stride, torso upright. Weight = both dumbbells.'),
  X('bw_squat', 'Bodyweight Squat', 'Quads', ['Glutes'], 'legs lower full', 'Bodyweight', 0, 20, 3, 'bodyweight', 'Sit between your hips, keep heels down.', { bw: 0, noE1: true }),
  // Hamstrings / Glutes / Calves
  X('rdl', 'Barbell Romanian Deadlift', 'Hamstrings', ['Back', 'Glutes', 'Core'], 'legs lower pull', 'Barbell', 265, 8, 4, 'compound', 'Hips back, soft knees, bar stays close, feel the hamstring stretch.'),
  X('db_rdl', 'Dumbbell Romanian Deadlift (Total)', 'Hamstrings', ['Glutes', 'Back'], 'legs lower pull', 'Dumbbells', 180, 10, 3, 'compound', 'Hinge, lats tight. Weight = both dumbbells.'),
  X('leg_curl', 'Leg Curl', 'Hamstrings', [], 'legs lower', 'Machines', 120, 12, 3, 'isolation', 'Hips pinned, curl heels to glutes, slow return.'),
  X('bb_hip_thrust', 'Barbell Bench Hip Thrust', 'Glutes', ['Hamstrings', 'Core'], 'legs lower full', 'Barbell Bench', 285, 10, 3, 'compound', 'Chin tucked, ribs down, full lockout, squeeze.'),
  X('glute_bridge', 'Glute Bridge', 'Glutes', ['Hamstrings'], 'legs lower full', 'Bodyweight', 0, 15, 3, 'bodyweight', 'Drive through heels, posterior pelvic tilt at the top.', { bw: 0, noE1: true }),
  X('standing_calf_raise', 'Standing Calf Raise', 'Calves', [], 'legs lower', 'Machines', 250, 12, 4, 'isolation', 'Full stretch at the bottom, pause at the top.', { alias: 'calf raise' }),
  X('db_calf_raise', 'Dumbbell Calf Raise (Total)', 'Calves', [], 'legs lower', 'Dumbbells', 100, 15, 3, 'isolation', 'Slow stretch, hold the top.'),
  X('bw_calf_raise', 'Single-Leg Calf Raise', 'Calves', [], 'legs lower full', 'Bodyweight', 0, 15, 3, 'bodyweight', 'Use a step for full range of motion.', { bw: 0, noE1: true }),
  // Arms
  X('bb_curl', 'Barbell Strict Curl', 'Biceps', [], 'pull upper', 'Barbell', 105, 10, 3, 'isolation', 'Elbows pinned, no swinging.', { alias: 'curl' }),
  X('incline_curl', 'Incline Dumbbell Curl (Total)', 'Biceps', [], 'pull upper', 'Dumbbells Bench', 75, 12, 3, 'isolation', 'Let arms hang back for a deep stretch.'),
  X('hammer_curl', 'Hammer Curl (Total)', 'Biceps', [], 'pull upper', 'Dumbbells', 70, 10, 3, 'isolation', 'Neutral grip, elbows still.'),
  X('cable_curl', 'Cable Curl', 'Biceps', [], 'pull upper', 'Cables', 90, 12, 3, 'isolation', 'Constant tension, squeeze at the top.'),
  X('cgbp', 'Close-Grip Bench Press', 'Triceps', ['Chest', 'Shoulders'], 'push upper', 'Barbell Bench', 195, 8, 3, 'compound', 'Hands shoulder-width, elbows tucked.'),
  X('skullcrusher', 'Barbell Skullcrushers', 'Triceps', [], 'push upper', 'Barbell Bench', 105, 10, 3, 'isolation', 'Lower to forehead, keep upper arms still.', { alias: 'skull crusher' }),
  X('tri_pushdown', 'Cable Triceps Pushdown', 'Triceps', [], 'push upper', 'Cables', 100, 12, 3, 'isolation', 'Elbows pinned, full lockout.', { alias: 'pushdown' }),
  X('oh_tri_ext', 'Overhead Dumbbell Triceps Extension', 'Triceps', [], 'push upper', 'Dumbbells', 60, 12, 3, 'isolation', 'Long-head stretch, elbows pointing forward.'),
  // Core
  X('ab_rollout', 'Barbell Ab Rollout', 'Core', ['Shoulders'], 'push pull legs upper lower full', 'Barbell', 0, 12, 3, 'bodyweight', 'Posterior tilt, roll out only as far as you can keep the pelvis tucked.', { bw: 0, noE1: true }),
  X('hanging_leg_raise', 'Hanging Leg Raise', 'Core', [], 'push pull legs upper lower full', 'PullupBar', 0, 12, 3, 'bodyweight', 'Curl pelvis up, no swinging.', { bw: 0, noE1: true }),
  X('cable_crunch', 'Cable Crunch', 'Core', [], 'push pull legs upper lower full', 'Cables', 100, 15, 3, 'isolation', 'Round the spine, elbows to knees.'),
  X('crunch', 'Crunches', 'Core', [], 'push pull legs upper lower full', 'Bodyweight', 0, 20, 3, 'bodyweight', 'Ribs to hips, slow lower.', { bw: 0, noE1: true }),
  // Chest (added)
  X('decline_bb_bench', "Decline Barbell Bench Press", 'Chest', ['Triceps', 'Shoulders'], 'push upper full', 'Barbell Bench', 245, 8, 3, 'compound', "Lower to the lower chest, shoulder blades pinned, drive up over the shoulders."),
  X('decline_db_press', "Decline Dumbbell Press (Total)", 'Chest', ['Triceps'], 'push upper full', 'Dumbbells Bench', 180, 10, 3, 'compound', "Lower to a stretch at the lower chest, press up and slightly in. Weight = both dumbbells."),
  X('db_chest_fly', "Dumbbell Chest Fly (Total)", 'Chest', ['Shoulders'], 'push upper full', 'Dumbbells Bench', 90, 12, 3, 'isolation', "Wide arc, soft elbows, deep stretch then squeeze. Weight = both dumbbells."),
  X('low_high_cable_fly', "Low-to-High Cable Fly", 'Chest', ['Shoulders'], 'push upper full', 'Cables', 60, 12, 3, 'isolation', "Sweep up and together to chin height, squeeze the upper chest.", { alias: 'incline cable fly' }),
  X('high_low_cable_fly', "High-to-Low Cable Fly", 'Chest', ['Triceps'], 'push upper full', 'Cables', 80, 12, 3, 'isolation', "Sweep down and together toward the hips, squeeze the lower chest.", { alias: 'decline cable fly' }),
  X('floor_press', "Barbell Floor Press", 'Chest', ['Triceps', 'Shoulders'], 'push upper full', 'Barbell', 205, 8, 3, 'compound', "Triceps touch the floor, pause, press. No bench needed."),
  X('landmine_chest_press', "Landmine Chest Press", 'Chest', ['Triceps', 'Shoulders', 'Core'], 'push upper full', 'Barbell', 135, 10, 3, 'compound', "Press up and forward along the arc, ribs down."),

  // Back (added)
  X('tbar_row', "T-Bar Row / Landmine Row", 'Back', ['Biceps', 'Core'], 'pull upper full', 'Barbell', 205, 10, 3, 'compound', "Hinge, flat back, row to the lower chest and squeeze.", { alias: 'landmine row t bar' }),
  X('cs_db_row', "Chest-Supported Dumbbell Row (Total)", 'Back', ['Biceps', 'Shoulders'], 'pull upper full', 'Dumbbells Bench', 110, 10, 3, 'compound', "Chest on the pad, row to the hips, no momentum. Weight = both dumbbells.", { alias: 'incline bench row' }),
  X('straight_arm_pulldown', "Straight-Arm Cable Pulldown", 'Back', ['Core'], 'pull upper full', 'Cables', 80, 12, 3, 'isolation', "Arms straight, sweep the bar to the thighs with your lats."),
  X('meadows_row', "Meadows Row", 'Back', ['Biceps'], 'pull upper full', 'Barbell', 100, 10, 3, 'compound', "Hinge, row the bar to the hip, squeeze, controlled stretch."),
  X('rack_pull', "Rack Pull (Above Knee)", 'Back', ['Glutes', 'Hamstrings'], 'pull lower full', 'Barbell', 365, 5, 3, 'compound', "Bar at the knee, back flat, stand up and lock out."),
  X('inverted_row', "Inverted Bodyweight Row", 'Back', ['Biceps', 'Core'], 'pull upper full', 'Bodyweight', 0, 12, 3, 'bodyweight', "Body in a straight line, pull the chest to the bar. Weight = added load.", { bw: .5, seedReps: [6, 12, 18] }),
  X('bb_shrug', "Barbell Shrug", 'Back', ['Biceps'], 'pull upper full', 'Barbell', 315, 12, 3, 'isolation', "Straight up toward the ears, pause, lower slowly. No rolling."),
  X('db_shrug', "Dumbbell Shrug (Total)", 'Back', ['Biceps'], 'pull upper full', 'Dumbbells', 220, 12, 3, 'isolation', "Straight up, pause, slow lower. Weight = both dumbbells."),

  // Shoulders (added)
  X('cable_upright_row', "Cable Upright Row", 'Shoulders', ['Back', 'Biceps'], 'push upper full', 'Cables', 90, 12, 3, 'isolation', "Lead with the elbows, stop at chest height."),
  X('db_front_raise', "Dumbbell Front Raise (Total)", 'Shoulders', [], 'push upper full', 'Dumbbells', 50, 12, 3, 'isolation', "Raise to shoulder height, no swinging. Weight = both dumbbells."),
  X('arnold_press', "Arnold Press (Total)", 'Shoulders', ['Triceps'], 'push upper full', 'Dumbbells', 100, 10, 3, 'compound', "Rotate the palms forward as you press. Weight = both dumbbells."),
  X('cable_y_raise', "Cable Y-Raise", 'Shoulders', ['Back'], 'push upper full', 'Cables', 30, 12, 3, 'isolation', "Raise up and out into a Y, thumbs up, light and slow."),
  X('cable_egyptian_raise', "Cable Egyptian / Behind-the-Back Lateral Raise", 'Shoulders', [], 'push upper full', 'Cables', 35, 12, 3, 'isolation', "Lean away, raise out to the side, constant tension.", { alias: 'lateral raise cable behind back' }),
  X('bb_upright_row', "Barbell Upright Row", 'Shoulders', ['Back', 'Biceps'], 'push upper full', 'Barbell', 115, 10, 3, 'compound', "Bar close to the body, elbows lead, stop at chest height."),
  X('face_pull_press', "Face Pull to Overhead Press", 'Shoulders', ['Back'], 'pull upper', 'Cables', 50, 12, 3, 'isolation', "Pull to the face, rotate up, press overhead. Light and smooth."),

  // Triceps (added)
  X('bench_dips', "Bench Dips", 'Triceps', ['Chest', 'Shoulders'], 'push upper full', 'Bench Bodyweight', 0, 12, 3, 'bodyweight', "Hands on the bench, lower to 90 degrees, press. Weight = added load.", { bw: .55, seedReps: [8, 15, 22] }),
  X('db_skullcrusher', "Dumbbell Skullcrushers (Total)", 'Triceps', [], 'push upper full', 'Dumbbells Bench', 90, 10, 3, 'isolation', "Elbows still, lower beside the head. Weight = both dumbbells."),
  X('oh_cable_tri_ext', "Overhead Cable Triceps Extension (Rope)", 'Triceps', [], 'push upper full', 'Cables', 80, 12, 3, 'isolation', "Elbows forward, full stretch behind the head, full lockout."),
  X('jm_press', "JM Press", 'Triceps', ['Chest', 'Shoulders'], 'push upper full', 'Barbell Bench', 175, 8, 3, 'compound', "Halfway between a skullcrusher and a close-grip bench. Start light."),
  X('tate_press', "Dumbbell Tate Press (Total)", 'Triceps', [], 'push upper full', 'Dumbbells Bench', 70, 12, 3, 'isolation', "Elbows flared, dumbbells lower to the chest and back up. Weight = both dumbbells."),

  // Biceps (added)
  X('single_arm_cable_curl', "Single-Arm Cable Curl", 'Biceps', [], 'pull upper full', 'Cables', 45, 12, 3, 'isolation', "Elbow pinned, squeeze at the top, slow lower. Weight = one arm."),
  X('reverse_bb_curl', "Reverse Barbell Curl", 'Biceps', [], 'pull upper full', 'Barbell', 75, 10, 3, 'isolation', "Overhand grip, elbows pinned, wrists straight. Forearms and biceps.", { alias: 'forearm curl' }),
  X('preacher_curl', "Preacher Curl (Barbell / EZ-Bar)", 'Biceps', [], 'pull upper full', 'Barbell Bench', 95, 10, 3, 'isolation', "Arms on the pad, full stretch, no swinging."),
  X('incline_hammer_curl', "Incline Dumbbell Hammer Curl (Total)", 'Biceps', [], 'pull upper full', 'Dumbbells Bench', 65, 10, 3, 'isolation', "Neutral grip, arms hang back for a deep stretch. Weight = both dumbbells."),
  X('bayesian_curl', "Bayesian Cable Curl", 'Biceps', [], 'pull upper full', 'Cables', 40, 12, 3, 'isolation', "Arm behind the torso, curl forward, stretch the long head. One arm."),
  X('spider_curl', "Spider Curl (Total)", 'Biceps', [], 'pull upper full', 'Dumbbells Bench', 55, 12, 3, 'isolation', "Chest on an incline bench, curl without swinging. Weight = both dumbbells."),
  X('farmers_walk', "Farmer's Walk / Heavy Carry (Total)", 'Biceps', ['Back', 'Core'], 'pull upper full', 'Dumbbells', 0, 4, 3, 'compound', "Heavy dumbbells, tall posture, quick steps. Each rep = one trip of about 20 yards.", { bw: 0, noE1: true, noGen: true, alias: 'farmers carry grip forearms suitcase' }),

  // Quads (added)
  X('box_squat', "Barbell Box Squat", 'Quads', ['Glutes', 'Core'], 'legs lower full', 'Barbell', 255, 6, 3, 'compound', "Sit back to the box, pause, drive up. Stay tight."),
  X('zercher_squat', "Zercher Squat", 'Quads', ['Core', 'Back', 'Glutes'], 'legs lower full', 'Barbell', 205, 8, 3, 'compound', "Bar in the crook of the elbows, torso upright, sit between the hips."),
  X('hack_squat', "Hack Squat (Machine / Barbell)", 'Quads', ['Glutes'], 'legs lower full', 'Machines', 300, 10, 3, 'compound', "Back on the pad, feet mid-platform, deep and controlled, no hard lockout."),
  X('heel_goblet_squat', "Heel-Elevated Goblet Squat", 'Quads', ['Core'], 'legs lower full', 'Dumbbells', 60, 12, 3, 'compound', "Heels on a plate, tall chest, knees travel forward."),
  X('db_step_up', "Dumbbell Step-Ups (Total)", 'Quads', ['Glutes'], 'legs lower full', 'Dumbbells Bench', 100, 10, 3, 'compound', "Drive through the top foot, step down slowly. Weight = both dumbbells."),
  X('sissy_squat', "Sissy Squat (Bodyweight / Weighted)", 'Quads', [], 'legs lower full', 'Bodyweight', 0, 10, 3, 'bodyweight', "Lean back, knees travel forward, slow and controlled.", { bw: 0, noE1: true }),

  // Hamstrings (added)
  X('good_morning', "Good Mornings (Barbell)", 'Hamstrings', ['Glutes', 'Back'], 'legs lower pull', 'Barbell', 185, 10, 3, 'compound', "Hips back, flat spine, drive the hips forward. Light."),
  X('seated_leg_curl', "Seated Leg Curl", 'Hamstrings', [], 'legs lower full', 'Machines', 110, 12, 3, 'isolation', "Pad above the heels, curl down and back, slow return."),
  X('nordic_curl', "Nordic Hamstring Curl", 'Hamstrings', ['Core'], 'legs lower full', 'Bodyweight', 0, 6, 3, 'bodyweight', "Lower as slowly as you can, hips extended, catch with the hands.", { bw: 0, noE1: true }),
  X('sl_db_rdl', "Single-Leg Dumbbell RDL (Total)", 'Hamstrings', ['Glutes', 'Core'], 'legs lower pull', 'Dumbbells', 80, 10, 3, 'compound', "Hinge on one leg, hips square, free leg extends back."),
  X('ghr', "Glute-Ham Raise (GHR)", 'Hamstrings', ['Glutes', 'Calves'], 'legs lower full', 'Machines', 0, 10, 3, 'bodyweight', "Hips just past the pad, lower under control, curl up with the hamstrings.", { bw: 0, noE1: true }),

  // Glutes (added)
  X('cable_kickback', "Cable Glute Kickback", 'Glutes', [], 'legs lower full', 'Cables', 40, 12, 3, 'isolation', "Kick straight back, squeeze, no arching. One leg."),
  X('cable_pull_through', "Cable Pull-Through", 'Glutes', ['Hamstrings', 'Core'], 'legs lower full', 'Cables', 100, 12, 3, 'isolation', "Hinge back, then drive the hips through and squeeze."),
  X('deficit_reverse_lunge', "Deficit Reverse Lunge (Dumbbell Total)", 'Glutes', ['Quads', 'Hamstrings'], 'legs lower full', 'Dumbbells', 100, 10, 3, 'compound', "Step back and down off a plate, drive up through the front heel. Weight = both dumbbells."),
  X('db_sumo_squat', "Dumbbell Sumo Squat", 'Glutes', ['Quads'], 'legs lower full', 'Dumbbells', 75, 12, 3, 'compound', "Wide stance, toes out, sit straight down, squeeze the glutes at the top."),
  X('sl_hip_thrust', "Single-Leg Bench Hip Thrust", 'Glutes', ['Hamstrings', 'Core'], 'legs lower full', 'Bench Bodyweight', 0, 10, 3, 'bodyweight', "Upper back on the bench, drive through one heel, hips level.", { bw: 0, noE1: true }),
  X('curtsy_lunge', "Curtsy Lunge (Total)", 'Glutes', ['Quads'], 'legs lower full', 'Dumbbells', 80, 10, 3, 'compound', "Step back across behind the front leg, tall chest. Weight = both dumbbells."),

  // Calves (added)
  X('seated_calf_raise', "Seated Calf Raise", 'Calves', [], 'legs lower full', 'Machines', 150, 15, 3, 'isolation', "Full stretch at the bottom, pause at the top. Works the soleus."),
  X('donkey_calf_raise', "Donkey Calf Raise", 'Calves', [], 'legs lower full', 'Machines', 220, 12, 3, 'isolation', "Hips hinged, full stretch, pause at the top."),
  X('tib_raise', "Tibialis Anterior Raise", 'Calves', [], 'legs lower full', 'Bodyweight', 0, 15, 3, 'bodyweight', "Back to a wall, lift the toes toward the shins, slow lower.", { bw: 0, noE1: true }),

  // Core (added)
  X('bicycle_crunch', "Bicycle Crunches", 'Core', [], 'push pull legs upper lower full', 'Bodyweight', 0, 20, 3, 'bodyweight', "Elbow to the opposite knee, slow pedaling. Each twist = 1 rep.", { bw: 0, noE1: true }),
  X('plank', "Plank Hold (seconds)", 'Core', ['Shoulders', 'Glutes'], 'push pull legs upper lower full', 'Bodyweight', 0, 45, 3, 'bodyweight', "Straight line from head to heels. Type the seconds you held in the Reps box.", { bw: 0, noE1: true, alias: 'planks hold' }),
  X('situp', "Sit-Ups", 'Core', [], 'push pull legs upper lower full', 'Bodyweight', 0, 15, 3, 'bodyweight', "Curl all the way up, control the way down.", { bw: 0, noE1: true }),
  X('side_plank', "Side Plank (seconds)", 'Core', ['Glutes'], 'push pull legs upper lower full', 'Bodyweight', 0, 30, 3, 'bodyweight', "Straight line, hips high. Type the seconds you held in the Reps box.", { bw: 0, noE1: true, alias: 'side plank hold obliques' }),
  X('pallof_press', "Pallof Press (Cable / Band)", 'Core', ['Shoulders'], 'push pull legs upper lower full', 'Cables', 50, 12, 3, 'isolation', "Press out and resist the twist. Same reps on both sides."),
  X('captains_chair_raise', "Captain's Chair Leg / Knee Raise", 'Core', [], 'push pull legs upper lower full', 'Machines', 0, 12, 3, 'bodyweight', "Curl the pelvis up, no swinging.", { bw: 0, noE1: true }),
  X('cable_woodchop', "Cable Woodchopper (High-to-Low / Low-to-High)", 'Core', ['Shoulders'], 'push pull legs upper lower full', 'Cables', 60, 12, 3, 'isolation', "Rotate through the torso and hips, arms stay long. Both sides.", { alias: 'wood chop' }),
  X('russian_twist', "Russian Twist (Weighted)", 'Core', [], 'push pull legs upper lower full', 'Dumbbells', 40, 20, 3, 'isolation', "Lean back, rotate side to side, chest up. Each side = 1 rep."),
  X('dragon_flag', "Dragon Flag / Negative Leg Raise", 'Core', ['Back'], 'push pull legs upper lower full', 'Bench', 0, 6, 3, 'bodyweight', "Body in one line, lower slowly (negatives are fine).", { bw: 0, noE1: true }),
  X('decline_situp', "Decline Weighted Sit-Up", 'Core', [], 'push pull legs upper lower full', 'Bench Dumbbells', 60, 12, 3, 'isolation', "Hook the feet, hold a weight at the chest, curl up, slow lower.")
];
const C = (id, name, gear, dist, min, cue, alias) => ({
  id, name, primary: 'Cardio', secondary: [], split: ['cardio'], gear: gear ? gear.split(' ') : [], type: 'cardio', cardio: true,
  dist, defaultMin: min, cue, default1RM: 0, reps: 0, sets: 0, noE1: true, alias: alias || ''
});
const CARDIO_EX = [
  C('cardio_run', 'Run (Outdoor / Treadmill)', '', true, 20, 'Easy conversational pace, or intervals if you prefer.', 'run jog'),
  C('cardio_walk', 'Walk / Incline Walk', '', true, 30, 'Brisk pace, swing your arms.', 'walk'),
  C('cardio_bike', 'Cycling', 'Bike', true, 25, 'Smooth cadence around 80-100 rpm.', 'bike cycle cycling'),
  C('cardio_row', 'Rowing Machine', 'Rower', true, 15, 'Legs, hips, arms. Reverse on the way back.', 'rower rowing'),
  C('cardio_rope', 'Jump Rope', 'JumpRope', false, 10, 'Light bounces, wrists do the work.', 'jump rope skipping'),
  C('cardio_stairs', 'Stair Climber', 'Machines', false, 15, 'Stand tall, do not lean on the rails.', 'stairs stair climber'),
  C('cardio_elliptical', 'Elliptical', 'Machines', true, 20, 'Smooth strides, upright posture.', 'elliptical'),
  C('cardio_swim', 'Swimming', '', true, 20, 'Steady breathing, relaxed kick.', 'swim swimming'),
  C('cardio_hiit', 'HIIT Circuit (Bodyweight)', 'Bodyweight', false, 12, '30s on / 30s off. Burpees, mountain climbers, jumps.', 'hiit circuit burpees')
];
let EXMAP = null;
function allEx() { if (!EXMAP) { EXMAP = new Map(); [...BASE_EX, ...CARDIO_EX, ...(state ? state.customExercises : [])].forEach(e => EXMAP.set(e.id, e)); } return [...EXMAP.values()]; }
const exById = id => { allEx(); return EXMAP.get(id); };
const resetExCache = () => { EXMAP = null; };

/* ---------- equipment ---------- */
const GEAR_DEFAULT = { Barbell: true, Bench: true, Dumbbells: true, PullupBar: true, Bodyweight: true, Cables: false, Machines: false, Bike: false, Rower: false, JumpRope: false };
const GEAR_LABEL = { PullupBar: 'Pull-up Bar', JumpRope: 'Jump Rope' };
const gearLabel = k => GEAR_LABEL[k] || k;
const GEAR_PRESETS = {
  'Home Gym': ['Barbell', 'Bench', 'Dumbbells', 'PullupBar', 'Bodyweight'],
  'Commercial Gym': '*',
  'Dumbbells Only': ['Dumbbells', 'Bench', 'Bodyweight'],
  'Bodyweight Only': ['Bodyweight']
};
function applyGearPreset(name) {
  let list = GEAR_PRESETS[name];
  if (!list && state.gearProfiles[name]) { state.gear = { ...state.gear, ...state.gearProfiles[name] }; Object.keys(state.gear).forEach(k => { if (!(k in state.gearProfiles[name])) state.gear[k] = false; }); }
  else if (list) Object.keys(state.gear).forEach(k => { state.gear[k] = list === '*' ? true : list.includes(k); });
  state.activeProfile = name;
}
const hasGear = ex => (ex.gear || []).every(g => state.gear[g]);

/* ---------- goals ---------- */
const GOALS = {
  strength: { label: 'Build Strength', cReps: 5, iReps: 10, cSets: 4, iSets: 3, restC: 210, restI: 90, rir: 2, desc: 'Heavier weights, lower reps, longer rests' },
  muscle: { label: 'Build Muscle', cReps: 8, iReps: 12, cSets: 4, iSets: 3, restC: 150, restI: 75, rir: 2, desc: 'Classic hypertrophy rep ranges' },
  tone: { label: 'Tone & Definition', cReps: 12, iReps: 15, cSets: 3, iSets: 3, restC: 90, restI: 60, rir: 3, desc: 'Higher reps, shorter rests, cardio finisher' },
  fitness: { label: 'General Fitness', cReps: 10, iReps: 12, cSets: 3, iSets: 2, restC: 90, restI: 60, rir: 3, desc: 'Balanced strength and conditioning' }
};
const MILESTONES = { lb: [135, 185, 225, 275, 315, 365, 405, 495], kg: [60, 80, 100, 120, 140, 160, 180, 220] };

/* ---------- state + persistence ---------- */
/* Several people can share one phone: each profile has its own storage keys. The first profile
   ("main") keeps the original keys, so existing data is never moved or renamed. */
const PROF_KEY = 'forgefit_profiles';
function readProfiles() {
  try { const o = JSON.parse(localStorage.getItem(PROF_KEY)); if (o && Array.isArray(o.list) && o.list.length) { o.list = o.list.filter(p => p && p.id); if (o.list.length) { if (!o.list.some(p => p.id === o.active)) o.active = o.list[0].id; return o; } } } catch (e) { }
  return { active: 'main', list: [{ id: 'main', name: 'Me' }] };
}
function writeProfiles() { try { localStorage.setItem(PROF_KEY, JSON.stringify(PROFILES)); } catch (e) { } }
const PROFILES = readProfiles();
const profSfx = id => !id || id === 'main' ? '' : '__' + id;
const keysFor = id => ({ ls: 'forgefit_state_v3' + profSfx(id), bak: 'forgefit_backup_v3' + profSfx(id), idb: 'state' + profSfx(id) });
const LS_KEY = keysFor(PROFILES.active).ls, LS_BAK = keysFor(PROFILES.active).bak, IDB_STATE = keysFor(PROFILES.active).idb;
const LS_OLD = 'forgefit_state_v2';
let state = null, saveT = null, idbT = null, saveFail = false;

function defaultState() {
  const muscles = {}; MUSCLES.forEach(m => muscles[m] = { recovery: 100, lastTrained: 0 });
  return {
    v: 3,
    profile: { done: false, goal: 'muscle', experience: 'intermediate', gender: 'other', age: 30, heightCm: 175, weight: 180, unit: 'lb', days: 4, splitPref: 'freshness', sessionMin: 60, cardio: false },
    settings: { rpe: false, sound: true, volume: .6, tone: 'beep', haptics: true, haptic: 'medium', restC: null, restI: null, notify: false, wake: false, bar: 45, plates: [45, 35, 25, 10, 5, 2.5], warmups: true, healthSync: false, prefill: true, theme: 'dark', weekStart: 1 },
    muscles, gear: { ...GEAR_DEFAULT }, gearProfiles: {}, activeProfile: 'Home Gym',
    e1rm: {}, e1rmHist: {}, prs: {}, split: 'auto',
    workout: { startedAt: null, name: "Today's Session", note: '', items: [] },
    customExercises: [], history: [], templates: [], measures: [], photos: [],
    timer: null, deload: null, lastDeload: 0, lastTick: Date.now(), lastBackup: 0,
    createdAt: Date.now(), lastExport: 0, backupSnooze: 0, nudgeSnooze: 0, block: null, seen: {}, favs: [], exNotes: {}
  };
}
function normalize(s) {
  const d = defaultState();
  s = s && typeof s === 'object' ? s : {};
  const out = { ...d, ...s };
  out.profile = { ...d.profile, ...(s.profile || {}) };
  out.settings = { ...d.settings, ...(s.settings || {}) };
  out.muscles = {};
  MUSCLES.forEach(m => {
    const o = s.muscles && s.muscles[m];
    out.muscles[m] = { recovery: o && Number.isFinite(+o.recovery) ? clamp(+o.recovery, 0, 100) : 100, lastTrained: (o && o.lastTrained) || 0 };
  });
  out.gear = { ...GEAR_DEFAULT, ...(s.gear || {}) };
  out.workout = { ...d.workout, ...(s.workout || {}) };
  if (Array.isArray(s.currentWorkout) && !s.workout) {          // migrate v2
    out.workout.items = s.currentWorkout.map(it => ({
      id: uid(), exId: it.exId, superset: it.superset || null,
      sets: (it.sets || []).map(x => ({ weight: x.weight, reps: x.reps, rir: x.rir ?? 2, done: !!x.done, type: 'work' }))
    }));
  }
  delete out.currentWorkout;
  ['history', 'templates', 'measures', 'photos', 'customExercises', 'favs'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
  ['e1rm', 'e1rmHist', 'prs', 'gearProfiles', 'seen', 'exNotes'].forEach(k => { if (!out[k] || typeof out[k] !== 'object') out[k] = {}; });
  ['createdAt', 'lastExport', 'backupSnooze', 'nudgeSnooze'].forEach(k => { if (!Number.isFinite(+out[k])) out[k] = k === 'createdAt' ? Date.now() : 0; });
  if (out.block && !(out.block.weeks >= 2 && out.block.start)) out.block = null;
  out.history = out.history.map((h, i) => h && h.t ? h : { id: uid(), t: Date.now() - (i + 1) * DAY, name: 'Session', split: String((h && h.split) || '').toLowerCase(), sets: (h && h.sets) || 0, vol: (h && h.volume) || 0, dur: 0, items: [], legacyDate: h && h.date });
  if (!Array.isArray(out.workout.items)) out.workout.items = [];
  out.v = 3;
  return out;
}

/* IndexedDB (photos + state mirror) */
let _db = null;
function idb() {
  if (_db) return _db;
  _db = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('no idb'));
    const r = indexedDB.open('forgefit', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv', { keyPath: 'key' }); d.createObjectStore('photos', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return _db;
}
const idbDo = (store, mode, fn) => idb().then(d => new Promise((res, rej) => {
  const t = d.transaction(store, mode); const st = t.objectStore(store); const rq = fn(st);
  t.oncomplete = () => res(rq ? rq.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
}));
const idbPut = (s, v) => idbDo(s, 'readwrite', st => st.put(v));
const idbGet = (s, k) => idbDo(s, 'readonly', st => st.get(k));
const idbAll = s => idbDo(s, 'readonly', st => st.getAll());
const idbDel = (s, k) => idbDo(s, 'readwrite', st => st.delete(k));

function scheduleSave() { clearTimeout(saveT); saveT = setTimeout(flushSave, 300); }
function flushSave() {
  clearTimeout(saveT);
  if (!state) return;
  let data;
  try { data = JSON.stringify(state); } catch (e) { return; }
  const now = Date.now();
  if (now - (state.lastBackup || 0) > 30 * 60 * 1000) {        // rolling auto-backup of the previous good copy
    try {
      const prev = localStorage.getItem(LS_KEY);
      if (prev && prev.length > 200) localStorage.setItem(LS_BAK, prev);
      state.lastBackup = now; data = JSON.stringify(state);
    } catch (e) { /* backup is best-effort */ }
  }
  try { localStorage.setItem(LS_KEY, data); saveFail = false; }
  catch (e) {
    try { sessionStorage.setItem(LS_KEY, data); } catch (_) { }
    if (!saveFail) { saveFail = true; toast('Storage is nearly full. Export a backup from More → Data.'); }
  }
  clearTimeout(idbT);
  idbT = setTimeout(() => { idbPut('kv', { key: IDB_STATE, value: data }).catch(() => { }); }, 3000);
}
async function loadState() {
  const tryParse = raw => { try { const o = JSON.parse(raw); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } };
  const get = k => { try { return localStorage.getItem(k) || sessionStorage.getItem(k); } catch (e) { return null; } };
  let s = tryParse(get(LS_KEY)) || tryParse(get(LS_BAK));
  if (!s) { try { const r = await idbGet('kv', IDB_STATE); if (r) s = tryParse(r.value); } catch (e) { } }
  if (!s && PROFILES.active === 'main') s = tryParse(get(LS_OLD));
  state = normalize(s);
  if (!s) state.__fresh = true;
}

/* ---------- theme ---------- */
function applyTheme() {
  const t = (state && state.settings.theme) || 'dark';
  let light = t === 'light';
  if (t === 'auto') { try { light = matchMedia('(prefers-color-scheme: light)').matches; } catch (e) { } }
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = light ? '#f2f4f9' : '#090d16';
}

/* ---------- units & loads ---------- */
const unit = () => state.profile.unit;
const inc = () => unit() === 'kg' ? 2.5 : 5;
const rnd = v => Math.round(v / inc()) * inc();
const bw = () => state.profile.weight || (unit() === 'kg' ? 80 : 180);
const loadOf = (ex, s) => (Number(s.weight) || 0) + (ex.bw ? ex.bw * bw() : 0);
const est1 = (ex, s) => { const L = loadOf(ex, s); return L > 0 ? L * (1 + Math.min((+s.reps || 0) + (s.fail ? 0 : (+s.rir || 0)), 15) / 30) : 0; };
const defPlates = u => u === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5];
const defBar = u => u === 'kg' ? 20 : 45;
function setUnit(nu) {
  if (nu === unit()) return;
  const f = nu === 'kg' ? KG : 1 / KG, r = v => Math.round(v * f / (nu === 'kg' ? 2.5 : 5)) * (nu === 'kg' ? 2.5 : 5);
  Object.keys(state.e1rm).forEach(k => state.e1rm[k] = Math.round(state.e1rm[k] * f));
  Object.values(state.prs).forEach(p => { p.e1rm = Math.round(p.e1rm * f); p.weight = Math.round(p.weight * f); });
  Object.values(state.e1rmHist).forEach(a => a.forEach(p => p.v = Math.round(p.v * f)));
  state.workout.items.forEach(it => (it.sets || []).forEach(s => s.weight = Math.max(0, r(+s.weight || 0))));
  state.profile.weight = Math.round((state.profile.weight || 0) * f);
  state.profile.unit = nu;
  state.settings.bar = defBar(nu); state.settings.plates = defPlates(nu);
}
function seedE1(ex) {
  if (ex.noE1) return 0;
  const p = state.profile, bwLb = unit() === 'kg' ? bw() / KG : bw();
  if (ex.bw) {
    const sr = ex.seedReps || [8, 15, 22];
    const reps = sr[{ beginner: 0, intermediate: 1, advanced: 2 }[p.experience] ?? 1];
    return Math.round(ex.bw * bw() * (1 + reps / 30));
  }
  const f = clamp(bwLb / 180, .5, 1.6) * ({ beginner: .55, intermediate: .8, advanced: 1 }[p.experience] || .8) * ({ male: 1, female: .7 }[p.gender] ?? .85);
  const lb = ex.default1RM * f;
  return unit() === 'kg' ? Math.max(2.5, Math.round(lb * KG / 2.5) * 2.5) : Math.max(5, Math.round(lb / 5) * 5);
}
function ensureE1(reseed) {
  allEx().forEach(ex => { if (ex.noE1) return; if (reseed || state.e1rm[ex.id] == null) state.e1rm[ex.id] = seedE1(ex); });
}
function recWeight(ex, reps, rir = 2, factor = 1) {
  if (ex.noE1) return 0;
  const orm = state.e1rm[ex.id] || seedE1(ex);
  let L = orm / (1 + Math.min(reps + rir, 15) / 30) * factor;
  if (ex.bw) return Math.max(0, rnd(L - ex.bw * bw()));
  return Math.max(inc(), rnd(L));
}

/* ---------- recovery ---------- */
function updatePassiveRecovery() {
  const now = Date.now(), hrs = (now - (state.lastTick || now)) / 36e5;
  if (hrs <= 0) { state.lastTick = now; return; }
  MUSCLES.forEach(m => { const mu = state.muscles[m]; mu.recovery = clamp(mu.recovery + hrs * 1.25, 0, 100); }); // floats: no rounding drift
  state.lastTick = now; scheduleSave();
}
const rec = m => Math.round(state.muscles[m] ? state.muscles[m].recovery : 100);
const avgRecovery = () => Math.round(MUSCLES.reduce((a, m) => a + state.muscles[m].recovery, 0) / MUSCLES.length);

/* ---------- set completion with reversible side-effects ---------- */
function applySetDone(it, s, ex) {
  s.done = true;
  if (s.type === 'warmup') return null;
  const rm = (s.fail || s.rir <= 0) ? 1.25 : 1, dm = s.type === 'drop' ? .6 : 1;
  s.fx = {};
  if (state.muscles[ex.primary]) s.fx[ex.primary] = Math.round(6 * rm * dm);
  (ex.secondary || []).forEach(m => { if (state.muscles[m]) s.fx[m] = (s.fx[m] || 0) + Math.round(3 * rm * dm); });
  const now = Date.now();
  for (const m in s.fx) { const mu = state.muscles[m]; mu.recovery = clamp(mu.recovery - s.fx[m], 0, 100); mu.lastTrained = now; }
  let pr = null;
  if (!ex.noE1) {
    const L = loadOf(ex, s), e = est1(ex, s), base = state.e1rm[ex.id] || 0;
    s.pct = base ? +(L / base).toFixed(3) : null;
    if (s.type !== 'drop' && e > 0) {
      s.prevE1 = base || null;
      state.e1rm[ex.id] = Math.round(base ? base * .35 + e * .65 : e);
      const old = state.prs[ex.id], crossed = MILESTONES[unit()].find(m => L >= m && (!old || old.weight < m));
      if (!old) { state.prs[ex.id] = { e1rm: Math.round(e), weight: L, reps: +s.reps, t: now }; s.pr = 1; s.prevPR = null; }
      else if (e > old.e1rm + .4 || (crossed && L > old.weight)) {
        s.pr = 1; s.prevPR = { ...old };
        state.prs[ex.id] = { e1rm: Math.max(old.e1rm, Math.round(e)), weight: Math.max(old.weight, L), reps: L >= old.weight ? +s.reps : old.reps, t: now };
        pr = { ex, old: old.e1rm, now: Math.round(e), weight: L, reps: +s.reps, milestone: crossed && L > old.weight ? crossed : null };
      }
    }
  }
  return pr;
}
function undoSet(it, s, ex) {
  for (const m in (s.fx || {})) if (state.muscles[m]) state.muscles[m].recovery = clamp(state.muscles[m].recovery + s.fx[m], 0, 100);
  if (s.prevE1 != null) state.e1rm[ex.id] = s.prevE1;
  if (s.pr) { if (s.prevPR) state.prs[ex.id] = s.prevPR; else delete state.prs[ex.id]; }
  ['fx', 'prevE1', 'pr', 'prevPR', 'pct'].forEach(k => delete s[k]);
  s.done = false;
}

/* ---------- audio, haptics, notifications ---------- */
let AC = null;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } }
  if (AC && AC.state === 'suspended') AC.resume().catch(() => { });
  return AC;
}
function tone(freq, dur, at = 0, type = 'sine') {
  const c = audio(); if (!c) return;
  const t0 = c.currentTime + at, o = c.createOscillator(), g = c.createGain(), v = clamp(state.settings.volume, 0, 1) * .3;
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
  o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + .02);
}
const TONES = { beep: { f: [880, 1175, 1568], t: 'sine' }, chime: { f: [660, 990, 1320], t: 'triangle' }, tick: { f: [1200, 1600, 2000], t: 'square' } };
function cue(kind) {
  if (!state.settings.sound) return;
  const T = TONES[state.settings.tone] || TONES.beep, [a, b, c] = T.f, ty = T.t;
  if (kind === 'set') tone(a, .12, 0, ty);
  else if (kind === 'timer') { tone(a, .14, 0, ty); tone(a, .14, .22, ty); tone(b, .35, .44, ty); }
  else if (kind === 'pr') [a, b, c, c * 1.25].forEach((f, i) => tone(f, .22, i * .13, ty));
  else if (kind === 'finish') { [a, b, c].forEach((f, i) => tone(f, .2, i * .14, ty)); tone(c * 1.25, .45, .45, ty); }
  else if (kind === 'phase') tone(b, .1, 0, ty);
  else if (kind === 'phase2') tone(a, .1, 0, ty);
}
function buzz(kind) {
  const s = state.settings; if (!s.haptics || !navigator.vibrate) return;
  const k = { light: .6, medium: 1, strong: 1.7 }[s.haptic] || 1;
  const base = { tap: [8], set: [18], timer: [70, 50, 70, 50, 140], pr: [40, 30, 40, 30, 160], finish: [30, 30, 30, 30, 140], phase: [12] }[kind] || [10];
  try { navigator.vibrate(base.map((v, i) => i % 2 === 0 ? Math.round(v * k) : v)); } catch (e) { }
}
function notifyUser(title, body) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
    if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(r => r.showNotification(title, { body, icon: 'icon-192.png', tag: 'ff-timer' })).catch(() => new Notification(title, { body }));
    else new Notification(title, { body });
  } catch (e) { }
}

/* ---------- native bridges (Live Activity / Dynamic Island / Health) ---------- */
const plugin = n => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n];
const LiveActivity = {
  available: () => !!plugin('LiveActivity'),
  call(m, d) { try { const p = plugin('LiveActivity'); if (p && p[m]) p[m](d); } catch (e) { } },
  sync() {
    const wk = state.workout; if (!this.available()) return;
    this.call('update', { workout: wk.name, startedAt: wk.startedAt, timerEndAt: state.timer ? state.timer.endAt : null, timerLabel: state.timer ? state.timer.label : null });
  },
  end() { this.call('end', {}); }
};
const HealthBridge = {
  available: () => !!plugin('Health'),
  async writeWorkout(e) { if (!state.settings.healthSync || !this.available()) return; try { await plugin('Health').writeWorkout(e); } catch (x) { } },
  async readBody() { if (!this.available()) return null; try { return await plugin('Health').readBody(); } catch (x) { return null; } }
};

/* ---------- rest timer (timestamp based, no drift) ---------- */
let tInt = null, tBg = null;
const timerLeft = () => state.timer ? Math.max(0, Math.ceil((state.timer.endAt - Date.now()) / 1000)) : 0;
function startTimer(sec, label) {
  if (!sec || sec <= 0) return;
  state.timer = { endAt: Date.now() + sec * 1000, total: sec, label };
  scheduleSave(); paintTimer(); armTimer(); LiveActivity.sync();
}
function armTimer() {
  clearInterval(tInt); clearTimeout(tBg);
  if (!state.timer) return;
  if (document.hidden) tBg = setTimeout(() => endTimer(), Math.max(0, state.timer.endAt - Date.now()));
  else tInt = setInterval(paintTimer, 1000);              // single 1s tick, only while visible
}
function paintTimer() {
  const bar = $('#tbar');
  if (!state.timer) { bar.hidden = true; return; }
  const left = timerLeft(); if (left <= 0) { endTimer(); return; }
  bar.hidden = false;
  $('#tdisp').textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
  $('#tlabel').textContent = state.timer.label;
  $('#tfill').style.transform = `scaleX(${clamp(left / state.timer.total, 0, 1)})`;
}
function endTimer() {
  const t = state.timer; state.timer = null;
  clearInterval(tInt); clearTimeout(tBg); $('#tbar').hidden = true;
  if (t) { cue('timer'); buzz('timer'); notifyUser('Rest over', 'Time for your next set.'); }
  scheduleSave(); LiveActivity.sync();
}
function adjustTimer(n) {
  if (!state.timer) return;
  const now = Date.now(); state.timer.endAt = Math.max(now + 5000, state.timer.endAt + n * 1000);
  state.timer.total = Math.max(state.timer.total, Math.ceil((state.timer.endAt - now) / 1000));
  scheduleSave(); paintTimer(); LiveActivity.sync();
}
