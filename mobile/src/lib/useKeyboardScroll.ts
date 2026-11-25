import { useEffect, type RefObject } from 'react'
import { Keyboard, type FlatList } from 'react-native'

/**
 * Когда открылась клавиатура, список сообщений прокручивается к последнему: поле ввода поднялось, а
 * переписка не должна уехать из виду под него.
 */
export function useScrollToEndOnKeyboard(listRef: RefObject<FlatList<any> | null>) {
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      // даём раскладке пересчитаться после подъёма поля ввода
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60)
    })
    return () => sub.remove()
  }, [listRef])
}
