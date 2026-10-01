import { useEffect, useMemo, useRef, useState } from 'react';
import { FUNCTIONS, resolveFn } from '../lib/functions';
import { runCommand } from '../lib/commands';
import { useMarket } from '../store/market';
import { toast } from '../store/toasts';
import { fmtChange, fmtPrice } from '../lib/format';

interface Suggestion { kind: 'sec' | 'fn' | 'hist'; key: string; label: string; right?: string; value: string }

const HIST_KEY = 'quanta.cmd.history';

export function CommandLine() {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch { return []; }
  });
  const [histIdx, setHistIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const list = useMarket((s) => s.list);
  const quotes = useMarket((s) => s.quotes);

  // Global hotkeys: typing anywhere (outside inputs) focuses the command line; '/' and Ctrl+K too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (!typing && e.key === '/')) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && /^[a-zA-Z]$/.test(e.key)) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const suggestions = useMemo<Suggestion[]>(() => {
    const raw = text.trim().toUpperCase();
    if (!raw) return history.slice(0, 8).map((h) => ({ kind: 'hist', key: '↺', label: h, value: h }));
    const parts = raw.split(/\s+/);
    const last = parts[parts.length - 1];
    const prefix = parts.slice(0, -1).join(' ');
    const out: Suggestion[] = [];
    const secs = list
      .map((i) => {
        const n = i.name.toUpperCase();
        const score = i.symbol === last ? 100 : i.symbol.startsWith(last) ? 80 - i.symbol.length : n.startsWith(last) ? 50 : n.includes(last) ? 30 : 0;
        return { i, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 7);
    for (const { i } of secs) {
      const q = quotes[i.symbol];
      out.push({ kind: 'sec', key: i.symbol, label: `${i.name}`, right: q ? `${fmtPrice(q.last, i)}  ${fmtChange(q.changePct, i)}` : i.assetClass, value: `${prefix ? `${prefix} ` : ''}${i.symbol}` });
    }
    const fns = FUNCTIONS.filter((f) => f.code.startsWith(last) || f.name.toUpperCase().includes(last) || resolveFn(last) === f.code).slice(0, 6);
    for (const f of fns) out.push({ kind: 'fn', key: f.code, label: f.name, right: f.category, value: `${prefix ? `${prefix} ` : ''}${f.code}` });
    return out;
  }, [text, list, quotes, history]);

  const execute = async (cmd: string) => {
    if (!cmd.trim()) return;
    const res = await runCommand(cmd);
    if (res.ok) {
      const h = [cmd.toUpperCase(), ...history.filter((x) => x !== cmd.toUpperCase())].slice(0, 30);
      setHistory(h);
      try { localStorage.setItem(HIST_KEY, JSON.stringify(h)); } catch { /* ignore */ }
      setText('');
      setOpen(false);
      inputRef.current?.blur();
    } else if (res.message) {
      toast({ kind: 'error', title: 'Command', body: res.message });
    }
    setHistIdx(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); setText(''); inputRef.current?.blur(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setSel((s) => Math.min(s + 1, suggestions.length - 1)); return; }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open && history.length) {
        const i = Math.min(histIdx + 1, history.length - 1);
        setHistIdx(i);
        setText(history[i]);
      } else setSel((s) => Math.max(s - 1, 0));
      return;
    }
    if (e.key === 'Tab' && suggestions[sel]) {
      e.preventDefault();
      setText(suggestions[sel].value + ' ');
      setSel(0);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const s = suggestions[sel];
      const typed = text.trim().toUpperCase();
      // Enter runs what was typed when it resolves; otherwise use the highlighted suggestion.
      const exact = typed && typed.split(/\s+/).every((t) => useMarket.getState().instruments[t] || resolveFn(t) || /^[\d.@,KM]+$/.test(t) || ['BUY', 'SELL', 'STP', 'LMT', 'LAYOUT', 'PAGE'].includes(t));
      execute(exact || !open || !s ? text : s.value);
    }
  };

  return (
    <div className="cmd">
      <span className="cmd-icon">&gt;</span>
      <input
        ref={inputRef}
        className="cmd-input"
        value={text}
        spellCheck={false}
        placeholder="Security or function — AAPL GP · EURUSD DOM · BUY NVDA 100 · HELP"
        onChange={(e) => { setText(e.target.value); setOpen(true); setSel(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {!text && <span className="cmd-hint">/ or Ctrl K</span>}
      {open && suggestions.length > 0 && (
        <div className="cmd-menu">
          {suggestions.some((s) => s.kind === 'hist') && <div className="cmd-section">Recent</div>}
          {suggestions.map((s, i) => (
            <div key={`${s.kind}${s.key}${i}`}>
              {(i === 0 || suggestions[i - 1].kind !== s.kind) && s.kind !== 'hist' && <div className="cmd-section">{s.kind === 'sec' ? 'Securities' : 'Functions'}</div>}
              <div className={`cmd-item ${i === sel ? 'sel' : ''}`} onMouseDown={(e) => { e.preventDefault(); execute(s.value); }} onMouseEnter={() => setSel(i)}>
                <span className="k">{s.key}</span>
                <span className="t">{s.label}</span>
                <span className="r mono">{s.right}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
