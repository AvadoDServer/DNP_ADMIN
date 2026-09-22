const KEY = "avado.dismissedFindings";

function read() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch (e) {
    return new Set();
  }
}
function write(set) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch (e) {
    // Private mode or blocked storage: dismissals last until reload.
  }
}
export const isDismissed = id => read().has(id);
export function dismiss(id) {
  const s = read();
  s.add(id);
  write(s);
}
export const undismissAll = () => write(new Set());
