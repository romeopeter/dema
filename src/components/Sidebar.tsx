import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import {
  CollapseIcon,
  HomeIcon,
  InvoiceIcon,
  ReportsIcon,
  SettingsIcon,
} from "@/components/icons";
import { pluralise } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useActiveProfile, useIsBusiness } from "@/store/profileStore";

function NavItem({
  to,
  icon,
  label,
  collapsed,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "flex w-full items-center gap-3 overflow-hidden rounded-2xl py-3 text-[15px]",
          "transition-all duration-200 ease-[var(--ease-standard)] outline-none",
          "focus-visible:ring-[3px] focus-visible:ring-bp-soft",
          collapsed ? "justify-center px-0" : "justify-start px-[14px]",
          isActive
            ? "bg-bp-soft font-semibold text-ink"
            : "bg-transparent font-medium text-muted hover:bg-divider hover:text-ink",
        )
      }
    >
      <span className="flex-none">{icon}</span>
      {collapsed ? null : <span className="whitespace-nowrap">{label}</span>}
    </NavLink>
  );
}

/**
 * The rail never switches profiles. It shows which book is open and sends you to
 * Settings to change it — that is the one place switching happens, however many
 * profiles exist.
 */
export function Sidebar({
  collapsed,
  onToggle,
  draftCount,
}: {
  collapsed: boolean;
  onToggle: () => void;
  draftCount: number;
}) {
  const navigate = useNavigate();
  const profile = useActiveProfile();
  const isBusiness = useIsBusiness();

  const label = profile?.type === "business" ? "Business" : "Personal";
  const initial = label[0];

  return (
    <nav
      style={{ width: collapsed ? 84 : 244 }}
      className="flex flex-none flex-col gap-7 overflow-hidden border-r border-line bg-surface px-5 py-7 transition-[width] duration-[220ms] ease-[var(--ease-standard)]"
    >
      <div className="flex items-center gap-[10px] px-2">
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[11px] bg-bp font-display text-[18px] font-bold text-on-bp">
          D
        </div>
        {collapsed ? null : (
          <div className="font-display text-[19px] font-bold tracking-[0.04em] whitespace-nowrap">
            DEXT
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate("/settings")}
        className={cn(
          "flex cursor-pointer items-center gap-[10px] overflow-hidden rounded-[20px] bg-divider py-3 text-left transition-colors hover:bg-[#E9EBEF]",
          collapsed ? "justify-center px-0" : "justify-start px-3",
        )}
      >
        <span
          className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[10px] font-display text-[13px] font-bold text-ink"
          style={{
            background:
              profile?.type === "business"
                ? "var(--brand-tertiary)"
                : "var(--brand-soft)",
          }}
        >
          {initial}
        </span>
        {collapsed ? null : (
          <span className="flex min-w-0 flex-col gap-px">
            <span className="text-[13px] font-semibold whitespace-nowrap">
              {label} profile
            </span>
            <span className="text-[11px] whitespace-nowrap text-muted">
              Manage in Settings
            </span>
          </span>
        )}
      </button>

      <div className="flex flex-col gap-1">
        <NavItem to="/" icon={<HomeIcon />} label="Home" collapsed={collapsed} />
        {isBusiness ? (
          <NavItem
            to="/invoices"
            icon={<InvoiceIcon />}
            label="Invoices"
            collapsed={collapsed}
          />
        ) : null}
        <NavItem
          to="/reports"
          icon={<ReportsIcon />}
          label="Reports"
          collapsed={collapsed}
        />
        <NavItem
          to="/settings"
          icon={<SettingsIcon />}
          label="Settings"
          collapsed={collapsed}
        />
      </div>

      <div className="mt-auto flex flex-col gap-[14px]">
        {!collapsed && draftCount > 0 ? (
          <div className="flex flex-col gap-[6px] rounded-[20px] bg-divider p-4">
            <div className="text-[13px] font-semibold">
              {pluralise(draftCount, "draft transaction")}
            </div>
            <div className="text-[12px] leading-4 text-muted">
              Drafts stay out of totals until you post them.
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? "Expand" : "Collapse"}
          className={cn(
            "flex items-center gap-[10px] overflow-hidden rounded-2xl border-[1.5px] border-line bg-surface py-[11px] font-display text-[13px] font-semibold text-muted transition-colors hover:bg-divider hover:text-ink",
            collapsed ? "justify-center px-0" : "justify-start px-3",
          )}
        >
          <CollapseIcon
            size={18}
            className={cn(
              "flex-none transition-transform duration-200",
              collapsed && "rotate-180",
            )}
          />
          {collapsed ? null : (
            <span className="whitespace-nowrap">Collapse</span>
          )}
        </button>
      </div>
    </nav>
  );
}
