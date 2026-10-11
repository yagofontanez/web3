import type { SVGProps } from "react";

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export type IconName = "overview" | "explorer" | "api" | "monitors" | "contracts" | "organization";

const paths: Record<IconName, React.ReactNode> = {
  overview: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="3" rx="1" />
      <rect x="9" y="7" width="5" height="7" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
    </>
  ),
  explorer: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3.5 3.5" />
    </>
  ),
  api: <path d="M5.5 4 2 8l3.5 4M10.5 4 14 8l-3.5 4" />,
  monitors: (
    <>
      <path d="M4 11V7a4 4 0 1 1 8 0v4l1 1.5H3L4 11Z" />
      <path d="M6.5 14h3" />
    </>
  ),
  contracts: (
    <>
      <path d="M4 2h5l3 3v9H4z" />
      <path d="M9 2v3h3M6 9h4M6 11.5h3" />
    </>
  ),
  organization: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <path d="M1.5 13.5c.6-2.3 2.3-3.5 4.5-3.5s3.9 1.2 4.5 3.5" />
      <path d="M10.5 3.6a2.5 2.5 0 0 1 0 4.8M12 10.3c1.2.5 2 1.6 2.5 3.2" />
    </>
  ),
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      {paths[name]}
    </svg>
  );
}
