import { useState, useEffect, useRef } from 'react';
import { useSupabase } from './useSupabase';
import { userService, syncService, consentService } from '../lib/supabase';
import { getCurrentUser, logSecurityEvent } from '../lib/deviceAuth';

interface AutoSyncStatus {
  isAutoSyncEnabled: boolean;
  lastSyncTime: string | null;
  syncInProgress: boolean;
  syncError: string | null;
  userCreated: boolean;
}

export const useAutoSync = () => {
  const { isConnected, currentUser, initializeUser } = useSupabase();
  const [status, setStatus] = useState<AutoSyncStatus>({
    isAutoSyncEnabled: false,
    lastSyncTime: null,
    syncInProgress: false,
    syncError: null,
    userCreated: false
  });
  
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = useRef(false);

  // 自動同期の設定を読み込み
  useEffect(() => {
    const autoSyncEnabled = localStorage.getItem('auto_sync_enabled') === 'true';
    const lastSync = localStorage.getItem('last_sync_time');
    
    setStatus(prev => ({
      ...prev,
      isAutoSyncEnabled: autoSyncEnabled,
      lastSyncTime: lastSync,
      userCreated: !!currentUser
    }));
  }, [currentUser]);

  // 接続状態が変わった時の自動処理
  useEffect(() => {
    if (!hasInitializedRef.current && isConnected) {
      console.log('自動同期: 接続状態が変わりました - 自動初期化を試みます', new Date().toISOString());
      const lineUsername = localStorage.getItem('line-username');
      if (lineUsername) {
        console.log('自動同期: ユーザー名が見つかりました:', lineUsername, new Date().toISOString());
        // 少し遅延させて実行（他の初期化処理が完了するのを待つ）
        setTimeout(() => {
          handleAutoInitialization(lineUsername);
        }, 1000);
        hasInitializedRef.current = true;
      } else {
        console.log('自動同期: ユーザー名が見つかりません', new Date().toISOString());
        hasInitializedRef.current = true;
      }
    }
  }, [isConnected]);

  // 自動初期化処理
  const handleAutoInitialization = async (lineUsername: string) => {
    try {
      console.log('自動同期: 自動初期化を開始します:', lineUsername, new Date().toISOString());
      setStatus(prev => ({ ...prev, syncInProgress: true, syncError: null }));
      
      let user = await userService.getUserByUsername(lineUsername);
      console.log('自動同期: ユーザー検索結果:', user ? 'ユーザーが見つかりました' : 'ユーザーが見つかりませんでした');
      
      if (!user) {
        if (import.meta.env.DEV) {
          console.log('ユーザーが存在しないため、自動作成します', new Date().toISOString());
        }
        
        try {
          logSecurityEvent('auto_sync_create_user', lineUsername, 'ユーザーが存在しないため、自動作成します');
        } catch (logError) {
          console.error('セキュリティログ記録エラー:', logError);
        }
        
        user = await userService.createUser(lineUsername);
        
        if (user) {
          console.log('自動同期: ユーザーを作成しました:', user.id, new Date().toISOString());
          setStatus(prev => ({ 
            ...prev, 
            userCreated: true, 
            syncError: null,
            syncInProgress: false
          }));
          
          // ユーザー作成後、アプリの状態を更新
          if (initializeUser) {
            await initializeUser(lineUsername); 
          }
        }
      } else {
        console.log('自動同期: ユーザーは既に存在します:', user.id, new Date().toISOString());
        setStatus(prev => ({ 
          ...prev, 
          userCreated: true, 
          syncError: null,
          syncInProgress: false
        }));
        
        // 既存ユーザーの場合も、アプリの状態を更新
        if (initializeUser) {
          console.log('自動同期: 既存ユーザーの状態を更新します', new Date().toISOString());
          await initializeUser(lineUsername);
        }
      }

      // 2. 自動同期が有効な場合のみデータ同期
      if (status.isAutoSyncEnabled && user) {
        console.log('自動同期: データ同期を開始します', new Date().toISOString());
        await performAutoSync(user.id);
      }
    } catch (error) {
      console.error('自動初期化エラー:', error);
      setStatus(prev => ({ 
        ...prev, 
        syncError: error instanceof Error ? error.message : '初期化に失敗しました',
        syncInProgress: false
      }));
    } finally {
      setStatus(prev => ({ ...prev, syncInProgress: false }));
    }
  };

  // 自動同期実行
  const performAutoSync = async (userId: string) => {
    try {
      if (!userId || typeof userId !== 'string') {
        console.error('自動同期エラー: 無効なユーザーID:', userId);
        setStatus(prev => ({ 
          ...prev, 
          syncInProgress: false,
          syncError: '無効なユーザーID'
        }));
        return;
      }
      
      console.log(`自動同期: データ同期を開始します - ユーザーID: ${userId}`, new Date().toISOString());
      setStatus(prev => ({ ...prev, syncInProgress: true, syncError: null }));
      
      // ローカルデータの存在確認
      const localEntries = localStorage.getItem('journalEntries');
      const localConsents = localStorage.getItem('consent_histories');
      
      let diarySync = false;
      let consentSync = false;

      // 日記データの同期
      if (localEntries) {
        const entries = JSON.parse(localEntries);
        if (entries.length > 0) {
          console.log(`自動同期: ${entries.length}件の日記データを同期します`, new Date().toISOString());
          await syncService.migrateLocalData(userId);
          diarySync = true;
          if (import.meta.env.DEV) {
            console.log('日記データを自動同期しました');
          }
        }
      }

      // 同意履歴の同期
      if (localConsents) {
        const consents = JSON.parse(localConsents);
        if (consents.length > 0) {
          console.log(`自動同期: ${consents.length}件の同意履歴を同期します`, new Date().toISOString());
          await syncService.syncConsentHistories();
          consentSync = true;
          if (import.meta.env.DEV) {
            console.log('同意履歴を自動同期しました');
          }
        }
      }

      if (diarySync || consentSync) {
        const now = new Date().toISOString();
        localStorage.setItem('last_sync_time', now);
        console.log(`自動同期: 同期が完了しました - 日記: ${diarySync ? '成功' : '未実行'}, 同意履歴: ${consentSync ? '成功' : '未実行'} - ${now}`);
        
        try {
          logSecurityEvent('auto_sync_completed', userId, '自動同期が完了しました');
        } catch (error) {
          console.error('セキュリティログ記録エラー:', error);
        }
        
        setStatus(prev => ({ ...prev, lastSyncTime: now }));
      } else {
        console.log('自動同期: 同期するデータがありませんでした', new Date().toISOString());
      }

    } catch (error) {
      console.error('自動同期エラー:', error);
      setStatus(prev => ({ 
        ...prev, 
        syncInProgress: false,
        syncError: error instanceof Error ? error.message : '同期に失敗しました'
      }));
    }
  };

  // 自動同期の有効/無効切り替え
  const toggleAutoSync = (enabled: boolean) => {
    localStorage.setItem('auto_sync_enabled', enabled.toString());

    try {
      const user = getCurrentUser();
      logSecurityEvent('auto_sync_toggled', user?.lineUsername || 'system', `自動同期が${enabled ? '有効' : '無効'}になりました`);
    } catch (error) {
      console.error('セキュリティログ記録エラー:', error);
    }

    setStatus(prev => ({ ...prev, isAutoSyncEnabled: enabled }));

    // 即座に同期を実行（非同期で）
    setTimeout(() => {
      if (enabled && isConnected && currentUser) {
        performAutoSync(currentUser.id).catch(error => {
          console.error('自動同期実行エラー:', error);
        });
      }
    }, 0);
  };

  // 手動同期実行
  const triggerManualSync = async () => {
    setStatus(prev => ({ ...prev, syncInProgress: true, syncError: null }));
    console.log('手動同期を開始します');

    try {
      if (!isConnected || !currentUser) {
        throw new Error('Supabaseに接続されていないか、ユーザーが設定されていません');
      }
      
      await performAutoSync(currentUser.id);
      console.log('手動同期が完了しました - ユーザーID:', currentUser.id, new Date().toISOString());
      
      try {
        const user = getCurrentUser();
        logSecurityEvent('manual_sync_triggered', user?.lineUsername || currentUser.id, '手動同期が実行されました');
      } catch (error) {
        console.error('セキュリティログ記録エラー:', error);
      }
    } finally {
      setStatus(prev => ({ ...prev, syncInProgress: false }));
    }
  };

  // 定期同期の設定（5分間隔）
  useEffect(() => {    
    if (status.isAutoSyncEnabled && isConnected && currentUser) {
      // 前回のタイマーをクリア
      if (syncTimeoutRef.current) {
        clearInterval(syncTimeoutRef.current);
      }
      
      syncTimeoutRef.current = setInterval(() => {
        performAutoSync(currentUser.id).catch(error => {
          console.error('定期同期エラー:', error);
        });
      }, 5 * 60 * 1000); // 5分

      return () => {
        if (syncTimeoutRef.current) {
          clearInterval(syncTimeoutRef.current);
        }
      };
    } else if (syncTimeoutRef.current) {
      clearInterval(syncTimeoutRef.current);
    }
  }, [status.isAutoSyncEnabled, isConnected, currentUser]);

  return {
    ...status,
    toggleAutoSync,
    triggerManualSync,
    isConnected,
    currentUser
  };
};