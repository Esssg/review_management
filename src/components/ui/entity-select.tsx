"use client";

import { Capacitor } from "@capacitor/core";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Select } from "@base-ui/react/select";

import { cn } from "@/lib/utils";

export type EntitySelectOption = { id: string; name: string };

export type EntitySelectProps = {
  icon: LucideIcon;
  value: string;
  onChange: (next: string) => void;
  options: EntitySelectOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
  emptyHint?: string;
};

export function EntitySelect({
  icon: Icon,
  value,
  onChange,
  options,
  placeholder = "선택",
  disabled = false,
  id,
  "aria-label": ariaLabel,
  className,
  emptyHint = "설정에서 먼저 추가해 주세요",
}: EntitySelectProps) {
  const [isNativeApp, setIsNativeApp] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      setIsNativeApp(Capacitor.isNativePlatform());
    });
  }, []);

  const selectItems = useMemo(
    () => options.map((o) => ({ value: o.id, label: o.name })),
    [options],
  );

  if (options.length === 0) {
    return (
      <div
        className={cn(
          "flex w-full min-w-0 overflow-hidden rounded-xl border border-dashed border-input bg-muted/20 text-muted-foreground",
          "dark:bg-input/20",
          isNativeApp ? "min-h-10 items-center px-3 py-2" : "h-10",
          className,
        )}
      >
        {!isNativeApp ? (
          <span
            className="flex w-10 shrink-0 items-center justify-center self-stretch border-r border-border/60 bg-muted/40 dark:bg-muted/25"
            aria-hidden
          >
            <Icon className="h-4 w-4 opacity-70" />
          </span>
        ) : null}
        <span
          className={cn(
            "flex min-w-0 flex-1 items-center",
            isNativeApp ? "text-xs leading-snug" : "px-3 text-sm",
          )}
        >
          {emptyHint}
        </span>
      </div>
    );
  }

  return (
    <Select.Root
      value={value || null}
      onValueChange={(next) => onChange(typeof next === "string" ? next : "")}
      disabled={disabled}
      items={selectItems}
    >
      <div
        className={cn(
          "flex w-full min-w-0 overflow-hidden rounded-xl border border-input bg-background shadow-sm transition-shadow",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
          disabled && "pointer-events-none opacity-50",
          isNativeApp ? "min-h-10 h-auto" : "h-10",
          className,
        )}
      >
        {!isNativeApp ? (
          <span
            className="flex w-10 shrink-0 items-center justify-center self-stretch border-r border-border/60 bg-muted/40 dark:bg-muted/25"
            aria-hidden
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
          </span>
        ) : null}
        <Select.Trigger
          id={id}
          aria-label={ariaLabel}
          className={cn(
            "flex min-h-10 min-w-0 flex-1 cursor-pointer items-center justify-between gap-1.5 border-0 bg-transparent text-left outline-none",
            "text-foreground",
            isNativeApp ? "px-2.5 py-2" : "px-3",
          )}
        >
          <Select.Value
            placeholder={placeholder}
            className={cn(
              "min-w-0 flex-1 outline-none",
              isNativeApp
                ? "text-[11px] font-medium leading-snug whitespace-normal break-words [overflow-wrap:anywhere] data-placeholder:text-muted-foreground data-placeholder:font-normal"
                : "truncate text-sm data-placeholder:text-muted-foreground data-placeholder:font-normal",
            )}
          />
          <Select.Icon className="pointer-events-none shrink-0 text-muted-foreground">
            <ChevronDown className={cn("opacity-80", isNativeApp ? "size-3.5" : "size-4")} aria-hidden />
          </Select.Icon>
        </Select.Trigger>
      </div>

      <Select.Portal>
        <Select.Backdrop className="fixed inset-0 z-50 bg-black/25 transition-[opacity,backdrop-filter] data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-black/45" />
        <Select.Positioner
          className="z-[51] outline-none"
          sideOffset={6}
          align="start"
          alignItemWithTrigger={false}
        >
          <Select.Popup
            className={cn(
              "max-h-[min(20rem,var(--available-height))] min-w-[var(--anchor-width)] max-w-[min(100vw-1.25rem,calc(var(--anchor-width)+2rem))]",
              "origin-[var(--transform-origin)] rounded-2xl border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-black/5",
              "outline-none dark:bg-popover dark:ring-white/10",
              "transition-[transform,opacity] data-ending-style:scale-[0.98] data-starting-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:opacity-0",
            )}
          >
            <Select.List className="max-h-[min(18.5rem,calc(var(--available-height)-0.75rem))] space-y-0.5 overflow-y-auto overscroll-contain p-0.5 outline-none">
              {options.map((opt) => (
                <Select.Item
                  key={opt.id}
                  value={opt.id}
                  className={cn(
                    "cursor-pointer select-none rounded-xl px-3 py-2.5 outline-none sm:py-2",
                    "text-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground",
                    "data-selected:bg-primary/18 data-selected:font-medium data-selected:text-foreground dark:data-selected:bg-primary/28",
                    "data-selected:ring-1 data-selected:ring-inset data-selected:ring-primary/25 dark:data-selected:ring-primary/35",
                    isNativeApp ? "text-xs leading-snug" : "text-sm",
                  )}
                >
                  <Select.ItemText className="block leading-snug">{opt.name}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
