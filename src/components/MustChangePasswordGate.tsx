import { Alert, Button, Modal } from 'antd'
import { useNavigate } from 'react-router-dom'

import ChangePasswordForm from './ChangePasswordForm'
import { useAuthStore } from '../store/authStore'

/**
 * Человек вошёл по временному паролю от админа — пока он не придумает свой,
 * закрыть это окно и работать в системе нельзя.
 */
export default function MustChangePasswordGate() {
  const mustChange = useAuthStore((s) => !!s.user?.mustChangePassword)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  return (
    <Modal
      open={mustChange}
      title="Придумайте свой пароль"
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={null}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Вы вошли по временному паролю"
        description="Его знает администратор, поэтому его нужно заменить на свой. Введите временный пароль и придумайте новый."
      />
      <ChangePasswordForm submitText="Сохранить и продолжить" />
      <Button
        type="link"
        style={{ paddingLeft: 0, marginTop: 8 }}
        onClick={() => {
          logout()
          navigate('/login')
        }}
      >
        Выйти
      </Button>
    </Modal>
  )
}
