const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DAY_MS = 24 * 60 * 60 * 1000;
/** 固定の起点日時(2024-01-01T00:00:00+09:00相当)。8章: 実時刻・乱数は一切使用しない。 */
const EPOCH_MS = Date.UTC(2024, 0, 1, 0, 0, 0);

/**
 * `git log`表示用に、コミットの`sequence`から決定的な日時文字列を合成する(8章)。
 * 実際の操作時刻とは無関係の、教育上の簡略化であることに注意。
 */
export function formatCommitDate(sequence: number): string {
  const date = new Date(EPOCH_MS + sequence * DAY_MS);
  const weekday = WEEKDAYS[date.getUTCDay()];
  const month = MONTHS[date.getUTCMonth()];
  const day = date.getUTCDate();
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${weekday} ${month} ${day} ${hh}:${mm}:${ss} ${date.getUTCFullYear()} +0900`;
}
