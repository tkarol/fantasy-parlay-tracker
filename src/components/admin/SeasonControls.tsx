import { useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader, Field, Input, Modal } from "../ui";
import { useToast } from "../../hooks/useToast";
import { startSeason } from "../../lib/api";
import { nextSeasonNumber } from "../../lib/stats";
import { nextThursdaySixPm } from "../../lib/dates";
import type { Week } from "../../types/models";

/**
 * Starting a new year. The league stopped partway through a season once
 * already, so this never assumes the previous season "finished" — it just
 * opens week 1 of the next one and leaves the old season's history alone.
 */
export function SeasonControls({
  leagueId,
  weeks,
  seasons,
  defaultStake,
  onSeasonStarted,
}: {
  leagueId: string;
  weeks: Week[];
  seasons: number[];
  defaultStake: number;
  onSeasonStarted: (weekId: string) => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [season, setSeason] = useState(String(nextSeasonNumber(weeks)));
  const [stake, setStake] = useState(String(defaultStake));
  const [saving, setSaving] = useState(false);

  const currentSeason = seasons[0];
  const lastWeek = weeks.filter((week) => week.season === currentSeason).at(-1);

  return (
    <Card>
      <CardHeader
        title="Seasons"
        description={
          currentSeason
            ? `Currently running ${currentSeason}${lastWeek ? `, through week ${lastWeek.week}` : ""}.`
            : "No season has been started yet."
        }
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSeason(String(nextSeasonNumber(weeks)));
              setStake(String(defaultStake));
              setOpen(true);
            }}
          >
            Start a new season
          </Button>
        }
      />
      <CardBody>
        {seasons.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Start a season to open week 1 and begin taking legs.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {seasons.map((value) => {
              const count = weeks.filter((week) => week.season === value).length;
              return (
                <li key={value}>
                  <Badge tone={value === currentSeason ? "brand" : "neutral"}>
                    {value} · {count} week{count === 1 ? "" : "s"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-3 text-xs text-ink-faint">
          Starting a new season opens week 1 of that year. Previous seasons stay exactly as they
          are and remain available in the stats.
        </p>
      </CardBody>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Start a new season"
        description="This opens week 1. Nothing about earlier seasons changes."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={saving}
              onClick={async () => {
                const seasonValue = Number(season);
                const stakeValue = Number(stake);
                if (!Number.isInteger(seasonValue) || seasonValue < 2000) {
                  toast.error("Check the year", "Use a year like 2026.");
                  return;
                }
                if (seasons.includes(seasonValue)) {
                  toast.error(`${seasonValue} already exists`, "Pick a different year.");
                  return;
                }
                if (!Number.isFinite(stakeValue) || stakeValue < 0) {
                  toast.error("Check the stake", "Enter a number like 5 or 20.");
                  return;
                }

                setSaving(true);
                try {
                  const weekId = await startSeason(
                    leagueId,
                    seasonValue,
                    stakeValue,
                    nextThursdaySixPm(),
                  );
                  onSeasonStarted(weekId);
                  toast.success(`${seasonValue} is open`, "Week 1 is ready for legs.");
                  setOpen(false);
                } catch (error) {
                  toast.error("Couldn't start that season", (error as Error)?.message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              Start season
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Year">
            {(id) => (
              <Input
                id={id}
                value={season}
                inputMode="numeric"
                onChange={(event) => setSeason(event.target.value)}
              />
            )}
          </Field>
          <Field label="Weekly stake">
            {(id) => (
              <Input
                id={id}
                value={stake}
                inputMode="decimal"
                onChange={(event) => setStake(event.target.value)}
              />
            )}
          </Field>
        </div>
      </Modal>
    </Card>
  );
}
