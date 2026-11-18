import { useStore } from '../data/store';
import { useT } from '../lib/prefs';

export function Brand({ compact }: { compact?: boolean }) {
  const s = useStore((x) => x.settings);
  const { tl } = useT();
  return (
    <span className="brand">
      {s.logo ? (
        <img className="brand-logo" src={s.logo} alt={s.companyName} />
      ) : (
        <span className="brand-mark" aria-hidden="true">
          {s.shortName.slice(0, 1)}
        </span>
      )}
      <span className="brand-text">
        <b>{s.shortName}</b>
        {!compact && <small>{tl(s.tagline)}</small>}
      </span>
    </span>
  );
}
