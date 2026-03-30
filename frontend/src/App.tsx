import React, { useState, useEffect } from 'react';
import { Layout, Menu } from 'antd';
import { DatabaseOutlined, LineChartOutlined, DownloadOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons';
import DataManagement from './components/DataManagement';
import KlineChart from './components/KlineChart';
import DataCollection from './components/DataCollection';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import './App.css';

const { Header, Sider, Content } = Layout;

const HeaderContent: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { locale, toggleLanguage, t } = useLanguage();

  const isZhCN = locale === 'zh-CN';
  const isDark = theme === 'dark';

  return (
    <Header className="app-header">
      <div className="logo">{t.app.title}</div>
      <div className="header-actions">
        <div className="toggle-group">
          <button
            className="toggle-btn"
            onClick={toggleLanguage}
            title={isZhCN ? 'Switch to English' : '切换到中文'}
          >
            <span className="toggle-text-active">{isZhCN ? t.app.english : t.app.chinese}</span>
          </button>
        </div>
        <div className="toggle-group">
          <button
            className="toggle-btn"
            onClick={toggleTheme}
            title={isDark ? t.app.switchToLight : t.app.switchToDark}
          >
            {isDark ? (
              <>
                <SunOutlined className="toggle-icon" />
                <span className="toggle-text-active">{t.app.light}</span>
              </>
            ) : (
              <>
                <MoonOutlined className="toggle-icon" />
                <span className="toggle-text-active">{t.app.dark}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Header>
  );
};

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('collection');
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { theme } = useTheme();
  const { t } = useLanguage();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const menuItems = [
    {
      key: 'collection',
      icon: <DownloadOutlined />,
      label: t.menu.collection,
    },
    {
      key: 'management',
      icon: <DatabaseOutlined />,
      label: t.menu.management,
    },
    {
      key: 'chart',
      icon: <LineChartOutlined />,
      label: t.menu.chart,
    },
  ];

  const handleMenuClick = (key: string) => {
    setActiveTab(key);
    setDrawerOpen(false);
  };

  return (
    <Layout className="app-layout">
      <HeaderContent />
      <Layout>
        {!isMobile && (
          <Sider width={200} className="app-sider" collapsible>
            <Menu
              theme={theme}
              mode="inline"
              selectedKeys={[activeTab]}
              items={menuItems}
              onClick={({ key }) => setActiveTab(key)}
            />
          </Sider>
        )}

        {isMobile && drawerOpen && (
          <>
            <div className="drawer-overlay open" onClick={() => setDrawerOpen(false)} />
            <div className="app-sider-drawer open">
              <Menu
                theme={theme}
                mode="inline"
                selectedKeys={[activeTab]}
                items={menuItems}
                onClick={({ key }) => handleMenuClick(key)}
              />
            </div>
          </>
        )}

        <Content className="app-content">
          {activeTab === 'collection' && <DataCollection />}
          {activeTab === 'management' && <DataManagement />}
          {activeTab === 'chart' && <KlineChart />}
        </Content>
      </Layout>

      {isMobile && (
        <div className="mobile-tab-nav">
          {menuItems.map(item => (
            <div
              key={item.key}
              className={`mobile-tab-item ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => setActiveTab(item.key)}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
};

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
