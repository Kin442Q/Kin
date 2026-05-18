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
import { useThemeStore } from '../store/themeStore'
import { useDataStore } from '../store/dataStore'
import { useAuthStore } from '../store/authStore'
import { http } from '../api'
import type { InstitutionType } from '../types'

const { Text, Title } = Typography

export default function SettingsPage() {
  const { message } = AntdApp.useApp()
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  const seed = useDataStore((s) => s.seedDemo)
  const reset = useDataStore((s) => s.resetAll)
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.login)

  const canEditInstitution =
    user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const inst = user?.institution ?? null

  const [savingInst, setSavingInst] = useState(false)
  const [instForm] = Form.useForm()

  useEffect(() => {
    if (inst) {
      instForm.setFieldsValue({
        name: inst.name,
        type: inst.type,
        latitude: inst.latitude,
        longitude: inst.longitude,
        checkInRadiusMeters: inst.checkInRadiusMeters,
      })
    }
  }, [inst, instForm])

  const useBrowserGeo = () => {
    if (!navigator.geolocation) {
      message.error('Геолокация недоступна в этом браузере')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        instForm.setFieldsValue({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        })
        message.success('Координаты текущей позиции записаны')
      },
      (err) => {
        message.error('Не удалось получить координаты: ' + err.message)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const saveInstitution = async () => {
    try {
      const values = await instForm.validateFields()
      setSavingInst(true)
      const r = await http.patch('/v1/kindergartens/mine', {
        name: values.name,
        type: values.type as InstitutionType,
        latitude: values.latitude ?? null,
        longitude: values.longitude ?? null,
        checkInRadiusMeters: values.checkInRadiusMeters,
      })
      message.success('Сохранено')
      // Обновим institution в auth store
      if (user) {
        setUser(
          {
            ...user,
            institution: {
              id: r.data.id,
              name: r.data.name,
              type: r.data.type,
              latitude: r.data.latitude,
              longitude: r.data.longitude,
              checkInRadiusMeters: r.data.checkInRadiusMeters,
            },
          },
          undefined as unknown as string,
        )
      }
    } catch (e: any) {
      if (e?.errorFields) return // ant-d form errors
      message.error(e?.response?.data?.message || 'Ошибка сохранения')
    } finally {
      setSavingInst(false)
    }
  }

  return (
    <div>
      <SproutPageHeader
        title="Настройки"
        icon={<SettingsIcon size={22} strokeWidth={2} />}
        iconAccent="cyan"
        description="Параметры приложения и управление данными"
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
                    <HomeOutlined /> Настройки учреждения
                  </>
                }
              >
                <Text type="secondary">
                  Тип учреждения определяет лейблы интерфейса (группа↔класс,
                  ребёнок↔ученик) на телефоне и в вебе. Координаты используются
                  для проверки check-in воспитателя/учителя через мобильное
                  приложение.
                </Text>

                <Form
                  form={instForm}
                  layout="vertical"
                  style={{ marginTop: 16 }}
                  onFinish={saveInstitution}
                >
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Название"
                        name="name"
                        rules={[{ required: true, message: 'Укажите название' }]}
                      >
                        <Input placeholder="ДОУ «Солнышко» или Школа №42" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Тип учреждения"
                        name="type"
                        rules={[{ required: true }]}
                      >
                        <Segmented
                          block
                          options={[
                            { value: 'KINDERGARTEN', label: '🌱 Детский сад' },
                            { value: 'SCHOOL', label: '🏫 Школа' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider orientation="left" plain>
                    <EnvironmentOutlined /> Геолокация для check-in
                  </Divider>

                  <Row gutter={16}>
                    <Col xs={24} md={8}>
                      <Form.Item label="Широта" name="latitude">
                        <InputNumber
                          style={{ width: '100%' }}
                          step={0.000001}
                          placeholder="42.876710"
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item label="Долгота" name="longitude">
                        <InputNumber
                          style={{ width: '100%' }}
                          step={0.000001}
                          placeholder="74.603719"
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        label="Радиус (м)"
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
                      Взять текущие координаты
                    </Button>
                    <Button type="primary" htmlType="submit" loading={savingInst}>
                      Сохранить
                    </Button>
                    {inst?.latitude != null && inst?.longitude != null && (
                      <a
                        href={`https://www.google.com/maps?q=${inst.latitude},${inst.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button>Открыть на карте</Button>
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
            <Card className="glass" bordered={false} title={<><BulbOutlined /> Внешний вид</>}>
              <Text type="secondary">Тема оформления</Text>
              <div className="mt-2">
                <Segmented
                  value={mode}
                  onChange={(v) => setMode(v as 'light' | 'dark')}
                  options={[
                    { value: 'light', label: 'Светлая' },
                    { value: 'dark', label: 'Тёмная' },
                  ]}
                />
              </div>
              <Divider />
              <Text type="secondary">Текущий пользователь</Text>
              <div className="mt-2">
                <Space>
                  <Text strong>{user?.fullName}</Text>
                  <Tag color="purple">{user?.role}</Tag>
                </Space>
              </div>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} md={12}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <Card className="glass" bordered={false} title={<><FileDoneOutlined /> Данные</>}>
              <Text type="secondary">
                Загрузите демо-данные, чтобы увидеть систему «вживую», или сбросьте всё.
              </Text>
              <Space className="mt-3" wrap>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    seed()
                    message.success('Демо-данные загружены')
                  }}
                >
                  Загрузить демо
                </Button>
                <Popconfirm
                  title="Сбросить все данные?"
                  description="Это удалит группы, детей, оплаты, расходы и сотрудников."
                  okText="Сбросить"
                  cancelText="Отмена"
                  onConfirm={() => {
                    reset()
                    message.success('Данные сброшены')
                  }}
                >
                  <Button danger>Сбросить всё</Button>
                </Popconfirm>
              </Space>
              <Divider />
              <Title level={5} style={{ marginTop: 0 }}>
                Информация о системе
              </Title>
              <ul className="text-sm space-y-1">
                <li>
                  Версия: <Tag color="purple">v2.0</Tag>
                </li>
                <li>Хранилище: localStorage (демо-режим)</li>
                <li>Локаль: русский</li>
              </ul>
            </Card>
          </motion.div>
        </Col>
      </Row>
    </div>
  )
}
