import type { ButtonHTMLAttributes, FormHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight: `primary` is the shimmering gold CTA, `secondary` the raised dark panel. */
  variant?: 'primary' | 'secondary';
  /** Full-width (`.btn-block`, capped at 400px) — the standard form CTA shape. */
  block?: boolean;
}

/**
 * The Tensies button (`.btn`). `primary` is the gold, shimmer-animated call to
 * action ("Create Game", "Start Game"); `secondary` is the raised dark-panel
 * button used for everything else. Disabled state dims to 45%.
 */
export function Button({ variant = 'primary', block, className, children, type = 'button', ...rest }: ButtonProps) {
  const cls = ['btn', `btn-${variant}`, block ? 'btn-block' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}

/** The shared 5-bar equalizer icon (`.eq`) used inside audio buttons. */
export function EqIcon() {
  return (
    <span className="eq" aria-hidden="true">
      <i /><i /><i /><i /><i />
    </span>
  );
}

export interface AudioButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `idle` breathes softly; `playing` shimmers + dances the EQ; `listening` adds inward sonar rings. */
  state?: 'idle' | 'playing' | 'listening';
}

/**
 * An audio-share button (`.btn-audio`): a secondary button with the live
 * 5-bar equalizer icon. Used for "Play" (broadcast the game code as sound)
 * and "Listen" (receive it). The active states animate — EQ bars dance
 * magenta, Listen adds contracting sonar rings.
 */
export function AudioButton({ state = 'idle', className, children, type = 'button', ...rest }: AudioButtonProps) {
  const cls = ['btn', 'btn-secondary', 'btn-audio', state !== 'idle' ? state : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      <EqIcon />
      {children}
    </button>
  );
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Game-code style (`.code-input`): large, bold, letter-spaced, uppercased. */
  code?: boolean;
}

/**
 * The Tensies text input — inset dark field with amber border and centered
 * text (styled by controls.css `input` + `.code-input`). Use `code` for the
 * 5-letter game-code field.
 */
export function TextInput({ code, className, ...rest }: TextInputProps) {
  const cls = [code ? 'code-input' : '', className ?? ''].filter(Boolean).join(' ') || undefined;
  return <input type="text" className={cls} {...rest} />;
}

/** Inline error line (`.error-msg`) — accent-pink, centered, reserves its height. */
export function ErrorMsg({ children }: { children?: ReactNode }) {
  return (
    <p className="error-msg" role="alert" aria-live="polite">
      {children}
    </p>
  );
}

/** Muted helper line above a form field (`.field-hint`), with optional inline links (`.field-hint-link`). */
export function FieldHint({ children }: { children?: ReactNode }) {
  return <p className="field-hint">{children}</p>;
}

/**
 * Vertical form column (`.form-stack`) — the standard layout for the landing
 * and join forms: hint, inputs, CTA, divider, actions, error line.
 */
export function FormStack({ children, ...rest }: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form className="form-stack" autoComplete="off" noValidate {...rest}>
      {children}
    </form>
  );
}

/** The "─── or ───" divider (`.or-divider`) between form sections. */
export function OrDivider() {
  return (
    <div className="or-divider" aria-hidden="true">
      <span>or</span>
    </div>
  );
}

/**
 * The round icon-only back chip (`.btn-back`, styled in landing.css) — a
 * chevron with a visually-hidden "Back" label.
 */
export function BackButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="btn-back" {...props}>
      <svg
        className="back-chevron"
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 18 9 12l6-6" />
      </svg>
      <span className="sr-only">Back</span>
    </button>
  );
}

export interface ActionButtonProps {
  /** Caption under the circle (`.lobby-action-label`), e.g. "Copy Link". */
  label: string;
  /** The icon — an inline SVG sized by `.btn-icon`, or an `<EqIcon />` for audio actions. */
  children: ReactNode;
  /** Adds `.btn-audio` chrome (breathing glow) for sound actions like "Play". */
  audio?: boolean;
  /** Checked-in/on state (`.is-on`) for togglable actions like Check In. */
  on?: boolean;
  onClick?: () => void;
  'aria-label'?: string;
}

/**
 * A circular quick-action (`.lobby-action`) with its caption below — the row
 * of Copy Link / Share / Play / Check In actions on the lobby and landing
 * screens. Compose several inside a `div.lobby-actions`.
 */
export function ActionButton({ label, children, audio, on, onClick, ...rest }: ActionButtonProps) {
  const cls = ['lobby-action', audio ? 'btn-audio' : '', on ? 'is-on' : ''].filter(Boolean).join(' ');
  return (
    <div className="lobby-action-item">
      <button type="button" className={cls} onClick={onClick} aria-label={rest['aria-label'] ?? label}>
        {children}
      </button>
      <span className="lobby-action-label">{label}</span>
    </div>
  );
}
