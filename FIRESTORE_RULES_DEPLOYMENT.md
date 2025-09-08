# 🚨 URGENT: Firestore Rules Deployment Required

## 현재 상황
모든 Firebase 에러가 "Missing or insufficient permissions"로 발생하고 있습니다. 이는 **Firestore 보안 규칙이 배포되지 않았기 때문**입니다.

## 해결 방법

### 1단계: Firebase Console 접속
1. https://console.firebase.google.com/ 접속
2. 프로젝트 선택

### 2단계: Firestore Database로 이동
1. 왼쪽 메뉴에서 **"Firestore Database"** 클릭
2. **"Rules"** 탭 클릭

### 3단계: 규칙 복사 및 배포
1. 현재 `firestore.rules` 파일의 내용을 복사:

```javascript
// EMERGENCY: Ultra-simple rules to fix permission errors
// Allow all authenticated users to access everything

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

2. Firebase Console의 Rules 편집기에 붙여넣기
3. **"Publish"** 버튼 클릭
4. 배포 완료까지 기다리기 (보통 1-2분)

### 4단계: 앱 재시작
```bash
expo start --clear
```

## 예상 결과
규칙 배포 후:
- ✅ UserData fetch 성공
- ✅ Goals listener 정상 작동
- ✅ Firestore ping 성공
- ✅ 모든 권한 에러 해결

## 주의사항
현재 규칙은 **개발용으로 매우 관대**합니다. 프로덕션 배포 전에 더 제한적인 규칙으로 변경해야 합니다.

## 문제가 계속되면
1. Firebase Console에서 Rules가 제대로 배포되었는지 확인
2. 프로젝트 ID가 올바른지 확인
3. .env 파일의 Firebase 설정이 정확한지 확인
