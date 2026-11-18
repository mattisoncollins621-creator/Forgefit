/* ---------- iPhone / Safari details ---------- */
/* Safari only lets a page make sound after a tap has "unlocked" audio. Rest-timer beeps fire from a timer, not a
   tap, so unlock once on the first touch: create the audio context and play a silent blip inside that tap. */
(function () {
  let done = false;
  const unlock = () => {
    if (done) return; done = true;
    try { const c = audio(); if (c) { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } } catch (e) { }
    document.removeEventListener('touchend', unlock, true); document.removeEventListener('pointerup', unlock, true);
  };
  document.addEventListener('touchend', unlock, true); document.addEventListener('pointerup', unlock, true);
  // returning to the app after the phone locked: Safari suspends audio, wake it on the next tap
  document.addEventListener('visibilitychange', () => { if (!document.hidden) done = false; });
})();
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
