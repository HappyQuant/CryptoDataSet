import React from 'react';
import { Layout, Menu } from 'antd';
import { DatabaseOutlined, LineChartOutlined, DownloadOutlined } from '@ant-design/icons';
import DataManagement from './components/DataManagement';
import KlineChart from './components/KlineChart';
import DataCollection from './components/DataCollection';
import './App.css';

const { Header, Sider, Content } = Layout;

function App() {
  const [activeTab, setActiveTab] = React.useState('collection');

  const menuItems = [
    {
      key: 'collection',
      icon: <DownloadOutlined />,
      label: '数据采集',
    },
    {
      key: 'management',
      icon: <DatabaseOutlined />,
      label: '数据管理',
    },
    {
      key: 'chart',
      icon: <LineChartOutlined />,
      label: 'K线图表',
    },
  ];

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div className="logo">Crypto量化数据管理平台</div>
      </Header>
      <Layout>
        <Sider width={200} className="app-sider" collapsible>
          <Menu
            theme="light"
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
}

export default App;
