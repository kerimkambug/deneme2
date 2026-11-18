import { useStore } from '../../data/store';
import { useT } from '../../lib/prefs';

export function LocationSelect({ value, onChange, exclude, required }: { value: string; onChange: (v: string) => void; exclude?: string; required?: boolean }) {
  const locations = useStore((s) => s.locations);
  const { t } = useT();
  const airports = locations.filter((l) => l.kind === 'airport' && l.id !== exclude);
  const regions = locations.filter((l) => l.kind === 'region' && l.id !== exclude);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{t('wSelect')}</option>
      <optgroup label={t('airports')}>
        {airports.map((l) => (
          <option key={l.id} value={l.id}>
            {l.code ? `${l.name} (${l.code})` : l.name}
          </option>
        ))}
      </optgroup>
      <optgroup label={t('regions')}>
        {regions.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
