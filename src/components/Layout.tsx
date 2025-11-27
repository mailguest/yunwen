import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Menu, Avatar, Dropdown, Button } from 'antd';
import { 
  DashboardOutlined, 
  ScheduleOutlined, 
  MonitorOutlined, 
  FileTextOutlined, 
  SettingOutlined, 
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SafetyOutlined,
  AlertOutlined,
  TeamOutlined,
  DatabaseOutlined,
  AreaChartOutlined,
  ProfileOutlined
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';

const { Header, Sider, Content } = AntLayout;

const Layout: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = React.useState(false);
  const [siteName, setSiteName] = useState('智能调度平台')

  const [allowedItems, setAllowedItems] = useState<Array<{ id: number; code: string; name: string; path: string; icon?: string; parent_id?: number | null; order_index?: number }>>([]);
  useEffect(() => {
    api.get<{ success: boolean; items: Array<{ id: number; code: string; name: string; path: string; icon?: string; parent_id?: number | null; order_index?: number }> }>(`/iam/me/resources`).then(res => {
      setAllowedItems(res.items);
    }).catch(() => setAllowedItems([]));
  }, []);

  useEffect(() => {
    api.get<any>('/settings/app').then(res => {
      const d = res?.data
      if (d && d.site_name) setSiteName(d.site_name)
    }).catch(() => {})
  }, [])

  const iconMap: Record<string, React.ReactNode> = {
    dashboardoutlined: <DashboardOutlined />,
    scheduleoutlined: <ScheduleOutlined />,
    profileoutlined: <ProfileOutlined />,
    areachartoutlined: <AreaChartOutlined />,
    filetextoutlined: <FileTextOutlined />,
    settingoutlined: <SettingOutlined />,
    useroutlined: <UserOutlined />,
    safetyoutlined: <SafetyOutlined />,
    alertoutlined: <AlertOutlined />,
    teamoutlined: <TeamOutlined />,
    databaseoutlined: <DatabaseOutlined />,
    monitoringoutlined: <MonitorOutlined />,
  }
  const getIcon = (name?: string) => {
    if (!name) return undefined
    return iconMap[(name || '').toLowerCase()] || undefined
  }

  const roots = React.useMemo(() => allowedItems.filter(i => !i.parent_id).sort((a,b) => (a.order_index||0)-(b.order_index||0)), [allowedItems])
  const childrenOf = (pid: number) => allowedItems.filter(i => i.parent_id === pid).sort((a,b) => (a.order_index||0)-(b.order_index||0))

  const menuItems = React.useMemo(() => {
    const items: any[] = []
    roots.forEach(root => {
      const children = childrenOf(root.id)
      if (children.length > 0) {
        items.push({
          key: root.code,
          icon: getIcon(root.icon),
          label: root.name,
          children: children.map(ch => ({ key: ch.path, icon: getIcon(ch.icon), label: <Link to={ch.path}>{ch.name}</Link> })),
        })
      } else {
        items.push({ key: root.path, icon: getIcon(root.icon), label: <Link to={root.path}>{root.name}</Link> })
      }
    })
    return items
  }, [roots])

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: <Link to="/profile">个人资料</Link>,
    },
    {
      key: 'api-docs',
      icon: <FileTextOutlined />,
      label: <a href="/api/docs" target="_blank" rel="noopener noreferrer">API 文档</a>,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: logout,
    },
  ];

  return (
    <AntLayout className="min-h-screen">
      <Sider trigger={null} collapsible collapsed={collapsed} theme="light">
        <div className="flex items-center justify-center h-16 border-b border-gray-200">
          <h1 className={`font-bold text-blue-600 ${collapsed ? 'text-sm' : 'text-lg'}`}>
            {siteName}
          </h1>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={(() => {
            const p = location.pathname
            const parent = roots.find(r => childrenOf(r.id).some(ch => ch.path === p))
            return parent ? [parent.code] : []
          })()}
          items={menuItems}
          className="border-r-0"
        />
      </Sider>
      
      <AntLayout>
        <Header className="bg-white shadow-sm flex items-center justify-between px-6">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className="text-lg"
          />
          
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">欢迎，{user?.username}{user?.email ? `（${user.email}）` : ''}</span>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Avatar icon={<UserOutlined />} className="cursor-pointer" />
            </Dropdown>
          </div>
        </Header>
        
        <Content className="m-6 p-6 bg-white rounded-lg shadow-sm">
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
