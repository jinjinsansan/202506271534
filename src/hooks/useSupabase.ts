import { useState, useEffect } from 'react';
import { supabase, userService, diaryService, syncService, testSupabaseConnection } from '../lib/supabase';
import { getAuthSession, logSecurityEvent } from '../lib/deviceAuth';

export const useSupabase = () => {
  // 管理者モードフラグ - カウンセラーとしてログインしている場合はtrue
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(0);

  useEffect(() => {
    checkConnection(true);
    
    // カウンセラーとしてログインしているかチェック
    const counselorName = localStorage.getItem('current_counselor');
    if (counselorName) {
      setIsAdminMode(true);
      console.log('管理者モードで動作中:', counselorName);
    }
    
  }, []);

  const checkConnection = async (isInitialCheck = false) => {
    const now = Date.now();
    // 最後の接続試行から3秒以上経過している場合のみ実行
    if (!isInitialCheck && now - lastAttemptTime < 3000) {
      console.log('接続チェックをスキップ: 前回の試行から3秒経過していません');
      return;
    }
    
    setLastAttemptTime(now);
    setLoading(true);
    
    if (isInitialCheck) {
      setError(null);
    }
    
    if (!supabase) {
      console.log('Supabase未設定 - ローカルモードで動作');
      setIsConnected(false);
      setError('Supabase接続エラー: 設定が見つかりません');
      setLoading(false);
      return;
    }
    
    try {
      // 新しい接続テスト関数を使用
      console.log(`Checking Supabase connection... (attempt: ${retryCount + 1})`);
      const result = await testSupabaseConnection();
      
      if (!result.success) {
        console.error('Supabase接続エラー:', result.error, result.details);
        setIsConnected(false);

        if (result.error === 'APIキーが無効です') {
          setError('接続エラー: APIキーが無効です');
        } else {
          setError(`${result.error}`);
        }
      } else {
        console.log('Supabase接続成功');
        setIsConnected(true);
        setError(null);
        
        // 既存ユーザーの確認
        const session = !isAdminMode ? getAuthSession() : null;
        if (session) {
          await initializeUser(session.lineUsername);
        }
      }
    } catch (error) {
      console.error('接続チェックエラー:', error);
      setError(error instanceof Error ? error.message : '不明なエラー');
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };
  
  // 接続を再試行する関数
  const retryConnection = () => {
    if (retryCount < 5) {
      console.log(`接続を再試行します... (${retryCount + 1}/5)`);
      setRetryCount(prev => prev + 1);
      setError(null);
      checkConnection(false);
    } else {
      setError('接続の再試行回数が上限に達しました。しばらく時間をおいてから再度お試しください。');
    }
  };

  const initializeUser = async (lineUsername: string) => {
    // 管理者モードの場合は初期化をスキップ
    if (isAdminMode) {
      console.log('管理者モードのため、ユーザー初期化をスキップします - 管理者IDを返します', new Date().toISOString());
      setCurrentUser({ id: 'admin', line_username: lineUsername.trim() });
      return { id: 'admin', line_username: lineUsername.trim() };
    }
    
    if (!isConnected) {
      console.log('Supabaseに接続されていないため、ユーザー初期化をスキップします', new Date().toISOString());
      return { id: null, line_username: lineUsername.trim() };
    }

    const startTime = new Date().toISOString();
    console.log(`ユーザー初期化開始: "${lineUsername.trim()}" - ${startTime}`);

    // 既に初期化中の場合は処理をスキップ
    if (loading) {
      console.log(`別の初期化処理が進行中のため、現在のユーザーを返します: ${lineUsername.trim()}`, new Date().toISOString());
      return currentUser || { id: null, line_username: lineUsername.trim() };
    }

    setLoading(true);
    setError(null);
    
    try {
      // 既存ユーザーを検索
      const trimmedUsername = lineUsername.trim();
      let user = await userService.getUserByUsername(trimmedUsername);
      console.log('ユーザー検索結果:', user ? `ユーザーが見つかりました: ${user.id}` : 'ユーザーが見つかりませんでした - 新規作成を試みます', new Date().toISOString());
      
      // セキュリティイベントをログ
      if (user) {
        console.log(`Supabaseユーザーが見つかりました: "${trimmedUsername}" - ID: ${user.id}`);
        try {
          logSecurityEvent('supabase_user_found', trimmedUsername, 'Supabaseユーザーが見つかりました');
        } catch (logError) {
          console.error('セキュリティログ記録エラー:', logError);
        }
        
        // ユーザーが見つかった場合は現在のユーザーとして設定
        setCurrentUser(user);
      } else {
        console.log(`Supabaseユーザーが見つかりません: "${trimmedUsername}" - 新規作成を試みます`);
        try {
          logSecurityEvent('supabase_user_not_found', trimmedUsername, 'Supabaseユーザーが見つかりません');
        } catch (logError) {
          console.error('セキュリティログ記録エラー:', logError);
        }
      }
      
      if (!user) {
        try {
           // 新規ユーザー作成
           console.log(`新規ユーザー作成を試みます: "${trimmedUsername}" - ${new Date().toISOString()}`);
           user = await userService.createUser(trimmedUsername);
           
           if (user) {
             setCurrentUser(user);
             console.log(`ユーザー作成成功: "${trimmedUsername}" - ID: ${user.id}`);
             
             try {
               logSecurityEvent('supabase_user_created', trimmedUsername, 'Supabaseユーザーを作成しました');
             } catch (logError) {
               console.error('セキュリティログ記録エラー:', logError);
             }
             
             // ローカルデータを移行
             try {
              if (user.id) {
                console.log(`ローカルデータの移行を開始: "${trimmedUsername}" - ID: ${user.id}`);
                const migrationResult = await syncService.migrateLocalData(user.id);
                console.log(`ローカルデータの移行結果: ${migrationResult ? '成功' : '失敗'} - "${trimmedUsername}"`);
              } else {
                console.error('ユーザーIDが不明なため、データ移行をスキップします');
              }
             } catch (syncError) {
               console.error('データ移行エラー:', syncError);
             }
           }
           
           try {
             console.log('ユーザー作成後に再検索を試みます');
             user = await userService.getUserByUsername(trimmedUsername);
             console.log('再検索結果:', user ? 'ユーザーが見つかりました' : 'ユーザーが見つかりませんでした');
           } catch (searchError) {
             console.error('ユーザー再検索エラー:', searchError);
             throw new Error('ユーザーの作成と検索に失敗しました');
           }
         } catch (createError) {
           console.error(`ユーザー作成エラー: "${trimmedUsername}"`, createError);
           setError(createError instanceof Error ? createError.message : '不明なエラー');
         }
      } else {
        // 既存ユーザーの場合、Supabaseからローカルに同期
        try {
          if (user.id) {
            console.log(`既存ユーザー: Supabaseからローカルへの同期を開始: "${trimmedUsername}" - ID: ${user.id}`);
            const syncResult = await syncService.syncToLocal(user.id);
            console.log(`Supabaseからローカルへの同期結果: ${syncResult ? '成功' : '失敗'} - "${trimmedUsername}"`);
          } else {
            console.error('ユーザーIDが不明です:', user);
          }
        } catch (syncError) {
          console.error('データ同期エラー:', syncError);
        }
      }
      
      // 明示的にユーザー情報を更新
      if (user) {
        setCurrentUser(user);
        console.log('currentUserを更新しました:', user.id || 'ID不明', '- ユーザー名:', user.line_username || lineUsername.trim(), new Date().toISOString());
        setError(null);
        
        // ローカルストレージにユーザーIDを保存
        if (user.id) {
          localStorage.setItem('supabase_user_id', user.id);
          console.log('ユーザーIDをローカルストレージに保存しました:', user.id);
        }
        return user;
      } else {
        console.error('ユーザー情報が取得できませんでした');
        setError('ユーザー情報の取得に失敗しました');
        return { id: null, line_username: lineUsername.trim() };
      }
    } catch (error) {
      console.error(`ユーザー初期化エラー: ${trimmedUsername}`, error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      setError(errorMessage);
      console.log(`ユーザー初期化エラー: ${errorMessage}`);
      return { id: null, line_username: trimmedUsername.trim() };
    } finally {
      const endTime = new Date().toISOString();
      console.log(`ユーザー初期化完了: "${trimmedUsername.trim()}" - ${endTime}`);
      setTimeout(() => {
        setLoading(false);
      }, 100);
      console.log('ローディング状態を解除しました', new Date().toISOString());
    }
  };

  const saveEntry = async (entryData: any) => {
    // まずローカルストレージに保存（既存の動作を維持）
    const existingEntries = localStorage.getItem('journalEntries') || '[]';
    const entries = JSON.parse(existingEntries);
    const newEntry = { id: Date.now().toString(), ...entryData };
    entries.unshift(newEntry);
    localStorage.setItem('journalEntries', JSON.stringify(entries));

    // Supabaseにも保存（バックグラウンドで）
    if (isConnected && currentUser) {
      try {
        await diaryService.createEntry({
          user_id: currentUser.id,
          date: entryData.date,
          emotion: entryData.emotion,
          event: entryData.event,
          realization: entryData.realization,
          self_esteem_score: entryData.selfEsteemScore,
          worthlessness_score: entryData.worthlessnessScore
        });
        console.log('Supabaseにも保存しました');
      } catch (error) {
        console.error('Supabase保存エラー:', error);
        // エラーが発生してもローカル保存は成功しているので続行
      }
    }
    
    return newEntry;
  };

  const updateEntry = async (id: string, updates: any) => {
    // ローカルストレージを更新
    const existingEntries = localStorage.getItem('journalEntries') || '[]';
    const entries = JSON.parse(existingEntries);
    const updatedEntries = entries.map((entry: any) => 
      entry.id === id ? { ...entry, ...updates } : entry
    );
    localStorage.setItem('journalEntries', JSON.stringify(updatedEntries));

    // Supabaseも更新
    if (isConnected && currentUser) {
      try {
        await diaryService.updateEntry(id, {
          date: updates.date,
          emotion: updates.emotion,
          event: updates.event,
          realization: updates.realization,
          self_esteem_score: updates.selfEsteemScore,
          worthlessness_score: updates.worthlessnessScore
        });
        console.log('Supabaseも更新しました');
      } catch (error) {
        console.error('Supabase更新エラー:', error);
      }
    }
  };

  const deleteEntry = async (id: string) => {
    // ローカルストレージから削除
    const existingEntries = localStorage.getItem('journalEntries') || '[]';
    const entries = JSON.parse(existingEntries);
    const filteredEntries = entries.filter((entry: any) => entry.id !== id);
    localStorage.setItem('journalEntries', JSON.stringify(filteredEntries));

    // Supabaseからも削除
    if (isConnected && currentUser) {
      try {
        await diaryService.deleteEntry(id);
        console.log('Supabaseからも削除しました');
      } catch (error) {
        console.error('Supabase削除エラー:', error);
      }
    }
  };

  return {
    isConnected,
    isAdminMode,
    currentUser,
    loading,
    error,
    retryConnection,
    retryCount,
    initializeUser,
    saveEntry, 
    updateEntry, 
    deleteEntry, 
    checkConnection 
  };
};