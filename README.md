# slack-plugins

Personal plugins for Slack client mods:

- [`slick/`](slick): plugins for [Slick](https://slickclient.net/) ([source](https://github.com/3kh0/slick))
- [`taut/`](taut): plugins for [Taut](https://github.com/jeremy46231/taut)

The same three plugins are available for both mods.

## Plugins

### Channel Lock

Adds **Lock channel** / **Unlock channel** to the right-click menu (sidebar row, channel header or channel link) of channels where you can change posting permissions.

- **Lock** saves the channel's current posting permissions, then sets posting to admins only and turns threads off. If you aren't a workspace admin you stay allowed to post, the same as Slack's own posting permissions dialog does, so you can't lock yourself out.
- **Unlock** restores the saved permissions exactly.

Under the hood it uses Slack's own `channels.prefs.get` / `channels.prefs.set` (`who_can_post`, `can_thread`) thunks, and Slack's `additionalOptionsToShow` selector to decide whether you can manage the channel.

The Slick and Taut versions keep their saved permissions separately, so unlock a channel with the same mod you locked it with.

### Search From User

Adds **Search messages** to a member's profile **⋯** menu (next to **View files**) and to the right-click menu on their name or avatar in chat. It opens search with a **From** filter for that member, the same filter Slack's own search builds, and runs it right away.

### Undo Mark Read

In the Unreads view, press **Ctrl+Z** (**Cmd+Z** on Mac) to undo the last channel you marked read, the same as clicking its **Undo** button. Pressing it again keeps going back through the channels you marked, newest first, and the undone channel becomes the selected one. It's ignored while you're typing in a text box.

## Slick

### Install

Each plugin is in [`slick/dist/`](slick/dist) as a `.js` file (desktop app and browser extension) and a `.user.js` file (userscript):

| Plugin           | Desktop / extension                                       | Userscript                                                          |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------------- |
| Channel Lock     | [`ChannelLock.js`](slick/dist/ChannelLock.js)             | [`ChannelLock.user.js`](slick/dist/ChannelLock.user.js)             |
| Search From User | [`SearchFromUser.js`](slick/dist/SearchFromUser.js)       | [`SearchFromUser.user.js`](slick/dist/SearchFromUser.user.js)       |
| Undo Mark Read   | [`UndoMarkRead.js`](slick/dist/UndoMarkRead.js)           | [`UndoMarkRead.user.js`](slick/dist/UndoMarkRead.user.js)           |

- **Desktop:** in **Slick Settings > Plugins**, paste the plugin's GitHub link (for example `https://github.com/ingoau/slack-plugins/blob/main/slick/dist/ChannelLock.js`) and press **Install from URL**. Slick re-downloads it every few hours and updates it in place. You can also download the file and use **Install plugin...**.
- **Browser extension:** download the `.js` file and use **Install plugin file…** in the Plugins tab of the Slick toolbar button. Chromium also needs **Allow User Scripts** turned on in the extension's details page. The Firefox Add-ons version can't run user plugins; use the self-hosted xpi instead.
- **Userscript:** install the `.user.js` file in Violentmonkey next to Slick.

Then enable the plugin in Slick's plugin settings.

### Build

Plugin sources are in `slick/plugins/<Name>/` (`meta.ts` plus `index.ts` or `index.tsx`). Build one with a Slick checkout ([Bun](https://bun.sh) required):

```sh
git clone https://github.com/3kh0/slick && cd slick && bun install
bun run build:plugin /path/to/slack-plugins/slick/plugins/ChannelLock /path/to/slack-plugins/slick/dist/ChannelLock.js
```

This writes `ChannelLock.js` and `ChannelLock.user.js`. Slick's plugin docs are in its [`src/plugins/README.md`](https://github.com/3kh0/slick/blob/main/src/plugins/README.md).

## Taut

### Install

Download a plugin from [`taut/dist/`](taut/dist) ([`ChannelLock.js`](taut/dist/ChannelLock.js), [`SearchFromUser.js`](taut/dist/SearchFromUser.js), [`UndoMarkRead.js`](taut/dist/UndoMarkRead.js)) and install it from `Preferences` > `Taut`.

### Build

Plugin sources are in `taut/plugins/`. Build one with a Taut checkout:

```sh
git clone https://github.com/jeremy46231/taut && cd taut && npm ci
npm run build:user-plugin -- /path/to/slack-plugins/taut/plugins/ChannelLock.tsx /path/to/slack-plugins/taut/dist/ChannelLock.js
```
