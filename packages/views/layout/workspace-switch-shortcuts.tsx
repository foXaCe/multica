"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { paths, useCurrentWorkspace } from "@multica/core/paths";
import {
  createShortcutChord,
  isEditableShortcutTarget,
  isPortalLayerShortcutTarget,
  type ShortcutChord,
} from "@multica/core/shortcuts";
import { workspaceListOptions } from "@multica/core/workspace/queries";
import { useNavigation } from "../navigation";
import { shouldIgnoreGlobalShortcutEvent } from "./global-shortcuts";

const MAX_NUMBERED_WORKSPACES = 9;
const EMPTY_WORKSPACES: { id: string; slug: string }[] = [];

/**
 * Alt+Shift+1…9 opens the Nth workspace of the switcher list.
 *
 * Not a rebindable action: it is nine positional chords, and neither of the
 * obvious single-modifier families is free. Mod+1…9 selects browser and
 * desktop tabs (see PRIMARY_RESERVED_KEYS), and Alt+1…9 selects tabs in
 * Chrome and Firefox on Linux, where the page never receives the keydown.
 *
 * Matched on the physical key (`event.code`) rather than `event.key`: with
 * Shift held the logical key is "!" on QWERTY, and on AZERTY the unshifted top
 * row is not digits at all, so only the key position means "the Nth".
 */
export function workspaceSwitchIndex(event: KeyboardEvent): number | null {
  if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return null;
  if (event.getModifierState?.("AltGraph")) return null;
  const match = /^Digit([1-9])$/.exec(event.code);
  return match ? Number(match[1]) - 1 : null;
}

/** The chord that opens the workspace at `index`, for display; null past the ninth. */
export function workspaceSwitchShortcut(index: number): ShortcutChord | null {
  if (index < 0 || index >= MAX_NUMBERED_WORKSPACES) return null;
  return createShortcutChord(String(index + 1), { alt: true, shift: true });
}

/** Listens for Alt+Shift+1…9 and switches to that workspace. */
export function WorkspaceSwitchShortcuts() {
  const navigation = useNavigation();
  const currentId = useCurrentWorkspace()?.id;
  const { data: workspaces = EMPTY_WORKSPACES } = useQuery(workspaceListOptions());

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreGlobalShortcutEvent(event)) return;
      const index = workspaceSwitchIndex(event);
      if (index === null) return;
      // Option+Shift+digit types a character on macOS, and an open menu or
      // dialog owns the keyboard: neither may be hijacked.
      if (isEditableShortcutTarget(event.target) || isPortalLayerShortcutTarget(event.target)) {
        return;
      }
      const target = workspaces[index];
      if (!target) return;
      event.preventDefault();
      if (target.id === currentId) return;
      // A push into another workspace's path is routed through the platform's
      // workspace switch by the navigation adapter.
      navigation.push(paths.workspace(target.slug).issues());
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigation, workspaces, currentId]);

  return null;
}
