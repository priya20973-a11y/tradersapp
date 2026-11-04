"use client";

import { inputClassName } from "./sales-workspace-types";

export function EmptyRow({ columns, label }: { columns: number; label: string }) {
  return (
    <tr>
      <td colSpan={columns} className="px-4 py-10 text-center text-sm text-slate-500">
        {label}
      </td>
    </tr>
  );
}

export function Field({
  label,
  name,
  type = "text",
  ...inputProps
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  min?: string;
  maxLength?: number;
  minLength?: number;
  step?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input className={inputClassName} name={name} type={type} {...inputProps} />
    </label>
  );
}

export function SelectField({
  label,
  name,
  options,
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        className={inputClassName}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
      >
        <option value="" disabled={required}>
          Select {label.toLowerCase()}
        </option>
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
