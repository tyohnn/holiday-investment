export type BoundCell = { text: string; empty: boolean };

export type BoundRow = {
  id: string;
  label: string;
  level: 0 | 1 | 2;
  formula?: string;
  cells: BoundCell[];
  children: BoundRow[];
};

export type BoundKv = { id: string; label: string; value: string; empty: boolean };

export type BoundSection =
  | { kind: 'kpis'; id: string; title: string; items: BoundKv[] }
  | { kind: 'kv'; id: string; title: string; items: BoundKv[] }
  | { kind: 'chart'; id: string; title: string; series: string[]; filled?: 'financial' }
  | {
      kind: 'tree-table';
      id: string;
      title: string;
      columns: { id: string; label: string }[];
      rows: BoundRow[];
      note?: string;
    }
  | {
      kind: 'records';
      id: string;
      title: string;
      columns: { id: string; label: string }[];
      rows: string[][];
      note?: string;
    }
  | { kind: 'tabs'; id: string; title?: string; tabs: { id: string; label: string; sections: BoundSection[] }[] }
  | { kind: 'iframe'; id: string; title: string; src: string }
  | { kind: 'note'; id: string; title?: string; text: string };
