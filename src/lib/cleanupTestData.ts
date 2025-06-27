import { supabase } from './supabase';

/**
 * Boltが作成したテストデータを削除する関数
 * 実際のユーザーデータは保持する
 */
export const cleanupTestData = async () => {
  try {
    let localRemoved = 0;
    let supabaseRemoved = 0;
    
    // ローカルストレージからテストデータを削除
    const savedEntries = localStorage.getItem('journalEntries');
    if (savedEntries) {
      const entries = JSON.parse(savedEntries);
      
      // テストデータの特徴を持つエントリーを識別
      // (例: Boltが生成したデータは特定のパターンを持つ)
      const realEntries = entries.filter((entry: any) => {
        // テストデータの特徴:
        // 1. 特定の期間内に作成された
        // 2. 特定のパターンの内容を持つ
        const isTestData = 
          (entry.event && entry.event.includes('テストデータ')) ||
          (entry.realization && entry.realization.includes('テスト')) ||
          (entry.event && entry.event.includes('サンプル')) ||
          (entry.event && entry.event.length < 10 && entry.realization && entry.realization.length < 10);
        
        if (isTestData) {
          localRemoved++;
          return false;
        }
        return true;
      });
      
      // 実際のユーザーデータのみを保存
      localStorage.setItem('journalEntries', JSON.stringify(realEntries));
    }
    
    // Supabaseからテストデータを削除（接続されている場合のみ）
    if (supabase) {
      try {
        // テストデータの特徴を持つエントリーを削除
        const { data, error } = await supabase
          .from('diary_entries')
          .delete()
          .or('event.ilike.%テストデータ%,event.ilike.%サンプル%,realization.ilike.%テスト%')
          .select();
        
        if (error) {
          console.error('Supabaseテストデータ削除エラー:', error);
        } else if (data) {
          supabaseRemoved = data.length;
        }
      } catch (supabaseError) {
        console.error('Supabase接続エラー:', supabaseError);
      }
    }
    
    return {
      localRemoved,
      supabaseRemoved,
      success: true
    };
  } catch (error) {
    console.error('テストデータ削除エラー:', error);
    return {
      localRemoved: 0,
      supabaseRemoved: 0,
      success: false
    };
  }
};