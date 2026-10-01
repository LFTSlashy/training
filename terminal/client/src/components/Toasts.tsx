import { useToasts } from '../store/toasts';

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismiss(t.id)}>
          <div className="tt">{t.title}</div>
          {t.body && <div className="tb">{t.body}</div>}
        </div>
      ))}
    </div>
  );
}
