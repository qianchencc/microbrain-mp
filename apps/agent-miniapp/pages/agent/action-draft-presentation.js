const DRAFT_RAIL_LIMIT = 4;

/**
 * 草案发布时刻的基线快照（勾选集合 + 每个动作的指令）。
 * 仅用于客户端 dirty 判定与服务端 restore 的展示对照；权威还原由
 * POST /action-drafts/:id/restore 完成（服务端持有 original_json）。
 */
export function createDraftBaseline(draft) {
  return {
    selectedActionIds: [...(draft?.selectedActionIds ?? [])],
    commands: Object.fromEntries((draft?.actions ?? []).map((action) => [action.id, { ...action.command }])),
  };
}

/** 当前草案是否偏离基线（勾选集合不同，或任一动作指令被修改）。 */
export function draftBaselineChanged(draft, baseline) {
  if (!draft || !baseline) return false;
  const selected = new Set(draft.selectedActionIds ?? []);
  if (selected.size !== baseline.selectedActionIds.length || baseline.selectedActionIds.some((id) => !selected.has(id))) return true;
  return (draft.actions ?? []).some((action) => {
    const original = baseline.commands[action.id];
    if (!original) return true;
    const keys = new Set([...Object.keys(original), ...Object.keys(action.command ?? {})]);
    return [...keys].some((key) => original[key] !== action.command[key]);
  });
}


export function computeDeviceGrid(viewportWidth, { inlinePadding = 20, cardWidth = 119, gap = 12 } = {}) {
  const availableWidth = Math.max(cardWidth, viewportWidth - inlinePadding * 2);
  const columns = Math.max(1, Math.floor((availableWidth + gap) / (cardWidth + gap)));
  return { columns, trackWidth: columns * cardWidth + (columns - 1) * gap };
}

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
