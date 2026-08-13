export type PlanDefinition = {
  code: string;
  label: string;
  monthlyPriceLabel: string;
  description: string;
  bullets: string[];
  channels: string;
  messagesPerMonth: string;
  apiAccess: string;
  webhooks: string;
  support: string;
  signupEnabled: boolean;
  highlight?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
};

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    code: "free",
    label: "Free",
    monthlyPriceLabel: "RM 0",
    description: "For trying things out",
    bullets: ["1 channel", "1k messages/mo", "API + webhooks"],
    channels: "1",
    messagesPerMonth: "1k",
    apiAccess: "Yes",
    webhooks: "Yes",
    support: "Community",
    signupEnabled: true,
    ctaHref: "/signup",
  },
  {
    code: "pro",
    label: "Pro",
    monthlyPriceLabel: "RM 19.99",
    description: "Most popular for support teams",
    bullets: ["5 channels", "50k messages/mo", "API + webhooks", "Email support"],
    channels: "5",
    messagesPerMonth: "50k",
    apiAccess: "Yes",
    webhooks: "Yes",
    support: "Email",
    signupEnabled: true,
    highlight: true,
    ctaHref: "/signup",
  },
  {
    code: "business",
    label: "Business",
    monthlyPriceLabel: "RM 49.99",
    description: "For higher-volume teams that need more headroom",
    bullets: ["20 channels", "200k messages/mo", "API + webhooks", "Priority support"],
    channels: "20",
    messagesPerMonth: "200k",
    apiAccess: "Yes",
    webhooks: "Yes",
    support: "Priority",
    signupEnabled: false,
    ctaLabel: "Contact sales",
    ctaHref: "/contact",
  },
];

export const PLAN_OPTIONS = PLAN_DEFINITIONS.map(({ code, label }) => ({ code, label }));
export const SIGNUP_PLAN_OPTIONS = PLAN_DEFINITIONS.filter((plan) => plan.signupEnabled).map(({ code, label }) => ({ code, label }));

const LEGACY_ALIASES: Record<string, string> = {
  enterprise: "business",
};

const PLAN_BY_CODE = PLAN_DEFINITIONS.reduce<Record<string, PlanDefinition>>((acc, plan) => {
  acc[plan.code] = plan;
  return acc;
}, {});

export function normalizePlanCode(value?: string | null): string {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return "free";
  return LEGACY_ALIASES[raw] || raw;
}

export function getPlanDefinition(value?: string | null): PlanDefinition {
  const code = normalizePlanCode(value);
  return PLAN_BY_CODE[code] || PLAN_DEFINITIONS[0];
}

export function formatPlanLabel(value?: string | null): string {
  return getPlanDefinition(value).label;
}
