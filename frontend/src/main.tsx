import { StrictMode, Suspense, lazy, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Status, Empty } from './components/UI';
import { Home } from './pages/Home';
import { AuthPage } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { PantryPage } from './pages/Pantry';
import { ProfilePage } from './pages/Profile';
import { RecipesPage, RecipeDetails } from './pages/Recipes';
import { HistoryPage } from './pages/History';
const AnalyticsPage = lazy(() => import('./pages/Analytics').then(m => ({ default: m.AnalyticsPage })));
const AdminPage = lazy(() => import('./pages/Admin').then(m => ({ default: m.AdminPage })));
import './styles.css';
function Protected({ children, admin = false }: { children: ReactNode; admin?: boolean }) { const { user, loading, error } = useAuth(), location = useLocation(); if (loading) return <Status loading/>; if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace/>; if (admin && user.role !== 'ADMIN') return <Empty title="Administrator access required">This area is available to catalog administrators.</Empty>; return <>{error && <Status error={error}/ >}{children}</>; }
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><AuthProvider><Suspense fallback={<Status loading/>}><Routes><Route element={<Layout/>}><Route index element={<Home/>}/><Route path="login" element={<AuthPage/>}/><Route path="register" element={<AuthPage register/>}/><Route path="recipes" element={<RecipesPage/>}/><Route path="recipes/:id" element={<RecipeDetails/>}/><Route path="dashboard" element={<Protected><Dashboard/></Protected>}/><Route path="pantry" element={<Protected><PantryPage/></Protected>}/><Route path="profile" element={<Protected><ProfilePage/></Protected>}/><Route path="history" element={<Protected><HistoryPage/></Protected>}/><Route path="analytics" element={<Protected><AnalyticsPage/></Protected>}/><Route path="admin" element={<Protected admin><AdminPage/></Protected>}/><Route path="*" element={<Empty title="This page wandered out of the kitchen.">Use the navigation to find your next meal.</Empty>}/></Route></Routes></Suspense></AuthProvider></BrowserRouter></StrictMode>);
