// デバイス認証関連の型定義
export interface DeviceFingerprint {
  id: string;
  screen: string;
  language: string;
  platform: string;
  userAgent: string;
  timezone: string;
  createdAt: string;
}

export interface UserCredentials {
  lineUsername: string;
  pinCodeHash: string;
  salt: string;
  deviceId: string;
  createdAt: string;
}

export interface AuthSession {
  lineUsername: string;
  deviceId: string;
  lastActivity: string;
  expiresAt: string;
}

export interface SecurityQuestion {
  id: string;
  question: string;
  answer: string; // Base64エンコードされた回答
}

export enum AuthErrorType {
  INVALID_CREDENTIALS = 'invalid_credentials',
  ACCOUNT_LOCKED = 'account_locked',
  DEVICE_MISMATCH = 'device_mismatch',
  INVALID_PIN = 'invalid_pin',
  UNKNOWN = 'unknown'
}

export class AuthError extends Error {
  type: AuthErrorType;
  
  constructor(type: AuthErrorType, message: string) {
    super(message);
    this.type = type;
    this.name = 'AuthError';
  }
}

// ローカルストレージのキー
export const STORAGE_KEYS = {
  DEVICE_FINGERPRINT: 'device_fingerprint',
  USER_CREDENTIALS: 'user_credentials',
  AUTH_SESSION: 'auth_session',
  SECURITY_QUESTIONS: 'security_questions',
  LOGIN_ATTEMPTS: 'login_attempts_',
  ACCOUNT_LOCKED: 'account_locked_',
  SECURITY_EVENTS: 'security_events'
};

// 秘密の質問リスト
export const SECURITY_QUESTIONS = [
  {
    id: 'first_pet',
    question: '最初に飼ったペットの名前は？',
    placeholder: '例: ポチ'
  },
  {
    id: 'mother_maiden',
    question: 'あなたの母親の旧姓は？',
    placeholder: '例: 田中'
  },
  {
    id: 'elementary_school',
    question: '通っていた小学校の名前は？',
    placeholder: '例: 中央小学校'
  },
  {
    id: 'childhood_friend',
    question: '幼少期の親友の名前は？',
    placeholder: '例: 太郎'
  },
  {
    id: 'favorite_place',
    question: '子供の頃の好きな場所は？',
    placeholder: '例: 祖父の家'
  },
  {
    id: 'first_job',
    question: '初めてのアルバイト先は？',
    placeholder: '例: コンビニ'
  },
  {
    id: 'favorite_teacher',
    question: '一番好きだった先生の名前は？',
    placeholder: '例: 佐藤先生'
  },
  {
    id: 'favorite_book',
    question: '子供の頃の好きな本は？',
    placeholder: '例: ハリーポッター'
  }
];

// デバイスフィンガープリントを生成する関数
export const generateDeviceFingerprint = (): DeviceFingerprint => {
  const screen = `${window.screen.width}x${window.screen.height}`;
  const language = navigator.language;
  const platform = navigator.platform;
  const userAgent = navigator.userAgent;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // 一意のデバイスIDを生成
  const deviceComponents = [screen, language, platform, userAgent, timezone];
  const deviceString = deviceComponents.join('|');
  const deviceId = btoa(deviceString).substring(0, 32);
  
  return {
    id: deviceId,
    screen,
    language,
    platform,
    userAgent,
    timezone,
    createdAt: new Date().toISOString()
  };
};

// デバイスフィンガープリントを保存する関数
export const saveDeviceFingerprint = (fingerprint: DeviceFingerprint): void => {
  localStorage.setItem(STORAGE_KEYS.DEVICE_FINGERPRINT, JSON.stringify(fingerprint));
  
  // セキュリティイベントをログ
  logSecurityEvent('device_registered', 'system', 'デバイスフィンガープリントが登録されました');
};

// デバイスフィンガープリントを取得する関数
export const getDeviceFingerprint = (): DeviceFingerprint | null => {
  const storedFingerprint = localStorage.getItem(STORAGE_KEYS.DEVICE_FINGERPRINT);
  return storedFingerprint ? JSON.parse(storedFingerprint) : null;
};

// デバイスフィンガープリントを比較する関数
export const compareDeviceFingerprints = (current: DeviceFingerprint, stored: DeviceFingerprint): boolean => {
  // 主要な特性が一致するかチェック
  return current.id === stored.id;
};

// PIN番号をハッシュ化する関数
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

// ユーザー認証情報を保存する関数
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
  
  // セキュリティイベントをログ
  logSecurityEvent('user_registered', lineUsername, 'ユーザー認証情報が登録されました');
};

// ユーザー認証情報を取得する関数
export const getUserCredentials = (): UserCredentials | null => {
  const storedCredentials = localStorage.getItem(STORAGE_KEYS.USER_CREDENTIALS);
  return storedCredentials ? JSON.parse(storedCredentials) : null;
};

// 現在のユーザーを取得する関数
export const getCurrentUser = (): UserCredentials | null => {
  return getUserCredentials();
};

// 認証セッションを作成する関数
export const createAuthSession = (data: {
  lineUsername: string;
  pinCode: string;
  deviceId: string;
}): void => {
  const session: AuthSession = {
    lineUsername: data.lineUsername,
    deviceId: data.deviceId,
    lastActivity: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30日後
  };
  
  localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(session));
  
  // セキュリティイベントをログ
  logSecurityEvent('session_created', data.lineUsername, '認証セッションが作成されました');
};

// 認証セッションを取得する関数
export const getAuthSession = (): AuthSession | null => {
  const storedSession = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
  if (!storedSession) return null;
  
  const session = JSON.parse(storedSession) as AuthSession;
  
  // セッションの有効期限をチェック
  if (new Date(session.expiresAt) < new Date()) {
    // 期限切れの場合はセッションを削除
    localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    return null;
  }
  
  // 最終アクティビティを更新
  session.lastActivity = new Date().toISOString();
  localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(session));
  
  return session;
};

// 認証セッションをクリアする関数
export const clearAuthSession = (): void => {
  localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
};

// ユーザーをログアウトする関数
export const logoutUser = (): void => {
  const credentials = getUserCredentials();
  if (credentials) {
    logSecurityEvent('user_logout', credentials.lineUsername, 'ユーザーがログアウトしました');
  }
  
  clearAuthSession();
};

// 秘密の質問を保存する関数
export const saveSecurityQuestions = (questions: SecurityQuestion[]): void => {
  // 回答をBase64エンコードして保存
  const encodedQuestions = questions.map(q => ({
    ...q,
    answer: btoa(q.answer.toLowerCase().trim())
  }));
  
  localStorage.setItem(STORAGE_KEYS.SECURITY_QUESTIONS, JSON.stringify(encodedQuestions));
  
  // セキュリティイベントをログ
  const credentials = getUserCredentials();
  if (credentials) {
    logSecurityEvent('security_questions_set', credentials.lineUsername, '秘密の質問が設定されました');
  }
};

// 秘密の質問を取得する関数
export const getSecurityQuestions = (): SecurityQuestion[] => {
  const storedQuestions = localStorage.getItem(STORAGE_KEYS.SECURITY_QUESTIONS);
  return storedQuestions ? JSON.parse(storedQuestions) : [];
};

// ログイン試行回数を取得する関数
export const getLoginAttempts = (username: string): number => {
  const key = `${STORAGE_KEYS.LOGIN_ATTEMPTS}${username}`;
  const attempts = localStorage.getItem(key);
  return attempts ? parseInt(attempts) : 0;
};

// ログイン試行回数を増やす関数
export const incrementLoginAttempts = (username: string): number => {
  const key = `${STORAGE_KEYS.LOGIN_ATTEMPTS}${username}`;
  const attempts = getLoginAttempts(username) + 1;
  localStorage.setItem(key, attempts.toString());
  
  // 試行回数が上限に達した場合はアカウントをロック
  if (attempts >= 5) {
    lockAccount(username);
  }
  
  return attempts;
};

// ログイン試行回数をリセットする関数
export const resetLoginAttempts = (username: string): void => {
  const key = `${STORAGE_KEYS.LOGIN_ATTEMPTS}${username}`;
  localStorage.removeItem(key);
};

// アカウントがロックされているかチェックする関数
export const isAccountLocked = (username: string): boolean => {
  const key = `${STORAGE_KEYS.ACCOUNT_LOCKED}${username}`;
  const lockedUntil = localStorage.getItem(key);
  
  if (!lockedUntil) return false;
  
  // ロック期限をチェック
  const lockExpiry = new Date(lockedUntil);
  const now = new Date();
  
  if (now > lockExpiry) {
    // ロック期限が切れている場合はロックを解除
    localStorage.removeItem(key);
    resetLoginAttempts(username);
    return false;
  }
  
  return true;
};

// アカウントをロックする関数
export const lockAccount = (username: string): void => {
  const key = `${STORAGE_KEYS.ACCOUNT_LOCKED}${username}`;
  
  // 24時間後の日時を設定
  const lockExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  localStorage.setItem(key, lockExpiry.toISOString());
  
  // セキュリティイベントをログ
  logSecurityEvent('account_locked', username, 'アカウントがロックされました（24時間）');
};

// セキュリティイベントをログに記録する関数
export const logSecurityEvent = (
  type: string,
  username: string,
  details: string
): void => {
  const events = localStorage.getItem(STORAGE_KEYS.SECURITY_EVENTS);
  const securityEvents = events ? JSON.parse(events) : [];
  
  const newEvent = {
    id: Date.now().toString(),
    type,
    username,
    timestamp: new Date().toISOString(),
    details
  };
  
  securityEvents.push(newEvent);
  
  // 最大100件までログを保存
  if (securityEvents.length > 100) {
    securityEvents.shift();
  }
  
  localStorage.setItem(STORAGE_KEYS.SECURITY_EVENTS, JSON.stringify(securityEvents));
};