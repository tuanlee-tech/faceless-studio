import type { VideoSpec } from "./schemas/video-spec.js";
import type { AssetManifest } from "./schemas/asset-manifest.js";
import type { Library } from "./schemas/library.js";

const VALID_LICENSE_PREFIXES = [
  "cc0",
  "cc-by",
  "cc by",
  "ofl",
  "mit",
  "apache",
  "public domain",
  "custom-internal",
  "proprietary-licensed",
  "royalty-free",
];

export function isValidLicenseFormat(license: string): boolean {
  if (!license || license.trim() === "") return false;
  const lower = license.toLowerCase().trim();
  return VALID_LICENSE_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

export interface LicenseValidationResult {
  valid: boolean;
  issues: string[];
}

export class LicenseManager {
  validateLicense(license: string): boolean {
    return isValidLicenseFormat(license);
  }

  validateSpecLicenses(
    spec: VideoSpec,
    manifest?: AssetManifest,
    library?: Library,
  ): LicenseValidationResult {
    const issues: string[] = [];

    // Check visuals / assets
    const manifestAssetMap = new Map(manifest?.assets.map((a) => [a.id, a]) || []);
    for (const chapter of spec.chapters || []) {
      for (const beat of chapter.beats || []) {
        for (const asset of beat.assets || []) {
          if (!asset.license || !isValidLicenseFormat(asset.license)) {
            issues.push(
              `Asset '${asset.assetId}' in beat '${beat.id}' has invalid or missing license: '${asset.license}'`,
            );
          }
          if (manifest && !manifestAssetMap.has(asset.assetId)) {
            issues.push(
              `Asset '${asset.assetId}' in beat '${beat.id}' is not registered in project assets manifest.`,
            );
          }
        }

        // Check SFX
        for (const sfx of beat.sfx || []) {
          if (!sfx.sfxId) {
            issues.push(`SFX in beat '${beat.id}' is missing sfxId.`);
          } else if (library) {
            const libSfx = library.sfx.find((s) => s.id === sfx.sfxId);
            if (!libSfx) {
              issues.push(`SFX '${sfx.sfxId}' not found in global library.`);
            } else if (!isValidLicenseFormat(libSfx.license)) {
              issues.push(`SFX '${sfx.sfxId}' in library has invalid license: '${libSfx.license}'`);
            }
          }
        }
      }
    }

    // Check Music
    for (const track of spec.music || []) {
      if (!track.libraryId) {
        issues.push(`Music track '${track.id}' is missing libraryId.`);
      } else if (library) {
        const libMusic = library.music.find((m) => m.id === track.libraryId);
        if (!libMusic) {
          issues.push(`Music track '${track.libraryId}' not found in global library.`);
        } else if (!isValidLicenseFormat(libMusic.license)) {
          issues.push(
            `Music track '${track.libraryId}' in library has invalid license: '${libMusic.license}'`,
          );
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
