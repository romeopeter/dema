import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

import { AlertIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export function Label({
  children,
  optional,
  className,
}: {
  children: ReactNode;
  optional?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("text-[14px] font-semibold", className)}>
      {children}
      {optional ? (
        <span className="ml-1 font-normal text-faint">optional</span>
      ) : null}
    </label>
  );
}

/** Errors sit below the field and only after it has been touched. */
export function FieldError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex items-center gap-2 text-[13px] font-medium text-alert">
      <AlertIcon size={16} />
      {children}
    </div>
  );
}

export function Field({
  label,
  optional,
  error,
  children,
  className,
}: {
  label?: ReactNode;
  optional?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-[10px]", className)}>
      {label ? <Label optional={optional}>{label}</Label> : null}
      {children}
      <FieldError>{error}</FieldError>
    </div>
  );
}

const INPUT_BASE =
  "w-full rounded-2xl border-[1.5px] px-[18px] py-[14px] text-[15px] text-ink " +
  "outline-none transition-colors duration-200 ease-[var(--ease-standard)] " +
  "placeholder:text-faint";

export function TextInput({
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cn(
        INPUT_BASE,
        invalid
          ? "border-alert bg-alert-bg"
          : "border-transparent bg-divider focus:border-bp focus:bg-surface focus:ring-[3px] focus:ring-bp-soft",
        "disabled:bg-sunken disabled:text-faint",
        className,
      )}
      {...props}
    />
  );
}

/** The bordered-on-white input used inside line-item rows and the new-category panel. */
export function OutlineInput({
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cn(
        "rounded-[14px] border-[1.5px] bg-surface px-4 py-3 text-[15px] text-ink " +
          "outline-none transition-colors duration-200 ease-[var(--ease-standard)] " +
          "placeholder:text-faint",
        invalid ? "border-alert" : "border-line focus:border-bp",
        className,
      )}
      {...props}
    />
  );
}

export function TextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        INPUT_BASE,
        "resize-none border-transparent bg-divider leading-[22px] focus:border-bp " +
          "focus:bg-surface focus:ring-[3px] focus:ring-bp-soft",
        className,
      )}
      {...props}
    />
  );
}

/** A date input styled as the design's muted field, with the calendar affordance intact. */
export function DateInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="date"
      className={cn(
        "w-full rounded-2xl border-[1.5px] border-transparent bg-divider px-[18px] py-[13px] " +
          "text-[15px] text-ink outline-none transition-colors duration-200 " +
          "ease-[var(--ease-standard)] focus:border-bp focus:bg-surface",
        className,
      )}
      {...props}
    />
  );
}
