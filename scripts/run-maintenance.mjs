// Appelle la maintenance depuis un planificateur. Code de sortie : 0 succès ou passage déjà en cours,
// 1 échec à signaler. Le jeton vient de l'environnement, jamais de la ligne de commande.
const checkOnly = process.argv.includes("--status");
const url = checkOnly ? `${process.env.MAINTENANCE_URL}/status` : process.env.MAINTENANCE_URL;
const token = process.env.MAINTENANCE_TOKEN;
const ATTEMPTS = 3;

async function main() {
  if (!process.env.MAINTENANCE_URL || !token) {
    console.error("MAINTENANCE_URL et MAINTENANCE_TOKEN sont requis.");
    return 1;
  }

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const { status, body } = await call();
      console.log(JSON.stringify({ at: new Date().toISOString(), attempt, status, body }));

      if (status === 200 || status === 409) return 0;
      if (status === 404) return 1;
    } catch (error) {
      console.error(JSON.stringify({ at: new Date().toISOString(), attempt, error: error.name }));
    }

    if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
  }

  return 1;
}

async function call() {
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(120_000),
  });

  const body = await response.text();
  return { status: response.status, body: body.slice(0, 300) };
}

// process.exit() en plein fetch fait planter Node sous Windows : on laisse le processus se terminer.
process.exitCode = await main();
