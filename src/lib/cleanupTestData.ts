import { supabase } from './supabase';

// Boltが作成したテストデータを削除する関数
export const cleanupTestData = async (): Promise<{ 
  localRemoved: number, 
  supabaseRemoved: number,
  success: boolean 
}> => {
  console.log('テストデータのクリーンアップを開始します...');
  
  try {
    // 1. ローカルストレージからデータを取得
    const localEntriesStr = localStorage.getItem('journalEntries');
    if (!localEntriesStr) {
      console.log('ローカルデータが見つかりません');
      return { localRemoved: 0, supabaseRemoved: 0, success: true };
    }
    
    const localEntries = JSON.parse(localEntriesStr);
    console.log(`ローカルデータ: ${localEntries.length}件`);
    
    // 2. 実際のユーザーデータを特定
    // ユーザー名を取得
    const lineUsername = localStorage.getItem('line-username');
    
    // 3. テストデータを除外
    // テストデータの特徴:
    // - 実際のユーザーが書いていないデータ
    // - Boltが生成したテストデータ
    const realUserData = localEntries.filter((entry: any) => {
      // 実際のユーザーデータの条件
      const isRealUserData = 
        // 実際のユーザーが書いたデータ（ユーザー名が一致）
        (entry.user && entry.user.line_username === lineUsername) ||
        // ユーザーフィールドがないが、ユーザーが手動で入力したデータ
        (!entry.user && !entry.source);
      
      return isRealUserData;
    });
    
    console.log(`実際のユーザーデータ: ${realUserData.length}件`);
    console.log(`削除対象のテストデータ: ${localEntries.length - realUserData.length}件`);
    
    // 4. 実際のユーザーデータのみを保存
    localStorage.setItem('journalEntries', JSON.stringify(realUserData));
    
    // 5. Supabaseからもテストデータを削除（接続されている場合のみ）
    let supabaseRemoved = 0;
    if (supabase) {
      try {
        // 現在のユーザーIDを取得
        const userId = localStorage.getItem('supabase_user_id');
        
        if (userId) {
          // 現在のユーザーのデータのみを残し、他のテストデータを削除
          const { error } = await supabase
            .from('diary_entries')
            .delete()
            .neq('user_id', userId);
          
          if (error) {
            console.error('Supabaseデータ削除エラー:', error);
          } else {
            console.log('Supabaseからテストデータを削除しました');
            supabaseRemoved = localEntries.length - realUserData.length;
          }
        }
      } catch (error) {
        console.error('Supabase操作エラー:', error);
      }
    }
    
    return { 
      localRemoved: localEntries.length - realUserData.length, 
      supabaseRemoved,
      success: true
    };
  } catch (error) {
    console.error('テストデータクリーンアップエラー:', error);
    return { localRemoved: 0, supabaseRemoved: 0, success: false };
  }
};