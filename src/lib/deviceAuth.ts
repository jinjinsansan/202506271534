// デバイス認証システム
// このファイルはデバイス認証に関する機能を提供します

// ストレージキー定義
export const STORAGE_KEYS = {
  DEVICE_FINGERPRINT: 'device_fingerprint',
  USER_CREDENTIALS: 'user_credentials',
  SECURITY_QUESTIONS: 'security_questions',
  AUTH_SESSION: 'auth_session',
  ACCOUNT_LOCKED: 'account_locked_',
  LOGIN_ATTEMPTS: 'login_attempts_',
  SECURITY_EVENTS: 'security_events'
};

// エラータイプ定義
export enum AuthErrorType {
  INVALID_CREDENTIALS = 'invalid_credentials',
  ACCOUNT_LOCKED = 'account_locked',
  DEVICE_MISMATCH = 'device_mismatch',
  VALIDATION_ERROR = 'validation_error',
  UNKNOWN_ERROR = 'unknown_error'
}

// カスタムエラークラス
export class AuthError extends Error {
  type: AuthErrorType;

  constructor(type: AuthErrorType, message: string) {
    super(message);
    this.type = type;
    this.name = 'AuthError';
  }
}

// 秘密の質問リスト
export const SECURITY_QUESTIONS = [
  {
    id: 'first_pet',
    question: '最初に飼ったペットの名前は？',
    placeholder: '例: ポチ'
  },
  {
    id: 'childhood_friend',
    question: '子供の頃の親友の名前は？',
    placeholder: '例: 田中太郎'
  },
  {
    id: 'favorite_place',
    question: '子供の頃の好きな場所は？',
    placeholder: '例: 祖父の家'
  },
  {
    id: 'first_school',
    question: '通った最初の学校の名前は？',
    placeholder: '例: ○○小学校'
  },
  {
    id: 'mother_maiden',
    question: '母親の旧姓は？',
    placeholder: '例: 佐藤'
  },
  {
    id: 'favorite_teacher',
    question: '一番好きだった先生の名前は？',
    placeholder: '例: 山田先生'
  },
  {
    id: 'first_job',
    question: '初めてのアルバイトは？',
    placeholder: '例: コンビニ店員'
  },
  {
    id: 'childhood_hero',
    question: '子供の頃の憧れのヒーローは？',
    placeholder: '例: ウルトラマン'
  }
];

// インターフェース定義
export interface DeviceFingerprint {
  id: string;
  userAgent: string;
  language: string;
  screen: string;
  timezone: string;
  platform: string;
  createdAt: string;
}

export interface UserCredentials {
  lineUsername: string;
  pinCodeHash: string;
  salt: string;
  deviceId: string;
  createdAt: string;
}

export interface SecurityQuestion {
  id: string;
  question: string;
  answer: string;
}

export interface AuthSession {
  lineUsername: string;
  deviceId: string;
  lastActivity: string;
  expiresAt: string;
}

export interface SecurityEvent {
  id: string;
  type: string;
  username: string;
  timestamp: string;
  details: string;
}

// デバイスフィンガープリント生成
export const generateDeviceFingerprint = (): DeviceFingerprint => {
  const userAgent = navigator.userAgent;
  const language = navigator.language;
  const screen = `${window.screen.width}x${window.screen.height}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const platform = navigator.platform;
  
  // 一意のデバイスIDを生成
  const components = [userAgent, language, screen, timezone, platform];
  const deviceId = btoa(components.join('|')).substring(0, 32);
  
  return {
    id: deviceId,
    userAgent,
    language,
    screen,
    timezone,
    platform,
    createdAt: new Date().toISOString()
  };
};

// デバイスフィンガープリントの保存
export const saveDeviceFingerprint = (fingerprint: DeviceFingerprint): void => {
  localStorage.setItem(STORAGE_KEYS.DEVICE_FINGERPRINT, JSON.stringify(fingerprint));
};

// デバイスフィンガープリントの取得
export const getDeviceFingerprint = (): DeviceFingerprint | null => {
  const stored = localStorage.getItem(STORAGE_KEYS.DEVICE_FINGERPRINT);
  return stored ? JSON.parse(stored) : null;
};

// デバイスフィンガープリントの比較
export const compareDeviceFingerprints = (current: DeviceFingerprint, stored: DeviceFingerprint): boolean => {
  // 主要な特性が一致するか確認
  return current.id === stored.id &&
         current.screen === stored.screen &&
         current.platform === stored.platform;
};

// PIN番号のハッシュ化
export const hashPinCode = async (pinCode: string, salt?: string): Promise<string> => {
  const encoder = new TextEncoder();
  const saltValue = salt || Math.random().toString(36).substring(2, 15);
  
  // PIN番号とソルトを結合してハッシュ化
  const data = encoder.encode(pinCode + saltValue);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return salt ? hashHex : `${hashHex}:${saltValue}`;
};

// ユーザー認証情報の保存
export const saveUserCredentials = async (
  lineUsername: string,
  pinCode: string,
  deviceId: string
): Promise<void> => {
  // PIN番号をハッシュ化
  const hashAndSalt = await hashPinCode(pinCode);
  const [pinCodeHash, salt] = hashAndSalt.split(':');
  
  const credentials: UserCredentials = {
    lineUsername,
    pinCodeHash,
    salt,
    deviceId,
    createdAt: new Date().toISOString()
  };
  
  localStorage.setItem(STORAGE_KEYS.USER_CREDENTIALS, JSON.stringify(credentials));
};

// ユーザー認証情報の取得
export const getUserCredentials = (): UserCredentials | null => {
  const stored = localStorage.getItem(STORAGE_KEYS.USER_CREDENTIALS);
  return stored ? JSON.parse(stored) : null;
};

// 秘密の質問の保存
export const saveSecurityQuestions = (questions: SecurityQuestion[]): void => {
  // 回答を暗号化（Base64エンコード）
  try {
    const encodedQuestions = questions.map(q => ({
      ...q,
      answer: btoa(q.answer.toLowerCase().trim())
    }));
    
    localStorage.setItem(STORAGE_KEYS.SECURITY_QUESTIONS, JSON.stringify(encodedQuestions));
  } catch (error) {
    console.error('秘密の質問保存エラー:', error);
    // エラーが発生しても処理を続行できるよう、基本情報だけでも保存
    try {
      const basicQuestions = questions.map(q => ({
        id: q.id,
        question: q.question,
        answer: 'encrypted_failed' // エラー時のフォールバック
      }));
      localStorage.setItem(STORAGE_KEYS.SECURITY_QUESTIONS, JSON.stringify(basicQuestions));
    } catch (fallbackError) {
      console.error('秘密の質問フォールバック保存エラー:', fallbackError);
    }
  }
};
  

// 秘密の質問の取得
export const getSecurityQuestions = (): SecurityQuestion[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SECURITY_QUESTIONS);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('秘密の質問取得エラー:', error);
    return [];
  }
};

// 認証セッションの作成
export const createAuthSession = (data: {
  lineUsername: string;
  pinCode: string;
  deviceId: string;
}): void => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30日間有効
  
  const session: AuthSession = {
    lineUsername: data.lineUsername,
    deviceId: data.deviceId,
    lastActivity: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };
  
  localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(session));
  
  // セキュリティイベントをログ
  logSecurityEvent('login_success', data.lineUsername, 'デバイス認証によるログイン成功');
};

// 認証セッションの取得
export const getAuthSession = (): AuthSession | null => {
  const stored = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
  if (!stored) return null;
  
  const session: AuthSession = JSON.parse(stored);
  
  // セッションの有効期限をチェック
  if (new Date(session.expiresAt) < new Date()) {
    clearAuthSession();
    return null;
  }
  
  // 最終アクティビティを更新
  session.lastActivity = new Date().toISOString();
  localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(session));
  
  return session;
};

// 認証セッションのクリア
export const clearAuthSession = (): void => {
  localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
};

// 認証状態のチェック
export const isAuthenticated = (): boolean => {
  return getAuthSession() !== null;
};

// 現在のユーザーを取得
export const getCurrentUser = (): { lineUsername: string; deviceId: string } | null => {
  const session = getAuthSession();
  if (!session) return null;
  
  return {
    lineUsername: session.lineUsername,
    deviceId: session.deviceId
  };
};

// ログアウト
export const logoutUser = (): void => {
  const user = getCurrentUser();
  if (user) {
    logSecurityEvent('logout', user.lineUsername, 'ユーザーがログアウトしました');
  }
  
  clearAuthSession();
};

// ログイン試行回数の取得
export const getLoginAttempts = (username: string): number => {
  const key = `${STORAGE_KEYS.LOGIN_ATTEMPTS}${username}`;
  const attempts = localStorage.getItem(key);
  return attempts ? parseInt(attempts) : 0;
};

// ログイン試行回数の増加
export const incrementLoginAttempts = (username: string): number => {
  const key = `${STORAGE_KEYS.LOGIN_ATTEMPTS}${username}`;
  const attempts = getLoginAttempts(username) + 1;
  localStorage.setItem(key, attempts.toString());
  
  // 最大試行回数に達した場合はアカウントをロック
  if (attempts >= 5) {
    lockAccount(username);
  }
  
  return attempts;
};

// ログイン試行回数のリセット
export const resetLoginAttempts = (username: string): void => {
  const key = `${STORAGE_KEYS.LOGIN_ATTEMPTS}${username}`;
  localStorage.removeItem(key);
};

// アカウントのロック
export const lockAccount = (username: string): void => {
  const key = `${STORAGE_KEYS.ACCOUNT_LOCKED}${username}`;
  const lockExpiry = new Date();
  lockExpiry.setHours(lockExpiry.getHours() + 24); // 24時間ロック
  
  localStorage.setItem(key, lockExpiry.toISOString());
  logSecurityEvent('account_locked', username, 'アカウントがロックされました（24時間）');
};

// アカウントのロック状態チェック
export const isAccountLocked = (username: string): boolean => {
  const key = `${STORAGE_KEYS.ACCOUNT_LOCKED}${username}`;
  const lockExpiry = localStorage.getItem(key);
  
  if (!lockExpiry) return false;
  
  // ロック期限が切れているかチェック
  const expiryDate = new Date(lockExpiry);
  const now = new Date();
  
  if (now > expiryDate) {
    // ロック期限切れ
    localStorage.removeItem(key);
    return false;
  }
  
  return true;
};

// セキュリティイベントのログ記録
export const logSecurityEvent = (
  type: string,
  username: string,
  details: string
): void => {
  const events = localStorage.getItem(STORAGE_KEYS.SECURITY_EVENTS);
  const securityEvents: SecurityEvent[] = events ? JSON.parse(events) : [];
  
  const newEvent: SecurityEvent = {
    id: Date.now().toString(),
    type,
    username,
    timestamp: new Date().toISOString(),
    details
  };
  
  securityEvents.push(newEvent);
  
  // 最大1000件まで保存
  if (securityEvents.length > 1000) {
    securityEvents.shift();
  }
  
  localStorage.setItem(STORAGE_KEYS.SECURITY_EVENTS, JSON.stringify(securityEvents));
};