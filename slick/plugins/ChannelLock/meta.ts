import type { PluginCategory, SettingsSchema } from '$slick';

export const id = 'ChannelLock';
export const pluginName = 'Channel Lock';
export const description =
  'Adds "Lock channel" to the right-click menu of channels you manage, so only admins can post and threads are off.';
export const category: PluginCategory = 'channels';
export const defaultEnabled = false;

export const settings = {} as const satisfies SettingsSchema;
