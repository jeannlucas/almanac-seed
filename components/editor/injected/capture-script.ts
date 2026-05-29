// Runs inside the sandboxed iframe (no allow-same-origin). Only channel to the
// parent is window.parent.postMessage. Kept as a string so it isn't touched by
// the bundler and stays self-contained.
export const CAPTURE_SCRIPT = `(() => {
  const send = (msg) => {
    try { window.parent.postMessage(msg, '*'); } catch (e) {}
  };

  const measure = () => ({
    scrollTop: window.scrollY || document.documentElement.scrollTop || 0,
    scrollLeft: window.scrollX || document.documentElement.scrollLeft || 0,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientWidth: document.documentElement.clientWidth,
    clientHeight: document.documentElement.clientHeight,
  });

  let mode = 'idle';
  let frame = null;

  const flushViewport = () => {
    frame = null;
    send({ type: 'iframe:viewport', viewport: measure() });
  };

  const scheduleViewport = () => {
    if (frame !== null) return;
    frame = window.requestAnimationFrame(flushViewport);
  };

  const computeSelector = (el) => {
    if (!(el instanceof Element)) return null;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body && parts.length < 6) {
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (same.length > 1) {
          const idx = same.indexOf(node) + 1;
          part += ':nth-of-type(' + idx + ')';
        }
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.length ? 'body > ' + parts.join(' > ') : 'body';
  };

  const onClick = (ev) => {
    if (mode !== 'placing') return;
    ev.preventDefault();
    ev.stopPropagation();

    const target = ev.target;
    const rect = target && target.getBoundingClientRect
      ? target.getBoundingClientRect()
      : { left: 0, top: 0, width: 1, height: 1 };

    const viewport = measure();
    const pageX = ev.clientX + viewport.scrollLeft;
    const pageY = ev.clientY + viewport.scrollTop;
    const docW = Math.max(viewport.scrollWidth, 1);
    const docH = Math.max(viewport.scrollHeight, 1);

    const anchor = {
      xPct: Math.min(1, Math.max(0, pageX / docW)),
      yPct: Math.min(1, Math.max(0, pageY / docH)),
      selector: computeSelector(target),
      selectorOffset: rect.width > 0 && rect.height > 0
        ? {
            dx: Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width)),
            dy: Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height)),
          }
        : null,
      scrollHeight: docH,
    };

    mode = 'idle';
    document.documentElement.style.cursor = '';
    send({ type: 'iframe:pinPlaced', anchor, viewport });
  };

  window.addEventListener('message', (ev) => {
    const data = ev.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'parent:setMode') {
      mode = data.mode === 'placing' ? 'placing' : 'idle';
      document.documentElement.style.cursor = mode === 'placing' ? 'crosshair' : '';
    } else if (data.type === 'parent:requestViewport') {
      send({ type: 'iframe:viewport', viewport: measure() });
    }
  });

  document.addEventListener('click', onClick, true);
  window.addEventListener('scroll', scheduleViewport, { passive: true });
  window.addEventListener('resize', scheduleViewport, { passive: true });

  const ready = () => send({ type: 'iframe:ready', viewport: measure() });
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(ready, 0);
  } else {
    document.addEventListener('DOMContentLoaded', ready);
  }
})();`;
