import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const STORAGE_PREFIX = 'floatingWindow:';
let zCounter = 10;

function loadRect(id, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_PREFIX + id));
    if (saved && typeof saved.x === 'number') return { ...fallback, ...saved };
  } catch {
    /* ignore, on repart des valeurs par défaut */
  }
  return fallback;
}

function saveRect(id, rect) {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(rect));
  } catch {
    /* stockage indisponible (navigation privée…) — tant pis, pas bloquant */
  }
}

// Fenêtre flottante déplaçable et redimensionnable (glisser l'en-tête pour bouger, la poignée en
// bas à droite pour redimensionner, le chevron pour replier) — pour que chaque panneau (config,
// itinéraire…) puisse être agrandi, réduit ou repositionné librement sur l'écran.
export default function FloatingWindow({ id, title, icon: Icon, defaultPosition, defaultSize, minWidth = 320, minHeight = 220, maxWidth = 720, headerExtra, children }) {
  const [rect, setRect] = useState(() => loadRect(id, { ...defaultPosition, ...defaultSize, collapsed: false }));
  const [z, setZ] = useState(() => ++zCounter);
  const dragRef = useRef(null);
  const rootRef = useRef(null);

  const bringToFront = useCallback(() => setZ(++zCounter), []);

  const startDrag = useCallback(
    (e) => {
      if (e.target.closest('[data-no-drag]')) return;
      bringToFront();
      dragRef.current = { type: 'move', startX: e.clientX, startY: e.clientY, origX: rect.x, origY: rect.y };
      document.body.style.userSelect = 'none';
      e.preventDefault();
    },
    [rect.x, rect.y, bringToFront]
  );

  const startResize = useCallback(
    (e) => {
      bringToFront();
      dragRef.current = { type: 'resize', startX: e.clientX, startY: e.clientY, origW: rect.width, origH: rect.height };
      document.body.style.userSelect = 'none';
      e.preventDefault();
      e.stopPropagation();
    },
    [rect.width, rect.height, bringToFront]
  );

  useEffect(() => {
    function onMove(e) {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (d.type === 'move') {
        const maxX = window.innerWidth - 60;
        const maxY = window.innerHeight - 44;
        setRect((r) => ({ ...r, x: Math.min(Math.max(d.origX + dx, -r.width + 100), maxX), y: Math.min(Math.max(d.origY + dy, 0), maxY) }));
      } else {
        const maxH = window.innerHeight - 40;
        setRect((r) => ({
          ...r,
          width: Math.min(Math.max(d.origW + dx, minWidth), maxWidth),
          height: Math.min(Math.max(d.origH + dy, minHeight), maxH),
        }));
      }
    }
    function onUp() {
      if (dragRef.current) {
        dragRef.current = null;
        document.body.style.userSelect = '';
        setRect((r) => {
          saveRect(id, r);
          return r;
        });
      }
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [id, minWidth, maxWidth, minHeight]);

  function toggleCollapse() {
    setRect((r) => {
      const next = { ...r, collapsed: !r.collapsed };
      saveRect(id, next);
      return next;
    });
  }

  return (
    <div
      ref={rootRef}
      onMouseDownCapture={bringToFront}
      className="glass-strong rounded-2xl pointer-events-auto flex flex-col overflow-hidden absolute"
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.collapsed ? 'auto' : rect.height, zIndex: z }}
    >
      <div onMouseDown={startDrag} className="flex items-center gap-2 px-4 py-3 cursor-grab active:cursor-grabbing select-none shrink-0 border-b border-border/10">
        {Icon && <Icon size={15} className="text-accent shrink-0" />}
        <h2 className="font-display font-semibold text-sm flex-1 truncate">{title}</h2>
        {headerExtra && <div data-no-drag>{headerExtra}</div>}
        <button
          data-no-drag
          onClick={toggleCollapse}
          className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-ink-faint hover:text-ink hover:bg-surface-3/60 transition-colors"
          title={rect.collapsed ? 'Déplier' : 'Replier'}
        >
          {rect.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {!rect.collapsed && <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>}

      {!rect.collapsed && (
        <div
          onMouseDown={startResize}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
          style={{ background: 'linear-gradient(135deg, transparent 50%, rgb(var(--ink-faint) / 0.35) 50%)' }}
        />
      )}
    </div>
  );
}
