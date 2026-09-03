import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Popover, Dropdown, Avatar, Menu, Divider, Typography } from 'antd';
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
  AuditOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { logout } from '../api/auth';
import { getMyMenus } from '../api/menus';
import styles from './FloatingMenu.module.css';

const { Text } = Typography;

const iconMap = {
  CameraOutlined: <CameraOutlined />,
  UserOutlined: <UserOutlined />,
  LogoutOutlined: <LogoutOutlined />,
  SettingOutlined: <SettingOutlined />,
  HomeOutlined: <HomeOutlined />,
  TeamOutlined: <TeamOutlined />,
  PictureOutlined: <PictureOutlined />,
  SafetyOutlined: <SafetyOutlined />,
  MenuOutlined: <MenuOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  AuditOutlined: <AuditOutlined />,
};

const fallbackModules = [
  {
    key: 'photography',
    label: '摄影',
    icon: <CameraOutlined />,
    path: '/photography',
    children: [
      { key: 'home', label: '首页', path: '/photography/home', icon: <HomeOutlined /> },
      { key: 'portfolio', label: '作品集', path: '/photography/portfolio', icon: <PictureOutlined /> },
      { key: 'admin', label: '管理', path: '/photography/admin', icon: <SettingOutlined /> },
    ]
  },
];

function buildTree(list) {
  const tree = [];
  const map = {};
  list.forEach(item => {
    map[item.id] = { ...item, children: [] };
  });
  list.forEach(item => {
    if (item.parent_id && map[item.parent_id]) {
      map[item.parent_id].children.push(map[item.id]);
    } else {
      tree.push(map[item.id]);
    }
  });
  return tree;
}

function resolveIcon(iconName) {
  if (!iconName) return <AppstoreOutlined />;
  return iconMap[iconName] || <AppstoreOutlined />;
}

function resolveMenuTree(apiTree) {
  return apiTree.map(node => ({
    ...node,
    icon: resolveIcon(node.icon),
    path: node.path || undefined,
    children: node.children ? resolveMenuTree(node.children) : undefined,
  }));
}

export default function FloatingMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loginUser } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [modules, setModules] = useState(fallbackModules);

  useEffect(() => {
    if (!user) return;
    getMyMenus().then(res => {
      const tree = resolveMenuTree(res.data || []);
      if (tree.length > 0) setModules(tree);
    }).catch(() => {});
  }, [user]);

  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  const getCurrentModule = () => {
    const path = location.pathname;
    // First: exact match on children paths (more specific)
    for (const mod of modules) {
      if (mod.children) {
        for (const child of mod.children) {
          if (child.path && path === child.path) return mod;
        }
      }
    }
    // Second: match on module prefix (less specific)
    for (const mod of modules) {
      if (mod.path && path.startsWith(mod.path)) return mod;
    }
    return modules[0];
  };

  const currentModule = getCurrentModule();

  const getCurrentPage = () => {
    const path = location.pathname;
    if (!currentModule || !currentModule.children) return '';
    for (const child of currentModule.children) {
      if (child.path && path === child.path) return child.key;
    }
    return currentModule.children[0]?.key || '';
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

  const moduleMenuItems = modules.map(mod => ({
    key: mod.key,
    icon: mod.icon,
    label: mod.label,
    onClick: () => {
      const target = mod.path
        ? (mod.children?.[0]?.path || mod.path)
        : (mod.children?.[0]?.path || '/');
      navigate(target);
    },
  }));

  const pageMenuItems = (currentModule?.children || []).map(child => ({
    key: child.key,
    icon: child.icon,
    label: child.label,
    onClick: () => child.path && navigate(child.path),
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
                  src={user.avatar}
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
        <div className={styles.mainButton}>
          <div className={styles.moduleIcon}>
            {currentModule.icon}
          </div>
        </div>
      </Popover>
    </div>
  );
}
