import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { preferredLaunchMode, launchBlocked, type LaunchMode } from "@core";
import { useToolContext } from "@/app/tool-context";
import { useSettings } from "@/app/settings";
import { Button, Select, ErrorNotice } from "./ui";
export function LaunchControls({
  id,
  name,
  kind = "app",
  supportsRtl = false,
}: {
  id: string;
  name: string;
  kind?: "app" | "editor";
  supportsRtl?: boolean;
}) {
  const { t } = useTranslation("ux");
  const ctx = useToolContext();
  const { settings } = useSettings();
  const available =
    supportsRtl && ctx.components.some((c) => c.id === id && c.available);
  const saved = settings.launchModeByApp[id];
  const [choice, setChoice] = useState<LaunchMode | undefined>();
  useEffect(() => setChoice(undefined), [id]);
  const mode = choice ?? preferredLaunchMode(saved, supportsRtl, available);
  const state = ctx.states[id];
  const key = kind + ":" + id;
  const busy = ctx.busy[key] ?? false;
  const blocked =
    kind === "app" ? launchBlocked(mode, state, available, busy) : busy;
  const reason =
    kind === "app" &&
    (!state
      ? t("stateUnknown")
      : state.phase === "running"
        ? t("alreadyRunning")
        : state.phase === "starting"
          ? t("checking")
          : mode === "rtl" && !available
            ? t("rtlMissing")
            : "");
  return (
    <div className="space-y-2">
      <div className="vh-launch-actions">
        {supportsRtl && (
          <Select
            aria-label={t("modeFor", { name })}
            value={mode}
            onChange={setChoice}
            disabled={busy}
            className="max-w-40"
            options={[
              { value: "normal", label: t("normal") },
              { value: "rtl", label: t("runRtl") },
            ]}
          />
        )}
        <Button
          variant="primary"
          disabled={blocked}
          loading={busy}
          aria-label={(mode === "rtl" ? t("runRtl") : t("run")) + " " + name}
          onClick={() => void ctx.launch(id, kind, mode)}
        >
          <Play aria-hidden="true" size={15} />
          {mode === "rtl" ? t("runRtl") : t("run")}
        </Button>
      </div>
      {reason && (
        <div className="max-w-xl text-xs text-muted" role="status">
          {reason}
          {!state && (
            <button
              className="ms-2 underline"
              onClick={() => void ctx.checkState(id)}
            >
              {t("retry")}
            </button>
          )}
        </div>
      )}
      {ctx.messages[key] && (
        <p role="status" className="text-xs text-success">
          {t("requestAccepted")}
        </p>
      )}
      {ctx.failures[key] && <ErrorNotice error={ctx.failures[key]} />}
    </div>
  );
}
