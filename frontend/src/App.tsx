import './App.css'

import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { MainSidebar } from '@/components/layout';
import { Toaster } from "@/components/ui/sonner";
import { ForwardTestingProvider } from '@/contexts/ForwardTestingContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { GlobalForwardTestIndicator } from '@/components/forward_testing/GlobalForwardTestIndicator';

// Pages
import LiveDashboard from './pages/live_dashboard/LiveDashboard.jsx';
import EnhancedLiveDashboard from './pages/live_dashboard/EnhancedLiveDashboard.tsx';
import BuildAlgorithmPage from './pages/build_algorithm/BuildAlgorithmPage.jsx';
import BacktestPage from './pages/backtest/BacktestPage.jsx';
import StrategiesPage from './pages/strategies/StrategiesPage';
import ForwardTestingManager from './pages/forward_testing/ForwardTestingManager';
import SessionCreationWizard from './pages/forward_testing/SessionCreationWizard';
import SessionDetailView from './pages/forward_testing/SessionDetailView';
import LoginPage from './pages/auth/LoginPage';

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('dashboard');

  // Sync activeView with current route
  useEffect(() => {
    const path = location.pathname;
    if (path === '/' || path === '/live_view') {
      setActiveView('dashboard');
    } else if (path === '/builder') {
      setActiveView('builder');
    } else if (path.startsWith('/backtest')) {
      setActiveView('backtest');
    } else if (path.startsWith('/strategies')) {
      setActiveView('strategies');
    } else if (path.startsWith('/forward-testing')) {
      setActiveView('forward-testing');
    }
  }, [location]);

  // Handle sidebar navigation
  const handleViewChange = (view: string) => {
    setActiveView(view);
    switch (view) {
      case 'dashboard':
        navigate('/');
        break;
      case 'builder':
        navigate('/builder');
        break;
      case 'backtest':
        navigate('/backtest');
        break;
      case 'strategies':
        navigate('/strategies');
        break;
      case 'forward-testing':
        navigate('/forward-testing');
        break;
    }
  };


  return (
    <AuthProvider>
      <Routes>
        <Route path='/login' element={<LoginPage />} />
        <Route path='/*' element={
          <ProtectedRoute>
            <ForwardTestingProvider>
              <SidebarProvider>
                <div className="flex h-screen w-screen" style={{ '--sidebar-width': '14rem' } as React.CSSProperties}>
                  <MainSidebar activeView={activeView} onViewChange={handleViewChange} />
                  <SidebarInset className="flex-1 overflow-x-hidden overflow-y-auto">
                    <Routes>
                      <Route path='/' element={<EnhancedLiveDashboard/>}/>
                      <Route path='/live_view' element={<EnhancedLiveDashboard/>}/>
                      <Route path='/live_view/legacy' element={<LiveDashboard/>}/>
                      <Route path='/builder' element={<BuildAlgorithmPage/>}/>
                      <Route path='/backtest' element={<BacktestPage/>} />
                      <Route path='/strategies' element={<StrategiesPage/>} />
                      <Route path='/forward-testing' element={<ForwardTestingManager/>} />
                      <Route path='/forward-testing/create' element={<SessionCreationWizard/>} />
                      <Route path='/forward-testing/session/:sessionId' element={<SessionDetailView/>} />
                    </Routes>
                  </SidebarInset>
                </div>
                <GlobalForwardTestIndicator />
                <Toaster />
              </SidebarProvider>
            </ForwardTestingProvider>
          </ProtectedRoute>
        } />
      </Routes>
    </AuthProvider>
  );
}

export default App
