import { Suspense, memo, useEffect, useState, Component, type ReactNode } from 'react';
import { useWorkspace, LAYOUTS, type LinkColor, type PanelState, type LayoutId } from '../store/workspace';
import { useMarket } from '../store/market';
import { FN, FUNCTIONS } from '../lib/functions';
import { PANELS } from '../panels/registry';
import { Loading } from './common';
import { fmtChange, fmtPrice, signClass } from '../lib/format';

class PanelBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) return <div className="empty">Panel error: {this.state.error.message}<br /><button className="btn sm" onClick={() => this.setState({ error: null })}>Retry</button></div>;
    return this.props.children;
  }
}

const LINKS: LinkColor[] = ['amber', 'blue', 'green', 'purple', null];
const AREAS = ['a', 'b', 'c', 'd', 'e', 'f'];

const HeaderQuote = memo(function HeaderQuote({ symbol }: { symbol: string }) {
  const q = useMarket((s) => s.quotes[symbol]);
  const inst = useMarket((s) => s.instruments[symbol]);
  if (!q) return null;
  return (
    <span className="mono" style={{ display: 'flex', gap: 8, fontSize: 11 }}>
      <span>{fmtPrice(q.last, inst)}</span>
      <span className={signClass(q.changePct)}>{fmtChange(q.changePct, inst)}</span>
    </span>
  );
});

function Panel({ p, area, active, maximized }: { p: PanelState; area: string; active: boolean; maximized: boolean }) {
  const ws = useWorkspace.getState(); // actions only — avoid re-rendering every panel on any workspace change
  const inst = useMarket((s) => s.instruments[p.symbol]);
  const [linkMenu, setLinkMenu] = useState(false);
  const [fnMenu, setFnMenu] = useState(false);
  const def = FN[p.fn] ?? FN.HELP;
  const Comp = PANELS[p.fn] ?? PANELS.HELP;
  const chartLike = p.fn === 'GP' || p.fn === 'GC' || p.fn === 'HMAP';

  return (
    <section
      className={`panel ${active ? 'active' : ''} ${maximized ? 'max' : ''}`}
      style={{ gridArea: area }}
      onMouseDown={() => ws.setActive(p.id)}
    >
      <div className="panel-head" onDoubleClick={() => ws.toggleMaximize(p.id)}>
        <span className={`link-dot ${p.link ? `link-${p.link}` : ''}`} title="Security link group" onClick={() => setLinkMenu(!linkMenu)} />
        <span className="fn-badge" title="Change function" onClick={() => setFnMenu(!fnMenu)}>{def.code}</span>
        <div className="panel-title">
          {def.security && <span className="sec" title={inst?.name}>{p.symbol}</span>}
          <span className={def.security ? 'nm' : 'fname'}>{def.security ? inst?.name : def.name}</span>
        </div>
        <div className="panel-actions">
          {def.security && <HeaderQuote symbol={p.symbol} />}
          <button className="icon-btn" title={maximized ? 'Restore (Esc)' : 'Maximize'} onClick={() => ws.toggleMaximize(p.id)}>{maximized ? '❐' : '⛶'}</button>
        </div>
        {linkMenu && (
          <div className="link-menu" onMouseLeave={() => setLinkMenu(false)}>
            {LINKS.map((l) => (
              <span key={String(l)} className={`link-dot ${l ? `link-${l}` : ''}`} title={l ? `Link group: ${l}` : 'Unlinked'} onClick={() => { ws.setLink(p.id, l); setLinkMenu(false); }} />
            ))}
          </div>
        )}
        {fnMenu && (
          <div className="cmd-menu" style={{ top: 26, left: 4, right: 'auto', width: 300 }} onMouseLeave={() => setFnMenu(false)}>
            {FUNCTIONS.map((f) => (
              <div key={f.code} className="cmd-item" onClick={() => { ws.load(p.id, { fn: f.code }); setFnMenu(false); }}>
                <span className="k">{f.code}</span><span className="t">{f.name}</span><span className="r">{f.category}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={`panel-body ${chartLike ? 'noscroll' : ''}`}>
        <PanelBoundary resetKey={`${p.fn}:${p.symbol}`}>
          <Suspense fallback={<Loading />}>
            <Comp
              key={p.fn}
              p={p}
              load={(change) => ws.load(p.id, change)}
              setParams={(params) => ws.setParams(p.id, params)}
            />
          </Suspense>
        </PanelBoundary>
      </div>
    </section>
  );
}

export function Workspace() {
  const page = useWorkspace((s) => s.pages.find((x) => x.id === s.pageId) ?? s.pages[0]);
  const activePanel = useWorkspace((s) => s.activePanel);
  const maximized = useWorkspace((s) => s.maximized);
  const layout = LAYOUTS[page.layout] ?? LAYOUTS.quad;
  const panels = page.panels.slice(0, layout.count);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ws = useWorkspace.getState();
      if (e.altKey && /^[1-9]$/.test(e.key)) {
        const pg = ws.pages[Number(e.key) - 1];
        if (pg) { e.preventDefault(); ws.setPage(pg.id); }
      } else if (e.key === 'Escape' && ws.maximized) {
        ws.toggleMaximize(ws.maximized);
      } else if (e.ctrlKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const pg = ws.page();
        const visible = pg.panels.slice(0, LAYOUTS[pg.layout].count);
        const i = visible.findIndex((x) => x.id === ws.activePanel);
        const next = visible[(i + (e.key === 'ArrowRight' ? 1 : visible.length - 1)) % visible.length];
        if (next) { e.preventDefault(); ws.setActive(next.id); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <main
      className="workspace"
      style={{ gridTemplateAreas: layout.areas.map((a) => `"${a}"`).join(' '), gridTemplateColumns: layout.cols, gridTemplateRows: layout.rows }}
    >
      {panels.map((p, i) => (
        <Panel key={`${page.id}:${p.id}`} p={p} area={AREAS[i]} active={p.id === activePanel} maximized={maximized === p.id} />
      ))}
    </main>
  );
}

export function LayoutPicker() {
  const page = useWorkspace((s) => s.pages.find((x) => x.id === s.pageId) ?? s.pages[0]);
  const setLayout = useWorkspace((s) => s.setLayout);
  return (
    <div className="seg" title="Panel layout">
      {(Object.keys(LAYOUTS) as LayoutId[]).map((id) => (
        <button key={id} className={page.layout === id ? 'on' : ''} onClick={() => setLayout(id)}>{LAYOUTS[id].label}</button>
      ))}
    </div>
  );
}
