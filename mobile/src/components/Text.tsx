import { createContext, forwardRef, useContext } from 'react'
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native'
import { familyFor } from '../theme/fonts'

/**
 * Text и TextInput приложения: то же API, что у react-native (включая ref и тип),
 * но шрифт (Inter / Montserrat) подбирается по fontWeight и fontSize. Так экранам не
 * нужно знать про файлы шрифтов: достаточно писать fontWeight, как раньше.
 * Явно заданный fontFamily не меняется.
 */
const InsideText = createContext(false)

function withFont(style: unknown, nested: boolean) {
  const flat = (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>
  if (flat.fontFamily) return style
  // Вложенный Text наследует шрифт родителя; свой подбираем, только если задан вес
  if (nested && flat.fontWeight == null) return style
  const { fontWeight, ...rest } = flat
  return [rest, { fontFamily: familyFor(fontWeight, flat.fontSize) }]
}

export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...rest }, ref) {
  const nested = useContext(InsideText)
  return (
    <InsideText.Provider value={true}>
      <RNText ref={ref} {...rest} style={withFont(style, nested) as never} />
    </InsideText.Provider>
  )
})
export type Text = RNText

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  { style, ...rest },
  ref,
) {
  return <RNTextInput ref={ref} {...rest} style={withFont(style, false) as never} />
})
export type TextInput = RNTextInput
