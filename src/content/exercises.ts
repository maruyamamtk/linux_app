export type Exercise = {
  id: string;
  chapterId: string;
  prompt: string;
};

export const exercises: Exercise[] = [
  {
    id: "ch04-06-ex01",
    chapterId: "ch04-06",
    prompt: "カレントディレクトリのパスを表示するコマンドを実行してください。",
  },
];
