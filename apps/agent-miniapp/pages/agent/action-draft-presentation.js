const DRAFT_RAIL_LIMIT = 4;

export function createDraftRailItems(actions) {
  if (actions.length <= DRAFT_RAIL_LIMIT) {
    return actions.map((action, index) => ({ kind: "action", action, index }));
  }

  return [
    ...actions.slice(0, DRAFT_RAIL_LIMIT - 1).map((action, index) => ({
      kind: "action",
      action,
      index,
    })),
    { kind: "overflow", hiddenCount: actions.length - (DRAFT_RAIL_LIMIT - 1) },
  ];
}

export function createDraftGroups(
  actions,
  selectedActionIds,
  { filter = "all", groupBy = "location" } = {},
) {
  const selectedIds = new Set(selectedActionIds);
  const groups = new Map();

  actions.forEach((action, index) => {
    const selected = selectedIds.has(action.id);
    if (filter === "selected" && !selected) return;
    if (filter === "unselected" && selected) return;

    const label = draftGroupLabel(action, groupBy, selected);
    const group = groups.get(label) ?? { key: label, label, items: [] };
    group.items.push({ action, index });
    groups.set(label, group);
  });

  return [...groups.values()];
}

function draftGroupLabel(action, groupBy, selected) {
  if (groupBy === "kind") return action.kind === "lighting" ? "照明" : action.kind === "ac" ? "中央空调" : action.kind === "access" ? "门禁" : "其他设备";
  if (groupBy === "selection") return selected ? "已选择" : "未选择";
  if (groupBy === "operation") {
    if (action.kind === "access") return "开门一次";
    if (action.command?.closeOrOpen === 1) return "打开";
    if (action.command?.closeOrOpen === 0) return "关闭";
    return "其他操作";
  }
  return action.location?.trim() || "未标注区域";
}
