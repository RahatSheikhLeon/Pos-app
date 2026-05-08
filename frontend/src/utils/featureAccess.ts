export type FeatureName = 'transactions' | 'reports' | 'settings_hardware';

const PRO_FEATURES: FeatureName[] = [];

export function canAccessFeature(
  plan: string | null | undefined,
  feature: FeatureName
): boolean {
  const isPro = plan !== 'free' && plan != null;
  return PRO_FEATURES.includes(feature) ? isPro : true;
}
