import React, { useState, useEffect } from 'react';
import { Heart, Search, Settings, User, Home, Info, HelpCircle, Shield, Database } from 'lucide-react';
import { useMaintenanceStatus } from './hooks/useMaintenanceStatus';
import { useAutoSync } from './hooks/useAutoSync';
import { getAuthSession } from './lib/deviceAuth';

// コンポーネントのインポート
import MaintenanceMode from './components/MaintenanceMode';
import PrivacyConsent from './components/PrivacyConsent';
import DeviceAuthLogin from './components/DeviceAuthLogin';
import DeviceAuthRegistration from './components/DeviceAuthRegistration';
import AdminPanel from './components/AdminPanel';
import DataMigration from './components/DataMigration';
import UserDataManagement from './components/UserDataManagement';
import AutoSyncSettings from './components/AutoSyncSettings';

// ページコンポーネントのインポート
import DiaryPage from './pages/DiaryPage';
import DiarySearchPage from './pages/DiarySearchPage';
import EmotionTypes from './pages/EmotionTypes';
import FirstSteps from './pages/FirstSteps';
import NextSteps from './pages/NextSteps';
import HowTo from './pages/HowTo';
import Support from './pages/Support';
import PrivacyPolicy from './pages/PrivacyPolicy';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('diary');
  const [lineUsername, setLineUsername] = useState<string | null>(null);
  const [privacyConsentGiven, setPrivacyConsentGiven] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [showDeviceAuth, setShowDeviceAuth] = useState<boolean>(false);
  const [deviceAuthMode, setDeviceAuthMode] = useState<'login' | 'register'>('login');
  const [isDeviceAuthEnabled, setIsDeviceAuthEnabled] = useState<boolean>(false);
  const [isDataManagementOpen, setIsDataManagementOpen] = useState<boolean>(false);
  
  // メンテナンスモードの状態を取得
  const { isMaintenanceMode, isAdminBypass, config } = useMaintenanceStatus();
  
  // 自動同期フックを使用
  const autoSync = useAutoSync();

  // 初期化
  useEffect(() => {
    // ローカルストレージからLINEユーザー名を取得
    const savedUsername = localStorage.getItem('line-username');
    if (savedUsername) {
      setLineUsername(savedUsername);
    }
    
    // プライバシーポリシーの同意状態を取得
    const consentGiven = localStorage.getItem('privacyConsentGiven') === 'true';
    setPrivacyConsentGiven(consentGiven);
    
    // 管理者（カウンセラー）かどうかをチェック
    const currentCounselor = localStorage.getItem('current_counselor');
    if (currentCounselor) {
      setIsAdmin(true);
    }
    
    // デバイス認証が有効かどうかをチェック
    const authSession = getAuthSession();
    setIsDeviceAuthEnabled(!!authSession);
  }, []);

  // プライバシーポリシーの同意処理
  const handlePrivacyConsent = (accepted: boolean) => {
    if (accepted) {
      localStorage.setItem('privacyConsentGiven', 'true');
      localStorage.setItem('privacyConsentDate', new Date().toISOString());
      setPrivacyConsentGiven(true);
      
      // デバイス認証画面を表示
      setShowDeviceAuth(true);
      setDeviceAuthMode('register');
    } else {
      // 同意しない場合の処理
      localStorage.setItem('privacyConsentGiven', 'false');
      alert('プライバシーポリシーに同意いただけない場合、サービスをご利用いただけません。');
    }
  };

  // デバイス認証のログイン成功時の処理
  const handleDeviceAuthLoginSuccess = (username: string) => {
    setLineUsername(username);
    localStorage.setItem('line-username', username);
    setShowDeviceAuth(false);
    setIsDeviceAuthEnabled(true);
  };

  // デバイス認証の登録完了時の処理
  const handleDeviceAuthRegistrationComplete = (username: string) => {
    setLineUsername(username);
    localStorage.setItem('line-username', username);
    setShowDeviceAuth(false);
    setIsDeviceAuthEnabled(true);
  };

  // カウンセラーログイン処理
  const handleCounselorLogin = () => {
    const email = prompt('カウンセラーメールアドレスを入力してください');
    if (!email) return;
    
    const password = prompt('パスワードを入力してください');
    if (!password) return;
    
    // カウンセラーアカウントの検証（実際の実装ではより安全な方法を使用）
    const counselors = [
      { email: 'jin@namisapo.com', name: '心理カウンセラー仁', password: 'counselor123' },
      { email: 'aoi@namisapo.com', name: '心理カウンセラーAOI', password: 'counselor123' },
      { email: 'asami@namisapo.com', name: '心理カウンセラーあさみ', password: 'counselor123' },
      { email: 'shu@namisapo.com', name: '心理カウンセラーSHU', password: 'counselor123' },
      { email: 'yucha@namisapo.com', name: '心理カウンセラーゆーちゃ', password: 'counselor123' },
      { email: 'sammy@namisapo.com', name: '心理カウンセラーSammy', password: 'counselor123' }
    ];
    
    const counselor = counselors.find(c => c.email === email && c.password === password);
    
    if (counselor) {
      localStorage.setItem('current_counselor', counselor.name);
      setIsAdmin(true);
      alert(`${counselor.name}としてログインしました。`);
      setActiveTab('admin');
    } else {
      alert('メールアドレスまたはパスワードが正しくありません。');
    }
  };

  // カウンセラーログアウト処理
  const handleCounselorLogout = () => {
    if (window.confirm('カウンセラーアカウントからログアウトしますか？')) {
      localStorage.removeItem('current_counselor');
      setIsAdmin(false);
      setActiveTab('diary');
    }
  };

  // メンテナンスモード中の表示
  if (isMaintenanceMode && !isAdminBypass) {
    return <MaintenanceMode config={config!} />;
  }

  // プライバシーポリシー同意画面
  if (!privacyConsentGiven) {
    return <PrivacyConsent onConsent={handlePrivacyConsent} />;
  }

  // デバイス認証画面
  if (showDeviceAuth) {
    if (deviceAuthMode === 'login') {
      return (
        <DeviceAuthLogin
          onLoginSuccess={handleDeviceAuthLoginSuccess}
          onRegister={() => setDeviceAuthMode('register')}
          onBack={() => setShowDeviceAuth(false)}
        />
      );
    } else {
      return (
        <DeviceAuthRegistration
          onRegistrationComplete={handleDeviceAuthRegistrationComplete}
          onBack={() => setShowDeviceAuth(false)}
        />
      );
    }
  }

  // データ管理画面
  if (isDataManagementOpen) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-jp-bold text-gray-900">データ管理</h1>
            <button
              onClick={() => setIsDataManagementOpen(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-jp-medium"
            >
              戻る
            </button>
          </div>
          
          <div className="space-y-6">
            <UserDataManagement />
            <DataMigration />
            <AutoSyncSettings />
          </div>
        </div>
      </div>
    );
  }

  // メインアプリ画面
  return (
    <div className="min-h-screen bg-gray-100">
      {/* メンテナンスモード表示（管理者バイパス中） */}
      {isMaintenanceMode && isAdminBypass && (
        <div className="bg-red-600 text-white px-4 py-2 text-center">
          <p className="text-sm font-jp-medium">
            メンテナンスモード中（管理者アクセス）
          </p>
        </div>
      )}
      
      {/* ヘッダー */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Heart className="w-6 h-6 text-red-500" />
            <h1 className="text-xl font-jp-bold text-gray-900">かんじょうにっき</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {isAdmin ? (
              <button
                onClick={handleCounselorLogout}
                className="text-red-600 hover:text-red-700 text-sm font-jp-medium"
              >
                カウンセラーログアウト
              </button>
            ) : (
              <button
                onClick={handleCounselorLogin}
                className="text-blue-600 hover:text-blue-700 text-sm font-jp-medium"
              >
                カウンセラーログイン
              </button>
            )}
            
            <button
              onClick={() => setIsDataManagementOpen(true)}
              className="flex items-center space-x-1 text-gray-600 hover:text-gray-800"
            >
              <Database className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      
      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {isAdmin ? (
          // 管理者（カウンセラー）向け画面
          <AdminPanel />
        ) : (
          // 一般ユーザー向け画面
          <div>
            {/* タブナビゲーション */}
            <div className="flex overflow-x-auto pb-2 mb-6 scrollbar-hide">
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab('diary')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-jp-medium transition-colors ${
                    activeTab === 'diary'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Home className="w-4 h-4" />
                  <span>日記</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('search')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-jp-medium transition-colors ${
                    activeTab === 'search'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span>検索</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('emotions')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-jp-medium transition-colors ${
                    activeTab === 'emotions'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  <span>感情</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('first-steps')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-jp-medium transition-colors ${
                    activeTab === 'first-steps'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>最初に</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('next-steps')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-jp-medium transition-colors ${
                    activeTab === 'next-steps'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>次に</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('how-to')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-jp-medium transition-colors ${
                    activeTab === 'how-to'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>使い方</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('support')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-jp-medium transition-colors ${
                    activeTab === 'support'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Info className="w-4 h-4" />
                  <span>サポート</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('privacy')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-jp-medium transition-colors ${
                    activeTab === 'privacy'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>プライバシー</span>
                </button>
              </div>
            </div>
            
            {/* アクティブなタブのコンテンツ */}
            {activeTab === 'diary' && <DiaryPage />}
            {activeTab === 'search' && <DiarySearchPage />}
            {activeTab === 'emotions' && <EmotionTypes />}
            {activeTab === 'first-steps' && <FirstSteps />}
            {activeTab === 'next-steps' && <NextSteps />}
            {activeTab === 'how-to' && <HowTo />}
            {activeTab === 'support' && <Support />}
            {activeTab === 'privacy' && <PrivacyPolicy />}
          </div>
        )}
      </main>
      
      {/* フッター */}
      <footer className="bg-white shadow-inner mt-8 py-4">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-gray-500 text-xs font-jp-normal">
            © 2025 一般社団法人NAMIDAサポート協会
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;