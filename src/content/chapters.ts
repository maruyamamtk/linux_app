export type Chapter = {
  id: string;
  title: string;
  phase: 1 | 2;
};

export const chapters: Chapter[] = [
  { id: "ch04-06", title: "ファイル操作の基本", phase: 1 },
  { id: "ch08", title: "エイリアスと環境変数", phase: 1 },
  { id: "ch09", title: "パーミッション", phase: 1 },
];
