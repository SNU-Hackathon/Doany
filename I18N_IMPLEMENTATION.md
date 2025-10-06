# i18n (국제화) 구현 완료

## 📋 개요

React Native (Expo) 앱에 한국어/영어 이중 언어 지원을 성공적으로 구현했습니다.

## ✅ 구현 완료 항목

### 1. 패키지 설치
```bash
npm install i18next react-i18next react-native-localize --legacy-peer-deps
```

**설치된 패키지:**
- `i18next` - 국제화 핵심 라이브러리
- `react-i18next` - React 바인딩
- `react-native-localize` - 디바이스 언어 감지

### 2. 파일 구조

```
src/
├── i18n/
│   ├── index.ts                      # i18n 초기화
│   └── resources/
│       ├── en/
│       │   └── common.json          # 영어 번역
│       └── ko/
│           └── common.json          # 한국어 번역
├── services/
│   └── userPrefs.ts                 # 언어 설정 저장/로드
└── screens/
    ├── ProfileScreen.tsx            # 언어 선택 UI
    ├── HomeScreen.tsx               # i18n 사용 예제
    └── navigation/
        └── MainTabNavigator.tsx     # 탭 레이블 번역
```

### 3. 번역 파일

#### 영어 (en/common.json)
```json
{
  "nav": {
    "home": "Home",
    "goals": "Goals",
    "space": "Space",
    "feed": "Feed",
    "profile": "Profile"
  },
  "profile": {
    "language": "Language",
    "select_language": "Select Language",
    "korean": "한국어 (Korean)",
    "english": "English"
  },
  "create_goal": {
    "title": "Create New Goal",
    "description": "Set your goal and start your journey",
    "button": "Create Goal"
  },
  "goal_detail": {
    "quests_one": "{{count}} Quest",
    "quests_other": "{{count}} Quests"
  },
  "home": {
    "welcome": "Welcome!",
    "start_journey": "Start your journey today"
  }
}
```

#### 한국어 (ko/common.json)
```json
{
  "nav": {
    "home": "홈",
    "goals": "목표",
    "space": "스페이스",
    "feed": "피드",
    "profile": "프로필"
  },
  "profile": {
    "language": "언어",
    "select_language": "언어 선택",
    "korean": "한국어 (Korean)",
    "english": "English"
  },
  "create_goal": {
    "title": "새 목표 만들기",
    "description": "목표를 설정하고 여정을 시작하세요",
    "button": "목표 생성"
  },
  "goal_detail": {
    "quests_one": "퀘스트 {{count}}개",
    "quests_other": "퀘스트 {{count}}개"
  },
  "home": {
    "welcome": "환영합니다!",
    "start_journey": "오늘부터 시작하세요"
  }
}
```

### 4. 초기화 (src/i18n/index.ts)

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'react-native-localize';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 디바이스 언어 감지 (ko/en, 기본값 en)
const getDeviceLocale = (): string => {
  const locales = Localization.getLocales();
  if (locales.length > 0) {
    const locale = locales[0].languageCode;
    if (locale === 'ko') return 'ko';
  }
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources: { en: { common: ... }, ko: { common: ... } },
    lng: getDeviceLocale(),
    fallbackLng: 'en',
    defaultNS: 'common'
  });

// AsyncStorage에서 저장된 언어 로드
AsyncStorage.getItem('pref.language').then(savedLanguage => {
  if (savedLanguage) i18n.changeLanguage(savedLanguage);
});

// 언어 변경 시 AsyncStorage에 저장
i18n.on('languageChanged', (lng) => {
  AsyncStorage.setItem('pref.language', lng);
});
```

### 5. App.tsx에서 초기화

```typescript
import './src/i18n'; // 가장 먼저 import
```

### 6. 언어 설정 서비스 (src/services/userPrefs.ts)

```typescript
export type Language = 'ko' | 'en';

// 현재 언어 가져오기
export async function getLanguage(): Promise<Language> { ... }

// 언어 설정 (AsyncStorage + i18n 업데이트)
export async function setLanguage(language: Language): Promise<void> {
  await AsyncStorage.setItem('pref.language', language);
  await i18n.changeLanguage(language);
}

// 동기적으로 현재 언어 가져오기
export function getCurrentLanguage(): Language {
  return i18n.language === 'ko' ? 'ko' : 'en';
}
```

## 🎨 UI 구현

### 1. MainTabNavigator (탭 레이블 번역)

```typescript
import { useTranslation } from 'react-i18next';

export default function MainTabNavigator() {
  const { t } = useTranslation();
  
  const getTabLabel = (tab: TabType): string => {
    switch (tab) {
      case 'Home': return t('nav.home');
      case 'Goals': return t('nav.goals');
      // ...
    }
  };
  
  return (
    <Text>{getTabLabel(tab)}</Text>
  );
}
```

### 2. ProfileScreen (언어 선택기)

**기능:**
- 언어 선택 모달 (한국어/영어)
- AsyncStorage에 저장
- 즉시 UI 업데이트

```typescript
import { useTranslation } from 'react-i18next';
import { setLanguage, getCurrentLanguage } from '../services/userPrefs';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(getCurrentLanguage());
  
  const handleLanguageChange = async (language: Language) => {
    await setLanguage(language);
    setCurrentLanguage(language);
    // i18n이 자동으로 리렌더링 트리거
  };
  
  return (
    <Modal>
      <TouchableOpacity onPress={() => handleLanguageChange('ko')}>
        <Text>{t('profile.korean')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => handleLanguageChange('en')}>
        <Text>{t('profile.english')}</Text>
      </TouchableOpacity>
    </Modal>
  );
}
```

### 3. HomeScreen (i18n 사용 예제)

```typescript
import { useTranslation } from 'react-i18next';

export default function HomeScreen() {
  const { t } = useTranslation();
  
  return (
    <View>
      {/* 기본 번역 */}
      <Text>{t('home.welcome')}</Text>
      
      {/* 복수형 (pluralization) */}
      <Text>{t('goal_detail.quests', { count: 3 })}</Text>
      {/* 영어: "3 Quests" / 한국어: "퀘스트 3개" */}
    </View>
  );
}
```

## 🚀 사용 방법

### 기본 번역
```typescript
const { t } = useTranslation();
t('nav.home')              // "홈" or "Home"
t('create_goal.title')     // "새 목표 만들기" or "Create New Goal"
```

### 변수 치환
```typescript
t('welcome_message', { name: 'John' })
// JSON: "welcome_message": "환영합니다, {{name}}님!"
```

### 복수형 (Pluralization)
```typescript
t('goal_detail.quests', { count: 1 })  // "1 Quest" or "퀘스트 1개"
t('goal_detail.quests', { count: 3 })  // "3 Quests" or "퀘스트 3개"
```

**JSON 정의:**
```json
{
  "quests_one": "{{count}} Quest",      // count === 1
  "quests_other": "{{count}} Quests"    // count !== 1
}
```

### 언어 변경
```typescript
import { setLanguage } from '../services/userPrefs';

// 사용자가 언어 선택 시
await setLanguage('ko');  // 또는 'en'
// ✅ 자동으로 모든 화면이 리렌더링되고 언어가 바뀝니다!
```

## ✨ 핵심 기능

### 1. 자동 언어 감지
- 앱 첫 실행 시 디바이스 언어 자동 감지
- 한국어 디바이스 → 한국어
- 기타 → 영어 (fallback)

### 2. 언어 저장
- AsyncStorage에 사용자 선택 저장
- 앱 재시작 후에도 선택한 언어 유지

### 3. 즉시 업데이트
- `i18n.changeLanguage()`를 호출하면
- `useTranslation()`을 사용하는 모든 컴포넌트가 **자동으로 리렌더링**
- 별도의 새로고침 불필요!

### 4. 타입 안정성
- TypeScript 완벽 지원
- Language 타입: `'ko' | 'en'`

## 📝 새 번역 추가 방법

### 1. JSON 파일에 키 추가
```json
// src/i18n/resources/ko/common.json
{
  "settings": {
    "notifications": "알림",
    "privacy": "개인정보"
  }
}

// src/i18n/resources/en/common.json
{
  "settings": {
    "notifications": "Notifications",
    "privacy": "Privacy"
  }
}
```

### 2. 컴포넌트에서 사용
```typescript
const { t } = useTranslation();
<Text>{t('settings.notifications')}</Text>
```

## 🎯 테스트 체크리스트

- [x] 앱 시작 시 디바이스 언어로 초기화
- [x] ProfileScreen에서 언어 선택
- [x] AsyncStorage에 저장
- [x] 앱 재시작 후 언어 유지
- [x] 언어 변경 시 즉시 UI 업데이트
- [x] 탭 레이블 번역
- [x] 복수형 지원
- [x] 타입스크립트 에러 없음

## 🌐 지원 언어

현재 지원:
- 🇰🇷 한국어 (ko)
- 🇺🇸 영어 (en)

추가 언어 지원:
1. `src/i18n/resources/[언어코드]/common.json` 생성
2. `src/i18n/index.ts`에서 리소스 추가
3. userPrefs.ts의 Language 타입 확장

## 🔧 문제 해결

### 번역이 표시되지 않음
- i18n이 App.tsx에서 import되었는지 확인
- JSON 파일 경로 확인
- 브라우저 콘솔에서 에러 확인

### 언어 변경이 즉시 반영되지 않음
- useTranslation() hook 사용 확인
- i18n.changeLanguage() 호출 확인

### AsyncStorage 저장 실패
- Expo가 권한을 가지고 있는지 확인
- 에러 로그 확인

## 📚 참고 자료

- [i18next 공식 문서](https://www.i18next.com/)
- [react-i18next 가이드](https://react.i18next.com/)
- [react-native-localize](https://github.com/zoontek/react-native-localize)

## 🎉 완료!

이제 앱에서 언어를 변경하면 **모든 텍스트가 즉시 변경**됩니다!

사용자는 ProfileScreen에서 언어를 선택하고, 설정이 자동으로 저장되며, 앱을 다시 시작해도 선택한 언어가 유지됩니다.

