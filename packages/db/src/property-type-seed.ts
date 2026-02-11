export interface PropertyTypeSeedRow {
  propertyTypeKey: string;
  sourcePropertyType: string;
  isMvpExposed: boolean;
}

export const PROPERTY_TYPE_SEED_ROWS: readonly PropertyTypeSeedRow[] = [
  {
    propertyTypeKey: "all",
    sourcePropertyType: "All Residential",
    isMvpExposed: true
  },
  {
    propertyTypeKey: "single_family",
    sourcePropertyType: "Single Family Residential",
    isMvpExposed: true
  },
  {
    propertyTypeKey: "condo_coop",
    sourcePropertyType: "Condo/Co-op",
    isMvpExposed: true
  },
  {
    propertyTypeKey: "townhouse",
    sourcePropertyType: "Townhouse",
    isMvpExposed: true
  },
  {
    propertyTypeKey: "multi_family",
    sourcePropertyType: "Multi-Family",
    isMvpExposed: false
  }
];

export function validatePropertyTypeSeedRows(rows: readonly PropertyTypeSeedRow[]): void {
  const seen = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.propertyTypeKey)) {
      throw new Error(`Duplicate property_type_key in seed data: ${row.propertyTypeKey}`);
    }
    seen.add(row.propertyTypeKey);
  }
}
