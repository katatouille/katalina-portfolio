(function () {
  // ---------- context-aware cursor ----------
  const cursor = document.createElement('div');
  cursor.className = 'cursor';
  document.body.appendChild(cursor);

  window.addEventListener('pointermove', (e) => {
    cursor.classList.add('is-active');
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });

  document.querySelectorAll('[data-title]').forEach((el) => {
    el.addEventListener('pointerenter', () => {
      cursor.classList.add('is-label');
      cursor.textContent = 'View';
    });
    el.addEventListener('pointerleave', () => {
      cursor.classList.remove('is-label');
      cursor.textContent = '';
    });
  });

  // ---------- work page: vertical scroll drives the horizontal row ----------
  const workRow = document.querySelector('.work-row');
  if (workRow) {
    window.addEventListener('wheel', (e) => {
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (delta === 0) return;
      const atStart = workRow.scrollLeft <= 0;
      const atEnd = workRow.scrollLeft >= workRow.scrollWidth - workRow.clientWidth - 1;
      if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;
      e.preventDefault();
      workRow.scrollLeft += delta;
    }, { passive: false });
  }

  // ---------- hidden detail ----------
  console.log(
    '%c you found the console. hi. %c\n this site is a work in progress — more specimens loading soon.',
    'background:#a89a7a; color:#141414; font-family:monospace; padding:4px 8px;',
    'color:#8f8f8f; font-family:monospace;'
  );
})();
