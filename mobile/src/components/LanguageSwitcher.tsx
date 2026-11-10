import { View, Pressable } from 'react-native'
import { Text } from './Text'
import { useLangStore, type Lang } from '../i18n'
import { colors } from '../theme/colors'

export default function LanguageSwitcher() {
  const lang = useLangStore(s => s.lang)
  const setLang = useLangStore(s => s.setLang)
  return <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingVertical: 10 }}>
    {([{code:'ru', name:'Русский'}, {code:'tg', name:'Тоҷикӣ'}, {code:'en', name:'English'}] as {code:Lang; name:string}[]).map(item =>
      <Pressable key={item.code} accessibilityRole="button" accessibilityLabel={item.name}
        accessibilityState={{ selected: lang === item.code }} onPress={() => setLang(item.code)}
        style={{ minHeight: 44, justifyContent:'center', paddingHorizontal:12, borderRadius:12,
          backgroundColor: lang === item.code ? colors.primary : colors.surfaceAlt }}>
        <Text style={{fontSize:13, fontWeight:'600', color:lang === item.code ? '#fff' : colors.text}}>{item.name}</Text>
      </Pressable>)}
  </View>
}
