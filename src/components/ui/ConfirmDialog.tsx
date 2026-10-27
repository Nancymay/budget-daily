import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, UI_ICONS } from "./Icon";

export interface ConfirmOptions {
  title: string;
  text?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** "danger" for deleting/replacing data. */
  tone?: "danger" | "accent";
  icon?: keyof typeof UI_ICONS;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/** Ask the user to confirm an action: `if (await confirm({...})) doIt()`. */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used inside <ConfirmProvider>");
  }
  return confirm;
}

interface Pending extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      }),
    []
  );

  const close = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && <ConfirmDialog options={pending} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: (value: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const tone = options.tone ?? "danger";

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // Focus the safe choice, so an accidental Enter doesn't delete anything.
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Don't let the sheet underneath close too.
        event.stopImmediatePropagation();
        closeRef.current(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="confirm-root">
      <div className="confirm-backdrop" onClick={() => onClose(false)} />
      <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
        <span className={`confirm-icon is-${tone}`} aria-hidden="true">
          <Icon path={UI_ICONS[options.icon ?? "trash"]} size={26} strokeWidth={2.4} />
        </span>
        <h2 id="confirm-title" className="confirm-title">
          {options.title}
        </h2>
        {options.text && (
          <p id="confirm-text" className="confirm-text">
            {options.text}
          </p>
        )}
        <div className="confirm-actions">
          <button type="button" className={`confirm-btn is-${tone}`} onClick={() => onClose(true)}>
            {options.confirmText ?? "Удалить"}
          </button>
          <button type="button" className="confirm-btn is-cancel" ref={cancelRef} onClick={() => onClose(false)}>
            {options.cancelText ?? "Отмена"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
