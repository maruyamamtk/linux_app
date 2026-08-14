import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import type { CommitGraph } from "../../engine/git";
import { layoutCommitGraph } from "./commitGraphLayout";

const MONOSPACE_FONT = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

const LANE_COLORS = ["#1a7f37", "#0969da", "#bf3989", "#9a6700", "#8250df"];
const LANE_WIDTH = 20;
const DOT_SIZE = 10;
const ROW_MIN_HEIGHT = 52;

function laneColor(lane: number): string {
  return LANE_COLORS[lane % LANE_COLORS.length];
}

export interface CommitGraphViewProps {
  /** `buildCommitGraph`(`src/engine/git`)が返すグラフデータ。表示のたびに親コンポーネントで再構築する想定。 */
  graph: CommitGraph;
}

/**
 * コミットグラフの可視化コンポーネント(docs/requirements.md 5章6節、
 * docs/git-simulator-design.md 10章)。`buildCommitGraph`が返す読み取り専用のグラフデータを
 * 受け取り、ブランチごとにレーンを分けてコミットを新しい順に描画する。SVG等の追加依存は使わず、
 * `View`のみでレーンの縦線とコミットのドットを表現する(要件定義書のスコープ規模ではこれで十分)。
 */
export function CommitGraphView({ graph }: CommitGraphViewProps) {
  const rows = layoutCommitGraph(graph);

  if (rows.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>コミットがまだありません。</Text>
      </View>
    );
  }

  const laneCount = rows.reduce(
    (max, row) => Math.max(max, row.lane + 1, ...row.activeLanes.map((lane) => lane + 1)),
    1,
  );
  const graphWidth = laneCount * LANE_WIDTH;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
      <View>
        {rows.map((row) => (
          <View key={row.node.hash} style={[styles.row, { minHeight: ROW_MIN_HEIGHT }]}>
            <View style={[styles.laneArea, { width: graphWidth }]}>
              {row.activeLanes.map((lane) => (
                <View
                  key={lane}
                  style={[
                    styles.laneLine,
                    {
                      left: lane * LANE_WIDTH + LANE_WIDTH / 2 - 1,
                      backgroundColor: laneColor(lane),
                    },
                  ]}
                />
              ))}
              <View
                style={[
                  styles.dot,
                  {
                    left: row.lane * LANE_WIDTH + LANE_WIDTH / 2 - DOT_SIZE / 2,
                    backgroundColor: laneColor(row.lane),
                  },
                ]}
              />
            </View>
            <View style={styles.info}>
              <View style={styles.infoHeader}>
                <Text style={styles.hash}>{row.node.hash.slice(0, 7)}</Text>
                {row.node.branches.map((branch) => (
                  <Text
                    key={branch}
                    style={[styles.branchBadge, branch === graph.headBranch && styles.headBranchBadge]}
                  >
                    {branch === graph.headBranch ? `HEAD -> ${branch}` : branch}
                  </Text>
                ))}
              </View>
              <Text style={styles.message} numberOfLines={2}>
                {row.node.message}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 0 },
  empty: { padding: 16 },
  emptyText: { fontSize: 13, color: "#57606a" },
  row: { flexDirection: "row", alignItems: "flex-start" },
  laneArea: { position: "relative" },
  laneLine: { position: "absolute", top: 0, bottom: 0, width: 2 },
  dot: {
    position: "absolute",
    top: (ROW_MIN_HEIGHT - DOT_SIZE) / 2,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  info: { minWidth: 200, paddingVertical: 8, paddingRight: 12, gap: 2 },
  infoHeader: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  hash: { fontFamily: MONOSPACE_FONT, fontSize: 12, color: "#57606a" },
  branchBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0969da",
    backgroundColor: "#ddf4ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  headBranchBadge: { color: "#1a7f37", backgroundColor: "#dafbe1" },
  message: { fontSize: 13, color: "#24292f" },
});
