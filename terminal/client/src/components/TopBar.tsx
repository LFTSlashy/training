import { useState } from 'react';
import { CommandLine } from './CommandLine';
import { LayoutPicker } from './Workspace';
import { useWorkspace } from '../store/workspace';
import { useSession } from '../store/session';
import { useNow } from '../lib/hooks';
import { feed } from '../lib/feed';
import { api } from '../lib/api';
import { useAccount } from '../store/account';
import { toast } from '../store/toasts';

const MARKETS = [
  { label: 'NEW YORK', tz: 'America/New_York', open: [9.5, 16] },
  { label: 'LONDON', tz: 'Europe/London', open: [8, 16.5] },
  { label: 'FRANKFURT', tz: 'Europe/Berlin', open: [9, 17.5] },
  { label: 'TOKYO', tz: 'Asia/Tokyo', open: [9, 15] },
  { label: 'HONG KONG', tz: 'Asia/Hong_Kong', open: [9.5, 16] },
];

function Clock({ label, tz, open, now }: { label: string; tz: string; open: number[]; now: number }) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const m = Number(parts.find((p) => p.type === 'minute')?.value);
  const wd = parts.find((p) => p.type === 'weekday')?.value;
  const t = h + m / 60;
  const isOpen = wd !== 'Sat' && wd !== 'Sun' && t >= open[0] && t < open[1];
  return (
    <div className="clock" title={isOpen ? 'Exchange open' : 'Exchange closed'}>
      <span>{label}</span>
      <span className={isOpen ? 'open' : 'closed'}>{String(h).padStart(2, '0')}:{String(m).padStart(2, '0')} {isOpen ? '●' : '○'}</span>
    </div>
  );
}

export function TopBar() {
  const now = useNow(10_000);
  const pages = useWorkspace((s) => s.pages);
  const pageId = useWorkspace((s) => s.pageId);
  const setPage = useWorkspace((s) => s.setPage);
  const resetPages = useWorkspace((s) => s.resetPages);
  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);
  const [menu, setMenu] = useState(false);

  const resetAccount = async () => {
    setMenu(false);
    if (!confirm('Reset paper-trading account? All positions, orders and history will be cleared.')) return;
    await api.post('/account/reset');
    await useAccount.getState().refresh();
    toast({ kind: 'success', title: 'Account reset', body: 'Starting balance restored.' });
  };

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">Q</div>
        QUANTA <small>TERMINAL</small>
      </div>
      <CommandLine />
      <nav className="pages">
        {pages.map((p, i) => (
          <button key={p.id} className={`page-tab ${p.id === pageId ? 'on' : ''}`} onClick={() => setPage(p.id)} title={`Alt+${i + 1}`}>
            {p.name}<kbd>{i + 1}</kbd>
          </button>
        ))}
      </nav>
      <LayoutPicker />
      <div className="top-right">
        <div className="clocks">{MARKETS.map((m) => <Clock key={m.label} {...m} now={now} />)}</div>
        <button className="user-btn" onClick={() => setMenu(!menu)}>
          <span className="avatar">{(user?.displayName || user?.username || '?')[0].toUpperCase()}</span>
          <span>{user?.displayName || user?.username}</span>
        </button>
        {menu && (
          <div className="menu" onMouseLeave={() => setMenu(false)}>
            <div style={{ padding: '6px 10px', color: 'var(--muted)', fontSize: 11 }}>Signed in as <b style={{ color: 'var(--text)' }}>{user?.username}</b></div>
            <hr />
            <button onClick={() => { resetPages(); setMenu(false); }}>Restore default workspace</button>
            <button onClick={resetAccount}>Reset paper account</button>
            <hr />
            <button onClick={() => { feed.disconnect(); logout(); }}>Sign out</button>
          </div>
        )}
      </div>
    </header>
  );
}
