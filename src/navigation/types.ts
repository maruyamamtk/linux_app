export type RootStackParamList = {
  ChapterList: undefined;
  UnitDetail: { chapterId: string };
  Exercise: { chapterId: string; exerciseId: string };
  ScriptExercise: { chapterId: string; exerciseId: string };
  QuizExercise: { chapterId: string; exerciseId: string };
  VimExercise: { chapterId: string; exerciseId: string };
  GitExercise: { chapterId: string; exerciseId: string };
  MyPage: undefined;
  Settings: undefined;
};
