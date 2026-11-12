export const KVP_CATEGORIES = ["Mortgages", "Accounts&Cards", "Investing", "Pension", "Digital Banking"] as const;

export type KvpCategory = (typeof KVP_CATEGORIES)[number];

export function isValidKvpCategory(category: unknown): category is KvpCategory {
  return typeof category === "string" && (KVP_CATEGORIES as readonly string[]).includes(category);
}
