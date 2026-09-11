import { Badge, type BadgeTone } from "../ui";
import type { LegResult } from "../../types/models";

const TONES: Record<LegResult, BadgeTone> = {
  Win: "good",
  Loss: "bad",
  Push: "warn",
  Void: "warn",
  Pending: "neutral",
};

export function ResultBadge({ result }: { result: LegResult }) {
  return <Badge tone={TONES[result]}>{result}</Badge>;
}
