import React from 'react';
import { Layout, Menu } from 'antd';
import { DatabaseOutlined, LineChartOutlined, DownloadOutlined } from '@ant-design/icons';
import DataManagement from './components/DataManagement';
import KlineChart from './components/KlineChart';
import DataCollection from './components/DataCollection';
import CollectionProgress from './components/CollectionProgress';
import './App.css';

const { Header, Content } = Layout;

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

  const handleCollect = (symbol: string, interval: string) => {
    setActiveTab('collection');
    const form = document.querySelector('.ant-form');
    if (form) {
      const symbolInput = form.querySelector(`[name="symbol"]`) as HTMLInputElement;
      const intervalInput = form.querySelector(`[name="interval"]`) as HTMLInputElement;
      if (symbolInput && intervalInput) {
        symbolInput.value = symbol;
        intervalInput.value = interval;
      }
    }
  };

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div className="logo">Crypto Kline Data</div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[activeTab]}
          items={menuItems}
          onClick={({ key }) => setActiveTab(key)}
        />
      </Header>
      <Content className="app-content">
        {activeTab === 'collection' && (
          <>
            <CollectionProgress onCollect={handleCollect} />
            <DataCollection />
          </>
        )}
        {activeTab === 'management' && <DataManagement />}
        {activeTab === 'chart' && <KlineChart />}
      </Content>
    </Layout>
  );
}

export default App;
