const artwork = Object.freeze({
  "access-door": Object.freeze({
    key: "access-door", code: "DOOR", label: "门禁 / 电动门",
    src: "/static/device-art/access-sliding-door.png", variant: "access-door",
  }),
  "ac-central": Object.freeze({
    key: "ac-central", code: "AC", label: "空调 / 中央空调",
    src: "/static/device-art/central-ac-cassette.png", variant: "central-ac",
  }),
  "generic-device": Object.freeze({
    key: "generic-device",
    code: "DEV",
    label: "设备",
    src: null,
    variant: "generic",
  }),
  "lighting-generic": Object.freeze({
    key: "lighting-generic",
    code: "LGT",
    label: "照明 / 设备",
    src: null,
    variant: "generic",
  }),
  "lighting-grille": Object.freeze({
    key: "lighting-grille",
    code: "LGT",
    label: "照明 / 格栅灯",
    src: "/static/device-art/lighting-grille-luminaire.png",
    variant: "grille",
  }),
  "lighting-linear": Object.freeze({
    key: "lighting-linear",
    code: "LGT",
    label: "照明 / 灯带",
    src: "/static/device-art/lighting-linear-luminaire.png",
    variant: "linear",
  }),
});

const artworkRules = [
  { key: "lighting-linear", terms: ["灯带", "线性灯"] },
  { key: "lighting-grille", terms: ["格栅灯", "栅格灯"] },
];

export function resolveDeviceArtwork(device = {}) {
  if (device.kind === "access") return artwork["access-door"];
  const explicitKey = String(device.visualKey ?? "").trim();
  if (Object.hasOwn(artwork, explicitKey)) return artwork[explicitKey];
  if (device.kind === "ac") return artwork["ac-central"];

  const haystack = normalize(`${device.deviceName ?? ""} ${device.location ?? ""}`);
  const matchedRule = artworkRules.find(({ terms }) => terms.some((term) => haystack.includes(term)));
  if (matchedRule) return artwork[matchedRule.key];
  if (device.kind === "lighting") return artwork["lighting-generic"];
  return artwork["generic-device"];
}

export function deviceDisplayName(deviceName) {
  const normalized = String(deviceName ?? "").normalize("NFKC").trim();
  if (!normalized) return "未命名设备";
  return normalized.split(/\s*-\s*/u).filter(Boolean).at(-1) ?? normalized;
}

export function deviceLocationLabel(device = {}) {
  const location = String(device.location ?? "").trim();
  if (!location || [device.deviceName, deviceDisplayName(device.deviceName)].some(name => normalize(String(name ?? "")) === normalize(location))) return "";
  return location;
}

function normalize(value) {
  return value.normalize("NFKC").replace(/\s+/gu, "").toLocaleLowerCase("zh-CN");
}
