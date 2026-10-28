import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, SlidersHorizontal } from "lucide-react";
import { Link } from 'react-router-dom';
import { preferredLaunchMode, launchBlocked, launchFailureKind, type LaunchMode } from "@core";
import { useToolContext } from "@/app/tool-context";
import { useSettings } from "@/app/settings";
import { Button, Select, ErrorNotice } from "./ui";
export function LaunchControls({
  id,
  name,
  kind = "app",
  supportsRtl = false,
  compact = false,
}: {
  id: string;
  name: string;
  kind?: "app" | "editor";
  supportsRtl?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation("ux");
  const ctx = useToolContext();
  const { settings } = useSettings();
  const available =
    supportsRtl && ctx.components.some((c) => c.id === id && c.available);
  const saved = settings.launchModeByApp[id];
  const [choice, setChoice] = useState<LaunchMode | undefined>();
  const [optionsOpen, setOptionsOpen] = useState(false);
  useEffect(() => { setChoice(undefined); setOptionsOpen(false); }, [id]);
  const mode = choice ?? preferredLaunchMode(saved, supportsRtl && id !== "antigravity", available);
  const state = ctx.states[id];
  const key = kind + ":" + id;
  const failureKind = launchFailureKind(ctx.failures[key]);
  const busy = ctx.busy[key] ?? false;
  const managed = kind === "app" || id === "antigravity";
  const preview = ctx.apps.some(app => app.via === 'browser-preview');
  const blocked =
    preview || (managed ? launchBlocked(mode, state, available, busy) : busy);
  const reason =
    preview ? t('browserLaunchUnavailable') : managed &&
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
    <div className={compact ? 'vh-launch-compact' : 'vh-launch-full'}>
      <div className="vh-launch-actions">
        {supportsRtl && !compact && (
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
          {preview ? t('desktopOnly') : mode === "rtl" ? t("runRtl") : t("run")}
        </Button>
        {supportsRtl && compact && <Button variant="ghost" aria-label={t('modeFor', { name })} title={t('modeFor', { name })} aria-expanded={optionsOpen} onClick={() => setOptionsOpen(!optionsOpen)}><SlidersHorizontal size={16} aria-hidden="true" /></Button>}
      </div>
      {compact && optionsOpen && <div className="vh-launch-options" onKeyDown={event => { if (event.key === 'Escape') { setOptionsOpen(false); event.currentTarget.previousElementSibling?.querySelector<HTMLButtonElement>('[aria-expanded]')?.focus(); } }}>
        <label className="block space-y-2 text-sm"><span>{t('modeFor', { name })}</span><Select aria-label={t('modeFor', { name })} value={mode} onChange={setChoice} disabled={busy} options={[{ value: 'normal', label: t('normal') }, { value: 'rtl', label: t('runRtl') }]} /></label>
        {id === 'antigravity' && <p className="mt-2 text-xs text-warning">{t('rtlExperimental')}</p>}
      </div>}
      {reason && (
        <div className="max-w-xl text-xs text-muted" role="status">
          {reason}
          {!preview && (!state || state.phase === 'running' || state.phase === 'starting') && !busy && (
            <button
              className="ms-2 underline"
              aria-label={t('refresh') + ' ' + name}
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
      {ctx.failures[key] && <div className="space-y-2">
        <ErrorNotice error={ctx.failures[key]}
          message={failureKind ? t(`launchFailure.${failureKind}`, { name }) : undefined}
          recovery={failureKind ? t(`launchFailure.${failureKind}Recovery`, { name }) : undefined}
          onRetry={failureKind && !busy ? () => { void ctx.launch(id, kind, mode); } : undefined} />
        {failureKind && <Link className="vh-button vh-button-ghost text-sm" to={`/doctor?tool=${encodeURIComponent(id)}&kind=app`}>{t('doctor')}</Link>}
      </div>}
    </div>
  );
}
