import type { Location } from "../../types/index.js";

export function hasSensoryData(loc: Location): boolean {
  const p = loc.sensoryPalette;
  return !!(
    p.sounds.length > 0 ||
    p.smells.length > 0 ||
    p.textures.length > 0 ||
    p.lightQuality ||
    p.atmosphere ||
    p.prohibitedDefaults.length > 0
  );
}
