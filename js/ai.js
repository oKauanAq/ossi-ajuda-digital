async function consultarSergioIA(pergunta) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const resp = await fetch('/api/sergio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pergunta }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!resp.ok) return { ok: false };
    const data = await resp.json();
    if (!data || typeof data !== 'object') return { ok: false };
    return { ok: true, ...data };
  } catch {
    return { ok: false };
  }
}
