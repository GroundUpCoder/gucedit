#!/usr/bin/env python3
"""Apply GucEdit identity after merging upstream product configuration."""
import json
from pathlib import Path
import sys

def brand(product, quality):
    if quality not in ("stable", "insider"):
        raise ValueError(f"Unsupported quality: {quality}")
    suffix = "-insiders" if quality == "insider" else ""
    name = "GucEdit" + (" - Insiders" if suffix else "")
    binary = "gucedit" + suffix
    repo = "https://github.com/GroundUpCoder/gucedit"
    product.update({
        "nameShort": name, "nameLong": name, "applicationName": binary,
        "dataFolderName": "." + binary, "sharedDataFolderName": ".gucedit-shared",
        "linuxDesktopName": "com.groundupcoder." + binary,
        "serverLicenseUrl": repo + "/blob/main/LICENSE",
        "darwinProfilePayloadUUID": "1956EF96-A228-4166-A337-1345077BAAED" if not suffix else "7A6BE2FF-5DFF-40B4-867B-ED513F4E5764", "linuxIconName": binary,
        "quality": quality, "urlProtocol": binary,
        "serverApplicationName": "gucedit-server" + suffix,
        "serverDataFolderName": ".gucedit-server" + suffix,
        "darwinBundleIdentifier": "com.groundupcoder.gucedit" + (".insiders" if suffix else ""),
        "darwinProfileUUID": "6B26B470-FE06-5DB5-A0AD-22875605B014" if not suffix else "89E59710-BFEB-58CD-B7CA-51C7A07AA653",
        "win32AppUserModelId": "GroundUpCoder." + ("GucEditInsiders" if suffix else "GucEdit"),
        "win32DirName": name, "win32NameVersion": name, "win32ShellNameShort": name,
        "win32MutexName": binary, "win32RegValueName": binary,
        "tunnelApplicationName": binary + "-tunnel",
        "win32TunnelMutex": binary + "-tunnel",
        "win32TunnelServiceMutex": binary + "-tunnelservice",
        "tunnelApplicationConfig": {}, "credentialServiceName": binary,
        "licenseName": "MIT", "licenseUrl": repo + "/blob/main/LICENSE",
        "reportIssueUrl": repo + "/issues/new", "requestFeatureUrl": repo + "/issues/new",
        "releaseNotesUrl": repo + "/releases", "downloadUrl": repo + "/releases",
        "privacyStatementUrl": repo + "/blob/main/README.md#privacy",
        "webUrl": repo, "enableTelemetry": False,
    })
    ids = json.loads(Path(__file__).with_name("identifiers.json").read_text())[quality]
    for key, value in ids.items():
        if key.endswith("Clsid"):
            product.setdefault("win32ContextMenu", {}).setdefault(key[:-5], {})["clsid"] = value
        else:
            product[key] = "{{" + value + "}"
    for key in ("updateUrl", "twitterUrl", "aiConfig", "defaultChatAgent", "configurationSync", "editSessions", "crashReporter", "appCenter", "tasConfig"):
        product.pop(key, None)
    return product

if __name__ == "__main__":
    path = Path(sys.argv[1])
    data = json.loads(path.read_text())
    data.setdefault("win32ContextMenu", {"x64": {}, "arm64": {}})
    path.write_text(json.dumps(brand(data, sys.argv[2]), indent=2) + "\n")
