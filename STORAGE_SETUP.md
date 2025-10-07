# Firebase Storage Setup Guide

## 문제: 사진 업로드 실패

Firebase Storage에 사진을 업로드할 때 "권한이 없습니다" 또는 "unknown error" 오류가 발생하는 경우, Storage 보안 규칙을 설정해야 합니다.

## 해결 방법

### 1. Firebase Console에서 Storage 규칙 설정

1. **Firebase Console 접속**
   - https://console.firebase.google.com/ 접속
   - 프로젝트 선택

2. **Storage 메뉴로 이동**
   - 왼쪽 메뉴에서 "Storage" 클릭
   - 상단의 "Rules" 탭 클릭

3. **규칙 업데이트**
   - 다음 규칙을 복사하여 붙여넣기:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Verification photos - users can upload their own
    match /verifications/{userId}/{goalId}/{fileName} {
      // Allow read for authenticated users
      allow read: if request.auth != null;
      
      // Allow write only for the owner
      allow write: if request.auth != null 
        && request.auth.uid == userId
        && request.resource.size < 10 * 1024 * 1024  // Max 10MB
        && request.resource.contentType.matches('image/.*');  // Only images
    }
    
    // User profile pictures
    match /users/{userId}/profile/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null 
        && request.auth.uid == userId
        && request.resource.size < 5 * 1024 * 1024  // Max 5MB
        && request.resource.contentType.matches('image/.*');
    }
    
    // Deny all other paths
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

4. **게시(Publish) 버튼 클릭**
   - 우측 상단의 "Publish" 또는 "게시" 버튼 클릭
   - 확인 다이얼로그에서 "확인" 클릭

### 2. Firebase CLI로 배포 (선택사항)

이미 Firebase CLI가 설치되어 있다면:

```bash
# Firebase 로그인 (처음 한 번만)
firebase login

# 프로젝트 초기화 (처음 한 번만)
firebase init storage

# Storage 규칙 배포
firebase deploy --only storage
```

## 규칙 설명

### 검증 사진 경로
- **경로**: `verifications/{userId}/{goalId}/{fileName}`
- **읽기**: 모든 인증된 사용자 가능
- **쓰기**: 본인만 가능
- **제한**: 최대 10MB, 이미지 파일만

### 프로필 사진 경로
- **경로**: `users/{userId}/profile/{fileName}`
- **읽기**: 모든 인증된 사용자 가능
- **쓰기**: 본인만 가능
- **제한**: 최대 5MB, 이미지 파일만

## 트러블슈팅

### "unauthorized" 에러
- Firebase Console에서 Storage 규칙이 올바르게 배포되었는지 확인
- 사용자가 로그인되어 있는지 확인
- `userId` 파라미터가 현재 로그인한 사용자의 ID와 일치하는지 확인

### "quota-exceeded" 에러
- Firebase 프로젝트의 Storage 용량을 확인
- 무료 플랜: 5GB
- 필요시 Blaze 플랜으로 업그레이드

### "retry-limit-exceeded" 에러
- 인터넷 연결 상태 확인
- 파일 크기가 너무 크지 않은지 확인 (최대 10MB)

### "network error" 에러
- Wi-Fi 또는 모바일 데이터 연결 확인
- 방화벽이나 VPN이 Firebase 접속을 차단하지 않는지 확인

## 확인 방법

규칙이 올바르게 설정되었는지 확인하려면:

1. 앱에서 로그인
2. 퀘스트 상세 화면에서 "업로드" 버튼 클릭
3. 사진 촬영
4. 업로드 진행 상황을 콘솔에서 확인:
   ```
   [Verification] Starting photo upload...
   [Verification] Blob size: ... bytes
   [Verification] Uploading to Firebase Storage...
   [Verification] Upload successful: ...
   [Verification] Download URL obtained: ...
   ```

5. Firebase Console > Storage에서 업로드된 파일 확인
   - `verifications/{userId}/{goalId}/` 경로에 파일이 있어야 함

## 추가 정보

- **Storage 위치**: 프로젝트 생성 시 선택한 지역 (변경 불가)
- **무료 용량**: 5GB 저장, 1GB/일 다운로드
- **가격**: https://firebase.google.com/pricing

## 도움말

문제가 계속되면:
1. Firebase Console > Storage > Rules 탭에서 규칙 재확인
2. 앱을 완전히 종료 후 재시작
3. Metro 번들러 재시작: `expo start --clear`
4. Firebase Console > Storage에서 "테스트 모드" 활성화 (테스트용, 프로덕션에서는 사용 금지)

