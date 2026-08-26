/** The `window.nadir` dev hook (see CLAUDE.md "Debug hook"). */
import type Phaser from 'phaser';

export interface NadirDebug {
  scene: Phaser.Scene;
  state(): unknown;
  warp(tx: number, ty: number): void;
  move(vx: number, vy: number, ms: number): void;
  descend(): void;
}

export function installDebugHook(hook: NadirDebug) {
  (window as unknown as Record<string, unknown>).nadir = hook;
}
