import { useTheme } from "../../hooks/useTheme";
import type { ThemePreference } from "../../providers/themeContext";
import { cn } from "../../lib/cn";

const OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀" },
  { value: "system", label: "System", icon: "◐" },
  { value: "dark", label: "Dark", icon: "☾" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn("inline-flex rounded-lg border border-line bg-surface-2 p-0.5", className)}
    >
      {OPTIONS.map((option) => {
        const active = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.label}
            onClick={() => setPreference(option.value)}
            className={cn(
              "grid h-7 w-7 place-content-center rounded-md text-xs transition",
              active ? "bg-surface text-ink shadow-sm" : "text-ink-faint hover:text-ink",
            )}
          >
            <span aria-hidden>{option.icon}</span>
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
