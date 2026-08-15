/**
 * Client-side extensions merged into registerscimapp getAllSupportedObjects responses
 * when the backend has not yet published a type (e.g. ScreenScrapping for AI Agent onboard).
 */

export const SCREEN_SCRAPPING_APPLICATION_TYPE = "ScreenScrapping";

const SUPPORTED_OBJECTS_CLONE_TEMPLATE_TYPES = [
  "RESTService Application",
  "Database",
] as const;

function findSupportedObjectsTypeEntry(
  applicationType: unknown[],
  typeName: string
): Record<string, unknown> | null {
  const found = applicationType.find(
    (item) =>
      item != null &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      Object.prototype.hasOwnProperty.call(item as object, typeName)
  );
  return found ? (found as Record<string, unknown>) : null;
}

function normalizeScreenScrappingSupportedFields(fields: unknown): unknown {
  if (!Array.isArray(fields)) return fields;
  const out = fields.map((field) => (field === "viewGetAllUsers" ? "baseURL" : field));
  for (const extra of ["screenScrapingJsonFile", "screenScrapingJsonFileName"]) {
    if (!out.includes(extra)) out.push(extra);
  }
  return out;
}

function cloneSupportedObjectsTypeEntry(
  sourceEntry: Record<string, unknown>,
  sourceTypeName: string,
  targetTypeName: string
): Record<string, unknown> {
  const fields = sourceEntry[sourceTypeName];
  const adv = sourceEntry.advancedSetting ?? sourceEntry.AdvancedSetting;
  const clonedFields =
    targetTypeName === SCREEN_SCRAPPING_APPLICATION_TYPE
      ? normalizeScreenScrappingSupportedFields(structuredClone(fields))
      : structuredClone(fields);
  const out: Record<string, unknown> = {
    [targetTypeName]: clonedFields,
  };
  if (adv !== undefined) {
    out.advancedSetting = structuredClone(adv);
  }
  return out;
}

/** supported-objects `applicationType[]` entry — cloned from REST/Database when available. */
export function buildScreenScrappingSupportedObjectsEntry(
  applicationType: unknown[] = []
): Record<string, unknown> {
  for (const templateName of SUPPORTED_OBJECTS_CLONE_TEMPLATE_TYPES) {
    const template = findSupportedObjectsTypeEntry(applicationType, templateName);
    if (template?.[templateName] !== undefined) {
      return cloneSupportedObjectsTypeEntry(
        template,
        templateName,
        SCREEN_SCRAPPING_APPLICATION_TYPE
      );
    }
  }

  return {
    [SCREEN_SCRAPPING_APPLICATION_TYPE]: [
      {
        advancedSetting: [
          {
            connectionParameters: [
              "connectionURL",
              "username",
              "password",
              "headerAttributes",
            ],
          },
        ],
      },
      "baseURL",
      "screenScrapingJsonFile",
      "screenScrapingJsonFileName",
    ],
    advancedSetting: {
      hook: [],
      threshold: [],
      autoRetry: [],
    },
  };
}

function supportedObjectsHasApplicationType(
  applicationType: unknown[],
  typeName: string
): boolean {
  return applicationType.some((item) => {
    if (item == null || typeof item !== "object" || Array.isArray(item)) return false;
    return Object.prototype.hasOwnProperty.call(item as object, typeName);
  });
}

/** Ensures ScreenScrapping exists in a getAllSupportedObjects payload. */
export function mergeSupportedObjectsExtensions(data: unknown): unknown {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return {
      applicationType: [buildScreenScrappingSupportedObjectsEntry()],
    };
  }

  const root = { ...(data as Record<string, unknown>) };
  const existing = root.applicationType;

  if (!Array.isArray(existing)) {
    root.applicationType = [buildScreenScrappingSupportedObjectsEntry([])];
    return root;
  }

  if (supportedObjectsHasApplicationType(existing, SCREEN_SCRAPPING_APPLICATION_TYPE)) {
    return root;
  }

  root.applicationType = [
    ...existing,
    buildScreenScrappingSupportedObjectsEntry(existing),
  ];
  return root;
}
