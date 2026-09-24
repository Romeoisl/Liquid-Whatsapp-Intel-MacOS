(() => {
  const KEY = 'liquid-glass-preference'
  const allowed = new Set(['tinted', 'clear', 'performance'])

  function normalize(value) {
    return allowed.has(value) ? value : 'tinted'
  }

  function apply(value, persist = true) {
    const mode = normalize(value)
    document.body.classList.remove('liquid-clear', 'liquid-tinted', 'liquid-performance')
    document.body.classList.add(`liquid-${mode}`)
    if (persist) {
      try { localStorage.setItem(KEY, mode) } catch (_) {}
    }
    return mode
  }

  function current() {
    try { return normalize(localStorage.getItem(KEY) || 'tinted') } catch (_) { return 'tinted' }
  }

  window.liquidGlass = {
    apply,
    current
  }

  document.addEventListener('DOMContentLoaded', () => apply(current(), false), { once: true })
})()
