import { type ReactNode } from "react";

const labelClass = "text-xs font-semibold text-slate-700";

export function FormRow({
  label,
  required,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-start sm:gap-4">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={`${labelClass} pt-2.5`}>
          {label}
          {required && <span className="ml-1 text-rose-500 font-bold">*</span>}
        </label>
      ) : (
        <div className={`${labelClass} pt-2.5`} role="group" aria-label={label}>
          {label}
          {required && <span className="ml-1 text-rose-500 font-bold">*</span>}
        </div>
      )}
      <div className="max-w-xl">{children}</div>
    </div>
  );
}
