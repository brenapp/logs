import { EmailMessage } from 'cloudflare:email';
import { createMimeMessage } from 'mimetext/browser';
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
	const correlation = request.application.prefix + '/' + nanoid(6);
	await env.LOGS.put(correlation, request.body);

	let frontmatter = '';
	try {
		frontmatter = Object.entries(JSON.parse(request.headers.get('X-Log-Server-Frontmatter') ?? '{}'))
			.map(([key, value]) => `${key}: ${value}`)
			.join('\n');
	} catch (e) {}

	const message = createMimeMessage();
	message.setSender({ name: 'Issue Reporting', addr: 'issue-reporting@referee.fyi' });
	message.setRecipient('brendan@bren.app');
	message.setSubject(`Issue Report - ${request.application.name} - ${correlation}`);
	message.addMessage({
		contentType: 'text/plain',
		data: `An issue has been reported for ${request.application.name} with Correlation ID '${correlation}'\n\n${frontmatter}`,
	});

	const email = new EmailMessage('issue-reporting@referee.fyi', 'brendan@bren.app', message.asRaw());

	try {
		await env.EMAIL.send(email);
	} catch (e) {
		console.log(e);
	}

	return response<LogServerPUTDumpResponse>({
		status: 200,
		correlation,
	});
});

export default { ...router };
