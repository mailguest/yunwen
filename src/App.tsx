// 主应用组件
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { Toaster } from 'sonner';

import { useAuthStore } from '@/stores/authStore';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import TaskList from '@/pages/TaskList';
import TaskForm from '@/pages/TaskForm';
import TaskDetail from '@/pages/TaskDetail';
import Monitoring from '@/pages/Monitoring';
// 移除日志页面
import TaskGroups from '@/pages/TaskGroups';
import Settings from '@/pages/Settings';
import Alerts from '@/pages/Alerts';
import Systems from '@/pages/Systems';
import Users from '@/pages/Users';
import Roles from '@/pages/Roles';
import Resources from '@/pages/Resources';
import Profile from '@/pages/Profile';
import SecurityManagement from '@/pages/SecurityManagement';

import '@/App.css';

function App() {
  const { isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 受保护的路由包装器
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
  };

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1E40AF',
          borderRadius: 6,
        },
      }}
    >
      <AntApp>
        <div className="min-h-screen bg-gray-50">
          <Router>
            <Routes>
            <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="tasks" element={<TaskList />} />
              <Route path="tasks/:id" element={<TaskDetail />} />
              <Route path="tasks/create" element={<TaskForm />} />
              <Route path="tasks/:id/edit" element={<TaskForm />} />
              <Route path="monitoring" element={<Monitoring />} />
              <Route path="task-groups" element={<TaskGroups />} />
              <Route path="settings" element={<Settings />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="systems" element={<Systems />} />
              <Route path="users" element={<Users />} />
              <Route path="roles" element={<Roles />} />
              <Route path="resources" element={<Resources />} />
              <Route path="security" element={<SecurityManagement />} />
              <Route path="profile" element={<Profile />} />
            </Route>
          </Routes>
        </Router>
        
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          duration={4000}
          visibleToasts={3}
          offset={16}
        />
        </div>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
