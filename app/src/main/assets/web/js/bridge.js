const pendingRequests = new Map();
let seq = 0;

window.__deskBridgeResolve = (requestId, payload) => {
  const entry = pendingRequests.get(requestId);
  if (!entry) return;
  pendingRequests.delete(requestId);
  if (payload && payload.ok) {
    entry.resolve(payload.body);
  } else {
    entry.reject(new Error(payload?.error || `HTTP ${payload?.status || 'error'}`));
  }
};

export async function fetchText(url) {
  if (window.DeskBridge && typeof window.DeskBridge.fetchUrl === 'function') {
    const requestId = `req_${++seq}_${Date.now()}`;
    return new Promise((resolve, reject) => {
      pendingRequests.set(requestId, { resolve, reject });
      window.DeskBridge.fetchUrl(requestId, url);
    });
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.text();
}

export async function fetchJson(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

export function openWebPage(url) {
  if (window.DeskBridge && typeof window.DeskBridge.openWebPage === 'function') {
    window.DeskBridge.openWebPage(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
