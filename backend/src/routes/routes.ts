import { FastifyInstance } from "fastify"
import postRoutes from "./posts.js";

async function DBRoutes(app: FastifyInstance, _options = {}) {
	if (!app) {
		throw new Error("Fastify instance has no value during routes construction");
	}
    postRoutes(app)
}
export default DBRoutes;