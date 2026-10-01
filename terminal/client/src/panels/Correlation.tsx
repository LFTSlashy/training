import { useState } from 'react';
import type { PanelProps } from './registry';
import { useApi } from '../lib/hooks';
import { Loading, Seg } from '../components/common';
import { useMarket } from '../store/market';

interface Corr { symbols: string[]; days: number; matrix: number[][] }
const SETS: Record<string, string> = {
  'Cross-asset': 'SPX,NDX,SX5E,NKY,HSI,EURUSD,USDJPY,GC1,CL1,BTCUSD,USGG10YR,VIX',
  'Mega-cap tech': 'AAPL,MSFT,NVDA,AMZN,GOOGL,META,TSLA,AVGO,AMD,TSM',
  'Sectors': 'AAPL,JPM,XOM,LLY,WMT,CAT,DIS,KO,BA,GS',
  'FX': 'EURUSD,GBPUSD,USDJPY,USDCHF,AUDUSD,USDCAD,NZDUSD,USDCNH',
  'Crypto': 'BTCUSD,ETHUSD,SOLUSD,BNBUSD,XRPUSD,ADAUSD,DOGEUSD,AVAXUSD,NDX',
};

const color = (v: number) => (v >= 0 ? `rgba(61, 139, 253, ${Math.abs(v) * 0.85})` : `rgba(240, 77, 85, ${Math.abs(v) * 0.85})`);

export default function Correlation({ load }: PanelProps) {
  const [set, setSet] = useState('Cross-asset');
  const [days, setDays] = useState('90');
  const [custom, setCustom] = useState('');
  const symbols = custom || SETS[set];
  const { data } = useApi<Corr>(`/analytics/correlation?symbols=${symbols}&days=${days}`);
  const instruments = useMarket((s) => s.instruments);
  return (
    <div>
      <div className="toolbar">
        {Object.keys(SETS).map((s) => <span key={s} className={`chip ${s === set && !custom ? 'on' : ''}`} onClick={() => { setSet(s); setCustom(''); }}>{s}</span>)}
        <span className="spacer" />
        <Seg value={days} options={['30', '90', '180', '365']} onChange={setDays} />
      </div>
      <div className="toolbar">
        <input className="input" style={{ height: 24 }} placeholder="Custom list: AAPL,MSFT,GC1 … (Enter)" onKeyDown={(e) => { if (e.key === 'Enter') setCustom((e.target as HTMLInputElement).value.toUpperCase().replace(/\s+/g, '')); }} />
      </div>
      {!data ? <Loading /> : (
        <div style={{ padding: 8, overflow: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontFamily: 'var(--mono)', fontSize: 10.5 }}>
            <thead><tr><th />{data.symbols.map((s) => <th key={s} style={{ color: 'var(--amber)', fontWeight: 600, padding: '2px 4px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 64 }}>{s}</th>)}</tr></thead>
            <tbody>
              {data.symbols.map((r, i) => (
                <tr key={r}>
                  <td style={{ color: 'var(--amber)', fontWeight: 600, paddingRight: 6, cursor: 'pointer' }} title={instruments[r]?.name} onClick={() => load({ symbol: r })}>{r}</td>
                  {data.matrix[i].map((v, j) => (
                    <td key={j} title={`${r} / ${data.symbols[j]}: ${v.toFixed(3)}`} style={{ background: i === j ? 'var(--bg-4)' : color(v), width: 44, height: 26, textAlign: 'center', borderRadius: 3, color: Math.abs(v) > 0.55 ? '#fff' : 'var(--text-2)' }}>
                      {i === j ? '' : v.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="muted" style={{ marginTop: 8, fontSize: 11 }}>Pearson correlation of daily log returns over {data.days} days (yield changes for rates). Blue = positive, red = negative.</div>
        </div>
      )}
    </div>
  );
}
