/**
 * DocuSign REST API helpers for JWT auth and embedded signing.
 * Env: DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_USER_ID (impersonated user GUID), DOCUSIGN_PRIVATE_KEY (PEM), DOCUSIGN_BASE_URL (optional).
 */

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Get OAuth2 access token via JWT grant.
 * Requires: DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_PRIVATE_KEY (RSA private key PEM).
 */
export async function getDocuSignAccessToken(): Promise<string> {
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
  const userId = process.env.DOCUSIGN_USER_ID;
  const privateKeyPem = process.env.DOCUSIGN_PRIVATE_KEY;

  if (!integrationKey || !userId || !privateKeyPem) {
    throw new Error(
      "DocuSign JWT not configured: set DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, and DOCUSIGN_PRIVATE_KEY"
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: integrationKey,
    sub: userId,
    aud: "account-d.docusign.com",
    iat: now,
    exp: now + 3600,
  };

  const signInput =
    base64UrlEncode(JSON.stringify(header)) +
    "." +
    base64UrlEncode(JSON.stringify(payload));

  const crypto = await import("crypto");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signInput);
  const signature = sign.sign(privateKeyPem);
  const jwt = signInput + "." + base64UrlEncode(signature);

  const tokenRes = await fetch("https://account-d.docusign.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`DocuSign token failed: ${tokenRes.status} ${errText}`);
  }

  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error("DocuSign token response missing access_token");
  }
  return tokenJson.access_token;
}

/**
 * Create recipient view (embedded signing URL) for an existing envelope.
 * Recipient email, userName, clientUserId must match how the envelope was created.
 */
export async function createRecipientView(
  envelopeId: string,
  options: {
    email: string;
    userName: string;
    clientUserId: string;
    returnUrl: string;
  }
): Promise<string> {
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  const baseUrl =
    process.env.DOCUSIGN_BASE_URL || "https://demo.docusign.net/restapi";
  if (!accountId) {
    throw new Error("DOCUSIGN_ACCOUNT_ID is not set");
  }

  const accessToken = await getDocuSignAccessToken();
  const url = `${baseUrl}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/views/recipient`;

  const body = {
    returnUrl: options.returnUrl,
    authenticationMethod: "none",
    email: options.email,
    userName: options.userName,
    clientUserId: options.clientUserId,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DocuSign recipient view failed: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) {
    throw new Error("DocuSign recipient view response missing url");
  }
  return data.url;
}

/** Check if DocuSign is configured (integration key + account id). */
export function isDocuSignConfigured(): boolean {
  return Boolean(
    process.env.DOCUSIGN_INTEGRATION_KEY && process.env.DOCUSIGN_ACCOUNT_ID
  );
}

/**
 * Create and send a DocuSign envelope with one document.
 * First signer: client (routing order 1). Optional second signer: admin (routing order 2).
 * Both must have clientUserId set so createRecipientView works later.
 * Returns the envelope ID.
 */
export async function createEnvelope(params: {
  documentBase64: string;
  documentName: string;
  signer: { email: string; name: string; clientUserId: string };
  adminSigner?: { email: string; name: string; clientUserId: string };
  emailSubject: string;
}): Promise<string> {
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  const baseUrl =
    process.env.DOCUSIGN_BASE_URL || "https://demo.docusign.net/restapi";
  if (!accountId) {
    throw new Error("DOCUSIGN_ACCOUNT_ID is not set");
  }

  const accessToken = await getDocuSignAccessToken();
  const url = `${baseUrl}/v2.1/accounts/${accountId}/envelopes`;

  const signers: Array<{
    email: string;
    name: string;
    recipientId: string;
    routingOrder: string;
    clientUserId: string;
    tabs: { signHereTabs: Array<{ documentId: string; pageNumber: string; xPosition: string; yPosition: string }> };
  }> = [
    {
      email: params.signer.email,
      name: params.signer.name,
      recipientId: "1",
      routingOrder: "1",
      clientUserId: params.signer.clientUserId,
      tabs: {
        signHereTabs: [
          { documentId: "1", pageNumber: "1", xPosition: "100", yPosition: "700" },
        ],
      },
    },
  ];

  if (params.adminSigner) {
    signers.push({
      email: params.adminSigner.email,
      name: params.adminSigner.name,
      recipientId: "2",
      routingOrder: "2",
      clientUserId: params.adminSigner.clientUserId,
      tabs: {
        signHereTabs: [
          { documentId: "1", pageNumber: "1", xPosition: "100", yPosition: "650" },
        ],
      },
    });
  }

  const envelopeDefinition = {
    status: "sent",
    emailSubject: params.emailSubject,
    documents: [
      {
        documentBase64: params.documentBase64,
        name: params.documentName,
        fileExtension: "pdf",
        documentId: "1",
      },
    ],
    recipients: { signers },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(envelopeDefinition),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DocuSign create envelope failed: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as { envelopeId?: string };
  if (!data.envelopeId) {
    throw new Error("DocuSign create envelope response missing envelopeId");
  }
  return data.envelopeId;
}
