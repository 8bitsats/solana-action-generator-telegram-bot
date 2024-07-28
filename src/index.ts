import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { handleWebhook } from './controllers/telegram-bot'
import { createUSDCTransferActionApp, endpointGetUSDCTransfer, endpointPostUSDCTransfer, deleteUSDCTransferActionApp } from './controllers/solana-action-app'

type Bindings = {
  BOT_TOKEN: string;
  SOLANA_ACTION_APPS: KVNamespace;
  TELEGRAM_SECRET_TOKEN: string;
  BASE_URL: string;
  PUBLIC_R2_URL: string;
  ICON_BUCKET: R2Bucket;
}

const app = new Hono<{ Bindings: Bindings }>();

// CORS for Solana Action App spec
app.use('/endpoint/app/*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'Content-Encoding', 'Accept-Encoding'],
  allowMethods: ['GET','POST','PUT','OPTIONS','DELETE']
}))

// Will handle the incoming request of telegram bot via webhook
app.post('/telegram-bot/webhook', async (c) => {
  return await handleWebhook(c.req.raw, c.env)
})

// Will create Solana Action app
app.post('/app', async (c) => {
  try {
    const body = await c.req.json()
    
    // Validate the incoming data
    if (!body.title || !body.icon || !body.description || !body.label || 
        !Array.isArray(body.predefinedAmounts) || !body.recipient) {
      return c.json({ error: 'Invalid input data' }, 400)
    }

    const spec = {
      title: body.title,
      icon: body.icon,
      description: body.description,
      label: body.label,
      predefinedAmounts: body.predefinedAmounts,
      recipient: body.recipient
    }

    // Call the controller function to create the app
    const result = await createUSDCTransferActionApp(c.env, spec);

    return c.json({
      message: 'USDC Transfer Action app created successfully',
      id: result.id,
      endpoints: result.endpoint
    }, 201);
  } catch (error) {
    console.error('Error creating USDC Transfer Action app:', error)
    return c.json({ error: 'Failed to create USDC Transfer Action app' }, 500)
  }
})

// Will return GET specifications of the Solana Action in the app
app.get('/endpoint/app/:id', async (c) => {
  const id = c.req.param('id')
  const spec = await endpointGetUSDCTransfer(c.env, id)
  if (spec) {
    return c.json(spec)
  }
  return c.json({ error: 'App not found' }, 404)
})

// Will return POST specifications of the Solana Action in the app
app.post('/endpoint/app/:id/transfer-usdc', async (c) => {
  const id = c.req.param('id');
  console.log("POST REQUEST", id);
  // Extract JSON body
  const jsonBody = await c.req.json();

  // Extract query string parameters
  const queryStringParams = c.req.query();

  // Combine them into a single object
  const spec = {
    ...jsonBody,
    ...queryStringParams
  };

  console.log("SPEC", spec);

  try {
    const result = await endpointPostUSDCTransfer(c.env, id, spec);
    return c.json(result);
  } catch (error) {
    console.error('Error executing USDC Transfer Action:', error)
    return c.json({ error: 'Failed to execute USDC Transfer Action app' }, 500)
  }
});

app.options('/*', (c) => {
  return c.text('Preflight CORS succeed!')
}) 

// Will return QR of the Solana Action in the app
app.get('/endpoint/app/qr/:id', (c) => {
  const id = c.req.param('id')
  return c.text(`QR code for app ${id}`)
})

// Will delete the Solana Action App
app.delete('/app/:id', async (c) => {
  const id = c.req.param('id')
  await deleteUSDCTransferActionApp(c.env, id)
  return c.json({ message: 'App deleted successfully' })
})

export default app;