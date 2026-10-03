import type { LearningStatus } from "./types";

export function deriveLearningStatus(input: {
  attendance: number;
  latestQuiz: number;
  reinforcementSignals?: number;
  incompleteMilestones?: number;
}): LearningStatus {
  const reinforcementSignals = input.reinforcementSignals ?? 0;
  const incompleteMilestones = input.incompleteMilestones ?? 0;

  if (
    input.attendance < 70 ||
    incompleteMilestones >= 2 ||
    (input.latestQuiz < 50 && reinforcementSignals >= 2)
  ) {
    return "follow_up";
  }

  if (
    input.attendance < 85 ||
    input.latestQuiz < 60 ||
    reinforcementSignals >= 3 ||
    incompleteMilestones === 1
  ) {
    return "reinforce";
  }

  return "on_track";
}
