import type { SVGProps } from "react";

/**
 * Every icon in Dema is an inline stroked path at 18–22px, `stroke-width` 1.6–2,
 * round caps and joins, inheriting `currentColor` where it sits on themed surfaces.
 * The category glyph set is keyed by the `icon` column on `categories`.
 */

export const CATEGORY_ICON_PATHS: Record<string, string> = {
  food: "M4 13h16a8 8 0 0 1-16 0ZM9.5 8.5c0-1.4 1-1.8 1-3M13.5 8.5c0-1.4 1-1.8 1-3",
  salary:
    "M4.5 7.5c0-1.6 3.2-2.8 7.5-2.8s7.5 1.2 7.5 2.8-3.2 2.8-7.5 2.8S4.5 9.1 4.5 7.5ZM4.5 7.5v8.8c0 1.6 3.2 2.8 7.5 2.8s7.5-1.2 7.5-2.8V7.5",
  transport: "M3 14.5h18M5.5 14.5 7 9.5h10l1.5 5M5.5 14.5V18M18.5 14.5V18M7.5 18h2M14.5 18h2",
  shopping: "M6 8h12l-1.2 12H7.2L6 8ZM9 8V6.2a3 3 0 0 1 6 0V8",
  bills: "M7 3h10v18l-2.5-2-2.5 2-2.5-2L7 21ZM10 9h4M10 13h4",
  software: "M3.5 5.5h17v10.5h-17ZM9.5 20h5M12 16v4",
  invoice: "M6 3h9l3 3v15H6ZM9 12h6M9 16h6",
  fun: "M3 9.5a2.2 2.2 0 0 0 0 5V19h18v-4.5a2.2 2.2 0 0 1 0-5V5H3Z",
  health: "M12 20s-7-4.4-7-9a3.8 3.8 0 0 1 7-2.1A3.8 3.8 0 0 1 19 11c0 4.6-7 9-7 9Z",
  office: "M4 20V8l8-4 8 4v12M9.5 20v-6h5v6",
};

/** The icons offered when creating a category, in the order the picker shows them. */
export const ICON_CHOICES = [
  "food",
  "transport",
  "shopping",
  "bills",
  "software",
  "health",
  "office",
  "fun",
] as const;

export function CategoryGlyph({
  icon,
  size = 22,
  color = "#1A2B49",
  strokeWidth = 1.6,
}: {
  icon: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const path = CATEGORY_ICON_PATHS[icon] ?? CATEGORY_ICON_PATHS.office;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function icon(
  render: (props: { strokeWidth: number }) => React.ReactNode,
  defaults: { strokeWidth?: number } = {},
) {
  return function Icon({ size = 20, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        {...props}
      >
        {render({ strokeWidth: defaults.strokeWidth ?? 1.7 })}
      </svg>
    );
  };
}

export const HomeIcon = icon(({ strokeWidth }) => (
  <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" strokeWidth={strokeWidth} />
));

export const InvoiceIcon = icon(({ strokeWidth }) => (
  <>
    <path d="M6 3h9l3 3v15H6z" strokeWidth={strokeWidth} />
    <path d="M9 12h6M9 16h6" strokeWidth={strokeWidth} />
  </>
));

export const ReportsIcon = icon(({ strokeWidth }) => (
  <path d="M4 20V9M10 20V4M16 20v-7M22 20H2" strokeWidth={strokeWidth} />
));

export const SettingsIcon = icon(({ strokeWidth }) => (
  <>
    <circle cx="12" cy="8" r="3.2" strokeWidth={strokeWidth} />
    <path d="M5.5 20c0-3.4 2.9-5.2 6.5-5.2s6.5 1.8 6.5 5.2" strokeWidth={strokeWidth} />
  </>
));

export const BellIcon = icon(({ strokeWidth }) => (
  <>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" strokeWidth={strokeWidth} />
    <path d="M10.5 19a1.7 1.7 0 0 0 3 0" strokeWidth={strokeWidth} />
  </>
));

export const PlusIcon = icon(() => <path d="M12 5v14M5 12h14" strokeWidth={2.2} />);

export const BackIcon = icon(() => <path d="M15 5l-7 7 7 7" strokeWidth={1.9} />);

export const ForwardIcon = icon(() => <path d="M9 5l7 7-7 7" strokeWidth={2} />);

export const CollapseIcon = icon(() => (
  <>
    <path d="M14.5 7.5 10 12l4.5 4.5" strokeWidth={1.8} />
    <path d="M4.5 4.5v15" strokeWidth={1.8} />
  </>
));

export const CalendarIcon = icon(({ strokeWidth }) => (
  <>
    <rect x="3.5" y="5" width="17" height="15" rx="3" strokeWidth={strokeWidth} />
    <path d="M8 3v4M16 3v4M3.5 10h17" strokeWidth={strokeWidth} />
  </>
));

export const AlertIcon = icon(() => (
  <>
    <circle cx="12" cy="12" r="9" strokeWidth={2} />
    <path d="M12 7.5v5M12 16h.01" strokeWidth={2} />
  </>
));

export const WarnIcon = icon(() => (
  <>
    <path d="M12 9v5M12 17.5v.5" strokeWidth={2} />
    <circle cx="12" cy="12" r="9" strokeWidth={2} />
  </>
));

export const CheckIcon = icon(() => <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth={2.2} />);

export const CloseIcon = icon(() => <path d="M6 6l12 12M18 6L6 18" strokeWidth={2} />);

export const DownloadIcon = icon(({ strokeWidth }) => (
  <path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 20h14" strokeWidth={strokeWidth} />
));

export const PersonIcon = icon(() => (
  <>
    <circle cx="12" cy="8" r="3.5" strokeWidth={1.6} />
    <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" strokeWidth={1.6} />
  </>
));

export const BriefcaseIcon = icon(() => (
  <>
    <rect x="3" y="7.5" width="18" height="12" rx="2.5" strokeWidth={1.6} />
    <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3 12h18" strokeWidth={1.6} />
  </>
));

export const BothIcon = icon(() => (
  <>
    <rect x="3.5" y="4.5" width="11" height="11" rx="3" strokeWidth={1.6} />
    <rect x="9.5" y="8.5" width="11" height="11" rx="3" strokeWidth={1.6} />
  </>
));

export const EmptyLedgerIcon = icon(() => (
  <>
    <rect x="3" y="5" width="18" height="14" rx="4" strokeWidth={1.4} />
    <path d="M3 10h18M8 14.5h3" strokeWidth={1.4} />
  </>
));
