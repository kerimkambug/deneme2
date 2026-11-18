import { NavLink } from 'react-router-dom';
import { Globe, LayoutDashboard, Car } from 'lucide-react';

/** Sadece sunum (demo) derlemesinde görünür: ekranlar arası hızlı geçiş. */
export function DemoBar() {
  return (
    <nav className="demobar" aria-label="Demo ekranları">
      <span>DEMO</span>
      <NavLink to="/" end><Globe size={15} /> Site</NavLink>
      <NavLink to="/panel"><LayoutDashboard size={15} /> Panel</NavLink>
      <NavLink to="/surucu"><Car size={15} /> Şoför</NavLink>
    </nav>
  );
}
