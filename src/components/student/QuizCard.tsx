import { Button, Tag } from 'antd'
import { Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { SP, SproutCard } from '../sprout'
import type { QuizSummary } from '../../api/learningApi'
import { starsFor } from '../../lib/quizGame'

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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span className="qg-quizcard-stars" aria-label={`Звёзд: ${starsFor(best.percent)} из 3`}>
              {[0, 1, 2].map((i) => (
                <Star key={i} size={18} className={i < starsFor(best.percent) ? 'on' : undefined} fill={i < starsFor(best.percent) ? 'currentColor' : 'none'} />
              ))}
            </span>
            <span style={{ fontSize: 12, color: SP.textMid, fontWeight: 600 }}>
              {best.percent}% · попыток {best.attempts}
            </span>
          </span>
        ) : (
          <span style={{ fontSize: 12, color: SP.muted }}>Ещё не проходил(а)</span>
        )}
        <Button type="primary" onClick={() => navigate(`/student/quizzes/${quiz.id}`)}>
          {best ? 'Играть ещё' : 'Играть'}
        </Button>
      </div>
    </SproutCard>
  )
}
