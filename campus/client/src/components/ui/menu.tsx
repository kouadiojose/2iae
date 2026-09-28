import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Menu({ declencheur, children, align = "end" }: { declencheur: ReactNode; children: ReactNode; align?: "start" | "end" }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{declencheur}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={8}
          className="z-50 min-w-[220px] rounded-2xl border border-ligne bg-white p-1.5 shadow-carte animate-apparait"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function ElementMenu({ onSelect, children, danger, icone }: { onSelect?: () => void; children: ReactNode; danger?: boolean; icone?: ReactNode }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] font-semibold outline-none data-[highlighted]:bg-creme",
        danger ? "text-danger" : "text-encre",
      )}
    >
      {icone}
      {children}
    </DropdownMenu.Item>
  );
}

export const SeparateurMenu = () => <DropdownMenu.Separator className="my-1 h-px bg-ligne-douce" />;
