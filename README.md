# Solana Action Endpoint Creator Bot (Work in Progress)

This project implements a Telegram bot that allows users to easily create Solana Action endpoints for various programs (starting with USDC Transfer, later will add more program options).
These endpoints can be easily used to create Blinks on https://dial.to. The bot utilizes Cloudflare Workers for serverless execution and Cloudflare KV for storing app specifications.

## Overview

The Solana Action Endpoint Creator Bot enables users to:
1. Create and manage Solana Action specifications for USDC transfers via Telegram.
2. Generate endpoints that can be directly used to create Blinks on https://dial.to.
3. Simplify the process of setting up Solana Actions for USDC transfers.


## Demo

Demo: https://youtu.be/frRIPRKXUGo

## Preview (Still in Progress)

https://t.me/solana_action_bot (Work In Progress)

## Quick Start

```
npm install

// If it's not running postinstall script to patch the Solana package due to nodejs incompability with cloudflare worker, you should run
// npm run postinstall

npm run dev
```

To deploy:
```
npm run deploy
```

## Environment Setup

To set up the environment for this project:

1. Copy the `wrangler.toml.sample` file and rename it to `wrangler.toml`:

   ```bash
   cp wrangler.toml.sample wrangler.toml
   ```

2. Open the wrangler.toml file and fill in the following fields:

```
[vars]
BOT_TOKEN = Your Telegram Bot Token (obtained from @BotFather on Telegram)
TELEGRAM_SECRET_TOKEN = This is a secret string you create to ensure that only authorized requests are processed by your bot. Choose a random, complex string.
BASE_URL = This is the URL where your Cloudflare Worker will be deployed. It will look something like https://your-worker-name.your-subdomain.workers.dev.

[[kv_namespaces]]
binding = "SOLANA_ACTION_APPS"
id = This is the ID of a Cloudflare KV namespace you've created to store your app data. You can create this in the Cloudflare dashboard and copy the ID.
```

Save the wrangler.toml file with your changes.


## Telegram Bot Setup
Create a new bot using @BotFather on Telegram and obtain the BOT_TOKEN.
Set up the webhook for your bot, including the secret token.
For more information, refer to the Telegram Bot API documentation.
https://core.telegram.org/bots/api#setwebhook

## Key Components
1. Telegram Bot Interface (main entry point):
  - Handles user interactions and commands via Telegram

2. App Creation Endpoint (/app POST route):
  - Creates a new USDC Transfer Solana Action app
  - Stores the app specification in Cloudflare KV

3. Solana Action Controller (solana-action-app.ts):
  - Manages the logic for creating and storing USDC Transfer Action apps

4. USDC Transfer Interface (transfer-usdc.ts):
  - Implements the Solana Action interface for USDC transfers
  - Retrieves app specifications from KV storage

## Usage
Start a chat with your Telegram bot.
Follow the bot's instructions to create a new USDC Transfer Solana Action endpoint.
Once created, the bot will provide you with an endpoint URL.
Copy this endpoint URL and paste it into https://dial.to to create a Blink for your Solana Action.

## Current Status
This project is still a work-in-progress

## Roadmap

1. USDC Transfer (Work in Progress)
Use cases: Donation, Commerce, Crowdfunding

2. ...