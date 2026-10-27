import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PageTitle } from '../components/UI';
import { PreferencesForm } from '../components/PreferencesForm';
export function ProfilePage() { const { user } = useAuth(); return <div className="wrap page narrow"><PageTitle eyebrow="JUST THE WAY YOU LIKE IT" title="A little more personal.">Your preferences make every match feel more like you.</PageTitle><div className="panel"><PreferencesForm profile/></div>{user?.role === 'ADMIN' && <Link className="button small" to="/admin">Manage recipe catalog</Link>}</div>; }
