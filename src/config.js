require("dotenv").config();

const config = {
  port: Number(process.env.PORT || 3000),
  satusehat: {
    authUrl: process.env.SATUSEHAT_AUTH_URL,
    fhirUrl: process.env.SATUSEHAT_FHIR_URL,
    clientId: process.env.SATUSEHAT_CLIENT_ID,
    clientSecret: process.env.SATUSEHAT_CLIENT_SECRET,
    orgId: process.env.SATUSEHAT_ORG_ID || "10000004",
    serviceProviderId:
      process.env.SATUSEHAT_SERVICE_PROVIDER_ID ||
      process.env.SATUSEHAT_ORG_ID ||
      "10000004",
  },
  mockMode: String(process.env.MOCK_MODE || "true").toLowerCase() === "true",
};

function validateConfig() {
  const required = [
    ["SATUSEHAT_AUTH_URL", config.satusehat.authUrl],
    ["SATUSEHAT_FHIR_URL", config.satusehat.fhirUrl],
    ["SATUSEHAT_CLIENT_ID", config.satusehat.clientId],
    ["SATUSEHAT_CLIENT_SECRET", config.satusehat.clientSecret],
    ["SATUSEHAT_ORG_ID", config.satusehat.orgId],
  ];

  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  if (!config.mockMode && missing.length > 0) {
    throw new Error(`Konfigurasi belum lengkap: ${missing.join(", ")}`);
  }
}

module.exports = { config, validateConfig };
