# taut-plugins

Personal plugins for [Taut](https://github.com/jeremy46231/taut), the Slack client mod.

## Plugins

### Channel Lock

Adds **Lock channel** / **Unlock channel** to the right-click menu (sidebar row, channel header or channel link) of channels where you can change posting permissions.

- **Lock** saves the channel's current posting permissions, then sets posting to admins only and turns threads off. If you aren't a workspace admin you stay allowed to post, the same as Slack's own posting permissions dialog does, so you can't lock yourself out.
- **Unlock** restores the saved permissions exactly.

Under the hood it uses Slack's own `channels.prefs.get` / `channels.prefs.set` (`who_can_post`, `can_thread`) thunks, and Slack's `additionalOptionsToShow` selector to decide whether you can manage the channel.

### Search From User

Adds **Search messages** to a member's profile **⋯** menu (next to **View files**) and to the right-click menu on their name or avatar in chat. It opens search with a **From** filter for that member, the same filter Slack's own search builds, and runs it right away.

### Undo Mark Read

In the Unreads view, press **Ctrl+Z** (**Cmd+Z** on Mac) to undo the last channel you marked read, the same as clicking its **Undo** button. Pressing it again keeps going back through the channels you marked, newest first, and the undone channel becomes the selected one. It's ignored while you're typing in a text box.

## Install

Download a plugin from [`dist/`](dist) ([`ChannelLock.js`](dist/ChannelLock.js), [`SearchFromUser.js`](dist/SearchFromUser.js), [`UndoMarkRead.js`](dist/UndoMarkRead.js)) and install it from `Preferences` > `Taut`.

## Building

Plugin sources are in `plugins/`. Build one with a Taut checkout:

```sh
git clone https://github.com/jeremy46231/taut && cd taut && npm ci
npm run build:user-plugin -- /path/to/taut-plugins/plugins/ChannelLock.tsx /path/to/taut-plugins/dist/ChannelLock.js
```
