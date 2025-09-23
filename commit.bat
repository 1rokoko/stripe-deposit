@echo off
git add .
git commit -m "fix: restrict tests to tests/ directory to prevent production load testing during CI/CD"
git push origin main
