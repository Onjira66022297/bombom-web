const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/emails/search?q=...
 *
 * Outlook integration requires an Azure AD app registration (client id/secret,
 * redirect URI) and delegated Mail.Read permission via Microsoft Graph. That's
 * a per-deployment config step, not something to hardcode here. Once the org's
 * Graph credentials are available, this handler should:
 *   1. Exchange the stored OAuth token (per-user, via MSAL) for a Graph token
 *   2. Call GET https://graph.microsoft.com/v1.0/me/messages?$search="{q}"
 *   3. Map the response into { id, subject, from, receivedAt, preview }
 *
 * Until then this returns 501 so the frontend fails loudly instead of showing
 * fake results.
 */
router.get('/search', async (req, res) => {
  res.status(501).json({
    error: 'Outlook integration not yet configured',
    detail: 'Requires Azure AD app registration + Microsoft Graph credentials in the environment.',
  });
});

module.exports = router;
