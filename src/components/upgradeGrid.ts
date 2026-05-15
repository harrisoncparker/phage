export const GRID = {
  ORIGIN_X: 600,
  ORIGIN_Y: 450,
  CELL:     160,
} as const;

export function gridPos(col: number, row: number): { x: number; y: number } {
  return {
    x: GRID.ORIGIN_X + col * GRID.CELL,
    y: GRID.ORIGIN_Y + row * GRID.CELL,
  };
}
