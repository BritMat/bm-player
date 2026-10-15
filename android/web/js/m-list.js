/**
 * m-list: a long list that stays quick. Only the rows on screen (and a few
 * either side) exist; scrolling moves them and fills them again. A phone
 * can hold twenty thousand songs, and a row each would take seconds to lay
 * out and much of the memory.
 *
 *   new VList(scroller, { rowHeight, render(i, row), head })
 *
 * scroller is the element that scrolls. render(i, row) fills a row element
 * for item i (rows are reused, so it sets everything). head, if given, is an
 * element shown above the rows, scrolling with them (an album's header).
 * setCount(n) says how many there are; refresh() fills the rows again.
 */
export class VList {
  constructor (scroller, { rowHeight, render, head = null, overscan = 8, rowClass = 'vrow' }) {
    this.sc = scroller; this.rh = rowHeight; this.render = render; this.overscan = overscan; this.rowClass = rowClass;
    this.count = 0; this.rows = new Map(); this.pool = [];
    this.sc.textContent = '';
    this.head = head;
    if (head) this.sc.appendChild(head);
    this.sizer = document.createElement('div');
    this.sizer.className = 'vsizer';
    this.sc.appendChild(this.sizer);
    this._raf = 0;
    this._onScroll = () => { if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = 0; this._fill(false); }); };
    this.sc.addEventListener('scroll', this._onScroll, { passive: true });
    this._ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this._fill(false)) : null;
    this._ro?.observe(this.sc);
  }

  get top () { return this.head ? this.head.offsetHeight : 0; }

  setCount (n, keepScroll = false) {
    this.count = n;
    this.sizer.style.height = (n * this.rh) + 'px';
    if (!keepScroll) this.sc.scrollTop = 0;
    this.refresh();
  }

  /** Every row on screen filled again (the data behind them changed). */
  refresh () { this._fill(true); }

  /** Item i brought into view, in the middle when it can be. */
  scrollTo (i) {
    const y = this.top + i * this.rh - (this.sc.clientHeight - this.rh) / 2;
    this.sc.scrollTop = Math.max(0, y);
    this._fill(false);
  }

  /** The row element showing item i, or null when it is not on screen. */
  rowOf (i) { return this.rows.get(i) || null; }

  _fill (force) {
    const top = this.top, h = this.sc.clientHeight || window.innerHeight, st = this.sc.scrollTop - top;
    const first = Math.max(0, Math.floor(st / this.rh) - this.overscan);
    const last = Math.min(this.count - 1, Math.ceil((st + h) / this.rh) + this.overscan);
    for (const [i, row] of this.rows) {
      if (i < first || i > last) { row.style.display = 'none'; this.pool.push(row); this.rows.delete(i); }
    }
    for (let i = first; i <= last; i++) {
      let row = this.rows.get(i), fresh = false;
      if (!row) {
        row = this.pool.pop();
        if (!row) { row = document.createElement('div'); row.className = this.rowClass; this.sc.appendChild(row); }
        row.style.display = '';
        this.rows.set(i, row); fresh = true;
      }
      if (fresh || force) {
        row.dataset.i = String(i);
        row.style.transform = `translateY(${top + i * this.rh}px)`;
        row.style.height = this.rh + 'px';
        this.render(i, row);
      }
    }
  }

  destroy () {
    this.sc.removeEventListener('scroll', this._onScroll);
    this._ro?.disconnect();
    cancelAnimationFrame(this._raf);
    this.sc.textContent = '';
    this.rows.clear(); this.pool = [];
  }
}
