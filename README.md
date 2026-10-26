# taut-plugins

Personal plugins for [Taut](https://github.com/jeremy46231/taut), the Slack client mod.

## Plugins

### Channel Lock

Adds **Lock channel** / **Unlock channel** to the right-click menu (sidebar row, channel header or channel link) of channels where you can change posting permissions.

- **Lock** saves the channel's current posting permissions, then sets posting to admins only and turns threads off. If you aren't a workspace admin you stay allowed to post, the same as Slack's own posting permissions dialog does, so you can't lock yourself out.
- **Unlock** restores the saved permissions exactly.

Under the hood it uses Slack's own `channels.prefs.get` / `channels.prefs.set` (`who_can_post`, `can_thread`) thunks, and Slack's `additionalOptionsToShow` selector to decide whether you can manage the channel.

## Install

Download [`dist/ChannelLock.js`](dist/ChannelLock.js) and install it from `Preferences` > `Taut`.

## Building

Plugin sources are in `plugins/`. Build one with a Taut checkout:

```sh
git clone https://github.com/jeremy46231/taut && cd taut && npm ci
npm run build:user-plugin -- /path/to/taut-plugins/plugins/ChannelLock.tsx /path/to/taut-plugins/dist/ChannelLock.js
```
