import { useApp } from '../store/AppContext'
import Icon from './Icon'

export default function ToastHost() {
  const { toasts, dismissToast } = useApp()
  if (toasts.length === 0) return null
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <p>{t.message}</p>
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss notification">
            <Icon name="x" />
          </button>
        </div>
      ))}
    </div>
  )
}
