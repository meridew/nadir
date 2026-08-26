/** The HUD contract between DungeonScene (writer) and UIScene (reader). */
import type Phaser from 'phaser';

export const HUD_KEY = 'hud';

export interface HudState {
  depth: number;
  maxDepth: number;
  size: number;
  seed: string;
  status: string;
  won: boolean;
}

export function setHud(scene: Phaser.Scene, hud: HudState) {
  scene.registry.set(HUD_KEY, hud);
}

export function patchHud(scene: Phaser.Scene, patch: Partial<HudState>) {
  const current = (scene.registry.get(HUD_KEY) ?? {}) as HudState;
  scene.registry.set(HUD_KEY, { ...current, ...patch });
}

export function getHud(scene: Phaser.Scene): HudState | undefined {
  return scene.registry.get(HUD_KEY) as HudState | undefined;
}
