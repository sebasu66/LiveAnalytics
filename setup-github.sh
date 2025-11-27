#!/bin/bash

# GitHub Repository Setup Script
# Run this after creating the repository on GitHub

# Replace YOUR_USERNAME with your GitHub username
GITHUB_USERNAME="YOUR_USERNAME"
REPO_NAME="live-analytics-dashboard"

echo "Setting up GitHub repository..."

# Add remote
git remote add origin https://github.com/$GITHUB_USERNAME/$REPO_NAME.git

# Rename branch to main
git branch -M main

# Push to GitHub
git push -u origin main

echo "Done! Repository uploaded to GitHub."
