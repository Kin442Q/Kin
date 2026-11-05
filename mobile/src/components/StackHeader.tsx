import {
  Pressable,
  View,
} from 'react-native'
import { Text } from './Text'
import { useNavigation } from '@react-navigation/native'
import { ChevronLeft } from 'lucide-react-native'

import { colors, shadow } from '../theme/colors'

import { themedStyles } from '../theme/themedStyles'
interface Props {
  title: string
  /** Что показать справа (кнопка, счётчик). По умолчанию — пустое место для симметрии. */
  right?: React.ReactNode
}

/** Верхняя панель экранов, открытых поверх вкладок: «назад» + заголовок. */
export default function StackHeader({ title, right }: Props) {
  const navigation = useNavigation()
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={12}
        style={styles.back}
        accessibilityLabel="Назад"
      >
        <ChevronLeft size={24} color={colors.text} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  )
}

const styles = themedStyles(() => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSolid,
    ...shadow.sm,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  right: { minWidth: 36, alignItems: 'flex-end' },
}))
