@echo off
git add .
git commit -m "fix: add missing Stripe dependency and restore critical dependencies for serverless functions"
git push origin main
echo Done!
pause
