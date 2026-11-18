import {
  Plane, Hotel, Clock, Route, Briefcase, Heart, Car, MapPin, ShieldCheck, Star, Crown, Ship, Calendar, Sparkles, Users, Luggage, Gift,
  type LucideIcon,
} from 'lucide-react';

export const SERVICE_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  plane: { icon: Plane, label: 'Uçak' },
  hotel: { icon: Hotel, label: 'Otel' },
  clock: { icon: Clock, label: 'Saat' },
  route: { icon: Route, label: 'Rota' },
  briefcase: { icon: Briefcase, label: 'İş' },
  heart: { icon: Heart, label: 'Kalp' },
  car: { icon: Car, label: 'Araç' },
  pin: { icon: MapPin, label: 'Konum' },
  shield: { icon: ShieldCheck, label: 'Güvenlik' },
  star: { icon: Star, label: 'Yıldız' },
  crown: { icon: Crown, label: 'Taç' },
  ship: { icon: Ship, label: 'Gemi / Liman' },
  calendar: { icon: Calendar, label: 'Takvim' },
  sparkles: { icon: Sparkles, label: 'Özel' },
  users: { icon: Users, label: 'Grup' },
  luggage: { icon: Luggage, label: 'Bagaj' },
  gift: { icon: Gift, label: 'Hediye' },
};

export function ServiceIcon({ name, size = 22 }: { name: string; size?: number }) {
  const I = SERVICE_ICONS[name]?.icon ?? Car;
  return <I size={size} strokeWidth={1.5} />;
}
