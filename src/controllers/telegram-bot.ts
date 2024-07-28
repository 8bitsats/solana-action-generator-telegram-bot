// src/controllers/telegram-bot.ts

import { Bot, Context, session, SessionFlavor, webhookCallback } from "grammy";
import { createUSDCTransferActionApp, USDCTransferActionSpec } from './solana-action-app';
const { freeStorage } = require("@grammyjs/storage-free");

interface SessionData {
  creatingApp: boolean;
  appData: Partial<USDCTransferActionSpec>;
  awaitingIcon: boolean;
}

type MyContext = Context & SessionFlavor<SessionData> & {
  env: {
    SOLANA_ACTION_APPS: KVNamespace;
    BASE_URL: string;
    PUBLIC_R2_URL: string;
    ICON_BUCKET: R2Bucket;
  };
};

const DEFAULT_ICON_URL = "https://pub-5e7a518e1ac64fa28ad8bd8a857d269a.r2.dev/USDC%20TRANSFER.png";

export async function createBot(token: string, env: { SOLANA_ACTION_APPS: KVNamespace, BASE_URL: string, PUBLIC_R2_URL: string, ICON_BUCKET: R2Bucket }) {
  const bot = new Bot<MyContext>(token);

  bot.use(session({
    initial: (): SessionData => ({ creatingApp: false, appData: {}, awaitingIcon: false }),
    storage: freeStorage(token)
  }));

  bot.use((ctx, next) => {
    ctx.env = env;
    return next();
  });
  const mainMenu = "Choose an action:\n/create - Create a new USDC Transfer App\n";

  async function sendMainMenu(ctx: MyContext) {
    console.log("Sending main menu...", mainMenu);
    await ctx.reply(mainMenu);
  }

  function resetSession(ctx: MyContext) {
    ctx.session.creatingApp = false;
    ctx.session.appData = {};
  }

  bot.command("start", sendMainMenu);

  // bot.command("list", async (ctx) => {
  //   // Implement listing of apps
  //   await ctx.reply("Listing apps... (to be implemented)");
  // });

  bot.command("create", async (ctx) => {
    ctx.session.creatingApp = true;
    ctx.session.appData = {};
    await ctx.reply("Let's create a new USDC Transfer App. First, what's the title?\n\nYou can use /cancel at any time to abort the process.");
  });

  // bot.command("delete", async (ctx) => {
  //   // Implement app deletion
  //   await ctx.reply("Deleting an app... (to be implemented)");
  // });

  bot.command("cancel", async (ctx) => {
    if (ctx.session.creatingApp) {
      resetSession(ctx);
      await ctx.reply("App creation cancelled.");
      await sendMainMenu(ctx);
    } else {
      await ctx.reply("There's no ongoing process to cancel.");
    }
  });

  bot.on("message:text", async (ctx) => {
    if (ctx.session.creatingApp) {
      console.log("in creating app")
      // Handle app creation flow
      if (!ctx.session.appData.title) {
        console.log("Setting title");
        ctx.session.appData.title = ctx.message.text;
        ctx.session.awaitingIcon = true;
        await ctx.reply("Great! Now, please upload an icon image for your app. If you don't want to upload an image, just type 'skip' to use the default icon.\n\nUse /cancel to abort if needed.");
      } else if (ctx.session.awaitingIcon) {
        if (ctx.message.text.toLowerCase() === 'skip') {
          ctx.session.appData.icon = DEFAULT_ICON_URL;
          ctx.session.awaitingIcon = false;
          await ctx.reply("Using default icon. What's the description?\n\nUse /cancel to abort if needed.");
        } else {
          await ctx.reply("Please upload an image or type 'skip' to use the default icon.\n\nUse /cancel to abort if needed.");
        }
      } else if (!ctx.session.appData.description) {
        console.log("Setting description");
        ctx.session.appData.description = ctx.message.text;
        await ctx.reply("Good! What's the label?\n\n/cancel is available if you want to stop.");
      } else if (!ctx.session.appData.label) {
        ctx.session.appData.label = ctx.message.text;
        await ctx.reply("Now, enter the predefined amounts separated by commas (e.g., 1,5,10):\n\nRemember /cancel is always an option.");
      } else if (!ctx.session.appData.predefinedAmounts) {
        ctx.session.appData.predefinedAmounts = ctx.message.text.split(',').map(Number);
        await ctx.reply("Finally, what's the recipient's Solana address?\n\nLast chance to /cancel if needed.");
      } else if (!ctx.session.appData.recipient) {
        ctx.session.appData.recipient = ctx.message.text;
        // Create the app
        try {
          console.log("Creating app with data:", ctx.session.appData);
          // Construct the endpoint URLs
          // const baseUrl = env.BASE_URL;
          const result = await createUSDCTransferActionApp(
            { SOLANA_ACTION_APPS: ctx.env.SOLANA_ACTION_APPS, BASE_URL: ctx.env.BASE_URL },
            ctx.session.appData as USDCTransferActionSpec
          );
          
            const successMessage = `
          App created successfully! 
          ID: ${result.id}
          
          Endpoint: ${result.endpoint}
          
          These endpoints conform to the Solana Action specification.
          You can create the Blink to share directly on https://dial.to
            `;
            await ctx.reply(successMessage);
            await ctx.reply(`Click here to create your Solana Action on Dialect: https://dial.to/?action=solana-action:${result.endpoint}`)
            
        } catch (error: unknown) {
          if (error instanceof Error) {
            await ctx.reply(`Error creating app: ${error.message}`);
          } else {
            await ctx.reply("An unknown error occurred while creating the app.");
          }
        }
        resetSession(ctx);
        await sendMainMenu(ctx);
      } else {
        console.log("Unexpected state in app creation flow");
        await ctx.reply("Something went wrong. Let's start over.");
        resetSession(ctx);
        await sendMainMenu(ctx);
      }
    } else {
      console.log("Not in app creation flow, sending main menu");
      await sendMainMenu(ctx);
    }
  });

  bot.on("message:photo", async (ctx) => {
    if (ctx.session.creatingApp && ctx.session.awaitingIcon) {
      const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      const file = await ctx.api.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      try {
        const response = await fetch(fileUrl);
        const arrayBuffer = await response.arrayBuffer();
        const fileName = `icon_${Date.now()}.jpg`;
        await ctx.env.ICON_BUCKET.put(fileName, arrayBuffer);
        
        const iconUrl = `${ctx.env.PUBLIC_R2_URL}/${fileName}`;
        ctx.session.appData.icon = iconUrl;
        ctx.session.awaitingIcon = false;

        await ctx.reply("Icon uploaded successfully. What's the description?\n\nUse /cancel to abort if needed.");
      } catch (error) {
        console.error("Error uploading icon:", error);
        await ctx.reply("There was an error uploading your icon. Please try again or type 'skip' to use the default icon.\n\nUse /cancel to abort if needed.");
      }
    } else if (!ctx.session.creatingApp) {
      await sendMainMenu(ctx);
    }
  });

  return bot;
}

export async function handleWebhook(request: Request, env: { BOT_TOKEN: string, SOLANA_ACTION_APPS: KVNamespace, TELEGRAM_SECRET_TOKEN: string, BASE_URL: string, PUBLIC_R2_URL: string, ICON_BUCKET: R2Bucket }) {

    const secretToken = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (secretToken !== env.TELEGRAM_SECRET_TOKEN) {
        console.error("Invalid secret token");
        return new Response("Unauthorized", { status: 401 });
    }

    console.log("success")

    const bot = await createBot(env.BOT_TOKEN, { SOLANA_ACTION_APPS: env.SOLANA_ACTION_APPS, BASE_URL: env.BASE_URL, PUBLIC_R2_URL: env.PUBLIC_R2_URL, ICON_BUCKET: env.ICON_BUCKET });

    console.log("bot", bot)
    
    const handleUpdate = webhookCallback(bot, "cloudflare-mod", { secretToken: env.TELEGRAM_SECRET_TOKEN});
  
    try {
      // Process the incoming update
      return await handleUpdate(request);
    } catch (error) {
      console.error("Error in webhook:", error);
      return new Response("Error processing update", { status: 500 });
    }
  }