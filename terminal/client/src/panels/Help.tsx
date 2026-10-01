import type { PanelProps } from './registry';
import { FUNCTIONS, ALIASES } from '../lib/functions';

export default function Help({ load }: PanelProps) {
  const cats = [...new Set(FUNCTIONS.map((f) => f.category))];
  return (
    <div style={{ padding: '0 0 12px' }}>
      <div className="section-title">Command line</div>
      <div className="kv-list">
        <div><span>Load security in active panel</span><span>AAPL &lt;Enter&gt;</span></div>
        <div><span>Security + function</span><span>EURUSD GP · NVDA DES · BTCUSD DOM</span></div>
        <div><span>Function only</span><span>WEI · PORT · N</span></div>
        <div><span>Market order</span><span>BUY AAPL 100</span></div>
        <div><span>Limit order</span><span>SELL MSFT 50 @ 450</span></div>
        <div><span>Stop / stop-limit</span><span>SELL TSLA 20 STP 230 [@ 229]</span></div>
        <div><span>Quantity shortcuts</span><span>BUY EURUSD 1M · BUY XRPUSD 10K</span></div>
        <div><span>Layout / page</span><span>LAYOUT 4 · PAGE 2</span></div>
      </div>
      <div className="section-title">Keyboard</div>
      <div className="kv-list">
        <div><span>Focus command line</span><span>/ · Ctrl+K · start typing</span></div>
        <div><span>Autocomplete / navigate</span><span>Tab · ↑ ↓</span></div>
        <div><span>Switch page</span><span>Alt+1 … Alt+5</span></div>
        <div><span>Cycle active panel</span><span>Ctrl+← / Ctrl+→</span></div>
        <div><span>Maximize panel</span><span>Double-click header · Esc to restore</span></div>
        <div><span>Click-trade on DOM ladder</span><span>Shift+Click a price level</span></div>
      </div>
      <div className="section-title">Panel linking</div>
      <p style={{ padding: '0 10px', margin: 0, color: 'var(--text-2)', lineHeight: 1.6 }}>
        Click the coloured square in a panel header to assign a link group. Panels sharing a colour follow the same security — change it in one (by command, click in a monitor, news ticker, blotter…) and all linked panels update.
      </p>
      {cats.map((c) => (
        <div key={c}>
          <div className="section-title">{c}</div>
          <table className="grid"><tbody>
            {FUNCTIONS.filter((f) => f.category === c).map((f) => (
              <tr key={f.code} className="clickable" onClick={() => load({ fn: f.code })}>
                <td className="sym" style={{ width: 60 }}>{f.code}</td>
                <td style={{ width: 160 }}>{f.name}</td>
                <td className="dim" style={{ whiteSpace: 'normal' }}>{f.description}</td>
                <td className="mono muted">{Object.entries(ALIASES).filter(([, v]) => v === f.code).map(([k]) => k).slice(0, 3).join(' ')}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      ))}
      <p className="muted" style={{ padding: '12px 10px 0', margin: 0, fontSize: 11 }}>
        Charts powered by <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--amber)' }}>TradingView Lightweight Charts™</a>. Market data is simulated by the QUANTA engine; trading is paper only.
      </p>
    </div>
  );
}
