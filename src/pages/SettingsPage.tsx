import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  Segmented,
  App as AntdApp,
} from 'antd'
import {
  BulbOutlined,
  ReloadOutlined,
  FileDoneOutlined,
  HomeOutlined,
  EnvironmentOutlined,
  AimOutlined,
} from '@ant-design/icons'
import { Settings as SettingsIcon } from 'lucide-react'
import { motion } from 'framer-motion'

import { SproutPageHeader } from '../components/sprout'
import { roleLabel } from '../lib/roles'
import { useThemeStore } from '../store/themeStore'
import { useDataStore } from '../store/dataStore'
import { useAuthStore } from '../store/authStore'
import InstitutionMap from '../components/InstitutionMap'
import { ChangePasswordCard } from '../components/ChangePasswordForm'
import { ChangeEmailCard } from '../components/ChangeEmailForm'
import { http } from '../api'
import { LANGS, useLangStore, useT, type Lang } from '../i18n'

const { Text, Title } = Typography

export default function SettingsPage() {
  const { message } = AntdApp.useApp()
  const t = useT()
  const lang = useLangStore((s) => s.lang)
  const setLang = useLangStore((s) => s.setLang)
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  const seed = useDataStore((s) => s.seedDemo)
  const reset = useDataStore((s) => s.resetAll)
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)

  const canEditInstitution =
    user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const inst = user?.institution ?? null
  // Владелец платформы (SUPER_ADMIN без привязки к садику) управляет всеми
  // учреждениями: выбирает из списка и привязывает геолокацию к выбранному.
  const isOwner = user?.role === 'SUPER_ADMIN' && !user?.kindergartenId

  interface InstApi {
    id: string
    name: string
    type: 'KINDERGARTEN' | 'SCHOOL'
    latitude: number | null
    longitude: number | null
    checkInRadiusMeters: number
  }

  const [institutions, setInstitutions] = useState<InstApi[]>([])
  const [selectedInstId, setSelectedInstId] = useState<string | null>(null)
  const [savingInst, setSavingInst] = useState(false)
  const [instForm] = Form.useForm()

  const selectedInst = institutions.find((i) => i.id === selectedInstId) ?? null
  // Учреждение, чьи данные сейчас в форме (для тега типа и карты).
  const activeInst = isOwner ? selectedInst : inst

  // Владелец: подгружаем список всех учреждений.
  useEffect(() => {
    if (!isOwner) return
    http
      .get<InstApi[]>('/v1/kindergartens')
      .then((r) => {
        setInstitutions(r.data)
        setSelectedInstId((prev) => prev ?? r.data[0]?.id ?? null)
      })
      .catch((e: any) =>
        message.error(e?.response?.data?.message || t('settings.loadInstFail')),
      )
  }, [isOwner, message, t])

  // Заполняем форму данными активного учреждения.
  useEffect(() => {
    if (activeInst) {
      instForm.setFieldsValue({
        name: activeInst.name,
        latitude: activeInst.latitude,
        longitude: activeInst.longitude,
        checkInRadiusMeters: activeInst.checkInRadiusMeters,
      })
    }
  }, [activeInst, instForm])

  const useBrowserGeo = () => {
    if (!navigator.geolocation) {
      message.error(t('settings.geoUnavailable'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        instForm.setFieldsValue({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        })
        message.success(t('settings.geoSet'))
      },
      (err) => {
        message.error(t('settings.geoFail') + ' ' + err.message)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const saveInstitution = async () => {
    if (isOwner && !selectedInstId) {
      message.warning(t('settings.pickFirst'))
      return
    }
    try {
      const values = await instForm.validateFields()
      setSavingInst(true)
      // Владелец сохраняет в выбранное учреждение по id; админ — в своё (mine).
      const url =
        isOwner && selectedInstId
          ? `/v1/kindergartens/${selectedInstId}`
          : '/v1/kindergartens/mine'
      const r = await http.patch(url, {
        name: values.name,
        latitude: values.latitude ?? null,
        longitude: values.longitude ?? null,
        checkInRadiusMeters: values.checkInRadiusMeters,
      })
      message.success(t('settings.saved'))
      if (isOwner) {
        // обновляем локальный список выбранного учреждения
        setInstitutions((list) =>
          list.map((i) =>
            i.id === r.data.id
              ? {
                  ...i,
                  name: r.data.name,
                  latitude: r.data.latitude,
                  longitude: r.data.longitude,
                  checkInRadiusMeters: r.data.checkInRadiusMeters,
                }
              : i,
          ),
        )
      } else {
        // Обновим institution в auth store, НЕ трогая JWT-токен
        updateUser({
          institution: {
            id: r.data.id,
            name: r.data.name,
            type: r.data.type,
            latitude: r.data.latitude,
            longitude: r.data.longitude,
            checkInRadiusMeters: r.data.checkInRadiusMeters,
          },
        })
      }
    } catch (e: any) {
      if (e?.errorFields) return // ant-d form errors
      message.error(e?.response?.data?.message || t('settings.saveFail'))
    } finally {
      setSavingInst(false)
    }
  }

  return (
    <div>
      <SproutPageHeader
        title={t('settings.title')}
        icon={<SettingsIcon size={22} strokeWidth={2} />}
        iconAccent="cyan"
        description={t('settings.description')}
      />

      <Row gutter={[16, 16]}>
        {canEditInstitution && (
          <Col xs={24}>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card
                className="glass"
                bordered={false}
                title={
                  <>
                    <HomeOutlined /> {t('settings.instTitle')}
                  </>
                }
              >
                {isOwner && (
                  <div style={{ marginBottom: 16 }}>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
                      {t('settings.institution')}
                    </Text>
                    <Select
                      style={{ width: '100%', marginTop: 4, maxWidth: 420 }}
                      placeholder={t('settings.pickInstitution')}
                      value={selectedInstId ?? undefined}
                      onChange={(v) => setSelectedInstId(v)}
                      showSearch
                      optionFilterProp="label"
                      options={institutions.map((i) => ({
                        value: i.id,
                        label: `${i.type === 'SCHOOL' ? '🏫' : '🌱'} ${i.name}`,
                      }))}
                      notFoundContent={t('settings.noSchools')}
                    />
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--sp-muted)' }}>
                      {t('settings.geoSavedFor')}
                    </div>
                  </div>
                )}

                <Divider />

                <Form
                  form={instForm}
                  layout="vertical"
                  onFinish={saveInstitution}
                >
                  <Form.Item
                    label={t('settings.name')}
                    name="name"
                    rules={[{ required: true, message: t('settings.nameRequired') }]}
                  >
                    <Input placeholder={t('settings.namePlaceholder')} />
                  </Form.Item>

                  <Divider orientation="left" plain>
                    <EnvironmentOutlined /> {t('settings.geoTitle')}
                  </Divider>

                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('settings.geoHelp')}
                  </Text>

                  <Form.Item shouldUpdate noStyle>
                    {() => {
                      const lat = instForm.getFieldValue('latitude') as number | null
                      const lon = instForm.getFieldValue('longitude') as number | null
                      const radius =
                        (instForm.getFieldValue('checkInRadiusMeters') as number) || 150
                      return (
                        <div style={{ margin: '12px 0' }}>
                          <InstitutionMap
                            latitude={lat ?? null}
                            longitude={lon ?? null}
                            radiusMeters={radius}
                            onChange={(la, lo) => {
                              instForm.setFieldsValue({ latitude: la, longitude: lo })
                            }}
                          />
                        </div>
                      )
                    }}
                  </Form.Item>

                  <Row gutter={16}>
                    <Col xs={24} md={8}>
                      <Form.Item label={t('settings.latitude')} name="latitude">
                        <InputNumber
                          style={{ width: '100%' }}
                          step={0.000001}
                          placeholder="42.876710"
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item label={t('settings.longitude')} name="longitude">
                        <InputNumber
                          style={{ width: '100%' }}
                          step={0.000001}
                          placeholder="74.603719"
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        label={t('settings.radius')}
                        name="checkInRadiusMeters"
                        rules={[
                          {
                            type: 'number',
                            min: 20,
                            max: 5000,
                            message: '20–5000',
                          },
                        ]}
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          min={20}
                          max={5000}
                          step={10}
                          placeholder="150"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Space wrap>
                    <Button
                      icon={<AimOutlined />}
                      onClick={useBrowserGeo}
                    >
                      {t('settings.useCurrent')}
                    </Button>
                    <Button type="primary" htmlType="submit" loading={savingInst}>
                      {t('common.save')}
                    </Button>
                    {activeInst?.latitude != null && activeInst?.longitude != null && (
                      <a
                        href={`https://www.google.com/maps?q=${activeInst.latitude},${activeInst.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button>{t('settings.openMap')}</Button>
                      </a>
                    )}
                  </Space>
                </Form>
              </Card>
            </motion.div>
          </Col>
        )}

        <Col xs={24} md={12}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="glass" bordered={false} title={<><BulbOutlined /> {t('settings.appearance')}</>}>
              <Text type="secondary">{t('settings.themeLabel')}</Text>
              <div className="mt-2">
                <Segmented
                  value={mode}
                  onChange={(v) => setMode(v as 'light' | 'dark')}
                  options={[
                    { value: 'light', label: t('settings.themeLight') },
                    { value: 'dark', label: t('settings.themeDark') },
                  ]}
                />
                <div style={{ marginTop: 6 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('settings.themeHint')}
                  </Text>
                </div>
              </div>
              <Divider />
              <Text type="secondary">{t('lang.title')}</Text>
              <div className="mt-2">
                <Segmented
                  value={lang}
                  onChange={(v) => setLang(v as Lang)}
                  options={LANGS.map((l) => ({
                    value: l.code,
                    label: <span lang={l.htmlLang}>{l.name}</span>,
                  }))}
                />
                <div style={{ marginTop: 6 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('lang.hint')}
                  </Text>
                </div>
              </div>
              <Divider />
              <Text type="secondary">{t('settings.currentUser')}</Text>
              <div className="mt-2">
                <Space>
                  <Text strong>{user?.fullName}</Text>
                  <Tag color="cyan">{roleLabel(user)}</Tag>
                </Space>
              </div>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} md={12}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <Card className="glass" bordered={false} title={<><FileDoneOutlined /> {t('settings.data')}</>}>
              <Text type="secondary">{t('settings.dataHelp')}</Text>
              <Space className="mt-3" wrap>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    seed()
                    message.success(t('settings.demoLoaded'))
                  }}
                >
                  {t('settings.loadDemo')}
                </Button>
                <Popconfirm
                  title={t('settings.resetTitle')}
                  description={t('settings.resetDesc')}
                  okText={t('settings.resetOk')}
                  cancelText={t('common.cancel')}
                  onConfirm={() => {
                    reset()
                    message.success(t('settings.resetDone'))
                  }}
                >
                  <Button danger>{t('settings.resetAll')}</Button>
                </Popconfirm>
              </Space>
              <Divider />
              <Title level={5} style={{ marginTop: 0 }}>
                {t('settings.sysInfo')}
              </Title>
              <ul className="text-sm space-y-1">
                <li>
                  {t('settings.version')} <Tag color="purple">v2.0</Tag>
                </li>
                <li>{t('settings.storage')}</li>
                <li>
                  {t('settings.localeLine')} {t('settings.localeName')}
                </li>
              </ul>
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* Свой пароль человек меняет сам: админ чужие пароли не вводит */}
      {user && user.role !== 'STUDENT' && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} md={12}>
            <ChangePasswordCard />
          </Col>
          <Col xs={24} md={12}>
            <ChangeEmailCard />
          </Col>
        </Row>
      )}
    </div>
  )
}
