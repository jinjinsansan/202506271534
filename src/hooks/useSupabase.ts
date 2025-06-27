import { useState, useEffect } from 'react';
import { supabase, userService } from '../lib/supabase';

export const useSupabase = () => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!supabase) {
        setIsConnected(false);
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      // Supabaseへの接続をテスト
      const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
      
      if (error) {
        console.error('Supabase接続エラー:', error);
        setIsConnected(false);
        setCurrentUser(null);
        setError('Supabaseに接続できませんでした');
      } else {
        setIsConnected(true);
        
        // ユーザー情報を取得
        await loadCurrentUser();
      }
    } catch (err) {
      console.error('接続チェックエラー:', err);
      setIsConnected(false);
      setCurrentUser(null);
      setError('接続チェック中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentUser = async () => {
    try {
      // ローカルストレージからユーザー名を取得
      const lineUsername = localStorage.getItem('line-username');
      if (!lineUsername) {
        setCurrentUser(null);
        return;
      }

      // Supabaseからユーザー情報を取得
      const user = await userService.getUserByUsername(lineUsername);
      
      if (user) {
        setCurrentUser({
          id: user.id,
          line_username: user.line_username,
          created_at: user.created_at
        });
        
        // ユーザーIDをローカルストレージに保存
        localStorage.setItem('supabase_user_id', user.id);
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('ユーザー情報取得エラー:', err);
      setCurrentUser(null);
    }
  };

  const initializeUser = async (lineUsername: string) => {
    if (!supabase || !lineUsername) {
      return { success: false, error: 'Supabaseに接続されていないか、ユーザー名が設定されていません' };
    }

    try {
      // ユーザーが存在するか確認
      let user = await userService.getUserByUsername(lineUsername);
      
      // ユーザーが存在しない場合は作成
      if (!user) {
        user = await userService.createUser(lineUsername);
        
        if (!user) {
          return { success: false, error: 'ユーザーの作成に失敗しました' };
        }
      }
      
      // 現在のユーザーを設定
      setCurrentUser({
        id: user.id,
        line_username: user.line_username,
        created_at: user.created_at
      });
      
      // ユーザーIDをローカルストレージに保存
      localStorage.setItem('supabase_user_id', user.id);
      
      return { success: true, user };
    } catch (err) {
      console.error('ユーザー初期化エラー:', err);
      return { success: false, error: err instanceof Error ? err.message : '不明なエラー' };
    }
  };

  return {
    isConnected,
    currentUser,
    loading,
    error,
    checkConnection,
    initializeUser
  };
};