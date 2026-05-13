/**
 * ПРИМЕР: Полностью интегрированный компонент со всеми операциями CRUD
 * Используется для демонстрации правильного использования API hooks
 *
 * В реальном приложении скопируйте этот паттерн в другие компоненты.
 */

import { useState } from 'react'
import {
  Table,
  Button,
  Form,
  Modal,
  Input,
  Select,
  DatePicker,
  Space,
  Tag,
  App as AntdApp,
  Spin,
  Empty,
  Popconfirm,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  useStudents,
  useCreateStudent,
  useUpdateStudent,
  useDeleteStudent,
  useGroups,
} from '@/api'
import type { Child, Group } from '@/types'
import type { AxiosError } from 'axios'
import dayjs from 'dayjs'

interface StudentFormData {
  firstName: string
  lastName: string
  groupId: string
  birthDate: string
  gender: 'male' | 'female'
  motherPhone?: string
  fatherPhone?: string
}

/**
 * Компонент для управления учениками.
 * Демонстрирует:
 * - Загрузку списка (useStudents)
 * - Создание (useCreateStudent)
 * - Обновление (useUpdateStudent)
 * - Удаление (useDeleteStudent)
 * - Правильную обработку ошибок
 * - Loading и Error состояния
 */
export function StudentsManagement({ groupId }: { groupId?: string }) {
  const { message } = AntdApp.useApp()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Child | null>(null)
  const [form] = Form.useForm()

  // Запросы данных
  const { data: students = [], isLoading, error } = useStudents(groupId)
  const { data: groups = [] } = useGroups()

  // Мутации
  const createMutation = useCreateStudent()
  const updateMutation = useUpdateStudent()
  const deleteMutation = useDeleteStudent()

  const handleOpenModal = (student?: Child) => {
    if (student) {
      setEditingStudent(student)
      form.setFieldsValue({
        ...student,
        birthDate: dayjs(student.birthDate),
      })
    } else {
      setEditingStudent(null)
      form.resetFields()
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingStudent(null)
    form.resetFields()
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()

      const data: StudentFormData = {
        ...values,
        birthDate: values.birthDate.format('YYYY-MM-DD'),
      }

      if (editingStudent) {
        // Обновление
        updateMutation.mutate(
          { id: editingStudent.id, data },
          {
            onSuccess: () => {
              message.success('Ученик обновлён')
              handleCloseModal()
            },
            onError: (error) => {
              const axiosError = error as AxiosError<any>
              message.error(
                axiosError?.response?.data?.message || 'Ошибка при обновлении',
              )
            },
          },
        )
      } else {
        // Создание
        createMutation.mutate(data, {
          onSuccess: () => {
            message.success('Ученик добавлен')
            handleCloseModal()
          },
          onError: (error) => {
            const axiosError = error as AxiosError<any>
            message.error(
              axiosError?.response?.data?.message || 'Ошибка при добавлении',
            )
          },
        })
      }
    } catch (err) {
      // Валидация формы не прошла
      console.error('Validation failed:', err)
    }
  }

  const handleDelete = (id: string, name: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        message.success(`Ученик "${name}" удалён`)
      },
      onError: (error) => {
        const axiosError = error as AxiosError<any>
        message.error(
          axiosError?.response?.data?.message || 'Ошибка при удалении',
        )
      },
    })
  }

  const columns = [
    {
      title: 'ФИО',
      dataIndex: 'firstName',
      key: 'firstName',
      render: (_: string, record: Child) => `${record.firstName} ${record.lastName}`,
    },
    {
      title: 'Группа',
      dataIndex: 'groupId',
      key: 'groupId',
      render: (groupId: string) => {
        const group = groups.find((g) => g.id === groupId)
        return group ? <Tag color="blue">{group.name}</Tag> : '-'
      },
    },
    {
      title: 'Дата рождения',
      dataIndex: 'birthDate',
      key: 'birthDate',
      render: (date: string) => new Date(date).toLocaleDateString('ru-RU'),
    },
    {
      title: 'Пол',
      dataIndex: 'gender',
      key: 'gender',
      render: (gender: string) =>
        gender === 'male' ? <Tag color="cyan">М</Tag> : <Tag color="magenta">Ж</Tag>,
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_: any, record: Child) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
          />
          <Popconfirm
            title="Удалить ученика?"
            description={`${record.firstName} ${record.lastName}`}
            onConfirm={() =>
              handleDelete(record.id, `${record.firstName} ${record.lastName}`)
            }
            okText="Да"
            cancelText="Отмена"
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deleteMutation.isPending}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // Обработка ошибок
  if (error) {
    return (
      <div className="p-6">
        <Empty
          description="Ошибка загрузки"
          style={{ marginTop: 48, marginBottom: 48 }}
        >
          <Button type="primary" onClick={() => window.location.reload()}>
            Перезагрузить
          </Button>
        </Empty>
      </div>
    )
  }

  return (
    <>
      <div className="mb-4">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => handleOpenModal()}
        >
          Добавить ученика
        </Button>
      </div>

      <Spin spinning={isLoading}>
        <Table
          columns={columns}
          dataSource={students}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          locale={{
            emptyText: 'Нет учеников',
          }}
        />
      </Spin>

      <Modal
        title={editingStudent ? 'Редактировать ученика' : 'Новый ученик'}
        open={isModalOpen}
        onCancel={handleCloseModal}
        footer={[
          <Button key="cancel" onClick={handleCloseModal}>
            Отмена
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={createMutation.isPending || updateMutation.isPending}
            onClick={handleSave}
          >
            {editingStudent ? 'Обновить' : 'Добавить'}
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Имя"
            name="firstName"
            rules={[{ required: true, message: 'Введите имя' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Фамилия"
            name="lastName"
            rules={[{ required: true, message: 'Введите фамилию' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Группа"
            name="groupId"
            rules={[{ required: true, message: 'Выберите группу' }]}
          >
            <Select placeholder="Выберите группу">
              {groups.map((g) => (
                <Select.Option key={g.id} value={g.id}>
                  {g.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="Дата рождения"
            name="birthDate"
            rules={[{ required: true, message: 'Выберите дату' }]}
          >
            <DatePicker format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            label="Пол"
            name="gender"
            rules={[{ required: true, message: 'Выберите пол' }]}
          >
            <Select>
              <Select.Option value="male">Мальчик</Select.Option>
              <Select.Option value="female">Девочка</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="Телефон мамы" name="motherPhone">
            <Input />
          </Form.Item>
          <Form.Item label="Телефон папы" name="fatherPhone">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default StudentsManagement
