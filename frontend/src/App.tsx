import React from 'react';
import { Layout, Menu, Button } from 'antd';
import { DatabaseOutlined, LineChartOutlined, DownloadOutlined, SunOutlined, MoonOutlined, GlobalOutlined } from '@ant-design/icons';
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

  return (
    <Header className="app-header">
      <div className="logo">{t.app.title}</div>
      <div className="header-actions">
        <Button
          className="header-action-btn"
          icon={<GlobalOutlined />}
          onClick={toggleLanguage}
          title={locale === 'zh-CN' ? 'Switch to English' : '切换到中文'}
        >
          {locale === 'zh-CN' ? 'EN' : '中'}
        </Button>
        <Button
          className="header-action-btn"
          icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
          onClick={toggleTheme}
          title={theme === 'light' ? t.app.switchToDark : t.app.switchToLight}
        />
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
