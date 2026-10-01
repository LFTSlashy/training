import { useState } from 'react';
import type { PanelProps } from './registry';
import { useApi, useNow } from '../lib/hooks';
import { Loading } from '../components/common';
import { fmtTime } from '../lib/format';

interface Ev { id: string; t: number; country: string; event: string; importance: number; unit: string; survey: number; prior: number; actual: number | null }
const FLAGS: Record<string, string> = { US: '🇺🇸', EZ: '🇪🇺', DE: '🇩🇪', GB: '🇬🇧', JP: '🇯🇵', CN: '🇨🇳', CA: '🇨🇦', AU: '🇦🇺', CH: '🇨🇭' };

export default function Calendar(_: PanelProps) {
  const { data } = useApi<Ev[]>('/calendar', 60_000);
  const now = useNow(30_000);
  const [minImp, setMinImp] = useState(1);
  const [countries, setCountries] = useState<string[]>([]);
  if (!data) return <Loading />;
  const rows = data.filter((e) => e.importance >= minImp && (!countries.length || countries.includes(e.country)));
  const byDay = new Map<string, Ev[]>();
  for (const e of rows) {
    const k = new Date(e.t).toDateString();
    byDay.set(k, [...(byDay.get(k) || []), e]);
  }
  const fmtV = (v: number | null, u: string) => (v === null ? '' : `${v}${u === '%' ? '%' : u}`);
  return (
    <div>
      <div className="toolbar">
        <div className="seg">{[1, 2, 3].map((i) => <button key={i} className={minImp === i ? 'on' : ''} onClick={() => setMinImp(i)}>{'★'.repeat(i)}</button>)}</div>
        {Object.keys(FLAGS).map((c) => <span key={c} className={`chip ${countries.includes(c) ? 'on' : ''}`} onClick={() => setCountries(countries.includes(c) ? countries.filter((x) => x !== c) : [...countries, c])}>{FLAGS[c]} {c}</span>)}
      </div>
      <table className="grid">
        <thead><tr><th>Time</th><th>Ctry</th><th>Event</th><th>Imp</th><th className="num">Actual</th><th className="num">Survey</th><th className="num">Prior</th></tr></thead>
        <tbody>
          {[...byDay.entries()].map(([day, evs]) => [
            <tr key={day} className="group"><td colSpan={7}>{new Date(evs[0].t).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}{new Date(evs[0].t).toDateString() === new Date(now).toDateString() ? ' — TODAY' : ''}</td></tr>,
            ...evs.map((e) => {
              const beat = e.actual !== null && e.actual !== e.survey ? (e.actual > e.survey ? 'up' : 'down') : '';
              const past = e.t < now;
              return (
                <tr key={e.id} style={{ opacity: past ? 0.75 : 1 }}>
                  <td className="mono">{fmtTime(e.t, false)}</td>
                  <td>{FLAGS[e.country]} <span className="mono muted">{e.country}</span></td>
                  <td>{e.event}</td>
                  <td className="amber">{'★'.repeat(e.importance)}</td>
                  <td className={`num mono b ${beat}`}>{e.actual === null ? <span className="muted">{past ? '…' : ''}</span> : fmtV(e.actual, e.unit)}</td>
                  <td className="num mono dim">{fmtV(e.survey, e.unit)}</td>
                  <td className="num mono muted">{fmtV(e.prior, e.unit)}</td>
                </tr>
              );
            }),
          ])}
        </tbody>
      </table>
    </div>
  );
}
