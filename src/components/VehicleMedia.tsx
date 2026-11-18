import { useState } from 'react';
import type { Vehicle } from '../types';
import { VehicleArt } from './VehicleArt';

export function VehicleMedia({ v, gallery }: { v: Vehicle; gallery?: boolean }) {
  const [i, setI] = useState(0);
  if (!v.images.length) return <div className="vmedia vmedia-art"><VehicleArt art={v.art} /></div>;
  return (
    <div className="vmedia">
      <img src={v.images[Math.min(i, v.images.length - 1)]} alt={v.name} loading="lazy" />
      {gallery && v.images.length > 1 && (
        <div className="vmedia-dots">
          {v.images.map((_, k) => (
            <button key={k} type="button" aria-label={`${k + 1}`} className={k === i ? 'on' : ''} onClick={(e) => { e.preventDefault(); setI(k); }} />
          ))}
        </div>
      )}
    </div>
  );
}
