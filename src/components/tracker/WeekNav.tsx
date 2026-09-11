import { Button, Select } from "../ui";
import { seasonsOf } from "../../lib/stats";
import type { Week } from "../../types/models";

/**
 * Season and week navigation. Split in two once a league spans more than one
 * year — a single flat list of every week ever played gets unusable fast.
 */
export function WeekNav({
  weeks,
  selectedId,
  onSelect,
}: {
  weeks: Week[];
  selectedId: string;
  onSelect: (weekId: string) => void;
}) {
  const selected = weeks.find((week) => week.id === selectedId);
  const seasons = seasonsOf(weeks);
  const season = selected?.season ?? seasons[0];
  const seasonWeeks = weeks.filter((week) => week.season === season);

  const index = seasonWeeks.findIndex((week) => week.id === selectedId);
  const previous = index > 0 ? seasonWeeks[index - 1] : undefined;
  const next = index >= 0 && index < seasonWeeks.length - 1 ? seasonWeeks[index + 1] : undefined;

  return (
    <div className="flex w-full items-center gap-1.5 sm:w-auto">
      <Button
        size="sm"
        variant="secondary"
        aria-label="Previous week"
        disabled={!previous}
        onClick={() => previous && onSelect(previous.id)}
      >
        ←
      </Button>

      {seasons.length > 1 && (
        <Select
          value={String(season ?? "")}
          aria-label="Season"
          className="!w-auto min-w-0 flex-1 sm:flex-none"
          onChange={(event) => {
            const nextSeason = Number(event.target.value);
            const target = weeks.filter((week) => week.season === nextSeason).at(-1);
            if (target) onSelect(target.id);
          }}
        >
          {seasons.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      )}

      <Select
        value={selectedId}
        onChange={(event) => onSelect(event.target.value)}
        aria-label="Week"
        className="!w-auto min-w-0 flex-1 sm:flex-none"
      >
        {seasonWeeks.map((week) => (
          <option key={week.id} value={week.id}>
            Week {week.week}
            {week.closed ? " · closed" : ""}
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
