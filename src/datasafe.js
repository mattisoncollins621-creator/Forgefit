/* ---------- keeping your data safe ---------- */
const bakEvery = () => { const v = state.settings.bakEvery; return v === 0 ? 0 : [7, 14, 30].includes(+v) ? +v : 7; };
F.bakEvery = el => { state.settings.bakEvery = +el.value; scheduleSave(); toast(+el.value ? 'Backup reminder updated' : 'Backup reminders off'); };
/* One-tap backup: photos are converted ahead of time, so the tap itself can build the file and open the
   share sheet straight away (iPhones only allow sharing directly from a tap). */
let qbPhotos = null, qbIds = '';
const photoIds = () => state.photos.map(p => p.id).sort().join();
async function prepQuickBackup() { if (qbPhotos && qbIds === photoIds()) return; const ids = photoIds(), ph = await backupPhotos(); qbPhotos = ph; qbIds = ids; }
A.bakQuick = () => {
  if (!qbPhotos || qbIds !== photoIds()) { A.exportJSON(); return; }
  flushSave(); const f = backupFile(qbPhotos);
  let can = false; try { can = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [f] })); } catch (e) { }
  if (!can) { A.exportJSON(); return; }
  navigator.share({ files: [f], title: 'ForgeFit backup' }).then(() => { markBackedUp(); toast('Backup saved. Nice.'); })
    .catch(e => { if (!e || e.name !== 'AbortError') A.exportJSON(); });
};
async function paintPersist() {
  const el = $('#persist-line'); if (!el) return;
  let p = null; try { p = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch (e) { }
  if (p === null) { el.textContent = 'Your data is saved on this phone. Keep regular backups in case the phone is lost or reset.'; return; }
  el.innerHTML = p ? `${ic('check', 'sm')} This phone protects ForgeFit's storage from automatic clean-up. Backups still guard against a lost or reset phone.`
    : 'This phone may clear website data if storage runs low. Install ForgeFit to your home screen and keep regular backups.';
}
