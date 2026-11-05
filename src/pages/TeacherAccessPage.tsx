import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Col, Input, Row, App as AntdApp } from 'antd'
import { KeyRound, Plus, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { SP, SproutCard, SproutEmpty, SproutPageHeader } from '../components/sprout'
import { http } from '../api'
import { useDataStore } from '../store/dataStore'
import { classLetterOf, groupByGrade } from '../lib/classes'
import { initialsOf } from '../lib/roles'
import { orderForSave, sameSelection, toggleId, toggleMany } from '../lib/teacherAccess'
import { useT } from '../i18n'

interface TeacherDto {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  groupId: string | null
  isActive: boolean
  teachingGroups?: { id: string; name: string }[]
}

/** Классы, к которым у учителя уже есть доступ: набор teachingGroups плюс основной класс. */
const savedSelection = (t: TeacherDto): Set<string> =>
  new Set([...(t.teachingGroups ?? []).map((g) => g.id), ...(t.groupId ? [t.groupId] : [])])

/**
 * Доступ учителей к классам. Слева — учителя, справа — классы по параллелям
 * (1 класс → А, Б, В): отмечаем, к каким классам у выбранного учителя есть доступ.
 * Один учитель может иметь несколько классов.
 */
export default function TeacherAccessPage() {
  const t = useT()
  const { message } = AntdApp.useApp()
  const navigate = useNavigate()
  const groups = useDataStore((s) => s.groups)

  const [teachers, setTeachers] = useState<TeacherDto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await http.get<TeacherDto[]>('/v1/teachers')
      setTeachers(Array.isArray(res.data) ? res.data : [])
    } catch (e: any) {
      message.error(e?.response?.data?.message || t('access.loadFail'))
    } finally {
      setLoading(false)
    }
  }, [message, t])

  useEffect(() => {
    load()
  }, [load])

  const grades = useMemo(() => groupByGrade(groups, (g) => g.name), [groups])
  const schoolOrder = useMemo(() => grades.flatMap((g) => g.items.map((i) => i.id)), [grades])
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])

  const selected = teachers.find((x) => x.id === selectedId) ?? null
  const saved = useMemo(() => (selected ? savedSelection(selected) : new Set<string>()), [selected])
  const dirty = !!selected && !sameSelection(draft, saved)

  // При выборе учителя (и после сохранения) черновик берётся из его текущего доступа
  useEffect(() => {
    setDraft(new Set(saved))
  }, [saved, selectedId])

  // Первый учитель выбран сразу — не надо искать, куда нажать
  useEffect(() => {
    if (!selectedId && teachers.length) setSelectedId(teachers[0].id)
  }, [teachers, selectedId])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return teachers
    return teachers.filter((x) => `${x.fullName} ${x.email ?? ''} ${x.phone ?? ''}`.toLowerCase().includes(q))
  }, [teachers, search])

  const save = async () => {
    if (!selected) return
    try {
      setSaving(true)
      const ids = orderForSave(draft, schoolOrder, selected.groupId)
      const res = await http.patch<{ id: string; groupId: string | null; teachingGroups: { id: string; name: string }[] }>(
        `/v1/teachers/${selected.id}/classes`,
        { groupIds: ids },
      )
      setTeachers((list) =>
        list.map((x) =>
          x.id === selected.id ? { ...x, groupId: res.data.groupId, teachingGroups: res.data.teachingGroups } : x,
        ),
      )
      message.success(t('access.saved'))
    } catch (e: any) {
      message.error(e?.response?.data?.message || t('access.saveFail'))
    } finally {
      setSaving(false)
    }
  }

  const classNames = (ids: Set<string>) =>
    schoolOrder.filter((id) => ids.has(id)).map((id) => groupById.get(id)?.name ?? '')

  return (
    <div>
      <SproutPageHeader
        title={t('access.title')}
        icon={<KeyRound size={22} strokeWidth={2} />}
        iconAccent="lilac"
        description={t('access.description')}
        actions={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => navigate('/admin/staff')}>
            {t('access.newTeacher')}
          </Button>
        }
      />

      {groups.length === 0 && !loading && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('access.noClasses')}
          description={t('access.noClassesHint')}
          action={
            <Button size="small" onClick={() => navigate('/admin/groups')}>
              {t('nav.classes')}
            </Button>
          }
        />
      )}

      {teachers.length === 0 && !loading ? (
        <SproutCard>
          <SproutEmpty title={t('access.noTeachers')} description={t('access.noTeachersHint')} minHeight={220} />
        </SproutCard>
      ) : (
        <Row gutter={[16, 16]} align="stretch">
          <Col xs={24} lg={9}>
            <SproutCard padding={14}>
              <Input
                allowClear
                prefix={<Search size={15} color={SP.muted} />}
                placeholder={t('access.search')}
                aria-label={t('access.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ marginBottom: 10 }}
              />
              <div className="ta-list" role="list" aria-label={t('access.teachers')}>
                {visible.map((x) => {
                  const ids = savedSelection(x)
                  const names = classNames(ids)
                  const on = x.id === selectedId
                  return (
                    <button
                      key={x.id}
                      type="button"
                      role="listitem"
                      className={`ta-item${on ? ' is-on' : ''}`}
                      aria-current={on ? 'true' : undefined}
                      onClick={() => setSelectedId(x.id)}
                    >
                      <span className="ta-avatar" aria-hidden="true">
                        {initialsOf(x.fullName)}
                      </span>
                      <span className="ta-body">
                        <b>
                          {x.fullName}
                          {!x.isActive && <em> · {t('access.inactive')}</em>}
                        </b>
                        {ids.size === 0 ? (
                          <span className="ta-none">{t('access.noAccess')}</span>
                        ) : (
                          <span className="ta-mini">
                            {names.slice(0, 4).join(', ')}
                            {names.length > 4 ? ` ${t('access.moreClasses', { n: names.length - 4 })}` : ''}
                          </span>
                        )}
                      </span>
                      <span className="ta-count">{ids.size}</span>
                    </button>
                  )
                })}
              </div>
            </SproutCard>
          </Col>

          <Col xs={24} lg={15}>
            <SproutCard>
              {!selected ? (
                <SproutEmpty title={t('access.pickTeacher')} minHeight={220} />
              ) : (
                <>
                  <div className="ta-head">
                    <div>
                      <div className="ta-name">{selected.fullName}</div>
                      <div className="ta-contact">{[selected.email, selected.phone].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div className="ta-bulk">
                      <span className="sp-chip" style={{ background: SP.primarySoft, color: SP.primaryDeep, padding: '4px 12px' }}>
                        {t('access.selected', { n: draft.size })}
                      </span>
                      <Button size="small" onClick={() => setDraft(new Set(schoolOrder))} disabled={!schoolOrder.length}>
                        {t('access.selectAll')}
                      </Button>
                      <Button size="small" onClick={() => setDraft(new Set())} disabled={draft.size === 0}>
                        {t('access.clear')}
                      </Button>
                    </div>
                  </div>

                  <div className="ta-grades">
                    {grades.map((gr) => {
                      const ids = gr.items.map((i) => i.id)
                      const allOn = ids.length > 0 && ids.every((id) => draft.has(id))
                      return (
                        <div key={String(gr.key)} className="ta-grade">
                          <div className="ta-grade-top">
                            <span className="sp-grade-badge">{gr.grade ?? '•'}</span>
                            <b>{gr.key === 'other' ? t('access.otherClasses') : t('access.grade', { n: gr.grade ?? '' })}</b>
                            <button
                              type="button"
                              className={`cf-chip ta-whole${allOn ? ' is-on' : ''}`}
                              aria-pressed={allOn}
                              onClick={() => setDraft((d) => toggleMany(d, ids))}
                            >
                              {t('access.wholeGrade')}
                            </button>
                          </div>
                          <div className="cf-chips">
                            {gr.items.map((g) => {
                              const on = draft.has(g.id)
                              return (
                                <button
                                  key={g.id}
                                  type="button"
                                  className={`cf-chip${on ? ' is-on' : ''}`}
                                  aria-pressed={on}
                                  title={g.name}
                                  onClick={() => setDraft((d) => toggleId(d, g.id))}
                                >
                                  {gr.key === 'other' ? g.name : classLetterOf(g.name)}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="ta-foot">
                    <span className="ta-hint">{dirty ? t('access.unsaved') : t('access.mainHint')}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button onClick={() => setDraft(new Set(saved))} disabled={!dirty || saving}>
                        {t('access.reset')}
                      </Button>
                      <Button type="primary" onClick={save} disabled={!dirty} loading={saving}>
                        {t('access.save')}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </SproutCard>
          </Col>
        </Row>
      )}
    </div>
  )
}
