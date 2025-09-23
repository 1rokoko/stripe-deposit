@echo off
echo Installing dependencies...
npm install

echo Building Next.js app...
npm run build

echo Committing changes...
git add .
git commit -m "fix: update vercel.json for Next.js framework support"

echo Pushing to GitHub...
git push origin main

echo Done!
pause
