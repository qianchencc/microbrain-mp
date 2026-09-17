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

// 全部设备列表的确定性几何：卡片 180 高 + 12 行距 = 行距 192；
// 分组标题 17px 行高 + 12 下距 = 29；分组间距 20。列表尾部留白不参与计数。
const CARD_ROW_PITCH = 192;
const GROUP_TITLE_H = 29;
const GROUP_GAP = 20;

/** 视口底缘之下仍完整隐藏的卡片数（滚动浮标计数；纯几何计算，不做 DOM 测量）。 */
export function remainingBelowFold(groups, columns, scrollTop, viewportHeight) {
  if (!viewportHeight) return 0;
  const bottom = scrollTop + viewportHeight;
  let y = 0, remaining = 0;
  for (const group of groups) {
    const rows = Math.ceil(group.items.length / columns);
    for (let row = 0; row < rows; row++) {
      if (y + GROUP_TITLE_H + row * CARD_ROW_PITCH > bottom) {
        remaining += Math.min(columns, group.items.length - row * columns);
      }
    }
    y += GROUP_TITLE_H + (rows ? rows * CARD_ROW_PITCH - 12 : 0) + GROUP_GAP;
  }
  return remaining;
}

/** 第一个仍完整隐藏的行顶 offset，供浮标点击下滚定位；无则返回 null。 */
export function firstRowBelowFold(groups, columns, scrollTop, viewportHeight) {
  const bottom = scrollTop + viewportHeight;
  let y = 0;
  for (const group of groups) {
    const rows = Math.ceil(group.items.length / columns);
    for (let row = 0; row < rows; row++) {
      const top = y + GROUP_TITLE_H + row * CARD_ROW_PITCH;
      if (top > bottom) return top;
    }
    y += GROUP_TITLE_H + (rows ? rows * CARD_ROW_PITCH - 12 : 0) + GROUP_GAP;
  }
  return null;
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
