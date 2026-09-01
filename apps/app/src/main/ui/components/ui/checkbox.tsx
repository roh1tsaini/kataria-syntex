import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/ui/lib/cn";

type CheckboxProps = {
  id?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Fires on the underlying button before the checked change. */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  name?: string;
  value?: string;
};

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  (
    {
      id,
      checked = false,
      onCheckedChange,
      onClick,
      disabled = false,
      className,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      name,
      value,
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        id={id}
        name={name}
        value={value}
        aria-checked={checked}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        disabled={disabled}
        onClick={(e) => {
          onClick?.(e);
          if (!disabled) {
            onCheckedChange?.(!checked);
          }
        }}
        className={cn(
          "peer flex size-5 shrink-0 items-center justify-center rounded-sm border border-input bg-card transition-all duration-150 outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50",
          checked &&
            "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
          className,
        )}
      >
        {checked && <Check className="size-3.5 stroke-[3]" aria-hidden />}
      </button>
    );
  },
);
Checkbox.displayName = "Checkbox";
