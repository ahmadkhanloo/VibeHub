// Lesson progress marks. Progress describes what this person finished and
// never leaves the device: it lives in localStorage next to the other local
// preferences and is not synced or reported anywhere.

import { useCallback, useState } from "react";

const STORAGE_KEY = "vibehub.progress.v1";

type ProgressMap = Record<string, boolean>;

function load(): ProgressMap {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([, value]) => value === true,
      ),
    ) as ProgressMap;
  } catch {
    return {};
  }
}

export function useLessonProgress() {
  const [done, setDone] = useState<ProgressMap>(load);
  const mark = useCallback((id: string, value: boolean) => {
    setDone((current) => {
      const next = { ...current, [id]: value };
      if (!value) delete next[id];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* Progress still works for the session when persistence is unavailable. */
      }
      return next;
    });
  }, []);
  return { done, mark };
}
