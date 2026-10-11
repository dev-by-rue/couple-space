import {
  CalendarHeart,
  Coffee,
  Compass,
  HandHeart,
  House,
  MessageCircleHeart,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";

const THEME_ICONS: Record<string, LucideIcon> = {
  coffee: Coffee,
  compass: Compass,
  house: House,
  "calendar-heart": CalendarHeart,
  "message-circle-heart": MessageCircleHeart,
  "hand-heart": HandHeart,
};

type ThemeIconProps = {
  /** Lucide key stored on the theme (e.g. `"coffee"`). Unknown keys fall back to a sparkle. */
  symbol: string;
  className?: string;
};

export function ThemeIcon({ symbol, className }: Readonly<ThemeIconProps>) {
  const Icon = THEME_ICONS[symbol] ?? SparklesIcon;
  return <Icon className={className} />;
}
