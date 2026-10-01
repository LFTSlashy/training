import { useAccount } from '../store/account';
import { useMarket } from '../store/market';
import { fmtPct, fmtUsd, signClass } from '../lib/format';

export function StatusBar() {
  const s = useAccount((x) => x.summary);
  const status = useMarket((x) => x.status);
  const latency = useMarket((x) => x.latency);
  return (
    <footer className="statusbar">
      <span className={`conn ${status}`}><i />{status === 'live' ? 'LIVE' : status === 'connecting' ? 'CONNECTING' : 'OFFLINE'}{latency !== null && status === 'live' ? ` ${latency}ms` : ''}</span>
      {s && (
        <>
          <span className="kv"><span>NAV</span><span>{fmtUsd(s.equity, 2)}</span></span>
          <span className="kv"><span>DAY P&amp;L</span><span className={signClass(s.dayPnl)}>{fmtUsd(s.dayPnl, 2)} ({fmtPct(s.dayPnlPct)})</span></span>
          <span className="kv"><span>TOTAL</span><span className={signClass(s.totalPnl)}>{fmtPct(s.totalPnlPct)}</span></span>
          <span className="kv"><span>CASH</span><span>{fmtUsd(s.cash)}</span></span>
          <span className="kv"><span>BP</span><span>{fmtUsd(s.buyingPower)}</span></span>
          <span className="kv"><span>LEV</span><span>{s.leverage.toFixed(2)}x</span></span>
          <span className="kv"><span>ORD</span><span>{s.workingOrders}</span></span>
        </>
      )}
      <span className="fkeys">
        <span><b>/</b> command</span>
        <span><b>Alt+1-5</b> pages</span>
        <span><b>Ctrl+←→</b> panels</span>
        <span><b>Esc</b> restore</span>
        <span><b>HELP</b> functions</span>
      </span>
    </footer>
  );
}
