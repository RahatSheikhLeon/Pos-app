export const PLAN_CART_LIMITS: Record<string, number> = {
  free: 2,
  pro: 4,
  pro_2: 4,
  pro_5: 4,
  pro_10: 4,
};

export const getCartLimit = (plan?: string | null): number =>
  PLAN_CART_LIMITS[plan ?? 'free'] ?? 4;
