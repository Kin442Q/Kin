import { localizeCopy, uiLanguage, uiText } from '../i18n/uiText'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  View,
} from 'react-native'
import { Text } from '../components/Text'
import { useRoute } from '@react-navigation/native'
import dayjs from 'dayjs'
import { Check, MessageCircle } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Btn from '../components/Btn'
import Avatar from '../components/Avatar'
import BottomModal from '../components/BottomModal'
import StackHeader from '../components/StackHeader'
import EmptyState from '../components/EmptyState'
import { Field } from '../components/Field'
import { colors, radius } from '../theme/colors'
import { STATUS_LABEL } from '../api/student'
import {
  homeworkStatusApi,
  type HomeworkRoster,
  type NoticeTemplate,
  type StaffStatus,
} from '../api/homeroom'

import { themedStyles, themedValue } from '../theme/themedStyles'
import { notifyError } from '../lib/notify'
const STAFF_OPTIONS = themedValue<Array<{ value: StaffStatus; label: string; bg: string; fg: string }>>(() => ([
  { value: 'DONE', label: uiText("Выполнено"), bg: colors.primarySoft, fg: colors.primaryDeep },
  { value: 'PARTIAL', label: uiText("Частично"), bg: colors.yellowSoft, fg: colors.yellowDeep },
  { value: 'NOT_DONE', label: uiText("Не сделано"), bg: colors.roseSoft, fg: colors.roseDeep },
]))

type TemplateChoice = 'auto' | NoticeTemplate

const TEMPLATES: Array<{ value: TemplateChoice; label: string }> = localizeCopy([
  { value: 'auto', label: 'По статусу ученика' },
  { value: 'NOT_DONE', label: 'Не выполнил(а)' },
  { value: 'PARTIAL', label: 'Не полностью' },
  { value: 'REMINDER', label: 'Напоминание о сроке' },
])

/**
 * Статусы ДЗ по ученикам класса: учитель отмечает выполнение, видит
 * самоотметки учеников и одним нажатием пишет родителям.
 */
export default function TeacherHomeworkRosterScreen() {
  const { homeworkId } = useRoute<any>().params as { homeworkId: string }

  const [roster, setRoster] = useState<HomeworkRoster | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  const [notifyOpen, setNotifyOpen] = useState(false)
  const [template, setTemplate] = useState<TemplateChoice>('auto')
  const [note, setNote] = useState('')
  const [notifying, setNotifying] = useState(false)

  const errorText = (e: any, fallback: string) => e?.response?.data?.message || fallback

  const load = useCallback(async () => {
    try {
      setRoster(await homeworkStatusApi.roster(homeworkId))
    } catch (e) {
      notifyError(e, uiText("Не удалось загрузить статусы"))
    } finally {
      setLoading(false)
    }
  }, [homeworkId])

  useEffect(() => {
    load()
  }, [load])

  const save = async (
    items: Array<{ studentId: string; status: StaffStatus | null }>,
  ) => {
    setSaving(true)
    try {
      setRoster(await homeworkStatusApi.setStatuses(homeworkId, items))
    } catch (e) {
      notifyError(e, uiText("Не удалось сохранить"))
    } finally {
      setSaving(false)
    }
  }

  const unmarked = useMemo(
    () => (roster?.students ?? []).filter((r) => r.status === null || r.status === 'SUBMITTED'),
    [roster, uiLanguage()],
  )

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const targets = (roster?.students ?? []).filter((r) => selected.includes(r.student.id))

  const sendNotice = async () => {
    if (targets.length === 0) return
    setNotifying(true)
    try {
      const r = await homeworkStatusApi.notifyParents(homeworkId, {
        studentIds: targets.map((t) => t.student.id),
        template: template === 'auto' ? undefined : template,
        note: note.trim() || undefined,
      })
      const noParents = r.skipped.length
      Alert.alert(
        uiText("Отправлено"),
        uiText("Сообщение получили родители {0} из {1} учеников", r.notified, targets.length) +
          (noParents ? uiText(". У {0} нет родителей в системе.", noParents) : ''),
      )
      setNotifyOpen(false)
      setNote('')
      setSelected([])
    } catch (e) {
      notifyError(e, uiText("Не удалось отправить"))
    } finally {
      setNotifying(false)
    }
  }

  const hw = roster?.homework
  const s = roster?.summary

  return (
    <Screen>
      <StackHeader title={uiText("Статусы ДЗ")} />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !roster || !hw || !s ? (
        <EmptyState title={uiText("Не удалось загрузить")} hint={uiText("Потяните назад и откройте задание ещё раз")} />
      ) : (
        <>
          <View style={styles.head}>
            <Text style={styles.hwTitle}>{hw.title}</Text>
            <Text style={styles.meta}>
              {hw.subject.name} · {hw.group.name} {" " + uiText("· срок") + " "}{dayjs(hw.dueDate).format('D MMM')}
            </Text>
            <View style={styles.summary}>
              <Text style={[styles.pill, { backgroundColor: colors.primarySoft, color: colors.primaryDeep }]}>
                {" " + uiText("выполнено") + " "}{s.done}
              </Text>
              <Text style={[styles.pill, { backgroundColor: colors.yellowSoft, color: colors.yellowDeep }]}>
                {" " + uiText("частично") + " "}{s.partial}
              </Text>
              <Text style={[styles.pill, { backgroundColor: colors.roseSoft, color: colors.roseDeep }]}>
                {" " + uiText("не сделано") + " "}{s.notDone}
              </Text>
              <Text style={[styles.pill, { backgroundColor: colors.blueSoft, color: colors.blueDeep }]}>
                {" " + uiText("«сделал»") + " "}{s.submitted}
              </Text>
              <Text style={[styles.pill, { backgroundColor: colors.surfaceAlt, color: colors.muted }]}>
                {" " + uiText("не отмечено") + " "}{s.unmarked}
              </Text>
            </View>
            <View style={styles.actions}>
              <Btn
                size="sm"
                variant="secondary"
                disabled={unmarked.length === 0 || saving}
                icon={<Check size={14} color={colors.primaryDeep} />}
                onPress={() =>
                  save(unmarked.map((r) => ({ studentId: r.student.id, status: 'DONE' as const })))
                }
              >
                {" " + uiText("Остальным: выполнено (")}{unmarked.length})
              </Btn>
              <Btn
                size="sm"
                disabled={selected.length === 0}
                icon={<MessageCircle size={14} color="#fff" />}
                onPress={() => setNotifyOpen(true)}
              >
                {" " + uiText("Родителям (")}{selected.length})
              </Btn>
            </View>
          </View>

          <FlatList
            data={roster.students}
            keyExtractor={(r) => r.student.id}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            extraData={[selected, saving]}
            renderItem={({ item: r }) => {
              const on = selected.includes(r.student.id)
              return (
                <Card padding={12}>
                  <Pressable onPress={() => toggleSelect(r.student.id)} style={styles.studentRow}>
                    <View style={[styles.check, on && styles.checkOn]}>
                      {on && <Check size={14} color="#fff" strokeWidth={3} />}
                    </View>
                    <Avatar name={`${r.student.firstName} ${r.student.lastName}`} size={34} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>
                        {r.student.lastName} {r.student.firstName}
                      </Text>
                      <Text style={styles.meta}>
                        {r.status === 'SUBMITTED'
                          ? STATUS_LABEL.SUBMITTED
                          : r.parentsCount > 0
                            ? uiText("Родителей: {0}", r.parentsCount)
                            : uiText("Нет родителей в системе")}
                      </Text>
                    </View>
                  </Pressable>
                  <View style={styles.statusRow}>
                    {STAFF_OPTIONS().map((o) => {
                      const active = r.status === o.value
                      return (
                        <Pressable
                          key={o.value}
                          disabled={saving}
                          onPress={() =>
                            save([{ studentId: r.student.id, status: active ? null : o.value }])
                          }
                          style={[
                            styles.statusBtn,
                            { backgroundColor: active ? o.bg : colors.surfaceAlt, borderColor: active ? o.fg : 'transparent' },
                          ]}
                        >
                          <Text style={[styles.statusText, { color: active ? o.fg : colors.muted }]}>
                            {o.label}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>
                  {r.comment && r.status && r.status !== 'SUBMITTED' ? (
                    <Text style={styles.comment}>{uiText("Заметка:") + " "}{r.comment}</Text>
                  ) : null}
                </Card>
              )
            }}
          />
        </>
      )}

      <BottomModal
        visible={notifyOpen}
        onClose={() => setNotifyOpen(false)}
        title={uiText("Родителям: {0} уч.", targets.length)}
      >
        <Text style={styles.modalText}>
          {" " + uiText("Родители получат сообщение от вашего имени. Текст формируется автоматически: имя ребёнка, предмет, задание и срок.") + " "}</Text>
        <View style={styles.templates}>
          {TEMPLATES.map((t) => {
            const on = t.value === template
            return (
              <Pressable
                key={t.value}
                onPress={() => setTemplate(t.value)}
                style={[styles.chip, { backgroundColor: on ? colors.primary : colors.surfaceAlt }]}
              >
                <Text style={[styles.chipText, { color: on ? '#fff' : colors.text }]}>{t.label}</Text>
              </Pressable>
            )
          })}
        </View>
        <Field
          label={uiText("Комментарий (необязательно)")}
          value={note}
          onChangeText={setNote}
          placeholder={uiText("Например: нужно сдать до пятницы")}
          maxLength={500}
          multiline
          style={{ minHeight: 70, textAlignVertical: 'top' }}
        />
        {targets.some((t) => t.parentsCount === 0) && (
          <Text style={styles.warn}>
            {" " + uiText("У некоторых выбранных учеников нет родителей в системе — им сообщение не уйдёт.") + " "}</Text>
        )}
        <Btn block size="lg" loading={notifying} onPress={sendNotice}>
          {" " + uiText("Отправить") + " "}</Btn>
      </BottomModal>
    </Screen>
  )
}

const styles = themedStyles(() => ({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { paddingHorizontal: 16, gap: 6 },
  hwTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  meta: { fontSize: 12, color: colors.muted },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  pill: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  list: { padding: 16, paddingBottom: 40 },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  name: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  statusRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  statusBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1.5,
  },
  statusText: { fontSize: 12, fontWeight: '800' },
  comment: { fontSize: 12.5, color: colors.textMid, marginTop: 8 },
  modalText: { fontSize: 13, color: colors.textMid, lineHeight: 18, marginBottom: 12 },
  templates: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  chipText: { fontSize: 12.5, fontWeight: '700' },
  warn: { fontSize: 12.5, color: colors.yellowDeep, marginBottom: 12 },
}))
