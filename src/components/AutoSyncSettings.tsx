import React from 'react';
import { RefreshCw, CheckCircle, AlertTriangle, Clock, Database, Shield } from 'lucide-react';
import { useAutoSync } from '../hooks/useAutoSync';

const AutoSyncSettings: React.FC = () => {
  const {
    isAutoSyncEnabled,
    lastSyncTime,
    syncInProgress,
    syncError,
    userCreated,
    isConnected,
    currentUser,
    toggleAutoSync,
    triggerManualSync
  } = useAutoSync();

  const formatSyncTime = (timeString: string | null) => {
    if (!timeString) return '未実行';
    
    const date = new Date(timeString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'たった今';
    if (diffMinutes < 60) return `${diffMinutes}分前`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}時間前`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}日前`;
  };

  const handleManualSync = async () => {
    try {
      await triggerManualSync();
    } catch (error) {
      alert(error instanceof Error ? error.message : '同期に失敗しました');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center space-x-3 mb-6">
        <RefreshCw className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-jp-bold text-gray-900">自動同期設定</h2>
      </div>

      {/* 接続状態表示 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <div>
              <p className="text-sm font-jp-medium text-gray-700">Supabase接続</p>
              <p className="text-xs text-gray-500">{isConnected ? '接続済み' : '未接続'}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${userCreated ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <div>
              <p className="text-sm font-jp-medium text-gray-700">ユーザー状態</p>
              <p className="text-xs text-gray-500">{userCreated ? '作成済み' : '未作成'}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isAutoSyncEnabled ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
            <div>
              <p className="text-sm font-jp-medium text-gray-700">自動同期</p>
              <p className="text-xs text-gray-500">{isAutoSyncEnabled ? '有効' : '無効'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 自動同期設定 */}
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-3">
            <Database className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-jp-semibold text-gray-900">自動データ同期</h3>
              <p className="text-sm text-gray-600 font-jp-normal">
                ローカルデータを自動的にSupabaseに同期します
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isAutoSyncEnabled}
              onChange={(e) => toggleAutoSync(e.target.checked)} 
              disabled={syncInProgress}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
          </label>
        </div>

        {/* 同期状態表示 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-jp-semibold text-gray-900">同期状態</h3>
            <button
              onClick={handleManualSync}
              disabled={syncInProgress || !isConnected}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-jp-medium text-sm transition-colors"
            >
              {syncInProgress ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>手動同期</span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-jp-medium text-gray-700">最終同期</span>
              </div> 
              <span className="text-sm text-gray-600 font-jp-normal">
                {formatSyncTime(lastSyncTime)}
              </span>
            </div>

            {syncInProgress && (
              <div className="flex items-center space-x-2 text-blue-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm font-jp-medium">同期中...</span>
              </div>
            )}

            {syncError && (
              <div className="flex items-center space-x-2 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-jp-medium">{syncError}</span>
              </div>
            )}

            {!syncInProgress && !syncError && lastSyncTime && (
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-jp-medium">同期完了</span>
              </div>
            )}
          </div>
        </div>

        {/* 自動同期の説明 */}
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800 font-jp-normal space-y-1">
              <p className="font-jp-medium">自動同期について</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>アプリ起動時に自動的にユーザーを作成・確認します</li>
                <li>ローカルデータを5分間隔でSupabaseに同期します</li> 
                <li>同意履歴も自動的に同期されます</li>
                <li>手動での操作は不要になります</li>
                <li>データの安全性は従来と同じレベルで保たれます</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoSyncSettings;