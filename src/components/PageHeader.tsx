import { ReactNode } from 'react'
import { Typography, Space } from 'antd'
import { motion } from 'framer-motion'

const { Title, Text } = Typography

interface Props {
  title: ReactNode
  icon?: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

/**
 * Унифицированная шапка страницы: иконка + заголовок + описание + действия.
 * Используется на всех страницах админки.
 */
export default function PageHeader({ title, icon, description, actions }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <div>
        <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon}
          {title}
        </Title>
        {description && (
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            {description}
          </Text>
        )}
      </div>
      {actions && <Space wrap>{actions}</Space>}
    </motion.div>
  )
}
