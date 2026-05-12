import { Button, Card, Col, Divider, Popconfirm, Row, Space, Tag, Typography, Segmented, App as AntdApp } from 'antd'
import { SettingOutlined, BulbOutlined, ReloadOutlined, FileDoneOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'

import PageHeader from '../components/PageHeader'
import { useThemeStore } from '../store/themeStore'
import { useDataStore } from '../store/dataStore'
import { useAuthStore } from '../store/authStore'

const { Text, Title } = Typography

export default function SettingsPage() {
  const { message } = AntdApp.useApp()
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  const seed = useDataStore((s) => s.seedDemo)
  const reset = useDataStore((s) => s.resetAll)
  const user = useAuthStore((s) => s.user)

  return (
    <div>
      <PageHeader
        title="Настройки"
        icon={<SettingOutlined />}
        description="Параметры приложения и управление данными"
      />

      <Row gutter={[16, 16]}>
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
