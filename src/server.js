const express = require("express");
const { config, validateConfig } = require("./config");
const {
  getAccessToken,
  findPatientByNik,
  findPractitionerByNik,
  buildLocationPayload,
  createLocation,
  buildEncounterPayload,
  createEncounter,
  runRegistrationFlow,
} = require("./satusehatClient");

validateConfig();

const app = express();
app.use(express.json());

function toErrorResponse(error) {
  const status = error.status || 500;
  return {
    status,
    error:
      status === 401
        ? "Token tidak valid atau kedaluwarsa"
        : error.message || "Terjadi kesalahan",
    detail: error.body || undefined,
  };
}

app.get("/", (req, res) => {
  res.json({
    app: "SATUSEHAT Pendaftaran Pasien",
    mode: config.mockMode ? "mock" : "real",
    endpoints: [
      "GET /auth/token",
      "GET /master/patient/:nik",
      "GET /master/practitioner/:nik",
      "POST /locations",
      "POST /encounters",
      "POST /registration-flow",
    ],
  });
});

app.get("/auth/token", async (req, res, next) => {
  try {
    res.json(await getAccessToken());
  } catch (error) {
    next(error);
  }
});

app.get("/master/patient/:nik", async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") || (await getAccessToken()).access_token;
    res.json(await findPatientByNik(token, req.params.nik));
  } catch (error) {
    next(error);
  }
});

app.get("/master/practitioner/:nik", async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") || (await getAccessToken()).access_token;
    res.json(await findPractitionerByNik(token, req.params.nik));
  } catch (error) {
    next(error);
  }
});

app.post("/locations", async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") || (await getAccessToken()).access_token;
    const payload = buildLocationPayload({
      orgId: config.satusehat.orgId,
      name: req.body.name || "Ruang Poli Umum",
    });
    res.status(201).json(await createLocation(token, payload));
  } catch (error) {
    next(error);
  }
});

app.post("/encounters", async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") || (await getAccessToken()).access_token;
    const payload = buildEncounterPayload({
      orgId: config.satusehat.orgId,
      serviceProviderId: req.body.service_provider_id || config.satusehat.serviceProviderId,
      patientId: req.body.patient_id,
      practitionerId: req.body.practitioner_id,
      locationId: req.body.location_id,
      timestamp: req.body.timestamp || new Date().toISOString(),
    });
    res.status(201).json(await createEncounter(token, payload));
  } catch (error) {
    next(error);
  }
});

app.post("/registration-flow", async (req, res, next) => {
  try {
    const result = await runRegistrationFlow(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  const response = toErrorResponse(error);
  res.status(response.status).json(response);
});

app.listen(config.port, () => {
  console.log(`Server berjalan di http://localhost:${config.port}`);
  console.log(`Mode: ${config.mockMode ? "mock" : "real"}`);
});
