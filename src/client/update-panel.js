import { HOST_ERROR_KEYS } from "./dicts.js";

const UPDATE_ENDPOINT = "/dsh-skins/update";
const RESTART_ENDPOINT = "/dsh-skins/restart";
const TERMINAL_PHASES = new Set(["done", "failed"]);

/** tr() guarded: returns the key itself when no translator is available. */
function safeTr(tr, key, params) {
  if (typeof tr !== "function") return key;
  const text = tr(key, params);
  return typeof text === "string" ? text : key;
}

/**
 * Localize a Host-reported error. The Host attaches a stable `code` (and
 * optional `params`) to every user-facing error and keeps a zh fallback
 * message; when the code maps to a dictionary key the localized template
 * wins, otherwise the raw Host text is shown unchanged. Accepts the plain
 * strings and Error shapes that never went through the Host fence.
 */
export function resolveHostErrorText(value, tr) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") return value;
  const key = value.code === undefined ? undefined : HOST_ERROR_KEYS[value.code];
  if (key !== undefined) {
    const text = safeTr(tr, key, value.params ?? {});
    if (text !== key) return text;
  }
  return value.text ?? value.message ?? String(value);
}

/**
 * Localize a failed update operation's message, composing the automatic
 * rollback suffix (with its own nested code) when a rollback also failed.
 */
export function resolveFailedOperationText(operation, tr) {
  if (operation === null || operation === undefined) return "";
  const base = resolveHostErrorText({ code: operation.code, params: operation.params, text: operation.message }, tr);
  const rollback = operation.rollbackError;
  if (rollback === null || rollback === undefined) return base;
  const reason = resolveHostErrorText(rollback, tr);
  const suffix = safeTr(tr, "host.update.rollbackSuffix", { reason });
  return suffix === "host.update.rollbackSuffix"
    ? `${base}；自动回滚失败：${reason}`
    : base + suffix;
}

/** Normalize a caught error into the panel's structured error state. */
function toPanelError(error) {
  return {
    text: error instanceof Error ? error.message : String(error),
    ...(error?.code === undefined ? {} : { code: error.code }),
    ...(error?.params === undefined ? {} : { params: error.params }),
  };
}

async function json(url, options) {
  const response = await fetch(url, options);
  const value = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(value.error || `HTTP ${response.status}`);
    if (value.code !== undefined) error.code = value.code;
    if (value.params !== undefined && value.params !== null) error.params = value.params;
    throw error;
  }
  return value;
}

export function createOperationPoller(options) {
  const schedule = options.schedule ?? setTimeout;
  const cancel = options.cancel ?? clearTimeout;
  const delay = options.delay ?? 450;
  let active = false;
  let timer;
  const tick = async () => {
    if (!active) return;
    const status = await options.loadStatus();
    const phase = status?.operation?.phase;
    if (active && phase && !TERMINAL_PHASES.has(phase)) timer = schedule(tick, delay);
  };
  return {
    start() {
      if (active) return;
      active = true;
      timer = schedule(tick, delay);
    },
    stop() {
      active = false;
      if (timer !== undefined) cancel(timer);
      timer = undefined;
    },
  };
}

export function createUpdatePanel(ctx, { jsx, react }) {
  const phaseKey = (phase) => `update.phase.${phase ?? "checking"}`;

  function UpdatePanel({ open, tr }) {
    const [view, setView] = react.useState({ kind: "idle", status: null, error: null });
    const [restartConfirm, setRestartConfirm] = react.useState(false);
    const [confirmUnknown, setConfirmUnknown] = react.useState(false);
    const [restarting, setRestarting] = react.useState(false);
    const [restartDeferred, setRestartDeferred] = react.useState(false);

    const loadStatus = react.useCallback(async (force = false, quiet = false) => {
      if (!quiet) setView((current) => ({ ...current, kind: "checking", error: null }));
      try {
        const status = await json(`${UPDATE_ENDPOINT}${force ? "?force=1" : ""}`, force ? {
          headers: { "x-dsh-skins-force": "1" },
        } : undefined);
        setView({ kind: "ready", status, error: null });
        return status;
      } catch (error) {
        setView({ kind: "error", status: null, error: toPanelError(error) });
        return null;
      }
    }, []);

    react.useEffect(() => {
      if (!open) return undefined;
      void loadStatus(false);
      return undefined;
    }, [open, loadStatus]);

    const operationPhase = view.status?.operation?.phase;
    react.useEffect(() => {
      if (!open || !operationPhase || TERMINAL_PHASES.has(operationPhase)) return undefined;
      const poller = createOperationPoller({ loadStatus: () => loadStatus(false, true) });
      poller.start();
      return poller.stop;
    }, [open, operationPhase, loadStatus]);

    const startUpdate = async () => {
      setView((current) => ({ ...current, kind: "updating", error: null }));
      try {
        const started = await json(UPDATE_ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        setView((current) => ({
          ...current,
          kind: "updating",
          status: current.status === null ? { operation: started.operation } : { ...current.status, operation: started.operation },
        }));
      } catch (error) {
        setView((current) => ({ ...current, kind: "error", error: toPanelError(error) }));
      }
    };

    const waitForReplacement = () => {
      const startedAt = Date.now();
      const probe = async () => {
        try {
          const response = await fetch(`/?dsh-skins-restart=${Date.now()}`, { cache: "no-store" });
          if (response.ok && Date.now() - startedAt > 1000) {
            window.location.reload();
            return;
          }
        } catch {}
        if (Date.now() - startedAt < 30_000) setTimeout(probe, 700);
      };
      setTimeout(probe, 900);
    };

    const restartNow = async () => {
      const safety = view.status?.restartSafety;
      if (safety?.state === "blocked") {
        setView((current) => ({ ...current, error: tr("update.restart.blocked", { count: safety.running ?? 1 }) }));
        return;
      }
      if (safety?.state === "unknown" && !confirmUnknown) {
        setConfirmUnknown(true);
        setView((current) => ({ ...current, error: tr("update.restart.unknown") }));
        return;
      }
      setRestarting(true);
      try {
        await json(RESTART_ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ confirmUnknown }),
        });
        waitForReplacement();
      } catch (error) {
        setRestarting(false);
        setView((current) => ({ ...current, error: toPanelError(error) }));
      }
    };

    const status = view.status;
    const operation = status?.operation;
    const sourceKind = status?.source?.kind;
    const showDevelopment = sourceKind === "link";
    const showUnsupported = sourceKind === "file" || sourceKind === "unknown";
    const showOperation = operation !== null && operation !== undefined;
    const showAvailable = status?.updateAvailable === true;
    const showRestart = status?.restartRequired === true || operation?.phase === "done";

    if (view.kind === "idle") return null;
    if (view.kind === "checking" && status === null) {
      return jsx("div", { className: "dsh-skins-update-row", children: tr("update.checking") });
    }
    if (view.kind === "error" && status === null) {
      return jsx("div", { className: "dsh-skins-update-row dsh-skins-update-error", children: [
        jsx("span", { children: resolveHostErrorText(view.error, tr) || tr("update.checkFailed") }),
        jsx("button", { type: "button", onClick: () => void loadStatus(true), children: tr("update.retry") }),
      ] });
    }
    if (showDevelopment) {
      const line = tr(showAvailable ? "update.developmentNewer" : "update.developmentCurrent", {
        current: status.currentVersion,
        latest: status.latest?.version ?? "—",
      });
      return jsx("div", {
        className: "dsh-skins-update-row dsh-skins-update-row-muted",
        title: line,
        children: line,
      });
    }
    if (showUnsupported) {
      return jsx("div", { className: "dsh-skins-update-row", children: [
        jsx("div", { className: "dsh-skins-update-copy", children: [
          jsx("strong", { children: tr("update.unsupported") }),
          jsx("span", { children: tr("update.unsupportedHint") }),
        ] }),
      ] });
    }
    if (!showAvailable && !showOperation && !showRestart && view.error === null) return null;

    const running = showOperation && !TERMINAL_PHASES.has(operation.phase);
    const failed = operation?.phase === "failed";
    const release = operation?.release ?? status?.latest;
    const phaseLabel = running ? tr(phaseKey(operation.phase)) : null;
    return jsx("div", { className: `dsh-skins-update-row${failed || view.error ? " dsh-skins-update-error" : ""}`, children: [
      jsx("div", { className: "dsh-skins-update-copy", children: [
        jsx("strong", { children: showRestart ? tr("update.installed") : failed ? tr("update.failed") : tr("update.available") }),
        jsx("span", { children: running
          ? phaseLabel
          : showRestart
            ? tr("update.restartRequired", { version: release?.version ?? status?.latest?.version ?? "" })
            : failed
              ? resolveFailedOperationText(operation, tr)
              : tr("update.versions", { current: status?.currentVersion ?? "", latest: status?.latest?.version ?? "" }) }),
        view.error ? jsx("span", { className: "dsh-skins-update-error-text", children: resolveHostErrorText(view.error, tr) }) : null,
        release?.htmlUrl ? jsx("a", {
          href: release.htmlUrl,
          target: "_blank",
          rel: "noreferrer",
          children: tr("update.releaseNotes"),
        }) : null,
      ] }),
      jsx("div", { className: "dsh-skins-update-actions", children: running
        ? jsx("span", { className: "dsh-skins-update-spinner", "aria-hidden": "true" })
        : showRestart
          ? restartDeferred
            ? jsx("span", { children: tr("update.deferred") })
            : restartConfirm
              ? [
                  jsx("button", { type: "button", disabled: restarting, onClick: () => void restartNow(), children: restarting ? tr("update.restarting") : confirmUnknown ? tr("update.confirmUnknown") : tr("update.confirmRestart") }),
                  jsx("button", { type: "button", disabled: restarting, onClick: () => { setRestartConfirm(false); setConfirmUnknown(false); setRestartDeferred(true); }, children: tr("update.later") }),
                ]
              : status?.restartAvailable === true
                ? [
                    jsx("button", { type: "button", onClick: () => setRestartConfirm(true), children: tr("update.restartNow") }),
                    jsx("button", { type: "button", onClick: () => setRestartDeferred(true), children: tr("update.later") }),
                  ]
                : jsx("span", { children: tr("update.restartManual") })
          : jsx("button", { type: "button", onClick: () => void startUpdate(), disabled: status?.canUpdate !== true && !failed, children: failed ? tr("update.retry") : tr("update.action") }),
      }),
    ] });
  }

  return UpdatePanel;
}
