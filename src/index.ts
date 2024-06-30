import { AutoRouter, cors, error, IRequest, json } from 'itty-router';
import { nanoid } from 'nanoid';
import { LogServerPUTDumpResponse, LogServerResponse } from '~types/api';

const response = <T>(data: LogServerResponse<T>, init?: ResponseInit) => {
	if (data.status !== 200) {
		const { status, ...rest } = data;
		return error(status, rest);
	}
	return json(data, init);
};

type Application = {
	name: string;
	prefix: string;
};

const verifyRequest = async (request: Request & IRequest, env: Env): Promise<Response | undefined> => {
	const header = request.headers.get('Authorization');
	if (!header || header.substring(0, 6) !== 'Bearer') {
		return response({
			status: 403,
			code: 'auth_error',
			message: 'Must specify Bearer token.',
		});
	}

	const token = header.substring(6).trim();
	const application = await env.TOKENS.get<Application>(token, 'json');

	if (!application) {
		return response({
			status: 403,
			code: 'auth_error',
			message: 'Invalid Bearer token.',
		});
	}

	request.application = application;
};

type VerifiedRequest = Request & IRequest & { application: Application };

const { preflight, corsify } = cors();
const router = AutoRouter<VerifiedRequest, [Env]>({
	before: [preflight, verifyRequest],
	finally: [corsify],
});

router.put('/dump', async (request, env) => {
	const correlation = request.application.prefix + '_' + nanoid(6);
	await env.LOGS.put(correlation, request.body);
	return response<LogServerPUTDumpResponse>({
		status: 200,
		correlation,
	});
});

export default { ...router };
