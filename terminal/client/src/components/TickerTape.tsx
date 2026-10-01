import { memo } from 'react';
import { useMarket } from '../store/market';
import { useWorkspace } from '../store/workspace';
import { fmtChange, fmtPrice, signClass } from '../lib/format';

const SYMBOLS = ['SPX', 'NDX', 'INDU', 'RTY', 'VIX', 'SX5E', 'DAX', 'UKX', 'NKY', 'HSI', 'USGG10YR', 'EURUSD', 'USDJPY', 'GBPUSD', 'BTCUSD', 'ETHUSD', 'GC1', 'CL1', 'NG1', 'HG1', 'AAPL', 'MSFT', 'NVDA', 'AMZN', 'TSLA'];

export const TickerTape = memo(function TickerTape() {
  const quotes = useMarket((s) => s.quotes);
  const instruments = useMarket((s) => s.instruments);
  const open = (symbol: string) => {
    const ws = useWorkspace.getState();
    ws.load(ws.activePanel, { symbol, fn: 'GP' });
  };
  const items = SYMBOLS.filter((s) => quotes[s]);
  return (
    <div className="tape">
      <div className="tape-track">
        {[...items, ...items].map((s, i) => {
          const q = quotes[s];
          const inst = instruments[s];
          return (
            <span key={`${s}${i}`} className="tape-item" onClick={() => open(s)}>
              <span className="s">{s}</span>
              <span>{fmtPrice(q.last, inst)}</span>
              <span className={signClass(q.changePct)}>{q.changePct >= 0 ? '▲' : '▼'} {fmtChange(q.changePct, inst)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
});
