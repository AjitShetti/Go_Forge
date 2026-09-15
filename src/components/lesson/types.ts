import type { LessonBundle } from "@/lib/content/load";
import type { LessonEvent, LessonState } from "@/lib/lesson/machine";
import type { RecordExtras } from "@/lib/lesson/recorder";

export type Dispatch = (event: LessonEvent, extras?: RecordExtras) => boolean;

export type StepProps = {
  bundle: LessonBundle;
  state: LessonState;
  dispatch: Dispatch;
};
