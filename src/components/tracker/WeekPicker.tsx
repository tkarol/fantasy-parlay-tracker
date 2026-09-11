import { Button, Select } from "../ui";
import type { Week } from "../../types/models";

export function WeekPicker({
  weeks,
  selectedId,
  onSelect,
}: {
  weeks: Week[];
  selectedId: string;
  onSelect: (weekId: string) => void;
}) {
  const index = weeks.findIndex((week) => week.id === selectedId);
  const previous = index > 0 ? weeks[index - 1] : undefined;
  const next = index >= 0 && index < weeks.length - 1 ? weeks[index + 1] : undefined;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="secondary"
        aria-label="Previous week"
        disabled={!previous}
        onClick={() => previous && onSelect(previous.id)}
      >
        ←
      </Button>

      <Select
        value={selectedId}
        onChange={(event) => onSelect(event.target.value)}
        aria-label="Select week"
        className="w-auto min-w-[10rem]"
      >
        {weeks.map((week) => (
          <option key={week.id} value={week.id}>
            {week.season} · Week {week.week}
            {week.closed ? " (closed)" : ""}
          </option>
        ))}
      </Select>

      <Button
        size="sm"
        variant="secondary"
        aria-label="Next week"
        disabled={!next}
        onClick={() => next && onSelect(next.id)}
      >
        →
      </Button>
    </div>
  );
}
