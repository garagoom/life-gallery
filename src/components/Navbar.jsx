import { NavLink, useNavigate } from 'react-router-dom';
import { Dropdown, Avatar } from 'antd';
import { UserOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { logout } from '../api/auth';
import styles from './Navbar.module.css';

export default function Navbar() {
  const navigate = useNavigate();
  const { user, loginUser, hasRole } = useAuth();

  const userMenuItems = [
    {
      key: 'profile',
      label: '个人信息',
      icon: <UserOutlined />,
    },
    hasRole('admin') && {
      key: 'users',
      label: '用户管理',
      icon: <SettingOutlined />,
      onClick: () => navigate('/photography/admin/users'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      onClick: () => {
        logout();
        loginUser(null);
      },
    },
  ].filter(Boolean);

  return (
    <nav className={styles.navbar}>
      <NavLink 
        to="/photography/home" 
        className={({ isActive }) => 
          `${styles.navLink} ${isActive ? styles.active : ''}`
        }
      >
        首页
      </NavLink>
      <NavLink 
        to="/photography/portfolio" 
        className={({ isActive }) => 
          `${styles.navLink} ${isActive ? styles.active : ''}`
        }
      >
        作品集
      </NavLink>
      <NavLink 
        to="/photography/admin" 
        className={({ isActive }) => 
          `${styles.navLink} ${isActive ? styles.active : ''}`
        }
      >
        管理
      </NavLink>
      {user && (
        <Dropdown menu={{ items: userMenuItems }} placement="topRight">
          <Avatar icon={<UserOutlined />} style={{ cursor: 'pointer', background: 'var(--accent)' }} />
        </Dropdown>
      )}
    </nav>
  );
}
