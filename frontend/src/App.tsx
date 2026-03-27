import React from 'react';
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
            className={`toggle-btn ${isZhCN ? 'active' : ''}`}
            onClick={toggleLanguage}
            title={isZhCN ? 'Switch to English' : '切换到中文'}
          >
            <span className="toggle-text-active">{isZhCN ? t.app.chinese : t.app.english}</span>
          </button>
        </div>
        <div className="toggle-group">
          <button
            className={`toggle-btn ${isDark ? 'active' : ''}`}
            onClick={toggleTheme}
            title={isDark ? t.app.switchToLight : t.app.switchToDark}
          >
            {isDark ? (
              <>
                <MoonOutlined className="toggle-icon" />
                <span className="toggle-text-active">{t.app.dark}</span>
              </>
            ) : (
              <>
                <SunOutlined className="toggle-icon" />
                <span className="toggle-text-active">{t.app.light}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Header>
  );
};

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState('collection');
  const { theme } = useTheme();
  const { t } = useLanguage();

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

  return (
    <Layout className="app-layout">
      <HeaderContent />
      <Layout>
        <Sider width={200} className="app-sider" collapsible>
          <Menu
            theme={theme}
            mode="vertical"
            selectedKeys={[activeTab]}
            items={menuItems}
            onClick={({ key }) => setActiveTab(key)}
          />
        </Sider>
        <Content className="app-content">
          {activeTab === 'collection' && <DataCollection />}
          {activeTab === 'management' && <DataManagement />}
          {activeTab === 'chart' && <KlineChart />}
        </Content>
      </Layout>
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
