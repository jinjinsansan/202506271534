import { createClient } from '@supabase/supabase-js';

// Supabase接続情報
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Supabaseクライアントの作成（環境変数が設定されている場合のみ）
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ユーザーサービス
export const userService = {
  // ユーザー名からユーザーを取得
  getUserByUsername: async (lineUsername: string) => {
    if (!supabase) return null;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('line_username', lineUsername)
        .single();
      
      if (error) {
        console.error('ユーザー取得エラー:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('ユーザー取得エラー:', error);
      return null;
    }
  },
  
  // 新規ユーザーを作成
  createUser: async (lineUsername: string) => {
    if (!supabase) return null;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([{ line_username: lineUsername }])
        .select()
        .single();
      
      if (error) {
        console.error('ユーザー作成エラー:', error);
        
        // 既に存在する場合は取得を試みる
        if (error.code === '23505') { // 一意性制約違反
          return userService.getUserByUsername(lineUsername);
        }
        
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('ユーザー作成エラー:', error);
      return null;
    }
  }
};

// 同期サービス
export const syncService = {
  // ローカルデータをSupabaseに移行
  migrateLocalData: async (userId: string, progressCallback?: (progress: number) => void) => {
    if (!supabase || !userId) return false;
    
    try {
      // ローカルストレージから日記データを取得
      const savedEntries = localStorage.getItem('journalEntries');
      if (!savedEntries) return true; // データがない場合は成功とみなす
      
      const entries = JSON.parse(savedEntries);
      if (entries.length === 0) return true; // データがない場合は成功とみなす
      
      // 管理者モードの場合は全ユーザーのデータを処理
      const isAdminMode = userId === 'admin';
      
      // 進捗状況の初期化
      let progress = 0;
      const totalEntries = entries.length;
      
      // 各エントリーをSupabaseに保存
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        
        // 管理者モードでない場合は、現在のユーザーのデータのみを処理
        if (!isAdminMode) {
          // Supabaseに保存
          const { error } = await supabase
            .from('diary_entries')
            .upsert({
              id: entry.id,
              user_id: userId,
              date: entry.date,
              emotion: entry.emotion,
              event: entry.event,
              realization: entry.realization,
              self_esteem_score: entry.selfEsteemScore || 50,
              worthlessness_score: entry.worthlessnessScore || 50,
              counselor_memo: entry.counselor_memo,
              is_visible_to_user: entry.is_visible_to_user,
              counselor_name: entry.counselor_name
            });
          
          if (error) {
            console.error('エントリー保存エラー:', error);
          }
        }
        
        // 進捗状況の更新
        progress = Math.round(((i + 1) / totalEntries) * 100);
        if (progressCallback) {
          progressCallback(progress);
        }
      }
      
      return true;
    } catch (error) {
      console.error('データ移行エラー:', error);
      return false;
    }
  },
  
  // 大量データの一括移行（バルク処理）
  bulkMigrateLocalData: async (userId: string, progressCallback?: (progress: number) => void) => {
    if (!supabase || !userId) return false;
    
    try {
      // ローカルストレージから日記データを取得
      const savedEntries = localStorage.getItem('journalEntries');
      if (!savedEntries) return true; // データがない場合は成功とみなす
      
      const entries = JSON.parse(savedEntries);
      if (entries.length === 0) return true; // データがない場合は成功とみなす
      
      // 管理者モードの場合は全ユーザーのデータを処理
      const isAdminMode = userId === 'admin';
      
      // 進捗状況の初期化
      let progress = 0;
      const totalEntries = entries.length;
      
      // バルク処理のためのバッチサイズ
      const batchSize = 50;
      const batches = Math.ceil(entries.length / batchSize);
      
      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, entries.length);
        const batchEntries = entries.slice(start, end);
        
        // バッチ処理用のデータを準備
        const batchData = batchEntries.map(entry => ({
          id: entry.id,
          user_id: userId,
          date: entry.date,
          emotion: entry.emotion,
          event: entry.event,
          realization: entry.realization,
          self_esteem_score: entry.selfEsteemScore || 50,
          worthlessness_score: entry.worthlessnessScore || 50,
          counselor_memo: entry.counselor_memo,
          is_visible_to_user: entry.is_visible_to_user,
          counselor_name: entry.counselor_name
        }));
        
        // Supabaseに一括保存
        if (!isAdminMode) {
          const { error } = await supabase
            .from('diary_entries')
            .upsert(batchData);
          
          if (error) {
            console.error('バッチ保存エラー:', error);
          }
        }
        
        // 進捗状況の更新
        progress = Math.round(((end) / totalEntries) * 100);
        if (progressCallback) {
          progressCallback(progress);
        }
      }
      
      return true;
    } catch (error) {
      console.error('バルクデータ移行エラー:', error);
      return false;
    }
  },
  
  // Supabaseからローカルに同期
  syncToLocal: async (userId: string) => {
    if (!supabase || !userId) return false;
    
    try {
      // 管理者モードの場合は全ユーザーのデータを処理
      const isAdminMode = userId === 'admin';
      
      let query = supabase
        .from('diary_entries')
        .select('*');
      
      // 管理者モードでない場合は、現在のユーザーのデータのみを取得
      if (!isAdminMode) {
        query = query.eq('user_id', userId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Supabaseデータ取得エラー:', error);
        return false;
      }
      
      if (!data || data.length === 0) {
        console.log('同期するデータがありません');
        return true;
      }
      
      // ローカルストレージのデータと統合
      const savedEntries = localStorage.getItem('journalEntries');
      const localEntries = savedEntries ? JSON.parse(savedEntries) : [];
      
      // IDをキーとしたマップを作成
      const entriesMap = new Map();
      
      // ローカルデータをマップに追加
      localEntries.forEach((entry: any) => {
        entriesMap.set(entry.id, entry);
      });
      
      // Supabaseデータをマップに追加（同じIDの場合は上書き）
      data.forEach((entry: any) => {
        entriesMap.set(entry.id, {
          id: entry.id,
          date: entry.date,
          emotion: entry.emotion,
          event: entry.event,
          realization: entry.realization,
          selfEsteemScore: entry.self_esteem_score,
          worthlessnessScore: entry.worthlessness_score,
          counselor_memo: entry.counselor_memo,
          is_visible_to_user: entry.is_visible_to_user,
          counselor_name: entry.counselor_name
        });
      });
      
      // マップから配列に変換
      const mergedEntries = Array.from(entriesMap.values());
      
      // ローカルストレージに保存
      localStorage.setItem('journalEntries', JSON.stringify(mergedEntries));
      
      return true;
    } catch (error) {
      console.error('ローカル同期エラー:', error);
      return false;
    }
  },
  
  // 同意履歴をSupabaseに同期
  syncConsentHistories: async () => {
    if (!supabase) return false;
    
    try {
      // ローカルストレージから同意履歴を取得
      const savedHistories = localStorage.getItem('consent_histories');
      if (!savedHistories) return true; // データがない場合は成功とみなす
      
      const histories = JSON.parse(savedHistories);
      if (histories.length === 0) return true; // データがない場合は成功とみなす
      
      // 各履歴をSupabaseに保存
      for (const history of histories) {
        const { error } = await supabase
          .from('consent_histories')
          .upsert({
            id: history.id,
            line_username: history.line_username,
            consent_given: history.consent_given,
            consent_date: history.consent_date,
            ip_address: history.ip_address,
            user_agent: history.user_agent
          });
        
        if (error) {
          console.error('同意履歴保存エラー:', error);
        }
      }
      
      return true;
    } catch (error) {
      console.error('同意履歴同期エラー:', error);
      return false;
    }
  },
  
  // Supabaseから同意履歴をローカルに同期
  syncConsentHistoriesToLocal: async () => {
    if (!supabase) return false;
    
    try {
      const { data, error } = await supabase
        .from('consent_histories')
        .select('*');
      
      if (error) {
        console.error('Supabase同意履歴取得エラー:', error);
        return false;
      }
      
      if (!data || data.length === 0) {
        console.log('同期する同意履歴がありません');
        return true;
      }
      
      // ローカルストレージのデータと統合
      const savedHistories = localStorage.getItem('consent_histories');
      const localHistories = savedHistories ? JSON.parse(savedHistories) : [];
      
      // IDをキーとしたマップを作成
      const historiesMap = new Map();
      
      // ローカルデータをマップに追加
      localHistories.forEach((history: any) => {
        historiesMap.set(history.id, history);
      });
      
      // Supabaseデータをマップに追加（同じIDの場合は上書き）
      data.forEach((history: any) => {
        historiesMap.set(history.id, history);
      });
      
      // マップから配列に変換
      const mergedHistories = Array.from(historiesMap.values());
      
      // ローカルストレージに保存
      localStorage.setItem('consent_histories', JSON.stringify(mergedHistories));
      
      return true;
    } catch (error) {
      console.error('同意履歴ローカル同期エラー:', error);
      return false;
    }
  }
};

// 同意履歴サービス
export const consentService = {
  // 同意履歴を保存
  saveConsentHistory: async (
    lineUsername: string,
    consentGiven: boolean,
    ipAddress: string = 'unknown',
    userAgent: string = navigator.userAgent
  ) => {
    try {
      // 同意履歴レコードを作成
      const consentRecord = {
        id: Date.now().toString(),
        line_username: lineUsername,
        consent_given: consentGiven,
        consent_date: new Date().toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent
      };
      
      // ローカルストレージに保存
      const existingHistories = localStorage.getItem('consent_histories');
      const histories = existingHistories ? JSON.parse(existingHistories) : [];
      histories.push(consentRecord);
      localStorage.setItem('consent_histories', JSON.stringify(histories));
      
      // Supabaseに保存（接続されている場合のみ）
      if (supabase) {
        try {
          const { error } = await supabase
            .from('consent_histories')
            .insert([consentRecord]);
          
          if (error) {
            console.error('Supabase同意履歴保存エラー:', error);
          }
        } catch (supabaseError) {
          console.error('Supabase接続エラー:', supabaseError);
        }
      }
      
      return consentRecord;
    } catch (error) {
      console.error('同意履歴保存エラー:', error);
      return null;
    }
  },
  
  // すべての同意履歴を取得
  getAllConsentHistories: async () => {
    try {
      if (supabase) {
        // Supabaseから取得
        const { data, error } = await supabase
          .from('consent_histories')
          .select('*')
          .order('consent_date', { ascending: false });
        
        if (error) {
          console.error('Supabase同意履歴取得エラー:', error);
          // エラーの場合はローカルから取得
          return getLocalConsentHistories();
        }
        
        return data;
      } else {
        // Supabase接続がない場合はローカルから取得
        return getLocalConsentHistories();
      }
    } catch (error) {
      console.error('同意履歴取得エラー:', error);
      return [];
    }
  }
};

// ローカルストレージから同意履歴を取得するヘルパー関数
const getLocalConsentHistories = () => {
  const savedHistories = localStorage.getItem('consent_histories');
  return savedHistories ? JSON.parse(savedHistories) : [];
};

// チャットサービス
export const chatService = {
  // チャットメッセージを取得
  getChatMessages: async (chatRoomId: string) => {
    if (!supabase) {
      // ローカルストレージからメッセージを取得
      const savedMessages = localStorage.getItem('chatMessages');
      return savedMessages ? JSON.parse(savedMessages) : [];
    }
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_room_id', chatRoomId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('メッセージ取得エラー:', error);
        return [];
      }
      
      return data;
    } catch (error) {
      console.error('メッセージ取得エラー:', error);
      return [];
    }
  },
  
  // メッセージを送信
  sendMessage: async (
    chatRoomId: string,
    content: string,
    senderId?: string,
    counselorId?: string
  ) => {
    const isCounselor = !!counselorId;
    
    if (!supabase) {
      // ローカルストレージにメッセージを保存
      const message = {
        id: Date.now().toString(),
        content,
        is_counselor: isCounselor,
        created_at: new Date().toISOString(),
        sender_name: isCounselor ? 'カウンセラー' : localStorage.getItem('line-username')
      };
      
      const savedMessages = localStorage.getItem('chatMessages');
      const messages = savedMessages ? JSON.parse(savedMessages) : [];
      messages.push(message);
      localStorage.setItem('chatMessages', JSON.stringify(messages));
      
      return message;
    }
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          chat_room_id: chatRoomId,
          sender_id: isCounselor ? null : senderId,
          counselor_id: isCounselor ? counselorId : null,
          content,
          is_counselor: isCounselor
        }])
        .select()
        .single();
      
      if (error) {
        console.error('メッセージ送信エラー:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      return null;
    }
  }
};