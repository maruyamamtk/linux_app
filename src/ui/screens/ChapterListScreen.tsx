import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChapterList'>;

export function ChapterListScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>章一覧</Text>
      <Text
        style={styles.link}
        onPress={() => navigation.navigate('Exercise', { exerciseId: 'ch04-01' })}
      >
        演習画面へ(サンプル)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  link: {
    marginTop: 16,
    color: '#2563eb',
  },
});
