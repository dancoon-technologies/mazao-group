export const PARTNER_TYPES = {
  INDIVIDUAL: 'individual',
  GROUP: 'group',
  STOCKIST: 'stockist',
  SACCO: 'sacco',
} as const;

export type PartnerType = (typeof PARTNER_TYPES)[keyof typeof PARTNER_TYPES];

export const STOCKIST_LIKE_PARTNER_TYPES: PartnerType[] = [
  PARTNER_TYPES.STOCKIST,
  PARTNER_TYPES.SACCO,
];

