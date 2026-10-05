# ClassMate – Your classroom. Your information. One platform.

Plain HTML + Bootstrap 5 + vanilla JS (ES modules) + Firebase Auth/Firestore. No build step.

## 1. Firebase setup (project `classmate-75660`)
1. Open https://console.firebase.google.com → your project.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** (production mode, any region).
4. **Firestore → Rules** tab → paste the contents of `firestore.rules` → **Publish**.
5. **Authentication → Settings → Authorized domains**: `localhost` and your hosting domain should be listed.

## 2. Create the first admin
1. **Authentication → Users → Add user** (your email + password). Copy the **User UID**.
2. **Firestore → Start collection** `users` → Document ID = that UID, with fields (all strings):
   `role` = `admin`, `name` = your name, `email` = your email.
3. Open `admin-login.html` and sign in.

## 3. Run locally (VS Code)
ES modules need http, not file://. Install the **Live Server** extension → right-click `index.html` → **Open with Live Server**.

## 4. First-use order
Admin: create **Classes** → add **Faculty** (assign classes) → students sign up themselves at `student-signup.html`.
Faculty then publish notes, announcements, assignments, timetable, attendance, marks, exams and answer doubts.

## 5. Deploy to Firebase Hosting
```
npm install -g firebase-tools
firebase login
firebase use classmate-75660
firebase deploy --only hosting,firestore:rules
```
(Create `.firebaserc` automatically with `firebase use --add` if prompted.)

## Notes
- **Faculty creation** uses a second, temporary Firebase app instance, so the admin is never signed out. No Cloud Functions or paid plan needed.
- Deleting a student/faculty removes their Firestore data and blocks role access; remove the login itself in Authentication → Users.
- Security rules: students read only their class content and their own attendance/marks/doubts/tasks; faculty write only for classes assigned to them; admin manages everything.
- Not included yet: quiz questions/submissions, assignment submissions, file upload (Drive links only).
