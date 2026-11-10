import type { PluginCategory, SettingsSchema } from '$slick';

export const id = 'SearchFromUser';
export const pluginName = 'Search From User';
export const description =
  'Adds "Search messages" to a member\'s profile menu and right-click menu, to search messages from them.';
export const category: PluginCategory = 'people';
export const defaultEnabled = false;

export const settings = {} as const satisfies SettingsSchema;
