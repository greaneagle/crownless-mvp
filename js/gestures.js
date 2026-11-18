// @ts-check
/* Crownless gesture recogniser (W-02): tells a tap from a drag from a pinch, so a map can be panned
 * and zoomed without a touch ever starting travel by accident. Pure: it takes pointer events (or
 * anything with pointerId, clientX, clientY, pointerType and button) and calls back; the mode using
 * it converts CSS pixels into its own coordinates. Map mode uses it now, battle zoom in W-03; every
 * other mode keeps its own handlers.
 *
 *   pointerdown  begins tracking (never acts on its own)
 *   pointermove  past THRESHOLD CSS px the press becomes a pan; a second pointer makes it a pinch
 *   pointerup    a tap only if the press never moved past the threshold and no second pointer joined
 *   cancel       pointercancel, lost capture, window blur: the interaction ends with no tap
 *
 * Lifting one finger of a pinch leaves a pan with the other, never a tap. */
(function (root) {
  'use strict';
  const CL = root.Crownless;

  const THRESHOLD = 8; // CSS px a press may wander and still be a tap

  /**
   * @param {{ threshold?: number, onTap?: (x: number, y: number, e: any) => void,
   *   onPan?: (dx: number, dy: number) => void, onPinch?: (factor: number, x: number, y: number) => void,
   *   onZoom?: (factor: number, x: number, y: number) => void, onEnd?: (kind: string) => void }} handlers
   */
  function recognizer(handlers) {
    const threshold = handlers.threshold ?? THRESHOLD;
    /** @type {Map<number, { x: number, y: number }>} */
    const pointers = new Map();
    let state = 'idle'; // idle | press | pan | pinch
    let start = { x: 0, y: 0 };
    let last = { x: 0, y: 0 };
    let pinch = { d: 0, x: 0, y: 0 };
    let spent = false; // a second pointer joined: no tap until every pointer is up

    const two = () => [...pointers.values()].slice(0, 2);
    const span = () => {
      const [a, b] = two();
      return { d: Math.hypot(b.x - a.x, b.y - a.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };
    function finish(kind) {
      const was = state;
      pointers.clear();
      state = 'idle';
      spent = false;
      if (was !== 'idle') handlers.onEnd?.(kind);
    }

    return {
      get state() {
        return state;
      },
      get count() {
        return pointers.size;
      },
      down(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return false; // only the main button
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 1) {
          state = 'press';
          spent = false;
          start = { x: e.clientX, y: e.clientY };
          last = { ...start };
        } else if (pointers.size === 2) {
          state = 'pinch';
          spent = true;
          pinch = span();
        }
        return true;
      },
      move(e) {
        const p = pointers.get(e.pointerId);
        if (!p) return;
        p.x = e.clientX;
        p.y = e.clientY;
        if (state === 'press' && Math.hypot(p.x - start.x, p.y - start.y) > threshold) {
          state = 'pan';
          handlers.onPan?.(p.x - start.x, p.y - start.y); // the map catches up with the finger
          last = { x: p.x, y: p.y };
        } else if (state === 'pan') {
          handlers.onPan?.(p.x - last.x, p.y - last.y);
          last = { x: p.x, y: p.y };
        } else if (state === 'pinch' && pointers.size >= 2) {
          const now = span();
          if (pinch.d > 0 && now.d > 0) handlers.onPinch?.(now.d / pinch.d, now.x, now.y);
          handlers.onPan?.(now.x - pinch.x, now.y - pinch.y); // two fingers moving together pan
          pinch = now;
        }
      },
      up(e) {
        const p = pointers.get(e.pointerId);
        if (!p) return;
        pointers.delete(e.pointerId);
        if (pointers.size === 0) {
          const tap = state === 'press' && !spent;
          const kind = tap ? 'tap' : state;
          state = 'idle';
          spent = false;
          if (tap) handlers.onTap?.(p.x, p.y, e);
          handlers.onEnd?.(kind);
        } else if (state === 'pinch' && pointers.size === 1) {
          // One finger lifted: the other carries on as a pan (never a tap).
          state = 'pan';
          const [rest] = pointers.values();
          last = { x: rest.x, y: rest.y };
        } else if (state === 'pinch') {
          pinch = span();
        }
      },
      /** pointercancel, window blur, or leaving the mode: end with no tap. */
      cancel() {
        finish('cancel');
      },
      /** lostpointercapture: only matters while that pointer is still down. */
      lost(e) {
        if (pointers.has(e.pointerId)) finish('cancel');
      },
      /** The mouse wheel zooms around the cursor. */
      wheel(e) {
        const factor = Math.exp(-Math.max(-300, Math.min(300, e.deltaY)) * 0.0015);
        handlers.onZoom?.(factor, e.clientX, e.clientY);
      },
    };
  }

  CL.gestures = { THRESHOLD, recognizer };
})(typeof window !== 'undefined' ? window : globalThis);
