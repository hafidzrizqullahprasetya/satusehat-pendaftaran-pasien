const { config } = require("./config");

const dummyIds = {
  token: "mock-access-token",
  patientId: "1000000000000001",
  practitionerId: "7209061211900001",
  locationId: "mock-location-ruang-poli-umum",
  encounterId: "mock-encounter-arrived",
};

let tokenCache = null;

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof body === "string" ? body : JSON.stringify(body);
    const error = new Error(`SATUSEHAT error ${response.status}: ${message}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

async function getAccessToken() {
  if (config.mockMode) {
    return { access_token: dummyIds.token, token_type: "Bearer", mock: true };
  }

  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.response;
  }

  const params = new URLSearchParams({
    client_id: config.satusehat.clientId,
    client_secret: config.satusehat.clientSecret,
  });

  const response = await requestJson(`${config.satusehat.authUrl}/accesstoken?grant_type=client_credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const expiresIn = Number(response.expires_in || 3600);
  tokenCache = {
    response,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return response;
}

async function findPatientByNik(token, nik) {
  if (config.mockMode) {
    return { id: dummyIds.patientId, nik, mock: true };
  }

  const url = `${config.satusehat.fhirUrl}/Patient?identifier=https://fhir.kemkes.go.id/id/nik|${nik}`;
  const bundle = await requestJson(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const patient = bundle.entry?.[0]?.resource;
  if (!patient?.id) {
    const error = new Error(`Pasien dengan NIK ${nik} tidak ditemukan`);
    error.status = 404;
    throw error;
  }

  return { id: patient.id, resource: patient };
}

async function findPractitionerByNik(token, nik) {
  if (config.mockMode) {
    return { id: dummyIds.practitionerId, nik, mock: true };
  }

  const url = `${config.satusehat.fhirUrl}/Practitioner?identifier=https://fhir.kemkes.go.id/id/nik|${nik}`;
  const bundle = await requestJson(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const practitioner = bundle.entry?.[0]?.resource;
  if (!practitioner?.id) {
    const error = new Error(`Dokter dengan NIK ${nik} tidak ditemukan`);
    error.status = 404;
    throw error;
  }

  return { id: practitioner.id, resource: practitioner };
}

function buildLocationPayload({ orgId, name = "Ruang Poli Umum" }) {
  return {
    resourceType: "Location",
    status: "active",
    name,
    description: name,
    mode: "instance",
    physicalType: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/location-physical-type",
          code: "ro",
          display: "Room",
        },
      ],
    },
    managingOrganization: {
      reference: `Organization/${orgId}`,
    },
  };
}

async function createLocation(token, payload) {
  if (config.mockMode) {
    return { id: dummyIds.locationId, status: "active", payload, mock: true };
  }

  const postLocation = (body) =>
    requestJson(`${config.satusehat.fhirUrl}/Location`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

  try {
    return await postLocation(payload);
  } catch (error) {
    const issueText = error.body?.issue?.[0]?.details?.text || "";
    if (error.status !== 400 || !issueText.includes("Found duplicate")) {
      throw error;
    }

    const suffix = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    return postLocation({
      ...payload,
      name: `${payload.name} ${suffix}`,
      description: `${payload.description} ${suffix}`,
    });
  }
}

function buildEncounterPayload({
  orgId,
  serviceProviderId,
  patientId,
  practitionerId,
  locationId,
  timestamp,
}) {
  return {
    resourceType: "Encounter",
    identifier: [
      {
        system: `http://sys-ids.kemkes.go.id/encounter/${orgId}`,
        value: `ENC-${Date.now()}`,
      },
    ],
    status: "arrived",
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: "AMB",
      display: "ambulatory",
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
    participant: [
      {
        individual: {
          reference: `Practitioner/${practitionerId}`,
        },
      },
    ],
    period: {
      start: timestamp,
    },
    location: [
      {
        location: {
          reference: `Location/${locationId}`,
        },
      },
    ],
    statusHistory: [
      {
        status: "arrived",
        period: {
          start: timestamp,
        },
      },
    ],
    serviceProvider: {
      reference: `Organization/${serviceProviderId || orgId}`,
    },
  };
}

async function createEncounter(token, payload) {
  if (config.mockMode) {
    return { id: dummyIds.encounterId, status: "arrived", payload, mock: true };
  }

  return requestJson(`${config.satusehat.fhirUrl}/Encounter`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function runRegistrationFlow({
  patientNik = "1000000000000001",
  practitionerNik = "7209061211900001",
  locationName = "Ruang Poli Umum",
  serviceProviderId = config.satusehat.serviceProviderId,
} = {}) {
  const tokenResponse = await getAccessToken();
  const token = tokenResponse.access_token;
  const patient = await findPatientByNik(token, patientNik);
  const practitioner = await findPractitionerByNik(token, practitionerNik);
  const locationPayload = buildLocationPayload({
    orgId: config.satusehat.orgId,
    name: locationName,
  });
  const location = await createLocation(token, locationPayload);
  const timestamp = new Date().toISOString();
  const encounterPayload = buildEncounterPayload({
    orgId: config.satusehat.orgId,
    serviceProviderId,
    patientId: patient.id,
    practitionerId: practitioner.id,
    locationId: location.id,
    timestamp,
  });
  const encounter = await createEncounter(token, encounterPayload);

  return {
    mode: config.mockMode ? "mock" : "real",
    patient_id: patient.id,
    practitioner_id: practitioner.id,
    location_id: location.id,
    service_provider_id: serviceProviderId,
    encounter_id: encounter.id,
    timestamp,
    encounter,
  };
}

module.exports = {
  getAccessToken,
  findPatientByNik,
  findPractitionerByNik,
  buildLocationPayload,
  createLocation,
  buildEncounterPayload,
  createEncounter,
  runRegistrationFlow,
};
