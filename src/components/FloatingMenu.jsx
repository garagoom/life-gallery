import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Popover, Dropdown, Avatar, Menu, Badge, Divider, Typography } from 'antd';
import { 
  CameraOutlined, 
  UserOutlined, 
  LogoutOutlined, 
  SettingOutlined,
  HomeOutlined,
  TeamOutlined,
  PictureOutlined,
  SafetyOutlined,
  MenuOutlined,
  AppstoreOutlined,
  BulbOutlined,
  BulbFilled
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { logout } from '../api/auth';
import styles from './FloatingMenu.module.css';

const { Text } = Typography;

const modules = [
  {
    key: 'photography',
    label: '摄影',
    icon: <CameraOutlined />,
    prefix: '/photography',
    children: [
      { key: 'home', label: '首页', path: '/photography/home', icon: <HomeOutlined /> },
      { key: 'portfolio', label: '作品集', path: '/photography/portfolio', icon: <PictureOutlined /> },
      { key: 'admin', label: '管理', path: '/photography/admin', icon: <SettingOutlined />, requiredRole: 'editor' },
    ]
  },
  {
    key: 'system',
    label: '系统管理',
    icon: <AppstoreOutlined />,
    prefix: '/photography/admin/users',
    requiredRole: 'admin',
    children: [
      { key: 'users', label: '用户管理', path: '/photography/admin/users', icon: <TeamOutlined /> },
      { key: 'roles', label: '角色管理', path: '/photography/admin/roles', icon: <SafetyOutlined /> },
      { key: 'menus', label: '菜单管理', path: '/photography/admin/menus', icon: <MenuOutlined /> },
    ]
  },
];

export default function FloatingMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loginUser, hasRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  const getCurrentModule = () => {
    const path = location.pathname;
    // Check system module first (more specific path)
    if (path.startsWith('/photography/admin/users') || 
        path.startsWith('/photography/admin/roles') || 
        path.startsWith('/photography/admin/menus')) {
      return modules.find(m => m.key === 'system');
    }
    // Then check other modules
    for (const mod of modules) {
      if (path.startsWith(mod.prefix) && mod.key !== 'system') {
        return mod;
      }
    }
    return modules[0];
  };

  const currentModule = getCurrentModule();

  const getCurrentPage = () => {
    const path = location.pathname;
    for (const mod of modules) {
      if (path.startsWith(mod.prefix)) {
        const pagePath = path.replace(mod.prefix, '');
        const child = mod.children.find(c => c.path === `${mod.prefix}${pagePath}`);
        return child?.key || 'home';
      }
    }
    return 'home';
  };

  const currentPage = getCurrentPage();

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch {}
    loginUser(null);
  };

  const moduleMenuItems = modules
    .filter(mod => !mod.requiredRole || hasRole(mod.requiredRole))
    .map(mod => ({
      key: mod.key,
      icon: mod.icon,
      label: mod.label,
      onClick: () => navigate(mod.key === 'system' ? '/photography/admin/users' : mod.prefix + '/home'),
    }));

  const pageMenuItems = currentModule.children
    .filter(child => !child.requiredRole || hasRole(child.requiredRole))
    .map(child => ({
      key: child.key,
      icon: child.icon,
      label: child.label,
      onClick: () => navigate(child.path),
    }));

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
      onClick: () => navigate('/photography/profile'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ].filter(Boolean);

  const popoverContent = (
    <div className={styles.popoverContent}>
      <div className={styles.section}>
        <Text type="secondary" className={styles.sectionTitle}>模块切换</Text>
        <Menu
          mode="vertical"
          selectedKeys={[currentModule.key]}
          items={moduleMenuItems}
          className={styles.menu}
        />
      </div>

      <Divider style={{ margin: '4px 0' }} />

      <div className={styles.section}>
        <Text type="secondary" className={styles.sectionTitle}>{currentModule.label}导航</Text>
        <Menu
          mode="vertical"
          selectedKeys={[currentPage]}
          items={pageMenuItems}
          className={styles.menu}
        />
      </div>

      {user && (
        <>
          <Divider style={{ margin: '4px 0' }} />
          <div className={styles.section}>
            <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="topRight">
              <div className={styles.userItem}>
                <Avatar 
                  icon={<UserOutlined />} 
                  size="small"
                  style={{ backgroundColor: 'var(--accent)' }}
                />
                <Text>{user.displayName || user.username}</Text>
              </div>
            </Dropdown>
          </div>
        </>
      )}

      <Divider style={{ margin: '4px 0' }} />

      <div className={styles.section}>
        <div className={styles.themeToggle} onClick={toggleTheme}>
          {theme === 'light' ? <BulbOutlined /> : <BulbFilled />}
          <Text>{theme === 'light' ? '深色模式' : '浅色模式'}</Text>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      <Popover
        content={popoverContent}
        trigger="hover"
        placement="topRight"
        overlayClassName={styles.popover}
        arrow={false}
      >
        <Badge dot={!!user} offset={[-2, 2]}>
          <div className={styles.mainButton}>
            <div className={styles.moduleIcon}>
              {currentModule.icon}
            </div>
          </div>
        </Badge>
      </Popover>
    </div>
  );
}
