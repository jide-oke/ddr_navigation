# DDR Navigation (Chrome Extension)

Basically you can use dance dance revolution keyboard combos to load your favorite URLs. 

(after its installed, Press Cmd + Shift + Y to activate it)
![ddrgif](https://github.com/user-attachments/assets/c7365922-05ee-4234-a4e4-2d091dd2d076)


## Current Version

- Name: `DDR Navigation`
- Version: `1.0`

## Features
<img width="2011" height="1104" alt="image" src="https://github.com/user-attachments/assets/12687429-43bc-40dd-8e9e-6920593e6dc9" />
- customizable shortcuts, combos, combo window, presets, and more!

- 4 base directional shortcuts: left, down, up, right

- Multi-step combos (example: `left,left` or `up,right,down`)

- Per-entry `Open in new tab` toggle

- Escape-to-cancel at any point during combo input

## Install (Local / Unpacked)

1. Clone this repo.
2. Open Chrome and go to `chrome://extensions`.
3. Enable `Developer mode` (top-right).
4. Click `Load unpacked`.
5. Select this folder:
   - `/Users/jide.oke/Documents/GitHub/Navigation-DDR`

## Configure

1. Click the extension icon to open the config popup.
2. Add URLs for base directions.
3. Add optional combo shortcuts in `left,right,...` format.
4. Add optional nicknames for readability in the overlay.
5. Set `Open in new tab` per entry as needed.
6. Set `Combo window (seconds)` to control how forgiving combo timing is.
7. Click `Save`.

## Usage

1. Hold `Cmd + Shift + Y` (Mac).
2. Press arrow keys to select a shortcut path.
3. Use combo chaining during the timing window.
4. Press `Escape` any time to cancel DDR navigation.

## Privacy

- Uses `chrome.storage.sync` to store your mappings/settings.
- Does not send your shortcuts to any external server.
- No analytics or network API calls are required for core behavior.

## Project Structure

- `manifest.json`: extension metadata, icons, permissions
- `background.js`: popup window launcher + open-new-tab message handler
- `content.js`: overlay UI + key handling + combo logic
- `config.html` / `config.css` / `config.js`: settings UI and persistence
- `assets/ddr-keys/`: directional key images used in overlay
- `assets/icons/`: extension icon sizes (16/32/48/128)
