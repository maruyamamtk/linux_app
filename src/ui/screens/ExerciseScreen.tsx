import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Exercise'>;

export function ExerciseScreen({ route }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>演習: {route.params.exerciseId}</Text>
      <Text style={styles.description}>
        ここに仮想ターミナル・課題文・ヒント等を実装していく。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  description: {
    marginTop: 12,
    textAlign: 'center',
    color: '#4b5563',
  },
});
