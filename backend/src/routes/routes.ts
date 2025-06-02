// Updated routes/routes.ts - Remove DM routes to avoid conflicts

import { FastifyInstance } from "fastify"
import postRoutes from "./posts.js";
// Remove dmRoutes import since we're registering it directly in app.ts
// import dmRoutes from "./message.js";

async function DBRoutes(app: FastifyInstance, _options = {}) {
	if (!app) {
		throw new Error("Fastify instance has no value during routes construction");
	}

	// Only register post routes here
	await postRoutes(app);

	// Don't register DM routes here since they're registered directly in app.ts
	// This prevents double registration which can cause conflicts
}

export default DBRoutes;