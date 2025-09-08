# 🚨 임시 해결책: Firestore 에러 우회

## 현재 상황
모든 Firestore 에러가 "Missing or insufficient permissions"로 발생하고 있습니다. 이는 **Firestore 보안 규칙이 배포되지 않았기 때문**입니다.

## 임시 해결책 (규칙 배포 전까지)

### 1단계: .env 파일에 환경변수 추가
프로젝트 루트에 `.env` 파일을 생성하고 다음을 추가:

```bash
# 기존 Firebase 설정들...
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
# ... 기타 설정들

# 임시: Firestore 작업을 우회 (규칙 배포 전까지)
EXPO_PUBLIC_SKIP_FIRESTORE=true
```

### 2단계: 앱 재시작
```bash
expo start --clear
```

## 예상 결과
- ✅ UserData fetch 에러 해결
- ✅ Goals listener 에러 해결  
- ✅ Firestore ping 에러 해결
- ✅ 앱이 정상적으로 작동 (데이터는 로컬에서만)

## 주의사항
- 이 설정은 **임시 해결책**입니다
- 실제 데이터 저장/조회는 작동하지 않습니다
- Firestore 규칙을 배포한 후 `EXPO_PUBLIC_SKIP_FIRESTORE=false`로 변경해야 합니다

## 영구 해결책
Firestore 규칙을 배포하세요:
1. https://console.firebase.google.com/ 접속
2. 프로젝트 선택 → Firestore Database → Rules
3. 다음 규칙 복사/붙여넣기 후 Publish:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. `EXPO_PUBLIC_SKIP_FIRESTORE=false`로 변경
5. 앱 재시작
