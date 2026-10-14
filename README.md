# GucEdit

A personal text editor based on [VSCodium](https://github.com/VSCodium/vscodium) and Microsoft's MIT-licensed [VS Code source](https://github.com/microsoft/vscode). The workbench, themes, keybindings, language services and extension API remain those of VS Code. GucEdit has its own application identity, icons, profiles and extension installation directories.

This is a private standalone fork retaining VSCodium history. `origin` is `GroundUpCoder/gucedit`; `upstream` is `VSCodium/vscodium`. GitHub does not support making a fork of a public repository private, so this repository is not in GitHub's public fork network.

## Build and development

The repository contains build scripts, branding overlays and patches. The actual editor source is fetched into the ignored `vscode/` directory at the commit pinned in `upstream/stable.json` (initial baseline: VS Code 1.140.0). Make permanent editor changes as patches under `patches/user/`; commit those patches in this repository.

Install Node from `.nvmrc`, npm, Git, jq, Python 3.11 and your platform's C/C++ build tools. On macOS, use Xcode Command Line Tools. Linux requires the system libraries listed in [upstream build instructions](docs/howto-build.md). The optional Rust tunnel CLI and remote server bundles are disabled by default; the normal `gucedit` desktop command is included.

From a fresh checkout:

```sh
./dev/build.sh
```

For source editing without compiling:

```sh
./dev/prepare.sh
cd vscode
npm ci
npm run watch
# In another terminal, from vscode/:
./scripts/code.sh
```

After the macOS build finishes, install the app and CLI:

```sh
./dev/install-macos.sh
open /Applications/GucEdit.app
gucedit .
```

The installer copies the app into `/Applications` and links `~/.local/bin/gucedit` to its bundled launcher. Ensure `~/.local/bin` is on your PATH. It refuses to overwrite an existing app or an unrelated CLI command; move an older GucEdit app aside before replacing it. You can set `GUCEDIT_APPLICATIONS_DIR` or `GUCEDIT_BIN_DIR` to choose other destinations.

For a packaged macOS Apple Silicon build, the result is `VSCode-darwin-arm64/GucEdit.app`. Linux produces `VSCode-linux-<arch>/`; Windows produces `VSCode-win32-<arch>/`. Builds are unsigned unless you configure your own signing credentials.

`dev/prepare.sh` and a clean build refuse to overwrite an existing source directory. To compile a prepared checkout, first save any editor changes as patches, then run `GUCEDIT_RESET_SOURCE=yes ./dev/build.sh -s`. This explicitly discards changes inside `vscode/` and reapplies the tracked patches. The source checkout prepared during initial setup is already available locally. A fresh preparation is needed when changing overlays or patches.

`./dev/build.sh -i` selects the independently branded insiders channel. Its patch compatibility depends on the pinned insiders source; stable is the verified starting point. The imported packaging/store scripts are retained for development, but store publication and automatic releases are not configured. Active GitHub Actions only check branding and prepare sources; original upstream workflows are archived in `upstream/workflows/`.

## Separate data

| Purpose | Stable location |
| --- | --- |
| Home, arguments and extensions | `~/.gucedit/` and `~/.gucedit/extensions/` |
| Settings, keybindings, profiles, caches and state on macOS | `~/Library/Application Support/GucEdit/` |
| Settings and state on Linux | `${XDG_CONFIG_HOME:-~/.config}/GucEdit/` |
| Settings and state on Windows | `%APPDATA%/GucEdit/` |
| Remote server and its extensions | `~/.gucedit-server/` |
| Shared GucEdit data | `~/.gucedit-shared/` |
| Source development extensions | `~/.gucedit-dev/extensions/` |
| Source development settings | OS application-data directory + `gucedit-dev/` |

Insiders uses `.gucedit-insiders`, `.gucedit-server-insiders` and `GucEdit - Insiders`. Both channels share only `.gucedit-shared`. Windows installer IDs, registry keys, mutexes, Linux desktop IDs, macOS bundle/profile IDs, credential identity and the `gucedit://` URL handler are separate from VS Code and VSCodium. Explicit `--user-data-dir`, `--extensions-dir` and portable mode remain available. Existing settings and extensions are not automatically copied.

Project `.vscode/` settings, `.code-workspace` files, `vscode` extension APIs and compatibility environment variables keep their established names so projects and extensions continue to work.

## GucEdit defaults

The classic workbench layout is the default: flat panels and traditional tabs, without the Modern UI card spacing and rounded panel layout. Built-in Copilot chat and agent UI are disabled, the default chat-agent setup is removed, and the secondary sidebar starts hidden.

The title-bar Command Center is hidden by default (`window.commandCenter: false`). Command Palette and Quick Open keyboard shortcuts remain available.

On macOS, Ctrl+Tab / Ctrl+Shift+Tab move forward/backward in editor tab order. Cmd+Shift+] / Cmd+Shift+[ use the MRU editor picker, including repeated navigation while holding Cmd. These are built-in defaults, so user settings and keybindings can still override them.

## Extensions

Extensions come from Open VSX, as in VSCodium. You can also install compatible VSIX files using `gucedit --install-extension path/to/extension.vsix`. Microsoft Marketplace-only extensions and Microsoft-hosted sync/tunnel services are not promised to work in this fork.

## Privacy

VSCodium's telemetry-removal patches are retained, product telemetry is disabled, and the editor has no automatic update endpoint. Updates must be built and installed manually until a GucEdit release service exists. Extension downloads and installed extensions can still access the network and have their own privacy policies.

## Maintaining the fork

- `branding/environment.sh`: shared build identity and service defaults.
- `branding/apply.py` and `branding/identifiers.json`: product identity after the upstream merge.
- `src/{stable,insider}/`: committed platform icons and workbench artwork.
- `branding/generate-icons.py`: reproducible icon generation (`uv run --with pillow==12.3.0 branding/generate-icons.py`).
- `patches/user/`: durable GucEdit editor patches, applied after VSCodium patches.
- `upstream/stable.json`: pinned editor source; `upstream/README.vscodium.md`: original README.

Run `python3 -m unittest discover -s tests` for identity checks. After preparing the source, run `node --test tests/paths.test.cjs` to exercise its actual user-data resolver for macOS, Windows, Linux, development and explicit overrides.

Fetch upstream with `git fetch upstream`, review and merge updates into `main`, then prepare fresh sources and repeat checks. Preserve the GucEdit branding layer and unique installer IDs across updates.

## License

MIT. Original Microsoft and VSCodium copyright notices are retained in [LICENSE](LICENSE). Third-party dependencies retain their respective licenses.
