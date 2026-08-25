export function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizePositions<T extends { position: number }>(items: T[]) {
  return items.map((item, position) => ({ ...item, position }));
}

export function moveById<T extends { id: string; position: number }>(items: T[], activeId: string, targetId: string) {
  const from = items.findIndex((item) => item.id === activeId);
  const to = items.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0 || from === to) return items;
  return moveToIndex(items, activeId, from < to ? to + 1 : to);
}

export function insertEdgeFromPointer(
  clientY: number,
  rect: { top: number; height: number } | null | undefined
): "before" | "after" {
  if (!rect || rect.height <= 0) return "after";
  return clientY < rect.top + rect.height / 2 ? "before" : "after";
}

export function insertIndexFromPointer(
  clientY: number,
  rect: { top: number; height: number } | null | undefined,
  targetIndex: number
) {
  return insertEdgeFromPointer(clientY, rect) === "before" ? targetIndex : targetIndex + 1;
}

export function scrollFromPointer(
  element: { getBoundingClientRect: () => { top: number; bottom: number }; scrollTop: number },
  clientY: number,
  edge = 48,
  step = 18
) {
  const rect = element.getBoundingClientRect();
  if (clientY < rect.top + edge) element.scrollTop -= step;
  else if (clientY > rect.bottom - edge) element.scrollTop += step;
}

export function moveToIndex<T extends { id: string; position: number }>(
  items: T[],
  activeId: string,
  insertIndex: number
) {
  const from = items.findIndex((item) => item.id === activeId);
  if (from < 0) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  const to = Math.max(0, Math.min(insertIndex > from ? insertIndex - 1 : insertIndex, next.length));
  if (to === from) return items;
  next.splice(to, 0, moved);
  return normalizePositions(next);
}

export type PositionChange = {
  id: string;
  previousPosition: number;
  optimisticPosition: number;
};

export function getPositionChanges<T extends { id: string; position: number }>(previous: T[], optimistic: T[]) {
  const previousPositions = new Map(previous.map(({ id, position }) => [id, position]));
  return optimistic.flatMap(({ id, position }) => {
    const previousPosition = previousPositions.get(id);
    return previousPosition === undefined || previousPosition === position
      ? []
      : [{ id, previousPosition, optimisticPosition: position }];
  });
}

export function updateMatchingPositions<T extends { id: string; position: number }>(
  items: T[],
  changes: PositionChange[],
  direction: "apply" | "rollback"
) {
  const byId = new Map(changes.map((change) => [change.id, change]));
  return items.map((item) => {
    const change = byId.get(item.id);
    const expectedPosition = direction === "apply" ? change?.previousPosition : change?.optimisticPosition;
    const nextPosition = direction === "apply" ? change?.optimisticPosition : change?.previousPosition;
    return change && item.position === expectedPosition ? { ...item, position: nextPosition } : item;
  });
}

export function applyPositions<T extends { id: string; position: number }>(
  items: T[],
  positions: Array<{ id: string; position: number }>
) {
  const byId = new Map(positions.map(({ id, position }) => [id, position]));
  return items.map((item) => (byId.has(item.id) ? { ...item, position: byId.get(item.id)! } : item));
}
