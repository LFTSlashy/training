import { useEffect, useState } from 'react';
import { useSession } from './store/session';
import { useMarket } from './store/market';
import { useAccount } from './store/account';
import { useWorkspace, type Page } from './store/workspace';
import { api } from './lib/api';
import { feed } from './lib/feed';
import type { Instrument, NewsItem } from './lib/types';
import { Login } from './components/Login';
import { TopBar } from './components/TopBar';
import { TickerTape } from './components/TickerTape';
import { Workspace } from './components/Workspace';
import { StatusBar } from './components/StatusBar';
import { Toasts } from './components/Toasts';

function Terminal() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [instruments, news, layout] = await Promise.all([
          api.get<Instrument[]>('/instruments'),
          api.get<NewsItem[]>('/news?limit=150'),
          api.get<{ pages: Page[] } | null>('/layout').catch(() => null),
          useAccount.getState().refresh(),
        ]);
        if (cancelled) return;
        useMarket.getState().setInstruments(instruments);
        useMarket.setState({ news });
        useWorkspace.getState().hydrate(layout?.pages ?? null);
        feed.connect();
        setReady(true);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; feed.disconnect(); };
  }, []);

  if (error) return <div className="empty" style={{ height: '100vh' }}>Could not reach the QUANTA server: {error}<br /><button className="btn" onClick={() => location.reload()}>Retry</button></div>;
  if (!ready) return <Splash text="Connecting to market data…" />;
  return (
    <div className="app">
      <TopBar />
      <TickerTape />
      <Workspace />
      <StatusBar />
      <Toasts />
    </div>
  );
}

function Splash({ text }: { text: string }) {
  return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div className="brand" style={{ fontSize: 16 }}><div className="brand-mark">Q</div>QUANTA <small>TERMINAL</small></div>
        <div className="loading" style={{ height: 24 }} />
        <div className="muted">{text}</div>
      </div>
    </div>
  );
}

export default function App() {
  const ready = useSession((s) => s.ready);
  const user = useSession((s) => s.user);
  const init = useSession((s) => s.init);
  useEffect(() => { init(); }, [init]);
  if (!ready) return <Splash text="Loading…" />;
  return user ? <Terminal key={user.id} /> : <><Login /><Toasts /></>;
}
