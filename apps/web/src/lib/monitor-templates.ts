import type { MonitorFormValues } from "@/components/monitors/monitor-form";

export type MonitorTemplate = {
  id: string;
  title: string;
  description: string;
  icon: "in" | "out" | "event";
  values: Partial<MonitorFormValues>;
};

export const MONITOR_TEMPLATES: MonitorTemplate[] = [
  {
    id: "whale-in",
    title: "Large deposits",
    description: "Get pinged when a wallet receives more than a set amount of anything.",
    icon: "in",
    values: { kind: "transfer", direction: "in", assetMode: "any", minAmount: "10000", name: "Large deposits" },
  },
  {
    id: "treasury-out",
    title: "Treasury outflows",
    description: "Every time coins or tokens leave a wallet you care about.",
    icon: "out",
    values: { kind: "transfer", direction: "out", assetMode: "any", name: "Treasury outflows" },
  },
  {
    id: "ownership",
    title: "Contract ownership change",
    description: "Know the moment a contract you depend on gets a new owner.",
    icon: "event",
    values: { kind: "event", signature: "OwnershipTransferred(address indexed previousOwner, address indexed newOwner)", name: "Ownership change" },
  },
];

export function templateById(id: string | undefined | null) {
  return MONITOR_TEMPLATES.find((t) => t.id === id);
}
