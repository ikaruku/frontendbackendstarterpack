import { Link } from 'react-router-dom'
import Icon from '../components/Icon'

export default function Forbidden() {
  return (
    <div className="card empty">
      <Icon name="lock" />
      <h3 className="card-title" style={{ color: 'var(--text)' }}>
        Access Denied
      </h3>
      <p style={{ margin: '6px 0 16px' }}>
        You do not have permission to view this page. Contact your administrator if you need access.
      </p>
      <Link className="btn" to="/">
        Back to Home
      </Link>
    </div>
  )
}
