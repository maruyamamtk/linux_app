export type VimMode = "normal" | "insert" | "cmdline";

export interface VimBuffer {
  /** 1行 = 配列の1要素。各要素は改行文字を含まない。空バッファは [""] (1行・空文字列)。 */
  lines: string[];
}

export interface CursorPosition {
  /** 0-indexed 行番号。 */
  line: number;
  /** 0-indexed 列番号(UTF-16コードユニット単位)。 */
  col: number;
}

export interface VimRegister {
  content: string;
  /** true: 行単位(dd/yy等)。false: 文字単位(x/dw等)。pの貼り付け方が変わる。 */
  linewise: boolean;
}

export interface PendingCommand {
  /** 操作全体の前置カウント。例: "3dd" の "3"。空文字列なら未指定(count=1として扱う)。 */
  count: string;
  /** 待機中のオペレータ("d" | "y" | "c")。未入力ならnull。 */
  operator: "d" | "y" | "c" | null;
  /** operator確定後に続けて入力された、モーション側のカウント。例: "d3w" の "3"。 */
  motionCount: string;
  /** "g" が単独入力され、次の1キー(`gg`のための2打目)を待っている状態かどうか。 */
  awaitingG: boolean;
}

export interface VimState {
  mode: VimMode;
  buffer: VimBuffer;
  cursor: CursorPosition;
  register: VimRegister;
  pending: PendingCommand;
  /** コマンドラインモード("`:`"入力中)のバッファ。先頭の "`:`" は含まない。 */
  commandLine: string;
  /** 直前の ":" コマンド実行結果メッセージ(エラー時は赤字表示等、UI側で利用)。 */
  statusMessage: { text: string; isError: boolean } | null;
  /** undo用の直前バッファのスナップショット列。 */
  undoStack: VimBuffer[];
  redoStack: VimBuffer[];
  /** これまでに入力された生キーのログ(画面のキー入力ログ表示用)。 */
  keyLog: string[];
}

/**
 * 生のキー入力。印字可能な1文字("a", "$", "3" 等)、または特殊キー名
 * ("Escape", "Enter", "Backspace", "Ctrl-r")を表す文字列。
 */
export type VimKey = string;

export function createEmptyPending(): PendingCommand {
  return { count: "", operator: null, motionCount: "", awaitingG: false };
}
