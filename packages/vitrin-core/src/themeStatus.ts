export const THEME_VERSION_STATUSES = [
  'draft',
  'pending_review',
  'in_review',
  'approved',
  'rejected',
  'published',
  'deprecated',
  'archived',
] as const;

export type ThemeVersionStatus = (typeof THEME_VERSION_STATUSES)[number];

export const STATUS_LABELS: Record<ThemeVersionStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
  deprecated: 'Deprecated',
  archived: 'Archived',
};

export const ALLOWED_STATUS_TRANSITIONS: Record<
  ThemeVersionStatus,
  ThemeVersionStatus[]
> = {
  draft: ['pending_review', 'archived'],
  pending_review: ['draft', 'in_review'],
  in_review: ['draft', 'approved', 'rejected'],
  approved: ['published', 'archived'],
  rejected: ['draft', 'archived'],
  published: ['deprecated'],
  deprecated: [],
  archived: ['draft'],
};

export const PARTNER_BLOCKED_FROM_STATUSES: ThemeVersionStatus[] = [
  'in_review',
  'deprecated',
];

export const PARTNER_BLOCKED_TARGET_STATUSES: ThemeVersionStatus[] = [
  'in_review',
  'approved',
  'rejected',
];

export interface PartnerTransitionInfo {
  current: ThemeVersionStatus;
  allowed: ThemeVersionStatus[];
  partnerBlocked: boolean;
  reason?: string;
}

export function getPartnerAllowedTransitions(
  current: ThemeVersionStatus
): PartnerTransitionInfo {
  if (PARTNER_BLOCKED_FROM_STATUSES.includes(current)) {
    return {
      current,
      allowed: [],
      partnerBlocked: true,
      reason: `Partners cannot change the status of a version that is ${STATUS_LABELS[current].toLowerCase()}.`,
    };
  }
  const fromTable = ALLOWED_STATUS_TRANSITIONS[current];
  return {
    current,
    allowed: fromTable.filter(
      s => !PARTNER_BLOCKED_TARGET_STATUSES.includes(s)
    ),
    partnerBlocked: false,
  };
}

export function isThemeVersionStatus(s: string): s is ThemeVersionStatus {
  return (THEME_VERSION_STATUSES as readonly string[]).includes(s);
}
