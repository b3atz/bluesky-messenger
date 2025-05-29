
import Fastify from "fastify";
import cors from '@fastify/cors'
import { FastifyMikroOrmPlugin } from "./plugins/mikro.js";
import DBRoutes from "./routes/routes.js";
import config from "./mikro-orm.config.js";
import blueskyAuthRoutes from "./routes/blueskyAuthRoutes.js";

const envToLogger = {
	development: {
		transport: {
			target: 'pino-pretty',
			options: {
				translateTime: 'HH:MM:ss Z',
				ignore: 'pid,hostname',
			},
		},
		level: "debug",
	},
	production: {
		level: "error"
	},
	test: {
		transport: {
			target: 'pino-pretty',
			options: {
				translateTime: 'HH:MM:ss Z',
				ignore: 'pid,hostname',
			},
		},
		level: "warn"
	},
};

const app = Fastify({
	logger: envToLogger[process.env.NODE_ENV]
});

await app.register(cors, {
	origin: (origin,cb) => {
		cb(null, true);
	}
});

await app.register(blueskyAuthRoutes);
await app.register(FastifyMikroOrmPlugin, config);
await app.register(DBRoutes, {});

export default app;