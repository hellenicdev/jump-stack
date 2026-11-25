# Jump Stack

[![Live demo](https://img.shields.io/badge/demo-live-19336e?style=flat-square)](https://hellenicdev.eu/jump-stack/) [![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

A mobile-first HTML5 canvas game where precision and timing are everything. Hold to charge your jump, release to launch: land on 100 platforms to win, but one miss and it is over.

**Play it live:** <https://hellenicdev.eu/jump-stack/>

## Features

- Smooth charge-and-release physics
- Dynamic difficulty curve across 100 jumps
- Two game modes: Classic and Extreme
- Achievements and trophies
- Dark mode
- Sound effects and haptic feedback
- PWA: installable on mobile and desktop
- Session persistence across page refreshes

## How to play

- **Hold** to charge jump power
- **Release** to jump
- Land in the **centre** of a platform for a **PERFECT**
- Get **3 perfects in a row** to earn an **extra life**
- Reach **0 jumps remaining** to win

## Run locally

No build step. Serve the folder with any static server:

```sh
git clone https://github.com/hellenicdev/jump-stack.git
cd jump-stack
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Tech

- HTML5 Canvas, CSS3 and vanilla JavaScript
- Web App Manifest (PWA)

## License

MIT. See [LICENSE](LICENSE).

## Credits

Made by [HellenicDev](https://hellenicdev.eu). More projects at <https://hellenicdev.eu>.

If you enjoy it, you can support the work here:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S6S31XB030)
