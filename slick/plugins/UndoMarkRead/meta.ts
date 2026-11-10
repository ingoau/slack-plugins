import type { PluginCategory, SettingsSchema } from '$slick';

export const id = 'UndoMarkRead';
export const pluginName = 'Undo Mark Read';
export const description = 'Press Ctrl+Z (Cmd+Z on Mac) in Unreads to undo the last channel you marked read.';
export const category: PluginCategory = 'messages';
export const defaultEnabled = false;

export const settings = {} as const satisfies SettingsSchema;
