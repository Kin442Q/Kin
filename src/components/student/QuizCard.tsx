import { Button, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'

import { SP, SproutCard } from '../sprout'
import type { QuizSummary } from '../../api/learningApi'

/** Квиз в списке ученика: что за тест, сколько вопросов и лучший результат. */
export default function QuizCard({ quiz }: { quiz: QuizSummary }) {
  const navigate = useNavigate()
  const best = quiz.myBest
  return (
    <SproutCard padding={16}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {quiz.subject && (
          <Tag style={{ margin: 0, background: quiz.subject.color, color: '#fff', border: 'none' }}>
            {quiz.subject.name}
          </Tag>
        )}
        {quiz.examTrack && (
          <Tag color="purple" style={{ margin: 0 }}>
            {quiz.examTrack.name}
          </Tag>
        )}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: SP.text }}>{quiz.title}</div>
      {quiz.description && <div style={{ fontSize: 13, color: SP.textMid, marginTop: 4 }}>{quiz.description}</div>}
      <div style={{ fontSize: 12, color: SP.muted, marginTop: 8 }}>
        Вопросов: {quiz.questionsCount}
        {quiz.timeLimitSec ? ` · ${Math.round(quiz.timeLimitSec / 60)} мин` : ''}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        {best ? (
          <Tag color={best.percent >= 80 ? 'green' : best.percent >= 50 ? 'orange' : 'red'} style={{ margin: 0 }}>
            Лучший: {best.percent}% · попыток {best.attempts}
          </Tag>
        ) : (
          <span style={{ fontSize: 12, color: SP.muted }}>Ещё не проходил(а)</span>
        )}
        <Button type="primary" onClick={() => navigate(`/student/quizzes/${quiz.id}`)}>
          {best ? 'Ещё раз' : 'Пройти'}
        </Button>
      </div>
    </SproutCard>
  )
}
