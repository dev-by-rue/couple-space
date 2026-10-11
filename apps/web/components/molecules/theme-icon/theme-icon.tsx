import { CalendarHeart, Coffee, Compass, HandHeart, House, MessageCircleHeart, type LucideIcon } from "lucide-react";

const THEME_ICONS: Record<string, LucideIcon> = {
  coffie: Coffee,
  compass: Compass,
  house: House,
  'calendar-heart': CalendarHeart,
  'message-circle-heart': MessageCircleHeart,
  'hand-heart': HandHeart
};

export function ThemeIcon({ symbol, className }: Readonly<{ symbol: keyof typeof THEME_ICONS, className?: string }>) {
  const Icon = THEME_ICONS[symbol];
  return <Icon className={className} />;
}
